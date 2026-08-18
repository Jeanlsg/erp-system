// ============================================================================
// Edge Function: erp-danfe
// Gera o DANFE de uma nota que não o tem arquivado.
//
// Body: { nota_id: string }
//
// Notas emitidas depois da fase 2 já guardam o PDF no bucket `fiscal` na
// própria emissão — este caminho é para as anteriores, que têm o XML
// assinado mas nunca ganharam DANFE. O sped-da renderiza a partir do XML,
// sem certificado; o resultado é gravado no bucket para as próximas vezes
// saírem do storage, não do serviço.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { erro: "método não suportado" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { db: { schema: "erp" } });
  const adminPublic = createClient(url, serviceKey);

  try {
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json(401, { erro: "não autenticado" });
    if (jwt !== serviceKey) {
      const { data: userData, error: userErr } = await adminPublic.auth.getUser(jwt);
      if (userErr || !userData?.user) return json(401, { erro: "não autenticado" });
      const { data: u } = await admin
        .from("erp_usuarios").select("ativo").eq("id", userData.user.id).maybeSingle();
      if (!u?.ativo) return json(403, { erro: "usuário sem acesso ao ERP" });
    }

    const { nota_id } = await req.json();
    if (!nota_id) return json(422, { erro: "nota_id é obrigatório" });

    const { data: nota } = await admin
      .from("erp_notas_fiscais")
      .select("id, numero, serie, tipo, status, loja_id, danfe_path, xml_assinado, xml_gerado")
      .eq("id", nota_id).maybeSingle();
    if (!nota) return json(422, { erro: "nota não encontrada" });

    // Já existe arquivado? Devolve o caminho e pronto.
    if (nota.danfe_path) {
      return json(200, { ok: true, danfe_path: nota.danfe_path, gerado_agora: false });
    }

    const xml = nota.xml_assinado ?? nota.xml_gerado;
    if (!xml) {
      return json(422, {
        erro: "nota sem XML armazenado — o DANFE é desenhado a partir do XML, e sem ele não há o que renderizar",
      });
    }

    const { data: integ } = await adminPublic
      .from("integrations").select("config").eq("provider", "nfe_service").single();
    if (!integ?.config?.url || !integ?.config?.token) {
      return json(500, { erro: "integração nfe_service não configurada" });
    }

    const resp = await fetch(`${integ.config.url}/v1/danfe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${integ.config.token}`,
      },
      body: JSON.stringify({
        xml_base64: btoa(unescape(encodeURIComponent(xml))),
        modelo: nota.tipo === "nfce" ? 65 : 55,
      }),
    });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok || !dados?.danfe_pdf_base64) {
      return json(422, { erro: "falha ao renderizar o DANFE", detalhe: dados?.erro ?? dados?.detalhe ?? null });
    }

    const pdf = Uint8Array.from(atob(dados.danfe_pdf_base64), (c) => c.charCodeAt(0));
    const caminho = `${nota.loja_id}/danfe/${nota.tipo}_${nota.serie}_${nota.numero}.pdf`;

    // Grava para as próximas vezes; se a gravação falhar, ainda devolve o PDF.
    const { error: upErr } = await adminPublic.storage
      .from("fiscal").upload(caminho, pdf, { contentType: "application/pdf", upsert: true });
    if (!upErr) {
      await admin.from("erp_notas_fiscais").update({ danfe_path: caminho }).eq("id", nota.id);
    }

    return json(200, {
      ok: true,
      danfe_path: upErr ? null : caminho,
      pdf_base64: dados.danfe_pdf_base64,
      gerado_agora: true,
    });
  } catch (err) {
    console.error("erp-danfe:", err);
    return json(500, { erro: err instanceof Error ? err.message : "erro interno" });
  }
});

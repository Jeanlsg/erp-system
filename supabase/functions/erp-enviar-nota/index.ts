// ============================================================================
// Edge Function: erp-enviar-nota
// Envia XML + DANFE da nota ao cliente.
//
// Body: { nota_id, canal?: 'email'|'whatsapp', destino?: string, automatico?: boolean }
//   - sem destino: usa o e-mail/celular do cliente da venda
//   - automatico: marcado quando chamado pela emissão (para o log distinguir)
//
// Canais:
//   email    → Resend (public.integrations provider 'resend') — pronto
//   whatsapp → Uazapi (provider 'nota_whatsapp': {url, token}) — envia como
//              documento quando o canal estiver configurado e conectado
//
// Em HOMOLOGAÇÃO o assunto grita "SEM VALOR FISCAL": nota de teste chegando
// limpa na caixa de um cliente real é confusão certa.
// Todo envio (sucesso ou falha) vira linha em erp_nota_envios.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function b64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(bin);
}

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
      const { data: u } = await adminPublic.auth.getUser(jwt);
      if (!u?.user) return json(401, { erro: "não autenticado" });
      const { data: eu } = await admin
        .from("erp_usuarios").select("role, ativo").eq("id", u.user.id).maybeSingle();
      if (!eu?.ativo || !["admin", "gerente"].includes(eu.role)) {
        return json(403, { erro: "requer admin/gerente" });
      }
    }

    const { nota_id, canal = "email", destino, automatico = false } = await req.json();
    if (!nota_id) return json(422, { erro: "nota_id é obrigatório" });
    if (!["email", "whatsapp"].includes(canal)) return json(422, { erro: "canal deve ser email ou whatsapp" });

    const { data: nota } = await admin
      .from("erp_notas_fiscais")
      .select("id, numero, serie, tipo, status, ambiente, chave_acesso, valor_total, danfe_path, xml_assinado, xml_gerado, loja_id, venda_id, consumidor_email, venda:erp_vendas(cliente:erp_pessoas(nome_razao, email, celular, telefone))")
      .eq("id", nota_id).maybeSingle();
    if (!nota) return json(422, { erro: "nota não encontrada" });
    if (nota.status !== "autorizada") {
      return json(422, { erro: `nota com status "${nota.status}" — só nota autorizada vai ao cliente` });
    }

    const cliente = (nota.venda as any)?.cliente;
    const registrar = (sucesso: boolean, dest: string, detalhe?: string) =>
      admin.from("erp_nota_envios").insert({
        nota_id: nota.id, canal, destino: dest, sucesso, detalhe: detalhe ?? null, automatico,
      });

    // ---- anexos: XML sempre; DANFE do bucket ou gerado na hora ----
    const xml = nota.xml_assinado ?? nota.xml_gerado;
    if (!xml) return json(422, { erro: "nota sem XML armazenado" });
    const rotulo = nota.tipo === "nfce" ? "NFCe" : "NFe";
    const nomeBase = `${rotulo}_${nota.serie}_${nota.numero}`;

    let pdfB64: string | null = null;
    if (nota.danfe_path) {
      const { data: arq } = await adminPublic.storage.from("fiscal").download(nota.danfe_path);
      if (arq) pdfB64 = b64(new Uint8Array(await arq.arrayBuffer()));
    }
    if (!pdfB64) {
      // gera sob demanda pelo mesmo caminho do botão de DANFE
      const r = await fetch(`${url}/functions/v1/erp-danfe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ nota_id: nota.id }),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.pdf_base64) pdfB64 = d.pdf_base64;
      else if (d?.danfe_path) {
        const { data: arq } = await adminPublic.storage.from("fiscal").download(d.danfe_path);
        if (arq) pdfB64 = b64(new Uint8Array(await arq.arrayBuffer()));
      }
    }

    const homolog = nota.ambiente !== "producao";
    const assunto = `${homolog ? "[TESTE - SEM VALOR FISCAL] " : ""}Nota fiscal ${nota.numero} — X-Life Suplementos`;

    // ================= E-MAIL (Resend) =================
    if (canal === "email") {
      const para = String(destino ?? nota.consumidor_email ?? cliente?.email ?? "").trim();
      if (!para || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(para)) {
        await registrar(false, para || "(vazio)", "cliente sem e-mail válido");
        return json(422, { erro: "cliente sem e-mail válido — informe um destino" });
      }

      const { data: integ } = await adminPublic
        .from("integrations").select("config").eq("provider", "resend").maybeSingle();
      if (!integ?.config?.api_key) return json(500, { erro: "integração resend não configurada" });

      const corpo = `Olá${cliente?.nome_razao ? `, ${cliente.nome_razao}` : ""}!

Segue em anexo a sua nota fiscal ${nota.numero} (série ${nota.serie}), no valor de R$ ${Number(nota.valor_total).toFixed(2).replace(".", ",")}.
${homolog ? "\nATENÇÃO: esta é uma nota de TESTE emitida em ambiente de homologação — SEM VALOR FISCAL.\n" : ""}
O XML anexo é o documento fiscal; o PDF (DANFE) é a representação para consulta e impressão.
Chave de acesso: ${nota.chave_acesso ?? "—"}

X-Life Suplementos`;

      const anexos: any[] = [
        { filename: `${nomeBase}.xml`, content: btoa(unescape(encodeURIComponent(xml))) },
      ];
      if (pdfB64) anexos.push({ filename: `${nomeBase}.pdf`, content: pdfB64 });

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${integ.config.api_key}`,
        },
        body: JSON.stringify({
          from: integ.config.de ?? "noreply@lojaxlife.com.br",
          to: [para],
          subject: assunto,
          text: corpo,
          attachments: anexos,
        }),
      });
      const dados = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        await registrar(false, para, `Resend HTTP ${resp.status}: ${JSON.stringify(dados).slice(0, 300)}`);
        return json(502, { erro: "falha no envio do e-mail", detalhe: dados });
      }
      await registrar(true, para, `resend id ${dados?.id ?? "?"}${pdfB64 ? "" : " (sem DANFE — só XML)"}`);
      return json(200, { ok: true, canal, destino: para, com_danfe: !!pdfB64 });
    }

    // ================= WHATSAPP (Uazapi) =================
    const { data: wpp } = await adminPublic
      .from("integrations").select("config").eq("provider", "nota_whatsapp").maybeSingle();
    if (!wpp?.config?.url || !wpp?.config?.token) {
      await registrar(false, destino ?? "(sem canal)", "canal de WhatsApp não configurado (provider nota_whatsapp)");
      return json(422, {
        erro: "canal de WhatsApp não configurado — cadastre provider 'nota_whatsapp' {url, token} em integrations",
      });
    }
    const tel = String(destino ?? cliente?.celular ?? cliente?.telefone ?? "").replace(/\D/g, "");
    if (tel.length < 10) {
      await registrar(false, tel || "(vazio)", "cliente sem celular válido");
      return json(422, { erro: "cliente sem celular válido — informe um destino" });
    }
    const numero = tel.length <= 11 ? `55${tel}` : tel;
    if (!pdfB64) {
      await registrar(false, numero, "sem DANFE para anexar");
      return json(422, { erro: "não foi possível obter o DANFE para enviar" });
    }
    const resp = await fetch(`${String(wpp.config.url).replace(/\/$/, "")}/send/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: wpp.config.token },
      body: JSON.stringify({
        number: numero,
        type: "document",
        file: `data:application/pdf;base64,${pdfB64}`,
        docName: `${nomeBase}.pdf`,
        text: assunto,
      }),
    });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      await registrar(false, numero, `uazapi HTTP ${resp.status}: ${JSON.stringify(dados).slice(0, 300)}`);
      return json(502, { erro: "falha no envio pelo WhatsApp", detalhe: dados });
    }
    await registrar(true, numero, "documento enviado");
    return json(200, { ok: true, canal, destino: numero });
  } catch (err) {
    console.error("erp-enviar-nota:", err);
    return json(500, { erro: err instanceof Error ? err.message : "erro interno" });
  }
});

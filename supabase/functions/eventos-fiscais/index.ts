// ============================================================================
// Edge Function: eventos-fiscais
//
// Eventos da NF-e/NFC-e que não são emissão:
//   acao='cancelar'   → cancela a nota na SEFAZ (prazo legal: 24h para NF-e)
//   acao='cce'        → carta de correção (não corrige valor, imposto nem
//                       destinatário — só dados acessórios)
//   acao='inutilizar' → inutiliza faixa de numeração que não foi usada
//                       (obrigação de quem consumiu número sem emitir nota)
//
// Todo evento fica registrado em erp_nfe_eventos / erp_inutilizacoes, mesmo
// quando a SEFAZ recusa — o rastro é a razão de existir desta função.
//
// Credenciais do serviço: public.integrations (provider = 'nfe_service').
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { erro: "método não suportado" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { db: { schema: "erp" } },
  );
  const adminPublic = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ---------------- Autenticação ----------------
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await adminPublic.auth.getUser(jwt);
    if (userErr || !userData?.user) return json(401, { erro: "não autenticado" });

    const { data: erpUser } = await admin
      .from("erp_usuarios").select("id, role, ativo").eq("id", userData.user.id).maybeSingle();
    if (!erpUser?.ativo) return json(403, { erro: "usuário sem acesso ao ERP" });
    if (!["admin", "gerente"].includes(erpUser.role)) {
      return json(403, { erro: "sem permissão para eventos fiscais (requer admin/gerente)" });
    }

    const body = await req.json();
    const acao = body?.acao;
    if (!["cancelar", "cce", "inutilizar"].includes(acao)) {
      return json(422, { erro: "acao deve ser 'cancelar', 'cce' ou 'inutilizar'" });
    }

    // ---------------- Loja + certificado + SEFAZ ----------------
    // Em cancelar/cce a loja vem da nota; em inutilizar vem do corpo.
    let nota: any = null;
    let loja_id: string = body?.loja_id;

    if (acao !== "inutilizar") {
      if (!body?.nota_id) return json(422, { erro: "nota_id é obrigatório" });
      const { data: n } = await admin
        .from("erp_notas_fiscais").select("*").eq("id", body.nota_id).maybeSingle();
      if (!n) return json(422, { erro: "nota não encontrada" });
      if (n.status !== "autorizada") {
        return json(422, { erro: `nota com status "${n.status}" — só nota autorizada aceita evento` });
      }
      if (!n.chave_acesso) return json(422, { erro: "nota sem chave de acesso" });
      nota = n;
      loja_id = n.loja_id;
    }
    if (!loja_id) return json(422, { erro: "loja_id é obrigatório" });

    const { data: loja } = await admin.from("erp_lojas").select("*").eq("id", loja_id).single();
    if (!loja) return json(422, { erro: "loja não encontrada" });

    const { data: sefaz } = await admin
      .from("erp_configuracoes_sefaz").select("*").eq("loja_id", loja_id).maybeSingle();
    if (!sefaz) return json(422, { erro: "configuração SEFAZ da loja ausente" });

    const { data: cert } = await admin
      .from("erp_certificados_digitais").select("*")
      .eq("loja_id", loja_id).eq("ativo", true)
      .order("data_validade", { ascending: false }).limit(1).maybeSingle();
    if (!cert) return json(422, { erro: "certificado digital A1 ativo não encontrado" });

    const { data: pfxFile, error: pfxErr } = await adminPublic.storage
      .from("certificados").download(cert.arquivo_path);
    if (pfxErr || !pfxFile) return json(422, { erro: `falha ao baixar certificado: ${pfxErr?.message}` });
    const pfxB64 = btoa(String.fromCharCode(...new Uint8Array(await pfxFile.arrayBuffer())));

    let senha = cert.senha_armazenada ?? "";
    if (cert.senha_armazenada_cripto) {
      const { data: senhaDec, error: decErr } = await admin
        .rpc("descriptografar_senha_cert", { crypto_data: cert.senha_armazenada_cripto });
      if (decErr) return json(422, { erro: `falha ao decriptar senha do certificado: ${decErr.message}` });
      senha = senhaDec;
    }
    if (!senha) return json(422, { erro: "certificado sem senha armazenada" });

    const { data: integ } = await adminPublic
      .from("integrations").select("config").eq("provider", "nfe_service").single();
    if (!integ?.config?.url || !integ?.config?.token) {
      return json(500, { erro: "integração nfe_service não configurada" });
    }

    const base = {
      ambiente: sefaz.ambiente === "producao" ? 1 : 2,
      certificado: { pfx_base64: pfxB64, senha },
      emitente: {
        cnpj: loja.cnpj, razao: loja.nome, ie: loja.inscricao_estadual, uf: loja.uf,
        endereco: { codigo_municipio: loja.codigo_municipio_ibge },
      },
    };

    async function chamar(rota: string, payload: unknown) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), (sefaz.timeout_segundos ?? 30) * 1000);
      try {
        const resp = await fetch(`${integ!.config.url}${rota}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${integ!.config.token}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        return { ok: resp.ok, data: await resp.json() };
      } finally {
        clearTimeout(timeout);
      }
    }

    // ---------------- CANCELAMENTO ----------------
    if (acao === "cancelar") {
      const justificativa = String(body?.justificativa ?? "").trim();
      if (justificativa.length < 15) {
        return json(422, { erro: "justificativa deve ter no mínimo 15 caracteres (exigência da SEFAZ)" });
      }
      if (!nota.protocolo) return json(422, { erro: "nota sem protocolo de autorização" });

      const { ok, data } = await chamar("/v1/nfe/cancelar", {
        ...base,
        nota: { modelo: nota.tipo === "nfce" ? 65 : 55 },
        chave: nota.chave_acesso,
        protocolo: nota.protocolo,
        justificativa,
      });

      const aceito = ok && data?.cancelada === true;
      await admin.from("erp_nfe_eventos").insert({
        nota_id: nota.id, loja_id, tipo: "cancelamento", justificativa,
        aceito, cstat: data?.cstat ?? null, motivo: data?.motivo ?? data?.erro ?? null,
        protocolo: data?.protocolo ?? null, ambiente: sefaz.ambiente,
        usuario_id: erpUser.id,
      });

      if (!aceito) {
        return json(422, { erro: "SEFAZ não aceitou o cancelamento", detalhe: data });
      }

      const { error: updErr } = await admin.from("erp_notas_fiscais").update({
        status: "cancelada",
        data_cancelamento: new Date().toISOString(),
        motivo_cancelamento: justificativa,
      }).eq("id", nota.id);
      if (updErr) console.error(`nota cancelada na SEFAZ mas falhou ao atualizar: ${updErr.message}`);

      return json(200, { cancelada: true, cstat: data.cstat, motivo: data.motivo, protocolo: data.protocolo });
    }

    // ---------------- CARTA DE CORREÇÃO ----------------
    if (acao === "cce") {
      const correcao = String(body?.correcao ?? "").trim();
      if (correcao.length < 15) {
        return json(422, { erro: "correção deve ter no mínimo 15 caracteres (exigência da SEFAZ)" });
      }
      if (nota.status === "cancelada") return json(422, { erro: "nota cancelada não aceita carta de correção" });

      // Sequência: a SEFAZ numera as CC-e da mesma nota (até 20)
      const { data: anteriores } = await admin
        .from("erp_nfe_eventos").select("sequencia")
        .eq("nota_id", nota.id).eq("tipo", "carta_correcao").eq("aceito", true)
        .order("sequencia", { ascending: false }).limit(1);
      const sequencia = (anteriores?.[0]?.sequencia ?? 0) + 1;
      if (sequencia > 20) return json(422, { erro: "limite de 20 cartas de correção por nota atingido" });

      const { ok, data } = await chamar("/v1/nfe/cce", {
        ...base,
        nota: { modelo: nota.tipo === "nfce" ? 65 : 55 },
        chave: nota.chave_acesso,
        correcao,
        sequencia,
      });

      const aceito = ok && data?.registrada === true;
      await admin.from("erp_nfe_eventos").insert({
        nota_id: nota.id, loja_id, tipo: "carta_correcao", sequencia,
        justificativa: correcao, aceito,
        cstat: data?.cstat ?? null, motivo: data?.motivo ?? data?.erro ?? null,
        protocolo: data?.protocolo ?? null, ambiente: sefaz.ambiente,
        usuario_id: erpUser.id,
      });

      if (!aceito) return json(422, { erro: "SEFAZ não registrou a carta de correção", detalhe: data });
      return json(200, { registrada: true, sequencia, cstat: data.cstat, motivo: data.motivo, protocolo: data.protocolo });
    }

    // ---------------- INUTILIZAÇÃO ----------------
    const modelo = Number(body?.modelo ?? 55);
    const serie = Number(body?.serie ?? (modelo === 65 ? sefaz.serie_nfce : sefaz.serie_nfe) ?? 1);
    const numero_inicial = Number(body?.numero_inicial);
    const numero_final = Number(body?.numero_final);
    const justificativa = String(body?.justificativa ?? "").trim();

    if (!Number.isInteger(numero_inicial) || !Number.isInteger(numero_final) || numero_inicial < 1) {
      return json(422, { erro: "numero_inicial e numero_final devem ser inteiros válidos" });
    }
    if (numero_final < numero_inicial) {
      return json(422, { erro: "numero_final não pode ser menor que numero_inicial" });
    }
    if (justificativa.length < 15) {
      return json(422, { erro: "justificativa deve ter no mínimo 15 caracteres (exigência da SEFAZ)" });
    }

    // Número já usado por nota emitida não pode ser inutilizado
    const { data: emUso } = await admin
      .from("erp_notas_fiscais").select("numero, status")
      .eq("loja_id", loja_id).eq("tipo", modelo === 65 ? "nfce" : "nfe")
      .eq("serie", serie)
      .gte("numero", numero_inicial).lte("numero", numero_final)
      .in("status", ["autorizada", "cancelada"]);
    if (emUso && emUso.length > 0) {
      return json(422, {
        erro: "a faixa contém notas autorizadas/canceladas — só é possível inutilizar números não usados",
        numeros: emUso.map((n: any) => n.numero),
      });
    }

    const { ok, data } = await chamar("/v1/nfe/inutilizar", {
      ...base,
      nota: { modelo },
      serie, numero_inicial, numero_final, justificativa,
    });

    const inutilizada = ok && data?.inutilizada === true;
    await admin.from("erp_inutilizacoes").insert({
      loja_id, modelo, serie, numero_inicial, numero_final, justificativa,
      inutilizada, cstat: data?.cstat ?? null, motivo: data?.motivo ?? data?.erro ?? null,
      ambiente: sefaz.ambiente, usuario_id: erpUser.id,
    });

    if (!inutilizada) return json(422, { erro: "SEFAZ não aceitou a inutilização", detalhe: data });
    return json(200, { inutilizada: true, cstat: data.cstat, motivo: data.motivo, serie, numero_inicial, numero_final });
  } catch (e) {
    return json(500, { erro: (e as Error).message });
  }
});

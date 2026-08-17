// ============================================================================
// Edge Function: erp-consultar-cadastro
// Lê no cadastro da SEFAZ os dados do próprio CNPJ da loja — IE, razão
// social, situação, CNAE, regime e endereço — usando o certificado dela.
//
// Body: { loja_id, aplicar?: boolean }
//   aplicar: true grava o que veio no cadastro da loja.
//
// Por que isto importa mais do que parece: o endereço da loja é o endereço do
// EMITENTE em toda NF-e e NFC-e. Digitado à mão ele diverge do cadastro da
// SEFAZ em silêncio, e a divergência só aparece quando a nota é recusada — ou,
// pior, quando não é e o documento sai com endereço errado.
//
// O endpoint já existia no nfe-service e nunca tinha sido ligado ao ERP.
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
        .from("erp_usuarios").select("role, ativo").eq("id", userData.user.id).maybeSingle();
      if (!u?.ativo) return json(403, { erro: "usuário sem acesso ao ERP" });
      // Mexer no cadastro do emitente muda o que sai em toda nota fiscal.
      if (u.role !== "admin") return json(403, { erro: "apenas admin pode sincronizar o cadastro" });
    }

    const { loja_id, aplicar } = await req.json();
    if (!loja_id) return json(422, { erro: "loja_id é obrigatório" });

    const { data: loja } = await admin.from("erp_lojas").select("*").eq("id", loja_id).maybeSingle();
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
    const bytes = new Uint8Array(await pfxFile.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const pfxB64 = btoa(bin);

    let senha = cert.senha_armazenada ?? "";
    if (cert.senha_armazenada_cripto) {
      const { data: senhaDec, error: decErr } = await admin
        .rpc("descriptografar_senha_cert", { crypto_data: cert.senha_armazenada_cripto });
      if (decErr) return json(422, { erro: `falha ao decriptar a senha: ${decErr.message}` });
      senha = senhaDec;
    }
    if (!senha) return json(422, { erro: "certificado sem senha armazenada" });

    const { data: integ } = await adminPublic
      .from("integrations").select("config").eq("provider", "nfe_service").single();
    if (!integ?.config?.url || !integ?.config?.token) {
      return json(500, { erro: "integração nfe_service não configurada" });
    }

    const resp = await fetch(`${integ.config.url}/v1/cadastro/consultar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${integ.config.token}` },
      body: JSON.stringify({
        ambiente: sefaz.ambiente === "producao" ? 1 : 2,
        certificado: { pfx_base64: pfxB64, senha },
        emitente: { cnpj: loja.cnpj, razao: loja.nome, uf: loja.uf },
        uf: loja.uf,
        cnpj: loja.cnpj,
      }),
    });
    const dados = await resp.json().catch(() => ({}));

    if (!dados?.encontrado) {
      return json(200, {
        ok: false,
        motivo: dados?.motivo ?? "cadastro não localizado",
        suportado: dados?.suportado !== false,
        cstat: dados?.cstat ?? null,
      });
    }

    // O que está no ERP versus o que a SEFAZ tem. Mostrar a diferença antes de
    // gravar: sincronizar às cegas o endereço do emitente é mudar documento
    // fiscal sem ninguém olhar.
    const end = dados.endereco ?? {};
    const divergencias: Record<string, { erp: unknown; sefaz: unknown }> = {};
    const cmp = (campo: string, atual: unknown, novo: unknown) => {
      const norm = (v: unknown) => String(v ?? "").replace(/[^\p{L}\p{N}]/gu, "").toUpperCase();
      if (novo && norm(atual) !== norm(novo)) divergencias[campo] = { erp: atual, sefaz: novo };
    };
    cmp("inscricao_estadual", loja.inscricao_estadual, dados.ie);
    cmp("nome", loja.nome, dados.razao_social);
    cmp("logradouro", loja.logradouro, end.logradouro);
    cmp("numero", loja.numero, end.numero);
    cmp("bairro", loja.bairro, end.bairro);
    cmp("cep", loja.cep, end.cep);
    cmp("cidade", loja.cidade, end.municipio);
    cmp("codigo_municipio_ibge", loja.codigo_municipio_ibge, end.codigo_municipio);

    let aplicado = false;
    if (aplicar === true && Object.keys(divergencias).length > 0) {
      const patch: Record<string, unknown> = {};
      if (dados.ie) patch.inscricao_estadual = dados.ie;
      if (end.logradouro) patch.logradouro = end.logradouro;
      if (end.numero) patch.numero = end.numero;
      if (end.complemento) patch.complemento = end.complemento;
      if (end.bairro) patch.bairro = end.bairro;
      if (end.cep) patch.cep = end.cep;
      if (end.municipio) patch.cidade = end.municipio;
      if (end.codigo_municipio) patch.codigo_municipio_ibge = end.codigo_municipio;
      // O nome fica de fora: o cadastro guarda o nome de uso da loja
      // ("X-life Suplementos Juazeiro"), não a razão social.
      const { error: errUpd } = await admin.from("erp_lojas").update(patch).eq("id", loja_id);
      if (errUpd) return json(500, { erro: `falha ao gravar: ${errUpd.message}` });
      aplicado = true;
    }

    return json(200, {
      ok: true,
      aplicado,
      ie: dados.ie,
      razao_social: dados.razao_social,
      habilitado: dados.habilitado,
      situacao: dados.situacao,
      cnae: dados.cnae,
      regime_tributario: dados.regime_tributario,
      endereco: end,
      divergencias,
    });
  } catch (err) {
    console.error("erp-consultar-cadastro:", err);
    return json(500, { erro: err instanceof Error ? err.message : "erro interno" });
  }
});

// ============================================================================
// Edge Function: erp-testar-certificado
//
// Valida um certificado digital A1 (.pfx / PKCS#12) e devolve os dados do
// titular. A validação REAL acontece no nfe-service (PHP/OpenSSL), que é quem
// tem a criptografia certa — a versão anterior tentava abrir um PKCS#12 como
// PKCS#8 via WebCrypto, o que sempre falhava e nunca conferia a senha.
//
// Body: { arquivo_base64: string, senha: string, arquivo_nome?: string }
// Resp: { success, valido, titular, cnpj, valido_de, valido_ate, motivo }
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
  if (req.method !== "POST") return json(405, { success: false, error: "método não suportado" });

  const adminPublic = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { db: { schema: "erp" } },
  );

  try {
    // Só usuário do ERP testa certificado (o .pfx é material sensível)
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await adminPublic.auth.getUser(jwt);
    if (userErr || !userData?.user) return json(401, { success: false, error: "não autenticado" });

    const { data: erpUser } = await admin
      .from("erp_usuarios").select("id, role, ativo").eq("id", userData.user.id).maybeSingle();
    if (!erpUser?.ativo) return json(403, { success: false, error: "usuário sem acesso ao ERP" });
    if (!["admin", "gerente"].includes(erpUser.role)) {
      return json(403, { success: false, error: "sem permissão (requer admin/gerente)" });
    }

    const { arquivo_base64, senha } = await req.json();
    if (!arquivo_base64 || senha === undefined || senha === null) {
      return json(422, { success: false, error: "arquivo_base64 e senha são obrigatórios" });
    }

    const { data: integ } = await adminPublic
      .from("integrations").select("config").eq("provider", "nfe_service").single();
    if (!integ?.config?.url || !integ?.config?.token) {
      return json(500, { success: false, error: "integração nfe_service não configurada" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    let resultado: any;
    try {
      const resp = await fetch(`${integ.config.url}/v1/certificado/validar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${integ.config.token}`,
        },
        body: JSON.stringify({ pfx_base64: arquivo_base64, senha: String(senha) }),
        signal: controller.signal,
      });
      resultado = await resp.json();
      if (!resp.ok) {
        return json(422, {
          success: false,
          error: resultado?.erro ?? `nfe-service HTTP ${resp.status}`,
        });
      }
    } catch (e) {
      return json(504, {
        success: false,
        error: `serviço de validação sem resposta: ${(e as Error).message}`,
      });
    } finally {
      clearTimeout(timeout);
    }

    // O serviço responde 200 mesmo para certificado inválido — o veredito
    // está em `valido`, para a tela distinguir "senha errada" de "fora do ar".
    return json(200, {
      success: true,
      valido: resultado.valido === true,
      expirado: resultado.expirado === true,
      motivo: resultado.motivo ?? null,
      titular: resultado.titular ?? null,
      cnpj: resultado.cnpj ?? null,
      valido_de: resultado.valido_de ?? null,
      valido_ate: resultado.valido_ate ?? null,
      detalhe: resultado.detalhe ?? null,
    });
  } catch (e) {
    return json(500, { success: false, error: (e as Error).message });
  }
});

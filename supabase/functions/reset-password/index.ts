// Edge Function: reset-password
// Envia email de redefinição de senha para um usuário (via Resend SMTP)
// APENAS admins podem chamar esta função
//
// Chamada via:
//   supabase.functions.invoke('reset-password', {
//     body: { user_id: 'uuid-do-usuario' }
//   })

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ResetPasswordPayload {
  user_id: string;
}

interface ResetPasswordResponse {
  success: boolean;
  email?: string;
  error?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Não autenticado" }, 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ success: false, error: "Token inválido" }, 401);
    }

    // 2. Verifica se caller é admin
    const { data: callerProfile } = await userClient
      .from("erp_usuarios")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (!callerProfile || callerProfile.role !== "admin") {
      return jsonResponse(
        { success: false, error: "Apenas administradores podem resetar senhas" },
        403
      );
    }

    // 3. Validação
    const body: ResetPasswordPayload = await req.json();
    if (!body.user_id) {
      return jsonResponse(
        { success: false, error: "user_id é obrigatório" },
        400
      );
    }

    // 4. Busca o email do usuário alvo
    const { data: targetUser } = await userClient
      .from("erp_usuarios")
      .select("email")
      .eq("id", body.user_id)
      .single();

    if (!targetUser?.email) {
      return jsonResponse(
        { success: false, error: "Usuário não encontrado" },
        404
      );
    }

    // 5. Envia email de redefinição (via Resend SMTP configurado no Supabase)
    const siteUrl =
      Deno.env.get("SITE_URL") || "http://localhost:3000";
    const { error: resetError } = await userClient.auth.resetPasswordForEmail(
      targetUser.email,
      {
        redirectTo: `${siteUrl}/auth/redefinir-senha`,
      }
    );

    if (resetError) {
      return jsonResponse(
        {
          success: false,
          error: `Erro ao enviar email: ${resetError.message}`,
        },
        500
      );
    }

    // 6. Reseta tentativas de login e desbloqueia (caso esteja bloqueado)
    await userClient
      .from("erp_usuarios")
      .update({ tentativas_login: 0, bloqueado: false })
      .eq("id", body.user_id);

    return jsonResponse(
      {
        success: true,
        email: targetUser.email,
      },
      200
    );
  } catch (err) {
    console.error("Erro inesperado:", err);
    return jsonResponse(
      {
        success: false,
        error: err instanceof Error ? err.message : "Erro interno do servidor",
      },
      500
    );
  }
});

function jsonResponse(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
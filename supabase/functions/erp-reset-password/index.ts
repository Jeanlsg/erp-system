// Edge Function: erp-reset-password
// Troca a senha de um usuário do ERP, ou envia o e-mail de redefinição.
// APENAS admins ativos podem chamar esta função
//
// Chamada via:
//   supabase.functions.invoke('erp-reset-password', {
//     body: {
//       user_id: 'uuid-do-usuario',
//       nova_senha?: string,     // define a senha na hora (mín. 6)
//       redirect_base?: string,  // sem nova_senha: origem do ERP para o link do e-mail
//     }
//   })
//
// Revisão de 10/10/2026: não havia como trocar uma senha esquecida — a tela
// prometia e-mail, e o link do e-mail usava SITE_URL (a do CRM) e caía na
// tela do CRM. Agora o admin define a senha nova, ou o link vem para o ERP.
// Também desbloqueia e zera as tentativas de login.

import { alvoDoErp, clienteAdmin, corsHeaders, exigirAdminAtivo, jsonResponse } from "../_shared/erp-admin.ts";

interface ResetPasswordPayload {
  user_id: string;
  nova_senha?: string;
  redirect_base?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = clienteAdmin();
    const chamador = await exigirAdminAtivo(req, admin, "trocar senhas");
    if (chamador instanceof Response) return chamador;

    const body: ResetPasswordPayload = await req.json();
    if (!body.user_id) return jsonResponse({ success: false, error: "user_id é obrigatório" }, 400);

    const alvo = await alvoDoErp(admin, chamador, body.user_id);
    if (alvo instanceof Response) return alvo;

    if (body.nova_senha !== undefined && body.nova_senha !== null && body.nova_senha !== "") {
      if (String(body.nova_senha).length < 6) {
        return jsonResponse({ success: false, error: "A senha deve ter pelo menos 6 caracteres" }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(alvo.id, { password: String(body.nova_senha) });
      if (error) return jsonResponse({ success: false, error: `Erro ao trocar a senha: ${error.message}` }, 500);
    } else {
      // O destino vem do próprio front do ERP: SITE_URL é a do CRM.
      const base = String(body.redirect_base ?? "").replace(/\/+$/, "");
      if (!/^https?:\/\//.test(base)) {
        return jsonResponse({ success: false, error: "redirect_base inválido" }, 400);
      }
      const { error } = await admin.auth.resetPasswordForEmail(alvo.email, { redirectTo: `${base}/auth/redefinir-senha` });
      if (error) return jsonResponse({ success: false, error: `Erro ao enviar e-mail: ${error.message}` }, 500);
    }

    await admin.from("erp_usuarios").update({ tentativas_login: 0, bloqueado: false }).eq("id", alvo.id);
    return jsonResponse({ success: true, email: alvo.email, senha_trocada: !!body.nova_senha }, 200);
  } catch (err) {
    console.error("Erro inesperado:", err);
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : "Erro interno do servidor" }, 500);
  }
});

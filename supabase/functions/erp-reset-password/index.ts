// Edge Function: erp-reset-password
// Troca a senha de um usuário do ERP, ou envia o e-mail de redefinição.
// APENAS admins ativos podem chamar esta função
//
// Chamada via:
//   supabase.functions.invoke('erp-reset-password', {
//     body: {
//       user_id: 'uuid-do-usuario',
//       nova_senha?: string,     // define a senha na hora (regra em _shared/erp-senha.ts)
//       forcar_troca_senha?: boolean, // com nova_senha: troca obrigatória no próximo acesso
//       redirect_base?: string,  // sem nova_senha: origem do ERP para o link do e-mail
//     }
//   })
//
// Revisão de 10/10/2026: não havia como trocar uma senha esquecida — a tela
// prometia e-mail, e o link do e-mail usava SITE_URL (a do CRM) e caía na
// tela do CRM. Agora o admin define a senha nova, ou o link vem para o ERP.
// Também desbloqueia e zera as tentativas de login.

import { alvoDoErp, clienteAdmin, corsHeaders, exigirAdminAtivo, jsonResponse } from "../_shared/erp-admin.ts";
import { problemaDaSenha } from "../_shared/erp-senha.ts";

interface ResetPasswordPayload {
  user_id: string;
  nova_senha?: string;
  /** a senha que o admin deu é temporária: a pessoa define a dela no próximo acesso */
  forcar_troca_senha?: boolean;
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
      const problema = problemaDaSenha(String(body.nova_senha));
      if (problema) return jsonResponse({ success: false, error: problema }, 400);
      // a própria senha não fica temporária: quem troca já sabe a nova
      const provisoria = body.forcar_troca_senha === true && alvo.id !== chamador.id;
      const { error } = await admin.auth.admin.updateUserById(alvo.id, {
        password: String(body.nova_senha),
        user_metadata: { senha_provisoria: provisoria },
      });
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
    // senha nova: o login por CPF dele volta a aceitar tentativas na hora (122)
    const { data: linha } = await admin.from("erp_usuarios").select("cpf").eq("id", alvo.id).maybeSingle();
    if (linha?.cpf) {
      const { error: erroLiberar } = await admin.rpc("liberar_login", { p_chaves: [`cpf:${linha.cpf}`] });
      if (erroLiberar) console.error("erp-reset-password: contador do CPF não zerado:", erroLiberar.message);
    }
    return jsonResponse({ success: true, email: alvo.email, senha_trocada: !!body.nova_senha }, 200);
  } catch (err) {
    console.error("Erro inesperado:", err);
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : "Erro interno do servidor" }, 500);
  }
});

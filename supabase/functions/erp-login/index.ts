// Edge Function: erp-login
// Entrar no ERP com CPF e senha (pedido do Jean, 03/11/2026: "login tanto
// pelo CPF quanto pelo e-mail"). O login por e-mail continua direto no
// Supabase Auth; só o CPF passa por aqui.
//
// Chamada via (sem estar logado — VERIFY_JWT=false no container):
//   supabase.functions.invoke('erp-login', { body: { cpf: '52998224725', senha: '...' } })
// Devolve { success, access_token, refresh_token }; a tela faz setSession.
//
// Por que no servidor e não uma função do banco que devolve o e-mail do CPF:
// essa função seria chamável por qualquer um, e quem tivesse um CPF
// descobriria o e-mail do funcionário sem saber a senha. Aqui o e-mail
// nunca sai: CPF errado, CPF sem login e senha errada dão a mesma resposta.
//
// O e-mail vem do auth.users, não de erp_usuarios.email: editar o e-mail em
// Usuários e Permissões muda só a linha do ERP, e o login continua no antigo.
// Desativado e bloqueado entram aqui e são barrados pela tela, como no
// login por e-mail (mesma mensagem nos dois caminhos).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clienteAdmin, corsHeaders, jsonResponse } from "../_shared/erp-admin.ts";

const RECUSA = "CPF ou senha inválidos";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Método não permitido" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const cpf = String(body?.cpf ?? "").replace(/\D/g, "");
    const senha = typeof body?.senha === "string" ? body.senha : "";
    if (cpf.length !== 11 || !senha) {
      return jsonResponse({ success: false, error: "Informe o CPF (11 dígitos) e a senha." }, 400);
    }

    const admin = clienteAdmin();
    // o índice único da 121 garante um login por CPF; o limit(2) é a trava
    // se um dia ele faltar — dois logins com o mesmo CPF não entram por CPF
    const { data: perfis, error } = await admin.from("erp_usuarios").select("id").eq("cpf", cpf).limit(2);
    if (error) throw error;
    if (!perfis || perfis.length !== 1) return jsonResponse({ success: false, error: RECUSA }, 401);

    const { data: alvo, error: erroAlvo } = await admin.auth.admin.getUserById(perfis[0].id);
    const email = alvo?.user?.email;
    if (erroAlvo || !email) return jsonResponse({ success: false, error: RECUSA }, 401);

    const anon = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: sessao, error: erroSenha } = await anon.auth.signInWithPassword({ email, password: senha });
    if (erroSenha || !sessao.session) return jsonResponse({ success: false, error: RECUSA }, 401);

    return jsonResponse({
      success: true,
      access_token: sessao.session.access_token,
      refresh_token: sessao.session.refresh_token,
    }, 200);
  } catch (e) {
    console.error("erp-login:", e);
    return jsonResponse({ success: false, error: "Falha ao entrar. Tente novamente." }, 500);
  }
});

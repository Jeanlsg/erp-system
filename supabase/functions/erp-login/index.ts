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
//
// Limite de tentativas (migration 122, varredura de 03/11/2026): 5 erros no
// mesmo CPF ou 20 do mesmo IP em 15 minutos e a chave espera 15 minutos. O
// CPF conta exista login ou não, e toda recusa leva o mesmo tempo mínimo:
// nem a mensagem nem a demora contam se o CPF tem acesso.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clienteAdmin, corsHeaders, jsonResponse } from "../_shared/erp-admin.ts";

const RECUSA = "CPF ou senha inválidos";
/** toda recusa demora pelo menos isto (mais um sorteio): a senha errada de um CPF que existe passa pelo bcrypt do Auth */
const DEMORA_MINIMA_MS = 900;

/**
 * IP de quem chamou: o primeiro do X-Forwarded-For, que o proxy da frente
 * (Traefik do EasyPanel) monta. Se um dia ele repassar o que o cliente
 * mandar, o limite por IP fica contornável — o do CPF continua valendo.
 */
function ipDoCliente(req: Request): string | null {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip")?.trim() || "";
  return ip ? ip.slice(0, 64) : null;
}

function emMinutos(segundos: number): string {
  const m = Math.max(1, Math.ceil(segundos / 60));
  return m === 1 ? "1 minuto" : `${m} minutos`;
}

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
    const inicio = Date.now();
    const ip = ipDoCliente(req);
    const chaves = [`cpf:${cpf}`, ...(ip ? [`ip:${ip}`] : [])];
    const bloqueio = (espera: number) =>
      jsonResponse({ success: false, error: `Muitas tentativas. Tente de novo em ${emMinutos(espera)}.` }, 429);

    // Falhar a conta (banco fora, 122 não aplicada) não pode trancar o login
    // de todo mundo: registra no log e segue — a senha continua conferida.
    const { data: esperaAntes, error: erroLimite } = await admin.rpc("login_bloqueado", { p_chaves: chaves });
    if (erroLimite) console.error("erp-login: limite de tentativas indisponível:", erroLimite.message);
    if (Number(esperaAntes) > 0) return bloqueio(Number(esperaAntes));

    const recusar = async () => {
      const { data: espera, error: erroFalha } = await admin.rpc("registrar_falha_login", { p_chaves: chaves });
      if (erroFalha) console.error("erp-login: falha não registrada:", erroFalha.message);
      const falta = DEMORA_MINIMA_MS + Math.floor(Math.random() * 200) - (Date.now() - inicio);
      if (falta > 0) await new Promise((r) => setTimeout(r, falta));
      return Number(espera) > 0 ? bloqueio(Number(espera)) : jsonResponse({ success: false, error: RECUSA }, 401);
    };

    // o índice único da 121 garante um login por CPF; o limit(2) é a trava
    // se um dia ele faltar — dois logins com o mesmo CPF não entram por CPF
    const { data: perfis, error } = await admin.from("erp_usuarios").select("id").eq("cpf", cpf).limit(2);
    if (error) throw error;
    if (!perfis || perfis.length !== 1) return await recusar();

    const { data: alvo, error: erroAlvo } = await admin.auth.admin.getUserById(perfis[0].id);
    const email = alvo?.user?.email;
    if (erroAlvo || !email) return await recusar();

    const anon = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: sessao, error: erroSenha } = await anon.auth.signInWithPassword({ email, password: senha });
    if (erroSenha || !sessao.session) return await recusar();

    // entrou: o CPF volta a zero (o IP não — ver a 122)
    const { error: erroLiberar } = await admin.rpc("liberar_login", { p_chaves: [`cpf:${cpf}`] });
    if (erroLiberar) console.error("erp-login: contador não zerado:", erroLiberar.message);

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

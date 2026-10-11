// ============================================================
// Quem chama as edges de usuários (criar, excluir, senha) tem de ser
// administrador do ERP ATIVO e não bloqueado.
//
// Antes cada edge só conferia role === "admin", lendo a linha com o JWT do
// próprio chamador: um admin desativado (sessão ainda viva) criava um admin
// novo para si e voltava a ter acesso (revisão de 10/10/2026). A linha agora
// é lida com a service key, e ativo/bloqueado entram na conta.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export interface Chamador {
  id: string;
  admin_principal: boolean;
}

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  admin_principal: boolean;
}

/** Cliente com a service key, no schema erp. */
export function clienteAdmin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "erp" },
  });
}

/**
 * Confere o JWT e se quem chama é admin ativo do ERP.
 * Devolve o chamador ou a Response de erro pronta para retornar.
 */
export async function exigirAdminAtivo(req: Request, admin: SupabaseClient, acao: string): Promise<Chamador | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ success: false, error: "Não autenticado" }, 401);

  const userClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ success: false, error: "Token inválido" }, 401);

  const { data: eu } = await admin.from("erp_usuarios")
    .select("id, role, papeis, ativo, bloqueado, admin_principal")
    .eq("id", userData.user.id).maybeSingle();
  const ehAdmin = !!eu && (eu.admin_principal || eu.role === "admin" || (eu.papeis ?? []).includes("admin"));
  if (!eu || !ehAdmin) {
    return jsonResponse({ success: false, error: `Apenas administradores podem ${acao}` }, 403);
  }
  if (!eu.ativo || eu.bloqueado) {
    return jsonResponse({ success: false, error: "Seu usuário está desativado ou bloqueado" }, 403);
  }
  return { id: eu.id, admin_principal: !!eu.admin_principal };
}

/**
 * Usuário-alvo do ERP; recusa quem não é do ERP e a conta do dono quando
 * quem chama não é o próprio dono.
 */
export async function alvoDoErp(admin: SupabaseClient, chamador: Chamador, id: string): Promise<Usuario | Response> {
  const { data: alvo } = await admin.from("erp_usuarios")
    .select("id, email, nome, admin_principal").eq("id", id).maybeSingle();
  if (!alvo) return jsonResponse({ success: false, error: "Usuário não encontrado no ERP" }, 404);
  if (alvo.admin_principal && alvo.id !== chamador.id && !chamador.admin_principal) {
    return jsonResponse({ success: false, error: "Só o administrador principal altera a conta dele" }, 403);
  }
  return alvo as Usuario;
}

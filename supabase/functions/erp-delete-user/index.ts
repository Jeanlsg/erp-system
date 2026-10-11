// Edge Function: erp-delete-user
// Exclui (ou desativa) um usuário do ERP
// APENAS admins ativos podem chamar esta função
//
// Chamada via:
//   supabase.functions.invoke('erp-delete-user', {
//     body: {
//       user_id: 'uuid-do-usuario',
//       hard_delete?: boolean  // true = exclui perfil e login; false = apenas desativa (padrão)
//     }
//   })
//
// Revisão de 10/10/2026:
//   - o alvo tem de ser usuário do ERP (antes apagava qualquer login do
//     auth.users, que é dividido com o CRM);
//   - a conta do admin principal só o próprio principal mexe, e não é excluída;
//   - a exclusão do perfil é uma transação (erp.excluir_usuario_erp): com
//     histórico (vendas, caixas…) volta "desative em vez de excluir", e o
//     login só é apagado depois que o perfil saiu.

import { alvoDoErp, clienteAdmin, corsHeaders, exigirAdminAtivo, jsonResponse } from "../_shared/erp-admin.ts";

interface DeleteUserPayload {
  user_id: string;
  hard_delete?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = clienteAdmin();
    const chamador = await exigirAdminAtivo(req, admin, "excluir usuários");
    if (chamador instanceof Response) return chamador;

    const body: DeleteUserPayload = await req.json();
    if (!body.user_id) {
      return jsonResponse({ success: false, error: "user_id é obrigatório" }, 400);
    }
    if (body.user_id === chamador.id) {
      return jsonResponse({ success: false, error: "Você não pode excluir nem desativar o próprio usuário" }, 400);
    }

    const alvo = await alvoDoErp(admin, chamador, body.user_id);
    if (alvo instanceof Response) return alvo;
    if (alvo.admin_principal) {
      return jsonResponse({ success: false, error: "O administrador principal não pode ser excluído nem desativado" }, 403);
    }

    if (body.hard_delete) {
      const { error: rpcError } = await admin.rpc("excluir_usuario_erp", { p_usuario: alvo.id });
      if (rpcError) {
        const temHistorico = rpcError.code === "23503";
        return jsonResponse(
          { success: false, error: rpcError.message, ...(temHistorico ? { tem_historico: true } : {}) },
          temHistorico ? 409 : 500,
        );
      }
      const { error: deleteError } = await admin.auth.admin.deleteUser(alvo.id);
      if (deleteError) {
        // o perfil do ERP já saiu: sem ele o login não entra no ERP
        console.error(`perfil ${alvo.id} excluído, login não: ${deleteError.message}`);
        return jsonResponse({ success: true, message: "Usuário excluído do ERP (o login ficou no Auth e não entra mais no ERP)" }, 200);
      }
      return jsonResponse({ success: true, message: "Usuário excluído" }, 200);
    }

    // Desativar: o RLS corta os dados na hora (current_erp_user_id exige
    // ativo) e o front desloga quem foi desativado (auth-store).
    const { error: updateError } = await admin.from("erp_usuarios").update({ ativo: false }).eq("id", alvo.id);
    if (updateError) {
      return jsonResponse({ success: false, error: `Erro ao desativar: ${updateError.message}` }, 500);
    }
    return jsonResponse({ success: true, message: "Usuário desativado" }, 200);
  } catch (err) {
    console.error("Erro inesperado:", err);
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : "Erro interno do servidor" }, 500);
  }
});

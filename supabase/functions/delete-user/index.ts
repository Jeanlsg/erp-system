// Edge Function: delete-user
// Exclui (ou desativa) um usuário do Supabase Auth
// APENAS admins podem chamar esta função
//
// Chamada via:
//   supabase.functions.invoke('delete-user', {
//     body: {
//       user_id: 'uuid-do-usuario',
//       hard_delete?: boolean  // true = exclui do Auth; false = apenas desativa (padrão)
//     }
//   })

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface DeleteUserPayload {
  user_id: string;
  hard_delete?: boolean;
}

interface DeleteUserResponse {
  success: boolean;
  message?: string;
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
      {
        global: { headers: { Authorization: authHeader } },
        db: { schema: "erp" },
      }
    );

    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return jsonResponse({ success: false, error: "Token inválido" }, 401);
    }

    // 2. Verifica se é admin
    const { data: callerProfile } = await userClient
      .from("erp_usuarios")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (!callerProfile || callerProfile.role !== "admin") {
      return jsonResponse(
        { success: false, error: "Apenas administradores podem excluir usuários" },
        403
      );
    }

    // 3. Validação
    const body: DeleteUserPayload = await req.json();
    if (!body.user_id) {
      return jsonResponse(
        { success: false, error: "user_id é obrigatório" },
        400
      );
    }

    // Impede que admin exclua a si mesmo
    if (body.user_id === userData.user.id) {
      return jsonResponse(
        { success: false, error: "Você não pode excluir seu próprio usuário" },
        400
      );
    }

    // 4. Cliente Admin
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: "erp" },
      }
    );

    if (body.hard_delete) {
      // Hard delete: remove do Auth + cascata remove de erp_usuarios (FK ON DELETE CASCADE)
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(
        body.user_id
      );
      if (deleteError) {
        return jsonResponse(
          {
            success: false,
            error: `Erro ao excluir: ${deleteError.message}`,
          },
          500
        );
      }
      return jsonResponse({
        success: true,
        message: "Usuário excluído permanentemente",
      });
    } else {
      // Soft delete: apenas desativa
      const { error: updateError } = await adminClient
        .from("erp_usuarios")
        .update({ ativo: false })
        .eq("id", body.user_id);

      if (updateError) {
        return jsonResponse(
          {
            success: false,
            error: `Erro ao desativar: ${updateError.message}`,
          },
          500
        );
      }
      return jsonResponse({
        success: true,
        message: "Usuário desativado com sucesso",
      });
    }
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
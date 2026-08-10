// Edge Function: create-user
// Cria um novo usuário no Supabase Auth + erp_usuarios
// APENAS admins podem chamar esta função
//
// Chamada via:
//   supabase.functions.invoke('create-user', {
//     body: {
//       email: 'usuario@empresa.com',
//       nome: 'Nome Completo',
//       role: 'caixa' | 'gerente' | 'admin' | 'estoquista',
//       loja_default_id?: string,
//       telefone?: string,
//       senha?: string,         // Opcional - se informada, usuario pode logar direto
//       send_invite?: boolean   // Default: !senha
//     }
//   })

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Role = "admin" | "gerente" | "caixa" | "estoquista";

interface CreateUserPayload {
  email: string;
  nome: string;
  role?: Role;
  loja_default_id?: string | null;
  telefone?: string | null;
  senha?: string | null;
  send_invite?: boolean;
}

interface CreateUserResponse {
  success: boolean;
  user_id?: string;
  email?: string;
  error?: string;
  invite_sent?: boolean;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: any, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Pegar o usuário autenticado (via JWT)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Não autenticado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // 2. Cliente com JWT do usuário (representa quem está chamando)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      db: { schema: "erp" },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ success: false, error: "Token inválido" }, 401);
    }

    // 3. Verificar se é admin
    const { data: callerProfile } = await userClient
      .from("erp_usuarios")
      .select("id, role")
      .eq("id", userData.user.id)
      .single();

    if (!callerProfile || callerProfile.role !== "admin") {
      return jsonResponse(
        { success: false, error: "Apenas administradores podem criar usuários" },
        403
      );
    }

    // 4. Validar payload
    const body: CreateUserPayload = await req.json();

    if (!body.email || !body.nome) {
      return jsonResponse(
        { success: false, error: "Email e nome são obrigatórios" },
        400
      );
    }

    if (!isValidEmail(body.email)) {
      return jsonResponse({ success: false, error: "Email inválido" }, 400);
    }

    const validRoles: Role[] = ["admin", "gerente", "caixa", "estoquista"];
    const role: Role = body.role || "caixa";
    if (!validRoles.includes(role)) {
      return jsonResponse(
        {
          success: false,
          error: `Role inválido. Use um dos: ${validRoles.join(", ")}`,
        },
        400
      );
    }

    if (body.senha !== null && body.senha !== undefined && body.senha !== "") {
      if (body.senha.length < 6) {
        return jsonResponse(
          { success: false, error: "A senha deve ter pelo menos 6 caracteres" },
          400
        );
      }
    }

    // 5. Cliente Admin (com service_role)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: "erp" },
    });

    // 6. Verificar duplicação
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === body.email.toLowerCase()
    );

    if (emailExists) {
      return jsonResponse(
        { success: false, error: "Já existe um usuário com este email" },
        409
      );
    }

    // 7. Criar usuário no Supabase Auth
    const userCreateData: any = {
      email: body.email,
      email_confirm: true,
      user_metadata: { nome: body.nome, role: role },
    };

    if (body.senha && body.senha.length >= 6) {
      userCreateData.password = body.senha;
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser(userCreateData);

    if (createError || !newUser.user) {
      return jsonResponse(
        {
          success: false,
          error: `Erro ao criar usuário no Auth: ${createError?.message || "desconhecido"}`,
        },
        500
      );
    }

    // 8. Atualiza campos adicionais (loja, telefone)
    if (body.loja_default_id || body.telefone) {
      await adminClient
        .from("erp_usuarios")
        .update({
          loja_default_id: body.loja_default_id || null,
          telefone: body.telefone || null,
        })
        .eq("id", newUser.user.id);
    }

    // 9. Email de convite (apenas se não tem senha)
    let inviteSent = false;
    if (!body.senha && body.send_invite !== false) {
      const { error: inviteError } = await adminClient.auth.resetPasswordForEmail(
        body.email,
        {
          redirectTo: `${Deno.env.get("SITE_URL") || "http://localhost:3000"}/auth/redefinir-senha`,
        }
      );
      inviteSent = !inviteError;
    }

    // 10. Resposta de sucesso
    const response: CreateUserResponse = {
      success: true,
      user_id: newUser.user.id,
      email: body.email,
      invite_sent: inviteSent,
    };

    return jsonResponse(response, 200);
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
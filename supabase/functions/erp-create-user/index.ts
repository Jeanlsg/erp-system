// Edge Function: erp-create-user
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

import { clienteAdmin, corsHeaders, exigirAdminAtivo, jsonResponse } from "../_shared/erp-admin.ts";

type Role = "admin" | "gerente" | "caixa" | "estoquista";

interface CreateUserPayload {
  email: string;
  nome: string;
  role?: Role;
  /** todos os papéis; `role` é o principal (o mais alto) */
  papeis?: Role[];
  loja_default_id?: string | null;
  /** filiais em que o usuário trabalha (obrigatório: sem filial ele não abre caixa) */
  lojas?: string[];
  telefone?: string | null;
  senha?: string | null;
  send_invite?: boolean;
  redirect_base?: string;   // origem do app que está criando o usuário
}

interface CreateUserResponse {
  success: boolean;
  user_id?: string;
  email?: string;
  error?: string;
  invite_sent?: boolean;
  invite_error?: string;
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
    // 1. Quem chama: admin ativo do ERP (ver _shared/erp-admin.ts)
    const adminClient = clienteAdmin();
    const chamador = await exigirAdminAtivo(req, adminClient, "criar usuários");
    if (chamador instanceof Response) return chamador;

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

    // papéis: todos válidos; o principal (`role`) sempre entra
    const papeis: Role[] = Array.isArray(body.papeis) && body.papeis.length ? body.papeis : [role];
    if (papeis.some((p) => !validRoles.includes(p))) {
      return jsonResponse(
        { success: false, error: `Papel inválido em papeis. Use: ${validRoles.join(", ")}` },
        400
      );
    }
    if (!papeis.includes(role)) papeis.push(role);

    // Filiais: obrigatórias. Logins criados sem filial não abriam caixa
    // ("não está cadastrado nesta filial") — revisão de 10/10/2026.
    const lojas = [...new Set((Array.isArray(body.lojas) && body.lojas.length ? body.lojas
      : (body.loja_default_id ? [body.loja_default_id] : [])).filter(Boolean))];
    if (!lojas.length) {
      return jsonResponse({ success: false, error: "Escolha ao menos uma filial para o usuário" }, 400);
    }
    const { data: lojasOk } = await adminClient.from("erp_lojas").select("id").in("id", lojas);
    if ((lojasOk ?? []).length !== lojas.length) {
      return jsonResponse({ success: false, error: "Filial inválida" }, 400);
    }
    const lojaPadrao = body.loja_default_id && lojas.includes(body.loja_default_id) ? body.loja_default_id : lojas[0];

    // 6. Verificar duplicação (consulta direta a erp_usuarios por email)
    const { data: existingErpUser, error: dupCheckError } = await adminClient
      .from("erp_usuarios")
      .select("id")
      .ilike("email", body.email)
      .maybeSingle();

    if (dupCheckError) {
      return jsonResponse(
        { success: false, error: `Erro ao verificar duplicação: ${dupCheckError.message}` },
        500
      );
    }

    if (existingErpUser) {
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
      // Email duplicado no Auth (usuário existe no Auth mas não em erp_usuarios)
      const msg = createError?.message ?? "";
      const status = (createError as any)?.status;
      if (
        status === 422 ||
        /already.*(registered|exists)|duplicate/i.test(msg)
      ) {
        return jsonResponse(
          { success: false, error: "Já existe um usuário com este email" },
          409
        );
      }
      return jsonResponse(
        {
          success: false,
          error: `Erro ao criar usuário no Auth: ${msg || "desconhecido"}`,
        },
        500
      );
    }

    // 8. Linha em erp_usuarios (papel, papéis, loja, telefone)
    //
    // Era um UPDATE, que pressupunha a linha já criada por trigger — e não
    // há trigger em auth.users que insira em erp_usuarios: só o de
    // public.profiles. Um UPDATE em linha inexistente afeta 0 linhas sem
    // erro, e o usuário nascia no Auth sem perfil no ERP (login barrado com
    // "Perfil de usuário não encontrado"). O upsert cria se faltar e
    // atualiza se um trigger vier a existir.
    {
      const { error: updateError } = await adminClient
        .from("erp_usuarios")
        .upsert({
          id: newUser.user.id,
          email: body.email,
          nome: body.nome,
          role,
          papeis,
          loja_default_id: lojaPadrao,
          telefone: body.telefone || null,
        }, { onConflict: "id" });
      const { error: lojasError } = updateError ? { error: null } : await adminClient
        .from("erp_usuario_lojas")
        .insert(lojas.map((loja_id) => ({ usuario_id: newUser.user!.id, loja_id })));
      if (updateError || lojasError) {
        // Desfaz o login: sem isto ficava um usuário no Auth sem perfil no
        // ERP, e toda nova tentativa com o mesmo e-mail dava "já existe".
        await adminClient.from("erp_usuarios").delete().eq("id", newUser.user.id);
        await adminClient.auth.admin.deleteUser(newUser.user.id);
        return jsonResponse(
          { success: false, error: `Não foi possível gravar o usuário no ERP: ${(updateError ?? lojasError)!.message}` },
          500
        );
      }
    }

    // 9. Email de convite (apenas se não tem senha)
    //
    // O destino vem do PRÓPRIO front do ERP (window.location.origin), porque
    // SITE_URL no container é compartilhada com o CRM: defini-la aqui faria os
    // links do CRM apontarem para o ERP. Quem valida o destino é o GoTrue,
    // contra a GOTRUE_URI_ALLOW_LIST — então não há risco de redirect aberto.
    let inviteSent = false;
    let inviteError: string | null = null;
    if (!body.senha && body.send_invite !== false) {
      const base = String(body.redirect_base ?? "").replace(/\/+$/, "");
      if (!base) {
        inviteError = "redirect_base não informado pelo aplicativo";
      } else if (!/^https?:\/\//.test(base)) {
        inviteError = "redirect_base inválido";
      } else {
        const { error: errConvite } = await adminClient.auth.resetPasswordForEmail(
          body.email,
          { redirectTo: `${base}/auth/redefinir-senha` },
        );
        if (errConvite) inviteError = errConvite.message;
        inviteSent = !errConvite;
      }
      if (inviteError) {
        console.error(`convite não enviado para ${body.email}: ${inviteError}`);
      }
    }

    // 10. Resposta de sucesso
    const response: CreateUserResponse = {
      success: true,
      user_id: newUser.user.id,
      email: body.email,
      invite_sent: inviteSent,
      ...(inviteError ? { invite_error: inviteError } : {}),
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
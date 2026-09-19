import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "admin" | "gerente" | "caixa" | "estoquista";

/** Força de cada papel. O mais alto dos papéis do usuário vira o `role`
 *  principal — o que o RLS do banco consulta. */
export const ROLE_RANK: Record<Role, number> = { admin: 4, gerente: 3, estoquista: 2, caixa: 1 };
export const ROLES: Role[] = ["admin", "gerente", "estoquista", "caixa"];

/** O papel principal de um conjunto: o mais forte. Vazio → caixa. */
export function papelPrincipal(papeis: Role[]): Role {
  return [...papeis].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0] ?? "caixa";
}

/** Linhas de erp_papel_permissoes → mapa papel → permissões. */
export function mapaPapelPermissoes(
  linhas: { papel: string; permissoes: string[] }[],
): Partial<Record<Role, Permission[]>> {
  const m: Partial<Record<Role, Permission[]>> = {};
  for (const l of linhas) m[l.papel as Role] = l.permissoes as Permission[];
  return m;
}

export type Permission =
  | "pdv.usar"
  | "caixa.abrir"
  | "caixa.fechar"
  | "venda.criar"
  | "venda.cancelar"
  | "venda.desconto"
  | "produto.ver"
  | "produto.criar"
  | "produto.editar"
  | "produto.excluir"
  | "estoque.ver"
  | "estoque.ajustar"
  | "estoque.transferir"
  | "cliente.ver"
  | "cliente.criar"
  | "cliente.editar"
  | "compra.ver"
  | "compra.criar"
  | "compra.receber"
  | "financeiro.ver"
  | "financeiro.lancar"
  | "financeiro.conciliar"
  | "fiscal.emitir"
  | "relatorio.ver"
  | "relatorio.exportar"
  | "config.ver"
  | "config.editar"
  | "usuario.ver"
  | "usuario.criar"
  | "usuario.editar"
  | "loja.ver"
  | "loja.criar"
  | "loja.editar";

export interface User {
  id: string;
  email: string;
  nome: string;
  role: Role;
  /** Todos os papéis; `role` é o principal e sempre está aqui. Vazio = só `role`. */
  papeis?: Role[];
  ativo: boolean;
  /** Dono do sistema: só ele vê página desativada e troca o conjunto de telas. */
  admin_principal?: boolean;
  /**
   * Permissões customizadas deste usuário, gravadas na tela Usuários e
   * Permissões. Vazio ou ausente = usa o padrão do papel.
   *
   * Antes este campo era gravado e NUNCA lido: a tela confirmava "Permissões
   * customizadas salvas" e o comportamento continuava o do papel — desmarcar
   * "venda.cancelar" de um gerente não mudava nada.
   */
  permissoes?: Record<string, boolean> | null;
}

export const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  caixa: "Operador de Caixa",
  estoquista: "Estoquista",
};

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "pdv.usar", "caixa.abrir", "caixa.fechar", "venda.criar", "venda.cancelar", "venda.desconto",
    "produto.ver", "produto.criar", "produto.editar", "produto.excluir",
    "estoque.ver", "estoque.ajustar", "estoque.transferir",
    "cliente.ver", "cliente.criar", "cliente.editar",
    "compra.ver", "compra.criar", "compra.receber",
    "financeiro.ver", "financeiro.lancar", "financeiro.conciliar",
    "fiscal.emitir", "relatorio.ver", "relatorio.exportar",
    "config.ver", "config.editar", "usuario.ver", "usuario.criar", "usuario.editar",
    "loja.ver", "loja.criar", "loja.editar",
  ],
  gerente: [
    "pdv.usar", "caixa.abrir", "caixa.fechar", "venda.criar", "venda.cancelar", "venda.desconto",
    "produto.ver", "produto.criar", "produto.editar",
    "estoque.ver", "estoque.ajustar", "estoque.transferir",
    "cliente.ver", "cliente.criar", "cliente.editar",
    "compra.ver", "compra.criar", "compra.receber",
    "financeiro.ver", "financeiro.lancar", "financeiro.conciliar",
    "fiscal.emitir", "relatorio.ver", "relatorio.exportar",
    "config.ver", "loja.ver",
  ],
  caixa: [
    "pdv.usar", "caixa.abrir", "venda.criar",
    "produto.ver", "estoque.ver",
    "cliente.ver", "cliente.criar",
  ],
  estoquista: [
    "produto.ver", "produto.criar", "produto.editar",
    "estoque.ver", "estoque.ajustar", "estoque.transferir",
    "compra.ver", "compra.criar", "compra.receber",
    "relatorio.ver", "loja.ver",
  ],
};

export { ROLE_PERMISSIONS as DEFAULT_ROLE_PERMISSIONS };

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /**
   * Permissões padrão de cada papel, lidas de erp_papel_permissoes (editáveis
   * em Usuários e Permissões › Papéis). Null = ainda não lidas; o can() cai
   * no ROLE_PERMISSIONS do código.
   */
  papelPermissoes: Partial<Record<Role, Permission[]>> | null;
  setPapelPermissoes: (m: Partial<Record<Role, Permission[]>>) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  hasRole: (role: Role) => boolean;
  hasAnyRole: (roles: Role[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      papelPermissoes: null,
      setPapelPermissoes: (m) => set({ papelPermissoes: m }),
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false }),
      can: (permission) => {
        const { user } = get();
        if (!user) return false;
        // O dono do sistema nunca fica trancado para fora. Sem isto, um JSON
        // de permissões que o front não entende esconde o menu inteiro dele —
        // e o único lugar para consertar é justamente o menu.
        if (user.admin_principal) return true;
        // Customização por usuário vence o padrão do papel. A tela inicializa
        // os checkboxes com as permissões do papel e o admin desmarca o que
        // quer tirar — então um objeto não vazio JÁ É o conjunto efetivo.
        const custom = user.permissoes;
        if (custom && Object.keys(custom).length > 0) {
          // {"all": true} é o curinga que a migration 022 gravou no admin.
          // Este campo ficou meses sem ser lido; quando passou a valer, o
          // curinga virou "nenhuma permissão" e a sidebar esvaziou no login.
          if (custom.all === true) return true;
          return custom[permission] === true;
        }
        // União dos papéis: gerente E estoquista enxerga o que qualquer um
        // dos dois enxerga. A tabela vence o código; o código é a reserva.
        const papeis: Role[] = user.papeis?.length ? user.papeis : [user.role];
        const mapa = get().papelPermissoes ?? {};
        return papeis.some((p) => (mapa[p] ?? ROLE_PERMISSIONS[p] ?? []).includes(permission));
      },
      canAny: (permissions) => {
        return permissions.some((p) => get().can(p));
      },
      hasRole: (role) => get().user?.role === role,
      hasAnyRole: (roles) => roles.includes(get().user?.role as Role),
    }),
    {
      name: "erp-auth",
    }
  )
);

// Função de login (Supabase Auth)
export async function login(
  email: string,
  password: string
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  try {
    const { supabase } = await import("@/lib/supabase");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      return { ok: false, error: "E-mail ou senha inválidos" };
    }

    // Busca perfil do usuario no schema erp (erp.erp_usuarios)
    // O id do erp_usuarios == auth.users.id (FK direta)
    const { data: perfil, error: perfilError } = await supabase
      .from("erp_usuarios")
      .select("id, email, nome, role, papeis, ativo, admin_principal, permissoes")
      .eq("id", data.user.id)
      .single();

    if (perfilError || !perfil) {
      await supabase.auth.signOut();
      return { ok: false, error: "Perfil de usuário não encontrado. Contate o administrador." };
    }

    if (perfil.ativo === false) {
      await supabase.auth.signOut();
      return { ok: false, error: "Usuário desativado" };
    }

    const user: User = {
      id: perfil.id,
      email: perfil.email,
      nome: perfil.nome,
      role: perfil.role,
      papeis: ((perfil as any).papeis ?? []) as Role[],
      ativo: perfil.ativo,
      admin_principal: !!(perfil as any).admin_principal,
      permissoes: ((perfil as any).permissoes ?? null) as Record<string, boolean> | null,
    };
    useAuthStore.getState().setUser(user);

    // permissões padrão dos papéis: da tabela, com o mapa do código de reserva
    const { data: pp } = await supabase.from("erp_papel_permissoes").select("papel, permissoes");
    if (pp?.length) useAuthStore.getState().setPapelPermissoes(mapaPapelPermissoes(pp));

    return { ok: true, user };
  } catch (err) {
    console.error("Erro no login:", err);
    return { ok: false, error: "Falha ao conectar ao servidor de autenticação. Tente novamente." };
  }
}

export function logout() {
  useAuthStore.getState().logout();
}

// Hook auxiliar
export function useAuth() {
  return useAuthStore();
}
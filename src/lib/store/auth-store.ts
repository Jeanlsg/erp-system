import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "admin" | "gerente" | "caixa" | "estoquista";

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
  ativo: boolean;
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
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false }),
      can: (permission) => {
        const { user } = get();
        if (!user) return false;
        return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
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
      .select("id, email, nome, role, ativo")
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
      ativo: perfil.ativo,
    };
    useAuthStore.getState().setUser(user);
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
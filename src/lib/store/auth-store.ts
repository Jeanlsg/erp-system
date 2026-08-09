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

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
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

// Função de login (mock para demo)
export async function login(
  email: string,
  password: string
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  // Demo users
  const demoUsers: Record<string, { user: User; password: string }> = {
    "admin@powererp.com": {
      password: "admin123",
      user: { id: "u1", email: "admin@powererp.com", nome: "Administrador", role: "admin", ativo: true },
    },
    "gerente@powererp.com": {
      password: "gerente123",
      user: { id: "u2", email: "gerente@powererp.com", nome: "Gerente", role: "gerente", ativo: true },
    },
    "caixa@powererp.com": {
      password: "caixa123",
      user: { id: "u3", email: "caixa@powererp.com", nome: "Caixa", role: "caixa", ativo: true },
    },
    "estoque@powererp.com": {
      password: "estoque123",
      user: { id: "u4", email: "estoque@powererp.com", nome: "Estoquista", role: "estoquista", ativo: true },
    },
  };

  await new Promise((r) => setTimeout(r, 500));

  const found = demoUsers[email];
  if (!found || found.password !== password) {
    return { ok: false, error: "E-mail ou senha inválidos" };
  }

  useAuthStore.getState().setUser(found.user);
  return { ok: true, user: found.user };
}

export function logout() {
  useAuthStore.getState().logout();
}

// Hook auxiliar
export function useAuth() {
  return useAuthStore();
}
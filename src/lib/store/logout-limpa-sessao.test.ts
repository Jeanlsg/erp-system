// Regressão: entrar como o dono, sair e entrar como operador no mesmo
// navegador mostrava as telas de dono — o logout não encerrava a sessão do
// Supabase nem apagava o cache, e o operador herdava o que o dono tinha lido.
import { describe, it, expect, beforeEach, vi } from "vitest";

const signOut = vi.fn(async (_opts?: unknown) => ({ error: null }));
const signInWithPassword = vi.fn();
let perfil: Record<string, unknown> = {};

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => null,
  supabase: {
    auth: { signOut: (o?: unknown) => signOut(o), signInWithPassword: (c: unknown) => signInWithPassword(c) },
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        single: async () => ({ data: perfil, error: null }),
        then: (r: (v: unknown) => unknown) => r({ data: [], error: null }),
      };
      return q;
    },
  },
}));

const apagarCacheOffline = vi.fn(async () => {});
vi.mock("@/lib/offline/db", () => ({
  apagarCacheOffline: () => apagarCacheOffline(),
  contarVendasNaoEnviadas: async () => 0,
}));

function armazenamento() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}
const localStorage = armazenamento();
const sessionStorage = armazenamento();
vi.stubGlobal("window", { localStorage, sessionStorage });

const { useAuthStore, logout, login } = await import("./auth-store");
const { useLojaAtualStore } = await import("./loja-atual");
const { queryClient, CHAVE_CACHE_PERSISTIDO } = await import("@/lib/query-client");

const DONO = { id: "dono", email: "dono@exemplo.test", nome: "Dono", role: "admin" as const, ativo: true, admin_principal: true };

function sessaoDoDono() {
  useAuthStore.setState({ user: DONO, isAuthenticated: true, papelPermissoes: { caixa: ["pdv.vender"] } as never });
  useLojaAtualStore.getState().setCurrentLojaId("loja-a");
  queryClient.setQueryData(["erp_admin_principal", "dono"], true);
  queryClient.setQueryData(["erp_usuarios"], [{ id: "dono" }, { id: "operador" }]);
  localStorage.setItem(CHAVE_CACHE_PERSISTIDO, '{"clientState":{}}');
  localStorage.setItem("erp-sidebar-collapsed", "1"); // preferência do aparelho
  sessionStorage.setItem("rascunho", "do dono");
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
  localStorage.clear();
  sessionStorage.clear();
});

describe("logout", () => {
  it("encerra a sessão e não deixa nada lido como o usuário anterior", async () => {
    sessaoDoDono();
    await logout();

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(localStorage.getItem(CHAVE_CACHE_PERSISTIDO)).toBeNull();
    expect(sessionStorage.length).toBe(0);
    expect(apagarCacheOffline).toHaveBeenCalled();
    expect(useLojaAtualStore.getState().currentLojaId).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().papelPermissoes).toBeNull();
  });

  it("limpa mesmo quando o signOut falha (sem internet)", async () => {
    sessaoDoDono();
    signOut.mockRejectedValueOnce(new Error("offline"));
    await logout();

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(localStorage.getItem(CHAVE_CACHE_PERSISTIDO)).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("preserva preferência do aparelho", async () => {
    sessaoDoDono();
    await logout();
    expect(localStorage.getItem("erp-sidebar-collapsed")).toBe("1");
  });
});

describe("login", () => {
  it("outra pessoa entrando sem logout antes não herda cache nem filial", async () => {
    sessaoDoDono();
    signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "operador" } }, error: null });
    perfil = { id: "operador", email: "op@exemplo.test", nome: "Operador", role: "caixa", ativo: true, admin_principal: false };

    const r = await login("op@exemplo.test", "x");

    expect(r.ok).toBe(true);
    expect(queryClient.getQueryData(["erp_admin_principal", "dono"])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(useLojaAtualStore.getState().currentLojaId).toBeNull();
    expect(useAuthStore.getState().user?.admin_principal).toBe(false);
  });

  it("a mesma pessoa voltando continua na filial", async () => {
    sessaoDoDono();
    signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "dono" } }, error: null });
    perfil = { ...DONO };

    await login(DONO.email, "x");

    expect(useLojaAtualStore.getState().currentLojaId).toBe("loja-a");
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});

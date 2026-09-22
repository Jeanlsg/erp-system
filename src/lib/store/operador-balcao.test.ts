import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore, ehOperadorDeBalcao, type User } from "./auth-store";

const base: User = {
  id: "1", email: "a@b.c", nome: "Fulano", role: "caixa", ativo: true,
};

const entrar = (u: Partial<User>) =>
  useAuthStore.getState().setUser({ ...base, ...u } as User);

describe("ehOperadorDeBalcao", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, papelPermissoes: null });
  });

  it("caixa puro é operador de balcão", () => {
    entrar({ role: "caixa", papeis: ["caixa"] });
    expect(ehOperadorDeBalcao()).toBe(true);
  });

  it("gerente e admin não são", () => {
    entrar({ role: "gerente", papeis: ["gerente"] });
    expect(ehOperadorDeBalcao()).toBe(false);
    entrar({ role: "admin", papeis: ["admin"] });
    expect(ehOperadorDeBalcao()).toBe(false);
  });

  it("estoquista não é (mexe em estoque, mas não vende)", () => {
    entrar({ role: "estoquista", papeis: ["estoquista"] });
    expect(ehOperadorDeBalcao()).toBe(false);
  });

  it("caixa + estoquista sai do balcão: passa a ter gestão de estoque", () => {
    entrar({ role: "estoquista", papeis: ["caixa", "estoquista"] });
    expect(ehOperadorDeBalcao()).toBe(false);
  });

  it("caixa que ganhou relatórios deixa de ser balcão", () => {
    entrar({ role: "caixa", papeis: ["caixa"], permissoes: { "pdv.usar": true, "relatorio.ver": true } });
    expect(ehOperadorDeBalcao()).toBe(false);
  });

  it("dono do sistema nunca é preso no PDV", () => {
    entrar({ role: "caixa", papeis: ["caixa"], admin_principal: true });
    expect(ehOperadorDeBalcao()).toBe(false);
  });

  it("sem sessão, não redireciona ninguém", () => {
    expect(ehOperadorDeBalcao()).toBe(false);
  });
});

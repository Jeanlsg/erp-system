import { describe, it, expect } from "vitest";
import { pontosQuePodeAbrir, podeVariosCaixas } from "./caixas-permitidos";

const PETROLINA = { id: "57cf59e2-6240-4d14-bc21-2dac4b2a089b", nome: "Caixa 1 — Petrolina" };
const JUAZEIRO = { id: "cdffb6eb-ba5a-4767-99c0-6c904e8d5b0c", nome: "Caixa 1 — Juazeiro" };
const pontos = [PETROLINA, JUAZEIRO];

describe("pontosQuePodeAbrir", () => {
  it("conta sem lista abre qualquer caixa — é o padrão das contas antigas", () => {
    expect(pontosQuePodeAbrir(pontos, [])).toEqual(pontos);
    expect(pontosQuePodeAbrir(pontos, undefined)).toEqual(pontos);
  });

  it("com lista, só os caixas da lista", () => {
    expect(pontosQuePodeAbrir(pontos, [JUAZEIRO.id])).toEqual([JUAZEIRO]);
  });

  it("lista que aponta para caixa de outra loja não oferece nada nesta", () => {
    expect(pontosQuePodeAbrir([PETROLINA], [JUAZEIRO.id])).toEqual([]);
  });
});

describe("podeVariosCaixas", () => {
  it("admin principal pode", () => {
    expect(podeVariosCaixas({ admin_principal: true, role: "caixa" })).toBe(true);
  });
  it("papel admin pode", () => {
    expect(podeVariosCaixas({ role: "admin" })).toBe(true);
    expect(podeVariosCaixas({ role: "caixa", papeis: ["caixa", "admin"] })).toBe(true);
  });
  it("gerente e caixa não podem — um turno por vez", () => {
    expect(podeVariosCaixas({ role: "gerente" })).toBe(false);
    expect(podeVariosCaixas({ role: "caixa" })).toBe(false);
  });
  it("sem usuário, não", () => {
    expect(podeVariosCaixas(null)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { nomeFantasiaFiscal, lojaNoTextoFiscal } from "./loja-fiscal.ts";

// O apelido de tela virou "Matriz"/"Filial" (migration 114); nada aqui pode
// depender dele — as funções nem recebem o apelido.
const juazeiro = { nome: "X-life Suplementos Juazeiro", apelido: "Matriz", cidade: "Juazeiro", uf: "BA" };
const petrolina = { nome: "X-life Suplementos Petrolina", apelido: "Filial", cidade: "Petrolina", uf: "pe" };

describe("nomeFantasiaFiscal", () => {
  it("é o nome comercial, não o apelido de tela", () => {
    expect(nomeFantasiaFiscal(juazeiro)).toBe("X-life Suplementos Juazeiro");
    expect(nomeFantasiaFiscal(petrolina)).not.toMatch(/^(Matriz|Filial)$/);
  });
  it("sem nome, a tag fica de fora (undefined), não vazia", () => {
    expect(nomeFantasiaFiscal({ nome: "  " })).toBeUndefined();
    expect(nomeFantasiaFiscal({})).toBeUndefined();
  });
});

describe("lojaNoTextoFiscal", () => {
  it("nome que já traz a cidade não a repete", () => {
    expect(lojaNoTextoFiscal(petrolina)).toBe("X-life Suplementos Petrolina");
  });
  it("mesmo nome de empresa nas duas lojas: a cidade/UF separa", () => {
    expect(lojaNoTextoFiscal({ nome: "X-life Suplementos", cidade: "Petrolina", uf: "pe" }))
      .toBe("X-life Suplementos - Petrolina/PE");
  });
  it("compara a cidade sem acento e sem caixa", () => {
    expect(lojaNoTextoFiscal({ nome: "LOJA SAO PAULO", cidade: "São Paulo", uf: "SP" })).toBe("LOJA SAO PAULO");
  });
  it("falta de dado não quebra o texto", () => {
    expect(lojaNoTextoFiscal({ nome: "X-life", cidade: null, uf: null })).toBe("X-life");
    expect(lojaNoTextoFiscal({ nome: null, cidade: "Juazeiro", uf: "BA" })).toBe("Juazeiro/BA");
  });
});

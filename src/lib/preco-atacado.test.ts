import { describe, it, expect } from "vitest";
import { precoAtacadoNoPayload, precoAtacadoOriginal, textoPrecoAtacado } from "./preco-atacado";

describe("precoAtacadoNoPayload — edição com o valor gravado conhecido", () => {
  it("salvar sem mexer não toca a coluna", () => {
    expect(precoAtacadoNoPayload("89.9", 89.9)).toEqual({ ok: true, campos: {} });
    expect(precoAtacadoNoPayload("", null)).toEqual({ ok: true, campos: {} });
  });
  it("limpar o campo grava null", () => {
    expect(precoAtacadoNoPayload("", 89.9)).toEqual({ ok: true, campos: { preco_atacado: null } });
    expect(precoAtacadoNoPayload("   ", 89.9)).toEqual({ ok: true, campos: { preco_atacado: null } });
  });
  it("valor novo vai arredondado em centavos", () => {
    expect(precoAtacadoNoPayload("79.904", 89.9)).toEqual({ ok: true, campos: { preco_atacado: 79.9 } });
    expect(precoAtacadoNoPayload("1.234,56", null)).toEqual({ ok: true, campos: { preco_atacado: 1234.56 } });
  });
  it("zero é valor explícito, diferente de sem atacado", () => {
    expect(precoAtacadoNoPayload("0", null)).toEqual({ ok: true, campos: { preco_atacado: 0 } });
    expect(precoAtacadoNoPayload("", 0)).toEqual({ ok: true, campos: { preco_atacado: null } });
  });
});

describe("precoAtacadoNoPayload — valor gravado desconhecido", () => {
  it("campo vazio não vai no payload (não apaga o que não chegou à tela)", () => {
    expect(precoAtacadoNoPayload("", undefined)).toEqual({ ok: true, campos: {} });
  });
  it("valor digitado vai", () => {
    expect(precoAtacadoNoPayload("50", undefined)).toEqual({ ok: true, campos: { preco_atacado: 50 } });
  });
});

describe("precoAtacadoNoPayload — recusa", () => {
  it("negativo e texto que não é número", () => {
    expect(precoAtacadoNoPayload("-1", 10)).toMatchObject({ ok: false });
    expect(precoAtacadoNoPayload("abc", undefined)).toMatchObject({ ok: false });
  });
});

describe("precoAtacadoOriginal e textoPrecoAtacado", () => {
  it("registro sem a coluna (linha da view, banco sem a 115) é desconhecido", () => {
    expect(precoAtacadoOriginal({ id: "p1", preco_venda: 10 })).toBeUndefined();
    expect(precoAtacadoOriginal(null)).toBeUndefined();
  });
  it("coluna presente: número ou null", () => {
    expect(precoAtacadoOriginal({ preco_atacado: null })).toBeNull();
    expect(precoAtacadoOriginal({ preco_atacado: "45.50" })).toBe(45.5);
    expect(precoAtacadoOriginal({ preco_atacado: 0 })).toBe(0);
  });
  it("texto do campo", () => {
    expect(textoPrecoAtacado(null)).toBe("");
    expect(textoPrecoAtacado(undefined)).toBe("");
    expect(textoPrecoAtacado(45.5)).toBe("45.5");
    expect(textoPrecoAtacado(0)).toBe("0");
  });
  it("ida e volta: hidratar e salvar sem mexer não muda nada", () => {
    for (const gravado of [null, 0, 12.3, 1234.56]) {
      const original = precoAtacadoOriginal({ preco_atacado: gravado });
      expect(precoAtacadoNoPayload(textoPrecoAtacado(original), original)).toEqual({ ok: true, campos: {} });
    }
  });
});

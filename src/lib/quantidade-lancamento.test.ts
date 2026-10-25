import { describe, it, expect } from "vitest";
import { quantidadeParaLancar, quantidadePorValor, QTD_MAXIMA_POR_LANCAMENTO } from "./quantidade-lancamento";

describe("quantidadeParaLancar", () => {
  it("campo vazio vale uma unidade — bipar e dar Enter é o caso comum", () => {
    expect(quantidadeParaLancar("")).toEqual({ ok: true, qtd: 1 });
    expect(quantidadeParaLancar(null)).toEqual({ ok: true, qtd: 1 });
  });

  it("recusa fração: o estoque é por unidade e o servidor quebrava com ela", () => {
    // o laço antigo lançava 3 aqui; depois a fração ia ao banco e a venda morria
    const r = quantidadeParaLancar("2.5");
    expect(r.ok).toBe(false);
    expect((r as any).erro).toContain("inteiro");
    expect(quantidadeParaLancar("1,75").ok).toBe(false);
  });

  it("aceita vírgula com zero, que é o que o teclado brasileiro digita", () => {
    expect(quantidadeParaLancar("3,0")).toEqual({ ok: true, qtd: 3 });
  });

  it("recusa código de barras no campo de quantidade — a causa da aba morrer", () => {
    const r = quantidadeParaLancar("7891234567890");
    expect(r.ok).toBe(false);
    expect((r as any).erro).toContain("código de barras");
  });

  it("recusa zero e negativo em vez de virar 1 em silêncio", () => {
    expect(quantidadeParaLancar("0").ok).toBe(false);
    expect(quantidadeParaLancar("-5").ok).toBe(false);
  });

  it("recusa texto", () => {
    expect(quantidadeParaLancar("abc").ok).toBe(false);
  });

  it("aceita exatamente o limite e recusa um acima", () => {
    expect(quantidadeParaLancar(String(QTD_MAXIMA_POR_LANCAMENTO)).ok).toBe(true);
    expect(quantidadeParaLancar(String(QTD_MAXIMA_POR_LANCAMENTO + 1)).ok).toBe(false);
  });
});

describe("quantidadePorValor (Quantidade em Dinheiro, Ctrl+R)", () => {
  it("divide o valor pelo preço", () => {
    expect(quantidadePorValor("10", 5)).toEqual({ ok: true, qtd: 2 });
  });

  it("dá as unidades inteiras que o valor compra, para baixo", () => {
    expect(quantidadePorValor("10,00", 3)).toEqual({ ok: true, qtd: 3 });
    expect(quantidadePorValor("0,3", 0.1)).toEqual({ ok: true, qtd: 3 });
  });

  it("recusa valor que não compra nem uma unidade", () => {
    expect(quantidadePorValor("2", 5).ok).toBe(false);
  });

  it("recusa valor vazio, zero ou texto", () => {
    expect(quantidadePorValor("", 5).ok).toBe(false);
    expect(quantidadePorValor("0", 5).ok).toBe(false);
    expect(quantidadePorValor("abc", 5).ok).toBe(false);
  });

  it("recusa produto sem preço em vez de dividir por zero", () => {
    expect(quantidadePorValor("10", 0).ok).toBe(false);
  });

  it("respeita o mesmo teto do lançamento comum", () => {
    expect(quantidadePorValor("100000", 1).ok).toBe(false);
  });
});

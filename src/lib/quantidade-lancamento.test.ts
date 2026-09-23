import { describe, it, expect } from "vitest";
import { quantidadeParaLancar, QTD_MAXIMA_POR_LANCAMENTO } from "./quantidade-lancamento";

describe("quantidadeParaLancar", () => {
  it("campo vazio vale uma unidade — bipar e dar Enter é o caso comum", () => {
    expect(quantidadeParaLancar("")).toEqual({ ok: true, qtd: 1 });
    expect(quantidadeParaLancar(null)).toEqual({ ok: true, qtd: 1 });
  });

  it("mantém a fração em vez de arredondar para cima", () => {
    // o laço antigo lançava 3 aqui
    expect(quantidadeParaLancar("2.5")).toEqual({ ok: true, qtd: 2.5 });
  });

  it("aceita vírgula, que é o que o teclado brasileiro digita", () => {
    expect(quantidadeParaLancar("1,75")).toEqual({ ok: true, qtd: 1.75 });
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

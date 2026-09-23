import { describe, it, expect } from "vitest";
import { faixaAtingida, proximaFaixa, validarFaixas } from "./faixas-comissao";

const faixas = [
  { venda_minima: 0, percentual: 5 },
  { venda_minima: 1000, percentual: 8 },
  { venda_minima: 2000, percentual: 10 },
];

describe("faixaAtingida — mesma regra do banco", () => {
  it("vale a maior faixa alcançada", () => {
    expect(faixaAtingida(faixas, 600)).toBe(5);
    expect(faixaAtingida(faixas, 1200)).toBe(8);
    expect(faixaAtingida(faixas, 5000)).toBe(10);
  });
  it("exatamente no limite já é a faixa de cima", () => {
    expect(faixaAtingida(faixas, 1000)).toBe(8);
  });
  it("abaixo da primeira faixa, zero", () => {
    expect(faixaAtingida([{ venda_minima: 500, percentual: 5 }], 100)).toBe(0);
  });
  it("sem faixa nenhuma, zero", () => {
    expect(faixaAtingida([], 1000)).toBe(0);
  });
});

describe("proximaFaixa", () => {
  it("mostra a próxima e quanto falta", () => {
    expect(proximaFaixa(faixas, 1200)).toEqual({ venda_minima: 2000, percentual: 10, falta: 800 });
  });
  it("na última faixa não há próxima", () => {
    expect(proximaFaixa(faixas, 3000)).toBeNull();
  });
});

describe("validarFaixas", () => {
  it("faixas corretas passam", () => {
    expect(validarFaixas(faixas).erros).toEqual([]);
  });
  it("recusa duas faixas começando no mesmo valor", () => {
    const r = validarFaixas([{ venda_minima: 1000, percentual: 5 }, { venda_minima: 1000, percentual: 8 }]);
    expect(r.erros.join()).toContain("mesmo valor");
  });
  it("recusa percentual fora de 0 a 100", () => {
    expect(validarFaixas([{ venda_minima: 0, percentual: 150 }]).erros.length).toBe(1);
  });
  it("avisa quando o percentual cai numa faixa maior", () => {
    const r = validarFaixas([{ venda_minima: 0, percentual: 8 }, { venda_minima: 1000, percentual: 5 }]);
    expect(r.erros).toEqual([]);
    expect(r.avisos.join()).toContain("percentual menor");
  });
  it("avisa que abaixo da primeira faixa a comissão é zero", () => {
    const r = validarFaixas([{ venda_minima: 500, percentual: 5 }]);
    expect(r.avisos.join()).toContain("zero");
  });
});

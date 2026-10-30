import { describe, it, expect } from "vitest";
import { escadaFaixas, faixaAtingida, mesmasFaixas, proximaFaixa, resumoFaixas, validarFaixas } from "./faixas-comissao";

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
  it("o aviso de comissão zero fala da unidade certa", () => {
    // dizia "em serviços" também nas faixas sobre vendas
    expect(validarFaixas([{ venda_minima: 500, percentual: 5 }]).avisos.join()).toContain("em vendas");
    expect(validarFaixas([{ venda_minima: 500, percentual: 5 }], "em serviços").avisos.join()).toContain("em serviços");
  });
});

describe("escadaFaixas — o que o relatório mostra", () => {
  it("marca as alcançadas e a atual, com a comissão do mês em cada uma", () => {
    const e = escadaFaixas(faixas, 1200);
    expect(e.map((d) => d.alcancada)).toEqual([true, true, false]);
    expect(e.map((d) => d.atual)).toEqual([false, true, false]);
    // alcançada: % sobre o que já vendeu; não alcançada: sobre o mínimo dela
    expect(e.map((d) => d.comissao)).toEqual([60, 96, 200]);
  });
  it("abaixo da primeira faixa nenhuma é a atual", () => {
    const e = escadaFaixas([{ venda_minima: 500, percentual: 5 }], 100);
    expect(e[0]).toMatchObject({ alcancada: false, atual: false, comissao: 25 });
  });
  it("ordena da menor para a maior", () => {
    const e = escadaFaixas([{ venda_minima: 2000, percentual: 10 }, { venda_minima: 0, percentual: 5 }], 0);
    expect(e.map((d) => d.venda_minima)).toEqual([0, 2000]);
  });
});

describe("resumoFaixas", () => {
  it("menor e maior percentual e quantas faixas", () => {
    expect(resumoFaixas(faixas)).toBe("5% a 10% · 3 faixas");
  });
  it("uma faixa só", () => {
    expect(resumoFaixas([{ venda_minima: 0, percentual: 7.5 }])).toBe("7,5% · 1 faixa");
  });
  it("sem faixa, vazio", () => {
    expect(resumoFaixas([])).toBe("");
  });
});

describe("mesmasFaixas — só grava quando mudou", () => {
  it("a ordem não importa", () => {
    expect(mesmasFaixas(faixas, [...faixas].reverse())).toBe(true);
  });
  it("percentual diferente é mudança", () => {
    expect(mesmasFaixas(faixas, [{ ...faixas[0], percentual: 6 }, faixas[1], faixas[2]])).toBe(false);
  });
  it("faixa a mais é mudança", () => {
    expect(mesmasFaixas(faixas.slice(0, 2), faixas)).toBe(false);
  });
});

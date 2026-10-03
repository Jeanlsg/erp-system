import { describe, it, expect } from "vitest";
import { ratear, ratearValoresDaVenda, totalDaNota, faltaParaEntregaNfce } from "./rateio.ts";

describe("ratear", () => {
  it("soma exatamente o valor, sobra para os maiores restos", () => {
    const r = ratear(10, [1, 1, 1]);
    expect(r.reduce((s, x) => s + x, 0)).toBeCloseTo(10, 10);
    expect(r).toEqual([3.34, 3.33, 3.33]);
  });
  it("proporcional ao peso", () => {
    expect(ratear(6, [100, 50])).toEqual([4, 2]);
  });
  it("zero não gera centavo perdido", () => {
    expect(ratear(0, [5, 5])).toEqual([0, 0]);
  });
});

const itens = [
  { quantidade: 1, valor_unitario: 119.9 },
  { quantidade: 2, valor_unitario: 35 },
  { quantidade: 3, valor_unitario: 9.99 },
];
const somaProd = 119.9 + 70 + 29.97; // 219,87

describe("ratearValoresDaVenda", () => {
  it("venda simples: nota = total, nada rateado", () => {
    const r = ratearValoresDaVenda(itens, { total: somaProd, frete: 0, acrescimo: 0, freteComoFrete: true });
    expect(totalDaNota(r)).toBeCloseTo(somaProd, 2);
    expect(r.every((i) => !i.valor_desconto && !i.valor_frete && !i.valor_outro)).toBe(true);
  });

  it("desconto geral + entrega: nota fecha com o total pago", () => {
    const total = Math.round((somaProd - 20 + 8.5) * 100) / 100;
    const r = ratearValoresDaVenda(itens, { total, frete: 8.5, acrescimo: 0, freteComoFrete: true });
    expect(totalDaNota(r)).toBe(total);
    expect(r.reduce((s, i) => s + (i.valor_frete ?? 0), 0)).toBeCloseTo(8.5, 10);
    expect(r.reduce((s, i) => s + (i.valor_desconto ?? 0), 0)).toBeCloseTo(20, 10);
  });

  it("NFC-e sem entrega a domicílio: a taxa vai como outras despesas", () => {
    const total = Math.round((somaProd + 7) * 100) / 100;
    const r = ratearValoresDaVenda(itens, { total, frete: 7, acrescimo: 0, freteComoFrete: false });
    expect(r.some((i) => i.valor_frete)).toBe(false);
    expect(r.reduce((s, i) => s + (i.valor_outro ?? 0), 0)).toBeCloseTo(7, 10);
    expect(totalDaNota(r)).toBe(total);
  });

  it("acréscimo vira outras despesas", () => {
    const total = Math.round((somaProd + 3) * 100) / 100;
    const r = ratearValoresDaVenda(itens, { total, frete: 0, acrescimo: 3, freteComoFrete: true });
    expect(totalDaNota(r)).toBe(total);
    expect(r.some((i) => i.valor_desconto)).toBe(false);
  });

  it("valor fora dos itens (kit) não é disfarçado: a nota não fecha e a edge recusa", () => {
    const r = ratearValoresDaVenda(itens, { total: somaProd + 50, frete: 0, acrescimo: 0, freteComoFrete: true });
    expect(r.some((i) => i.valor_desconto || i.valor_outro)).toBe(false);
    expect(totalDaNota(r)).not.toBeCloseTo(somaProd + 50, 2);
  });

  it("desconto de item gravado no total (PDV) também fecha", () => {
    // PDV grava desconto = itens + geral e total já líquido
    const total = Math.round((somaProd - 5 - 10) * 100) / 100;
    const r = ratearValoresDaVenda(itens, { total, frete: 0, acrescimo: 0, freteComoFrete: true });
    expect(totalDaNota(r)).toBe(total);
  });
});

describe("faltaParaEntregaNfce", () => {
  const end = { logradouro: "Rua A", numero: "1", bairro: "Centro", cidade: "Petrolina", uf: "PE", codigo_municipio: "2611101" };
  it("com CPF e endereço completo pode", () => {
    expect(faltaParaEntregaNfce("123.456.789-09", end)).toBeNull();
  });
  it("sem CPF não pode", () => {
    expect(faltaParaEntregaNfce("", end)).toMatch(/CPF/);
  });
  it("sem IBGE não pode", () => {
    expect(faltaParaEntregaNfce("12345678909", { ...end, codigo_municipio: null })).toMatch(/IBGE/);
  });
});

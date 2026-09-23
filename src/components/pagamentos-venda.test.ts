import { describe, it, expect } from "vitest";
import { faltaPagar, trocoDe, type Pagamento } from "./pagamentos-venda";

describe("falta pagar", () => {
  it("venda sem pagamento falta inteira", () => {
    expect(faltaPagar(100, [])).toBe(100);
  });

  it("soma as formas lançadas", () => {
    const p: Pagamento[] = [{ forma: "dinheiro", valor: 60 }, { forma: "pix", valor: 30 }];
    expect(faltaPagar(100, p)).toBe(10);
  });

  it("pagamento completo não falta nada", () => {
    expect(faltaPagar(100, [{ forma: "cartao_debito", valor: 100 }])).toBe(0);
  });

  it("excedente não vira falta negativa", () => {
    // cliente entrega mais em dinheiro: é troco, não "falta -50"
    expect(faltaPagar(100, [{ forma: "dinheiro", valor: 150 }])).toBe(0);
  });

  it("centavos de arredondamento não travam a venda", () => {
    // três parcelas de 33,33 somam 99,99 num total de 100
    const p: Pagamento[] = [
      { forma: "pix", valor: 33.33 }, { forma: "pix", valor: 33.33 }, { forma: "pix", valor: 33.34 },
    ];
    expect(faltaPagar(100, p)).toBe(0);
  });
});

describe("troco", () => {
  it("sai só do dinheiro", () => {
    const p: Pagamento[] = [{ forma: "dinheiro", valor: 60, valor_recebido: 100 }];
    expect(trocoDe(p)).toBe(40);
  });

  it("cartão não dá troco mesmo com recebido maior", () => {
    const p: Pagamento[] = [{ forma: "cartao_debito", valor: 60, valor_recebido: 100 }];
    expect(trocoDe(p)).toBe(0);
  });

  it("sem valor recebido não há troco", () => {
    expect(trocoDe([{ forma: "dinheiro", valor: 60 }])).toBe(0);
  });

  it("soma o troco de várias entregas em dinheiro", () => {
    const p: Pagamento[] = [
      { forma: "dinheiro", valor: 20, valor_recebido: 50 },
      { forma: "dinheiro", valor: 30, valor_recebido: 40 },
    ];
    expect(trocoDe(p)).toBe(40);
  });
});

import { describe, it, expect } from "vitest";
import { faltaPagar, trocoDe, lancarPagamento, aplicarDigitado, prepararFinalizacao, type Pagamento } from "./pagamentos-venda";

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

describe("lancarPagamento — digita o que o cliente dá e o sistema pede o resto", () => {
  it("20 no dinheiro numa venda de 89 lança 20 e deixa 69 faltando", () => {
    const r = lancarPagamento(89, [], "dinheiro", 20);
    expect(r).toEqual({ ok: true, linha: { forma: "dinheiro", valor: 20 } });
    if (r.ok) expect(faltaPagar(89, [r.linha])).toBe(69);
  });

  it("repete até bater o total: 20 dinheiro, 40 pix, 29 débito", () => {
    let pags: Pagamento[] = [];
    for (const [forma, v] of [["dinheiro", 20], ["pix", 40], ["cartao_debito", 29]] as const) {
      const r = lancarPagamento(89, pags, forma, v);
      expect(r.ok).toBe(true);
      if (r.ok) pags = [...pags, r.linha];
    }
    expect(faltaPagar(89, pags)).toBe(0);
  });

  it("dinheiro acima do que falta vira troco, e a linha fica só com o que falta", () => {
    // a gaveta conta a linha: gravar 100 inventaria 31 que saíram de troco
    const r = lancarPagamento(89, [{ forma: "pix", valor: 20 }], "dinheiro", 100);
    expect(r).toEqual({ ok: true, linha: { forma: "dinheiro", valor: 69, valor_recebido: 100, troco: 31 } });
  });

  it("cartão ou PIX acima do que falta é recusado — não existe troco na maquininha", () => {
    const r = lancarPagamento(89, [{ forma: "dinheiro", valor: 20 }], "cartao_debito", 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("não há troco");
  });

  it("recusa valor vazio, zero ou negativo", () => {
    expect(lancarPagamento(89, [], "dinheiro", 0).ok).toBe(false);
    expect(lancarPagamento(89, [], "pix", -5).ok).toBe(false);
    expect(lancarPagamento(89, [], "pix", Number.NaN).ok).toBe(false);
  });

  it("não lança nada depois de completo", () => {
    const r = lancarPagamento(89, [{ forma: "pix", valor: 89 }], "dinheiro", 10);
    expect(r.ok).toBe(false);
  });

  it("centavo de arredondamento no último lançamento não é recusado", () => {
    const pags: Pagamento[] = [{ forma: "pix", valor: 33.33 }, { forma: "pix", valor: 33.33 }];
    expect(lancarPagamento(100, pags, "pix", 33.34).ok).toBe(true);
  });

  it("crédito parcelado leva as parcelas; parcela única não", () => {
    const a = lancarPagamento(300, [], "cartao_credito", 300, { parcelas: 3 });
    expect(a.ok && a.linha.parcelas).toBe(3);
    const b = lancarPagamento(300, [], "cartao_credito", 300, { parcelas: 1 });
    expect(b.ok && b.linha.parcelas).toBeUndefined();
  });
});

describe("prepararFinalizacao — o botão Finalizar", () => {
  it("o defeito antigo: 20 em dinheiro numa venda de 200 NÃO vira 200 em dinheiro", () => {
    // antes, a venda era gravada inteira na forma escolhida e a gaveta
    // passava a esperar 180 que nunca entraram
    const r = prepararFinalizacao(200, [], "dinheiro", "20");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pagamentos).toEqual([{ forma: "dinheiro", valor: 20 }]);
      expect(r.falta).toBe(180);
    }
  });

  it("nada digitado e nada lançado: o total inteiro na forma escolhida", () => {
    const r = prepararFinalizacao(200, [], "cartao_debito", "");
    expect(r.ok && r.pagamentos).toEqual([{ forma: "cartao_debito", valor: 200 }]);
    expect(r.ok && r.falta).toBe(0);
  });

  it("dinheiro a mais no Finalizar vira troco e fecha", () => {
    const r = prepararFinalizacao(200, [], "dinheiro", "250");
    expect(r.ok && r.pagamentos).toEqual([{ forma: "dinheiro", valor: 200, valor_recebido: 250, troco: 50 }]);
    expect(r.ok && r.falta).toBe(0);
  });

  it("com linhas lançadas e campo vazio, não inventa outra linha", () => {
    const pags: Pagamento[] = [{ forma: "dinheiro", valor: 20 }];
    const r = prepararFinalizacao(200, pags, "pix", "");
    expect(r.ok && r.pagamentos).toEqual(pags);
    expect(r.ok && r.falta).toBe(180);
  });

  it("recusa quando um item saiu do cupom depois do pagamento e sobrou no cartão", () => {
    const pags: Pagamento[] = [{ forma: "cartao_credito", valor: 200 }];
    const r = prepararFinalizacao(150, pags, "dinheiro", "");
    expect(r.ok).toBe(false);
  });

  it("repassa o erro do lançamento: cartão acima do que falta", () => {
    const r = prepararFinalizacao(200, [{ forma: "dinheiro", valor: 20 }], "pix", "500");
    expect(r.ok).toBe(false);
  });
});

describe("aplicarDigitado — Enter no campo de valor", () => {
  it("campo vazio não lança nada", () => {
    const r = aplicarDigitado(200, [], "dinheiro", "");
    expect(r).toEqual({ ok: true, pagamentos: [], lancou: false });
  });

  it("lança o digitado e mantém as linhas anteriores", () => {
    const r = aplicarDigitado(200, [{ forma: "dinheiro", valor: 20 }], "pix", "100");
    expect(r.ok && r.pagamentos).toEqual([{ forma: "dinheiro", valor: 20 }, { forma: "pix", valor: 100 }]);
  });
});

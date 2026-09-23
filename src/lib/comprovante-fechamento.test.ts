import { describe, it, expect } from "vitest";
import { montarComprovante } from "./comprovante-fechamento";
import type { DadosFechamento } from "./dados-fechamento";

// os números são os do comprovante real da loja (Fechamento Caixa - 3931810)
const base: DadosFechamento = {
  loja: { nome: "X LIFE SUPLEMENTOS ALIMENTARES", endereco: "AV PRINCIPAL, 15", cidadeUf: "JOSE E MARIA - PETROLINA - PE" },
  caixaNome: "001 - DANILO ALVES",
  operadorAbertura: "DANILO ALVES",
  operadorFechamento: "DANILO ALVES",
  aberturaEm: "2026-09-01T09:30:20-03:00",
  fechamentoEm: "2026-09-01T19:28:31-03:00",
  identificacao: "3931810",
  valorInicial: 152.95,
  entradasExtras: [{ forma: "Dinheiro", valor: 2 }],
  vendasPorForma: [
    { forma: "Cartão de crédito", valor: 1480 },
    { forma: "PIX", valor: 4197 },
    { forma: "Cartão de débito", valor: 7 },
    { forma: "Dinheiro", valor: 658 },
  ],
  vendasCanceladas: { quantidade: 0, valor: 0 },
  devolucoes: { quantidade: 0, valor: 0 },
  sangrias: { quantidade: 7, valor: 736, emDinheiro: 736 },
  descontoTotal: 1298,
  taxaEntrega: 0,
  valorEmEspecie: 76.95,   // 658 + 2 + 152,95 − 736
  valorNoCaixa: 5760.95,
  informado: 76.95,
};

describe("comprovante de fechamento", () => {
  it("sai no tamanho da bobina térmica", () => {
    const h = montarComprovante(base);
    expect(h).toContain("size: 80mm auto");
    expect(h).toContain("width: 72mm");
  });

  it("traz as seções do comprovante que a loja já usa", () => {
    const h = montarComprovante(base);
    for (const s of ["FECHAMENTO DE CAIXA", "ENTRADAS — EXTRAS", "ENTRADAS — VENDAS",
                     "VENDAS CANCELADAS", "DEVOLUÇÃO", "SAÍDAS", "VALOR EM ESPÉCIE",
                     "IDENTIFICAÇÃO DE FECHAMENTO: 3931810"]) {
      expect(h).toContain(s);
    }
  });

  it("a diferença é contra o dinheiro em espécie, não contra o valor no caixa", () => {
    // no comprovante original este mesmo caixa saiu com "Saldo: -R$ 5.684,00"
    // porque comparava com o valor no caixa (que inclui cartão e PIX) — e o
    // caixa tinha batido exato
    const h = montarComprovante(base);
    expect(h).toContain("Gaveta confere");
    expect(h).not.toContain("5.684");
  });

  it("falta e sobra saem com o sinal certo", () => {
    expect(montarComprovante({ ...base, informado: 50 })).toContain("Falta de");
    expect(montarComprovante({ ...base, informado: 100 })).toContain("Sobra de");
  });

  it("centavos de arredondamento não viram divergência", () => {
    expect(montarComprovante({ ...base, informado: 76.954 })).toContain("Gaveta confere");
  });

  it("sangria por PIX aparece separada do que saiu da gaveta", () => {
    const h = montarComprovante({ ...base, sangrias: { quantidade: 2, valor: 100, emDinheiro: 80 } });
    expect(h).toContain("em dinheiro:");
    expect(h).toContain("não muda a gaveta");
  });

  it("turno sem venda não finge que teve", () => {
    const h = montarComprovante({ ...base, vendasPorForma: [] });
    expect(h).toContain("nenhuma venda neste turno");
  });

  it("escapa o que o operador digitou", () => {
    const h = montarComprovante({ ...base, observacoes: '<script>alert("x")</script>' });
    expect(h).not.toContain("<script>alert");
  });
});

import { describe, it, expect } from "vitest";
import {
  FORMAS_FECHAMENTO,
  formasParaDeclarar,
  valorDeclaradoValido,
  faltaDeclarar,
  argumentosDeFechamento,
} from "./fechamento-por-forma";

const resumoSoDinheiro = {
  vendas_dinheiro: 189,
  vendas_pix: 0,
  vendas_cartao_credito: 0,
  vendas_cartao_debito: 0,
  vendas_outras: 0,
};

const resumoMisto = { ...resumoSoDinheiro, vendas_pix: 50, vendas_cartao_debito: 39 };

describe("formasParaDeclarar", () => {
  it("com o esperado à mostra, pede só dinheiro quando nada mais teve movimento", () => {
    const f = formasParaDeclarar(resumoSoDinheiro, true).map((x) => x.chave);
    expect(f).toEqual(["dinheiro"]);
  });

  it("acrescenta as formas que tiveram movimento", () => {
    const f = formasParaDeclarar(resumoMisto, true).map((x) => x.chave);
    expect(f).toEqual(["dinheiro", "pix", "cartao_debito"]);
  });

  it("com o esperado oculto pede todas — a lista curta entregaria onde houve venda", () => {
    const f = formasParaDeclarar(resumoMisto, false);
    expect(f).toHaveLength(FORMAS_FECHAMENTO.length);
  });

  it("caixa sem movimento ainda pede dinheiro, por causa do saldo inicial", () => {
    expect(formasParaDeclarar(null, true).map((x) => x.chave)).toEqual(["dinheiro"]);
  });
});

describe("valorDeclaradoValido", () => {
  it("recusa vazio — campo em branco não é zero declarado", () => {
    expect(valorDeclaradoValido("")).toBe(false);
    expect(valorDeclaradoValido("   ")).toBe(false);
    expect(valorDeclaradoValido(undefined)).toBe(false);
  });
  it("aceita zero declarado de propósito", () => {
    expect(valorDeclaradoValido("0")).toBe(true);
  });
  it("recusa negativo e texto", () => {
    expect(valorDeclaradoValido("-5")).toBe(false);
    expect(valorDeclaradoValido("abc")).toBe(false);
  });
  it("aceita vírgula decimal, que é o que o teclado brasileiro digita", () => {
    expect(valorDeclaradoValido("189,50")).toBe(true);
  });
});

describe("faltaDeclarar", () => {
  const formas = formasParaDeclarar(resumoMisto, true);

  it("com a regra desligada nunca trava o fechamento", () => {
    expect(faltaDeclarar(formas, {}, false)).toBe(false);
  });

  it("trava enquanto faltar qualquer forma", () => {
    expect(faltaDeclarar(formas, { dinheiro: "200", pix: "50" }, true)).toBe(true);
  });

  it("libera quando todas estão preenchidas", () => {
    expect(faltaDeclarar(formas, { dinheiro: "200", pix: "50", cartao_debito: "39" }, true)).toBe(false);
  });

  it("valor a mais numa forma não pedida não libera as que faltam", () => {
    expect(faltaDeclarar(formas, { dinheiro: "200", outras: "10" }, true)).toBe(true);
  });
});

describe("argumentosDeFechamento", () => {
  it("mapeia cada forma para o parâmetro de useFecharCaixa", () => {
    const formas = formasParaDeclarar(resumoMisto, true);
    expect(argumentosDeFechamento(formas, { dinheiro: "200", pix: "50", cartao_debito: "39" }))
      .toEqual({ valorDinheiro: 200, valorPix: 50, valorCartaoDebito: 39 });
  });

  it("devolve null se algum campo é inválido — o caixa não fecha pela metade", () => {
    const formas = formasParaDeclarar(resumoMisto, true);
    expect(argumentosDeFechamento(formas, { dinheiro: "200", pix: "", cartao_debito: "39" })).toBeNull();
  });

  it("aceita vírgula e converte para número", () => {
    const formas = formasParaDeclarar(resumoSoDinheiro, true);
    expect(argumentosDeFechamento(formas, { dinheiro: "189,50" })).toEqual({ valorDinheiro: 189.5 });
  });
});

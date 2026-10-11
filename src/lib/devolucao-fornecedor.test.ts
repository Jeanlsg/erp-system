import { describe, it, expect } from "vitest";
import { cfopDevolucao, itemDaNotaEntrada, mudarQuantidadeOuValor, aplicarTributacao, faltaParaEmitir } from "./devolucao-fornecedor";

const entrada = { id: "e1", produto_id: "p1", nome: "WHEY", ncm: "21069030", quantidade: 10, valor_unitario: 50, valor_total: 500,
  icms_origem: "0", icms_csosn: "102", icms_aliquota: 18, icms_valor: 90, numero_item: 3 };

describe("cfopDevolucao", () => {
  it("5202 no estado, 6202 fora, 5411/6411 com ST", () => {
    expect(cfopDevolucao("PE", "PE")).toBe("5202");
    expect(cfopDevolucao("PE", "SP")).toBe("6202");
    expect(cfopDevolucao("BA", "SP", true)).toBe("6411");
  });
});

describe("itemDaNotaEntrada", () => {
  it("traz base do ICMS, CSOSN 900 quando veio ICMS e o nº do item da compra", () => {
    const i = itemDaNotaEntrada(entrada, "6202");
    expect(i).toMatchObject({ cfop: "6202", icms_base: 500, icms_aliquota: 18, icms_valor: 90, icms_csosn: "900", item_nota_origem: 3, maximo: 10 });
  });
});

describe("mudarQuantidadeOuValor", () => {
  it("metade da quantidade, metade da base e do ICMS; não passa do que veio", () => {
    const i = itemDaNotaEntrada(entrada, "5202");
    const m = mudarQuantidadeOuValor(i, 5);
    expect(m).toMatchObject({ quantidade: 5, valor_total: 250, icms_base: 250, icms_valor: 45 });
    expect(mudarQuantidadeOuValor(i, 99).quantidade).toBe(10);
  });
});

describe("aplicarTributacao", () => {
  it("900 calcula o ICMS pela base e alíquota; outro CSOSN zera o destaque", () => {
    const i = itemDaNotaEntrada(entrada, "5202");
    expect(aplicarTributacao(i, { icms_base: 200, icms_aliquota: 20.5 }).icms_valor).toBe(41);
    const s = aplicarTributacao(i, { icms_csosn: "102" });
    expect(s).toMatchObject({ icms_valor: 0, icms_base: 0, icms_aliquota: 0 });
  });
});

describe("faltaParaEmitir", () => {
  const ok = {
    chave_nota_origem: "2".repeat(44),
    fornecedor: { cpf_cnpj: "11.444.777/0001-61", endereco: { logradouro: "R", cidade: "C", uf: "PE" } },
    itens: [{ nome: "WHEY", cfop: "5202", quantidade: 1, item_nota_origem: 3, ncm: "21069030" }],
  };
  it("completa passa", () => { expect(faltaParaEmitir(ok)).toEqual([]); });
  it("aponta chave, item da nota e CFOP de entrada", () => {
    const f = faltaParaEmitir({ ...ok, chave_nota_origem: "123", itens: [{ ...ok.itens[0], item_nota_origem: null, cfop: "1202" }] });
    expect(f.join(" | ")).toMatch(/chave de acesso/);
    expect(f.join(" | ")).toMatch(/nº do item na nota de compra/);
    expect(f.join(" | ")).toMatch(/CFOP de saída/);
  });
});

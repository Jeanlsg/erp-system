import { describe, it, expect } from "vitest";
import {
  cfopDevolucao, itemDaNotaEntrada, mudarQuantidadeOuValor, aplicarTributacao, faltaParaEmitir, aplicarDesconto,
  totais, faltasDoFornecedor, lerXmlNfe, casarProduto, itemDoXml, itemDoProduto, arredondarUnit,
} from "./devolucao-fornecedor";

const CNPJ = "11222333000181";
const CHAVE = `2626${"10"}${CNPJ}550010000012341000012345`.slice(0, 44);

const entrada = { id: "e1", produto_id: "p1", nome: "WHEY", ncm: "21069030", quantidade: 10, valor_unitario: 50, valor_total: 500,
  icms_origem: "0", icms_csosn: "102", icms_aliquota: 18, icms_valor: 90, ipi_valor: 20, numero_item: 3 };

const fornecedor = { cpf_cnpj: CNPJ, codigo_municipio_ibge: "3505708", endereco: { logradouro: "Rua A", cidade: "Barueri", uf: "SP" } };

describe("cfopDevolucao", () => {
  it("5202 no estado, 6202 fora, 5411/6411 com ST", () => {
    expect(cfopDevolucao("PE", "PE")).toBe("5202");
    expect(cfopDevolucao("PE", "SP")).toBe("6202");
    expect(cfopDevolucao("BA", "SP", true)).toBe("6411");
  });
});

describe("itemDaNotaEntrada", () => {
  it("traz base do ICMS, CSOSN 900, o IPI como devolvido e o nº do item da compra", () => {
    const i = itemDaNotaEntrada(entrada, "6202", CHAVE);
    expect(i).toMatchObject({
      cfop: "6202", icms_base: 500, icms_aliquota: 18, icms_valor: 90, icms_csosn: "900", item_nota_origem: 3, maximo: 10,
      ipi_devolvido_percentual: 100, ipi_devolvido_valor: 20, chave_nota_origem: CHAVE,
    });
  });
});

describe("mudarQuantidadeOuValor", () => {
  it("metade da quantidade: metade da base, do ICMS e do IPI devolvido; não passa do que veio", () => {
    const i = itemDaNotaEntrada(entrada, "5202", CHAVE);
    const m = mudarQuantidadeOuValor(i, 5);
    expect(m).toMatchObject({ quantidade: 5, valor_total: 250, icms_base: 250, icms_valor: 45, ipi_devolvido_valor: 10, ipi_devolvido_percentual: 50 });
    expect(mudarQuantidadeOuValor(i, 99).quantidade).toBe(10);
  });
  it("desconto em % acompanha o novo total", () => {
    const i = aplicarDesconto(itemDaNotaEntrada(entrada, "5202", CHAVE), { percentual: 10 });
    expect(mudarQuantidadeOuValor(i, 5).valor_desconto).toBe(25);
  });
});

describe("aplicarDesconto", () => {
  const i = itemDaNotaEntrada(entrada, "5202", CHAVE);
  it("% calcula o R$", () => expect(aplicarDesconto(i, { percentual: 10 })).toMatchObject({ desconto_percentual: 10, valor_desconto: 50 }));
  it("R$ calcula o %, sem passar do total", () => {
    expect(aplicarDesconto(i, { valor: 25 })).toMatchObject({ valor_desconto: 25, desconto_percentual: 5 });
    expect(aplicarDesconto(i, { valor: 900 }).valor_desconto).toBe(500);
  });
});

describe("aplicarTributacao", () => {
  it("CSOSN 900 calcula o ICMS; 102 zera base e alíquota", () => {
    const i = itemDaNotaEntrada(entrada, "5202", CHAVE);
    expect(aplicarTributacao(i, { icms_csosn: "900", icms_base: 200, icms_aliquota: 12 }).icms_valor).toBe(24);
    expect(aplicarTributacao(i, { icms_csosn: "102" })).toMatchObject({ icms_valor: 0, icms_base: 0, icms_aliquota: 0 });
  });
});

describe("totais", () => {
  const a = { ...itemDoProduto({ id: "p", nome: "A", preco_custo: 100 }, "5202", CHAVE), valor_frete: 3, outras_despesas: 1 };
  const b = aplicarDesconto(itemDaNotaEntrada(entrada, "5202", CHAVE), { valor: 10 });
  it("rateio igual usa os valores do cabeçalho; soma IPI devolvido e tira o desconto", () => {
    expect(totais([a, b], { valor_frete: 20, valor_seguro: 5, outras_despesas: 0, rateio_frete: "igual" }))
      .toMatchObject({ produtos: 600, desconto: 10, frete: 20, seguro: 5, ipiDevolvido: 20, total: 635 });
  });
  it("por produto soma o frete e as outras despesas de cada item", () => {
    expect(totais([a, b], { valor_frete: 99, valor_seguro: 0, outras_despesas: 99, rateio_frete: "por_produto" }))
      .toMatchObject({ frete: 3, outras: 1 });
  });
});

describe("faltasDoFornecedor e faltaParaEmitir", () => {
  it("cadastro completo não acusa nada", () => expect(faltasDoFornecedor(fornecedor)).toEqual([]));
  it("acusa o que falta no cadastro, como o 'Incompleto' do Excellent", () => {
    expect(faltasDoFornecedor({ cpf_cnpj: "123", endereco: {} })).toEqual(["CNPJ", "rua", "cidade", "UF", "código IBGE da cidade"]);
  });
  const item = { nome: "WHEY", cfop: "5202", quantidade: 1, chave_nota_origem: CHAVE, ncm: "21069030" };
  it("tudo certo: lista vazia", () => {
    expect(faltaParaEmitir({ chaves: [CHAVE], fornecedor, itens: [item] })).toEqual([]);
  });
  it("DANFE de outro CNPJ, item sem nota de origem e CFOP de entrada", () => {
    const outra = CHAVE.slice(0, 6) + "99888777000166" + CHAVE.slice(20);
    const f = faltaParaEmitir({ chaves: [outra], fornecedor, itens: [{ ...item, cfop: "1202" }] });
    expect(f.join(" | ")).toMatch(/outra empresa/);
    expect(f.join(" | ")).toMatch(/nota de entrada de "WHEY"/);
    expect(f.join(" | ")).toMatch(/CFOP de saída/);
  });
  it("compra emitida por outra filial do mesmo fornecedor (mesma raiz de CNPJ) passa", () => {
    const filial = CHAVE.slice(0, 6) + CNPJ.slice(0, 8) + "000262" + CHAVE.slice(20);
    expect(faltaParaEmitir({ chaves: [filial], fornecedor, itens: [{ ...item, chave_nota_origem: filial }] })).toEqual([]);
  });
  it("nota normal (finalidade 1) não exige DANFE", () => {
    expect(faltaParaEmitir({ finalidade: 1, chaves: [], fornecedor, itens: [{ ...item, chave_nota_origem: null }] })).toEqual([]);
  });
});

describe("XML da nota de entrada", () => {
  const xml = `<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe${CHAVE}" versao="4.00">
    <ide><nNF>1234</nNF></ide><emit><CNPJ>${CNPJ}</CNPJ><xNome>FORNECEDOR TESTE &amp; CIA</xNome></emit>
    <det nItem="1"><prod><cProd>AB1</cProd><cEAN>7890000000017</cEAN><xProd>WHEY TESTE 900G</xProd><NCM>21069030</NCM><CFOP>6102</CFOP>
      <uCom>UN</uCom><qCom>4.0000</qCom><vUnCom>50.0000000000</vUnCom><vProd>200.00</vProd></prod>
      <imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST><vBC>200.00</vBC><pICMS>12.00</pICMS><vICMS>24.00</vICMS></ICMS00></ICMS>
      <IPI><cEnq>999</cEnq><IPITrib><CST>50</CST><vIPI>10.00</vIPI></IPITrib></IPI></imposto></det>
    <det nItem="2"><prod><cProd>ZZ9</cProd><cEAN>SEM GTIN</cEAN><xProd>COQUETELEIRA</xProd><NCM>39241000</NCM><CFOP>6102</CFOP>
      <uCom>UN</uCom><qCom>2</qCom><vUnCom>5</vUnCom><vProd>10.00</vProd></prod>
      <imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS></imposto></det>
  </infNFe></NFe></nfeProc>`;

  it("lê chave, número, emitente e itens com impostos", () => {
    const n = lerXmlNfe(xml);
    expect(n).toMatchObject({ chave: CHAVE, numero: "1234", emitente_cnpj: CNPJ, emitente_nome: "FORNECEDOR TESTE & CIA" });
    expect(n.itens).toHaveLength(2);
    expect(n.itens[0]).toMatchObject({ n_item: 1, ean: "7890000000017", quantidade: 4, valor_total: 200, icms_valor: 24, icms_aliquota: 12, ipi_valor: 10 });
    expect(n.itens[1]).toMatchObject({ n_item: 2, ean: null, csosn: "102" });
  });

  it("recusa arquivo que não é NF-e", () => {
    expect(() => lerXmlNfe("<html></html>")).toThrow(/não é o XML/);
  });

  it("casa o produto pelo código de barras e monta o item com o nº do item e o IPI devolvido", () => {
    const n = lerXmlNfe(xml);
    const produtos = [{ id: "p9", nome: "Whey da loja", codigo_barras: "7890000000017" }];
    const p = casarProduto(n.itens[0], produtos);
    expect(p?.id).toBe("p9");
    expect(casarProduto(n.itens[1], produtos)).toBeNull();
    const it = itemDoXml(n.itens[0], n.chave, "6202", p);
    expect(it).toMatchObject({ produto_id: "p9", item_nota_origem: 1, chave_nota_origem: CHAVE, icms_csosn: "900", icms_valor: 24, ipi_devolvido_valor: 10 });
  });
});

describe("arredondarUnit", () => {
  it("respeita as casas decimais (2 a 10)", () => {
    expect(arredondarUnit(1.23456, 2)).toBe(1.23);
    expect(arredondarUnit(1.23456, 4)).toBe(1.2346);
    expect(arredondarUnit(1.23456, 1)).toBe(1.23);
  });
});

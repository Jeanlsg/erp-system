import { describe, it, expect } from "vitest";
import { cfopParaUf, calcularIcms, creditoSimples, faltaNoTributoDoProduto, CSOSNS, CSTS_ICMS, ORIGENS_MERCADORIA } from "./tabelas-fiscais";

describe("tabelas", () => {
  it("origens 0 a 8", () => {
    expect(ORIGENS_MERCADORIA.map((o) => o.valor)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it("não oferece CSOSN com ST que o emissor não monta", () => {
    expect(CSOSNS.map((c) => c.valor)).not.toContain("201");
  });
});

describe("cfopParaUf", () => {
  it("troca o primeiro dígito conforme a UF", () => {
    expect(cfopParaUf("5202", false)).toBe("6202");
    expect(cfopParaUf("6411", true)).toBe("5411");
    expect(cfopParaUf("1202", true)).toBe("1202");
  });
});

describe("ICMS", () => {
  it("base × alíquota em centavos", () => {
    expect(calcularIcms(199.9, 18)).toBe(35.98);
    expect(calcularIcms(100, 0)).toBe(0);
    expect(creditoSimples(250, 1.25)).toBe(3.13);
  });
});

describe("faltaNoTributoDoProduto", () => {
  it("101 sem alíquota de crédito e 900 sem alíquota de ICMS", () => {
    expect(faltaNoTributoDoProduto({ csosn: "101" })).toMatch(/crédito/);
    expect(faltaNoTributoDoProduto({ csosn: "900", icms: 0 })).toMatch(/alíquota do ICMS/);
    expect(faltaNoTributoDoProduto({ csosn: "900", icms: 18 })).toBeNull();
    expect(faltaNoTributoDoProduto({ csosn: "102" })).toBeNull();
    expect(faltaNoTributoDoProduto({ csosn: "201" })).toMatch(/não é suportado/);
  });
  it("CST 00 sem alíquota, PIS 01 sem alíquota; 49 e 06 passam sem alíquota", () => {
    expect(faltaNoTributoDoProduto({ cst_icms: "00" })).toMatch(/CST 00/);
    expect(faltaNoTributoDoProduto({ cst_icms: "00", icms: 18 })).toBeNull();
    expect(faltaNoTributoDoProduto({ cst_pis: "01" })).toMatch(/PIS com CST 01/);
    expect(faltaNoTributoDoProduto({ cst_pis: "01", pis: 0.65, cst_cofins: "01", cofins: 3 })).toBeNull();
    expect(faltaNoTributoDoProduto({ cst_pis: "49", cst_cofins: "06" })).toBeNull();
    expect(faltaNoTributoDoProduto({ cst_icms: "10" })).toMatch(/não é suportado/);
  });
  it("não oferece CST com ST/redução que o emissor não monta", () => {
    expect(CSTS_ICMS.map((c) => c.valor)).not.toContain("10");
    expect(CSTS_ICMS.map((c) => c.valor)).not.toContain("20");
  });
});

import { describe, it, expect } from "vitest";
import { ROTAS_DA_EMPRESA } from "./root-layout";

describe("seletor de loja do cabeçalho", () => {
  it("telas de movimento não são tratadas como cadastro da empresa", () => {
    // estas têm dados próprios de cada filial e seguem a loja do topo
    for (const r of ["/", "/relatorios", "/caixa", "/vendas", "/financeiro",
                     "/produtos-estoque-lotes", "/notas-fiscais", "/compras"]) {
      expect(ROTAS_DA_EMPRESA).not.toContain(r);
    }
  });

  it("cadastros comuns ganham o aviso", () => {
    for (const r of ["/gestao/clientes", "/gestao/fornecedores", "/gestao/funcionarios", "/lojas"]) {
      expect(ROTAS_DA_EMPRESA).toContain(r);
    }
  });

  it("a frente de caixa não usa esta lista — tem casco próprio", () => {
    expect(ROTAS_DA_EMPRESA).not.toContain("/pdv");
  });
});

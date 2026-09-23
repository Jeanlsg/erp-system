import { describe, it, expect } from "vitest";
import { ROTAS_COM_FILTRO_DE_LOJA } from "./root-layout";

describe("seletor de loja do cabeçalho", () => {
  it("some nas telas que escolhem a loja por conta própria", () => {
    for (const r of ["/", "/relatorios", "/caixa", "/produtos-estoque-lotes"]) {
      expect(ROTAS_COM_FILTRO_DE_LOJA).toContain(r);
    }
  });

  it("continua nas telas que dependem da loja do cabeçalho", () => {
    // estas leem useAutoSelectLoja e não têm seletor próprio: sem o do topo,
    // ficariam presas numa loja só
    for (const r of ["/vendas", "/financeiro", "/compras", "/notas-fiscais", "/kits"]) {
      expect(ROTAS_COM_FILTRO_DE_LOJA).not.toContain(r);
    }
  });
});

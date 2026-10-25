import { describe, it, expect } from "vitest";
import { resumoMovimentos, alteracoesDePreco, rotuloOrigem, sinalDoMovimento, htmlFichaProduto } from "./ficha-produto";

const t = (h: number) => `2026-10-10T${String(h).padStart(2, "0")}:00:00Z`;

describe("resumoMovimentos", () => {
  it("separa entradas, saídas e vendas; ajuste segue o saldo", () => {
    const r = resumoMovimentos([
      { tipo: "entrada", origem: "reposicao", quantidade: 10, created_at: t(8) },
      { tipo: "saida", origem: "venda", quantidade: 3, created_at: t(9) },
      { tipo: "saida", origem: "devolucao_fornecedor", quantidade: 1, created_at: t(10) },
      { tipo: "ajuste", origem: "manual", quantidade: 2, saldo_anterior: 6, saldo_posterior: 4, created_at: t(11) },
      { tipo: "ajuste", origem: "manual", quantidade: 5, saldo_anterior: 4, saldo_posterior: 9, created_at: t(12) },
    ]);
    expect(r).toEqual({ entradas: 15, saidas: 6, vendidas: 3, liquido: 9 });
  });
});

describe("sinalDoMovimento", () => {
  it("ajuste para baixo é saída", () => {
    expect(sinalDoMovimento({ tipo: "ajuste", quantidade: 2, saldo_anterior: 6, saldo_posterior: 4, created_at: t(1) })).toBe(-1);
  });
});

describe("alteracoesDePreco", () => {
  it("lista só o que mudou em custo e venda, mais recente primeiro", () => {
    const r = alteracoesDePreco([
      { created_at: t(8), operacao: "UPDATE", usuario_id: "u1", dados_antes: { preco_venda: 25, preco_custo: 10, nome: "A" }, dados_depois: { preco_venda: 25, preco_custo: 10, nome: "B" } },
      { created_at: t(9), operacao: "UPDATE", usuario_id: "u1", dados_antes: { preco_venda: 25, preco_custo: 10 }, dados_depois: { preco_venda: 29.9, preco_custo: 10 } },
      { created_at: t(10), operacao: "UPDATE", usuario_id: "u2", dados_antes: { preco_venda: 29.9, preco_custo: 10 }, dados_depois: { preco_venda: 29.9, preco_custo: 12.5 } },
    ]);
    expect(r).toEqual([
      { data: t(10), usuario_id: "u2", campo: "preco_custo", antes: 10, depois: 12.5 },
      { data: t(9), usuario_id: "u1", campo: "preco_venda", antes: 25, depois: 29.9 },
    ]);
  });
  it("cadastro conta como primeiro preço", () => {
    const r = alteracoesDePreco([{ created_at: t(7), operacao: "INSERT", dados_antes: null, dados_depois: { preco_venda: 20, preco_custo: 8 } }]);
    expect(r.map((x) => x.campo).sort()).toEqual(["preco_custo", "preco_venda"]);
  });
  it("atacado: nulo ↔ valor é alteração, nulo → nulo e auditoria sem a coluna não são", () => {
    const base = { preco_venda: 30, preco_custo: 10 };
    const r = alteracoesDePreco([
      { created_at: t(6), operacao: "UPDATE", dados_antes: base, dados_depois: { ...base, nome: "X" } },
      { created_at: t(7), operacao: "UPDATE", dados_antes: { ...base, preco_atacado: null }, dados_depois: { ...base, preco_atacado: null, nome: "Y" } },
      { created_at: t(8), operacao: "UPDATE", dados_antes: { ...base, preco_atacado: null }, dados_depois: { ...base, preco_atacado: 0 } },
      { created_at: t(9), operacao: "UPDATE", dados_antes: { ...base, preco_atacado: 0 }, dados_depois: { ...base, preco_atacado: 25 } },
      { created_at: t(10), operacao: "UPDATE", dados_antes: { ...base, preco_atacado: 25 }, dados_depois: { ...base, preco_atacado: null } },
      { created_at: t(11), operacao: "INSERT", dados_antes: null, dados_depois: { ...base, preco_atacado: null } },
    ]);
    expect(r.filter((x) => x.campo === "preco_atacado").map((x) => [x.antes, x.depois])).toEqual([
      [25, null], [0, 25], [null, 0],
    ]);
  });
});

describe("rotuloOrigem e impressão", () => {
  it("traduz origens conhecidas e não quebra nas desconhecidas", () => {
    expect(rotuloOrigem("devolucao_fornecedor")).toBe("Devolução a fornecedor");
    expect(rotuloOrigem("algo_novo")).toBe("algo novo");
    expect(rotuloOrigem(null)).toBe("—");
  });
  it("escapa o nome do produto no HTML", () => {
    const h = htmlFichaProduto({ produto: { nome: "<b>X</b>" }, loja: "L", de: "2026-10-01", ate: "2026-10-10", estoque: 1, custo: 1, preco: 2, movimentos: [] });
    expect(h).toContain("&lt;b&gt;X&lt;/b&gt;");
    expect(h).toContain("Nenhuma movimentação no período");
    expect(h).not.toContain("Atacado");
  });
  it("imprime o atacado só quando o produto tem", () => {
    const h = htmlFichaProduto({ produto: { nome: "X" }, loja: "L", de: "2026-10-01", ate: "2026-10-10", estoque: 1, custo: 1, preco: 2, atacado: 1.5, movimentos: [] });
    expect(h).toMatch(/Atacado: <b>R\$\s1,50<\/b>/);
  });
});

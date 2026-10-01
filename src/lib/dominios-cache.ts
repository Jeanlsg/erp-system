// ============================================================
// Domínios do cache: quais leituras uma gravação deixa velhas.
//
// O erro que isto existe para impedir: o fechamento de caixa mostrava como
// "esperado na gaveta" só o saldo inicial, mesmo depois de R$ 400 vendidos em
// dinheiro. O banco calculava certo (vw_caixa_resumo); a tela exibia o resumo
// lido na ABERTURA do caixa, porque a venda não avisava ninguém de que o caixa
// tinha mudado. A varredura achou 75 pontos de gravação com o mesmo defeito —
// cada um invalidava à mão a sua listinha de chaves, e a lista sempre faltava
// alguma (ou trazia uma grafia que não existia).
//
// Aqui as chaves ficam agrupadas pelo que elas mostram. Quem grava diz QUE
// domínio mudou, não quais chaves: `invalidarDominios(qc, ...DOMINIOS_DA_VENDA)`.
// O teste dominios-cache.test.ts confere que toda chave listada existe.
// ============================================================

export const DOMINIOS = {
  /** Vendas e o que se calcula delas: listas, relatórios, painel, metas, comissões. */
  venda: [
    "erp_vendas", "erp_vendas-hoje", "erp_vendas-por-dia", "erp_vendas-por-dia-view",
    "erp-vendas-por-periodo", "erp_rel_vendas", "erp-top-produtos-vendidos", "erp_top-produtos",
    "erp_top-produtos-view", "erp_curva_abc", "erp_itens_devolviveis", "erp_dashboard",
    "erp_dashboard-stats", "erp_metas", "erp_comissoes", "erp_notas_fiscais-venda-ids",
  ],
  /** O turno de caixa: resumo aberto, esperado na gaveta, sangrias, fechamentos. */
  caixa: [
    "erp_caixa", "erp_caixa-aberto", "erp_caixa_movimentacoes", "erp_fechamentos-caixa",
    "erp_rel_fechamentos", "erp_sangrias", "erp_entradas-extras", "erp-sangrias-periodo",
    "erp-entradas-extras-periodo", "erp_vendas-hoje-caixa", "erp_formas-recebimento",
    "erp-taxas-cartao", "erp_fluxo-caixa", "erp_fluxo-caixa-kpis",
  ],
  /** Saldo, lotes e tudo que depende do estoque — inclusive as listas de produto. */
  estoque: [
    "erp_estoque", "erp_estoque_produto", "erp_estoque_movimentacoes", "erp_estoque-baixo",
    "erp_estoque_negativo", "erp_estoque_parado", "erp_lotes", "erp_lotes-vencendo",
    "erp_lotes_produto", "erp_sugestao_compra", "erp_produtos", "erp_produto_completo",
    "erp_produto_total", "erp_produtos-com-estoque", "erp_dashboard-stats",
  ],
  /** Contas a pagar/receber e o que sai delas: crediário, fluxo de caixa, DRE. */
  contas: [
    "erp_contas", "erp_contas-vencidas", "erp_crediario_clientes", "erp_crediario_contratos",
    "erp_promissorias", "erp_parcelamentos", "erp_parcelamentos_full", "erp_boletos",
    "erp_clientes_compras", "erp_dre_mensal", "erp_fluxo-caixa", "erp_fluxo-caixa-kpis",
    "erp_dashboard-stats",
  ],
  /** Cadastro de pessoas e suas visões (clientes, fornecedores, vendedores). */
  pessoas: [
    "erp_pessoas", "erp_clientes", "erp_fornecedores", "erp_clientes_compras", "erp_pessoa_lojas",
    "erp_crediario_clientes", "erp_aniversariantes", "erp_vendedores", "erp_funcionarios",
    "erp_dfe_pendentes",
  ],
  fidelidade: ["erp_cartao_fidelidade", "erp_fidelidade_movimentacoes"],
  pedidos: ["erp_pedidos", "erp_pedidos_saldo", "erp_pedido_itens", "erp_orcamentos"],
} as const;

export type Dominio = keyof typeof DOMINIOS;

/**
 * Uma venda (PDV, orçamento convertido, devolução) mexe em quase tudo: caixa,
 * estoque, contas (crediário), cadastro (cliente da filial), fidelidade e o
 * saldo de pedidos. Os triggers do banco fazem isso numa transação só; a tela
 * tem de acompanhar.
 */
export const DOMINIOS_DA_VENDA: Dominio[] = ["venda", "caixa", "estoque", "contas", "pessoas", "fidelidade", "pedidos"];

/** As chaves, sem repetição, de um ou mais domínios. */
export function chavesDosDominios(...dominios: Dominio[]): string[] {
  return Array.from(new Set(dominios.flatMap((d) => DOMINIOS[d])));
}

/**
 * Marca como velhas todas as leituras dos domínios. A invalidação é por
 * prefixo: ["erp_caixa"] também alcança ["erp_caixa", lojaId].
 */
export function invalidarDominios(
  qc: { invalidateQueries: (f: { queryKey: unknown[] }) => unknown },
  ...dominios: Dominio[]
) {
  for (const chave of chavesDosDominios(...dominios)) {
    void qc.invalidateQueries({ queryKey: [chave] });
  }
}

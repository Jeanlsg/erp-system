/**
 * Conferência do fechamento por forma de pagamento.
 *
 * Duas regras ligadas pelo dono em Configurações Gerais (migration 090):
 *
 *   caixa_exigir_valores_por_forma — o operador declara quanto entrou em cada
 *     forma, não só o total da gaveta. Pega venda lançada na forma errada, que
 *     é o erro que mais desencontra caixa: o dinheiro bate, a maquininha não.
 *
 *   caixa_ocultar_esperado — o operador conta às cegas, sem ver o esperado.
 *     Controle de rotina contra o ajuste do valor informado. NÃO é segurança:
 *     o esperado continua legível na view para quem chamar a API direto.
 *
 * A lógica mora aqui, fora do componente, porque é ela que decide se o caixa
 * fecha — e isso precisa de teste.
 */

export type FormaFechamento = {
  chave: string;
  rotulo: string;
  /** coluna de vw_caixa_resumo com o que o sistema registrou nesta forma */
  campo: string;
  /** parâmetro correspondente em useFecharCaixa */
  arg: string;
};

export const FORMAS_FECHAMENTO: FormaFechamento[] = [
  { chave: "dinheiro", rotulo: "Dinheiro em gaveta", campo: "vendas_dinheiro", arg: "valorDinheiro" },
  { chave: "pix", rotulo: "PIX", campo: "vendas_pix", arg: "valorPix" },
  { chave: "cartao_credito", rotulo: "Cartão crédito", campo: "vendas_cartao_credito", arg: "valorCartaoCredito" },
  { chave: "cartao_debito", rotulo: "Cartão débito", campo: "vendas_cartao_debito", arg: "valorCartaoDebito" },
  { chave: "outras", rotulo: "Outras formas", campo: "vendas_outras", arg: "valorOutros" },
];

/**
 * Quais formas o operador precisa declarar.
 *
 * Com o esperado à mostra, pedir só as formas que tiveram movimento (mais
 * dinheiro, que sempre entra por causa do saldo inicial) evita cinco campos
 * zerados na tela. Com o esperado oculto, isso não serve: a própria lista de
 * formas exibidas já diria onde houve venda. Aí pede-se todas.
 */
export function formasParaDeclarar(
  resumo: Record<string, unknown> | null | undefined,
  podeVerEsperado: boolean,
): FormaFechamento[] {
  if (!podeVerEsperado) return FORMAS_FECHAMENTO;
  return FORMAS_FECHAMENTO.filter(
    (f) => f.chave === "dinheiro" || Number((resumo as any)?.[f.campo] || 0) > 0,
  );
}

/** Um campo só vale se for número e não negativo. Vazio não é zero. */
export function valorDeclaradoValido(bruto: string | undefined): boolean {
  if (bruto == null || bruto.trim() === "") return false;
  const v = Number(bruto.replace(",", "."));
  return Number.isFinite(v) && v >= 0;
}

/** Falta declarar alguma forma? (sempre false quando a regra está desligada) */
export function faltaDeclarar(
  formas: FormaFechamento[],
  declarados: Record<string, string>,
  exigir: boolean,
): boolean {
  if (!exigir) return false;
  return formas.some((f) => !valorDeclaradoValido(declarados[f.chave]));
}

/**
 * Converte o que o operador digitou nos parâmetros de useFecharCaixa.
 * Retorna null quando algum campo é inválido — quem chama não fecha o caixa.
 */
export function argumentosDeFechamento(
  formas: FormaFechamento[],
  declarados: Record<string, string>,
): Record<string, number> | null {
  const saida: Record<string, number> = {};
  for (const f of formas) {
    if (!valorDeclaradoValido(declarados[f.chave])) return null;
    saida[f.arg] = Number((declarados[f.chave] as string).replace(",", "."));
  }
  return saida;
}

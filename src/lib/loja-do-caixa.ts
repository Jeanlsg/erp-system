/**
 * Qual loja vale na frente de caixa.
 *
 * O PDV tinha duas fontes para a mesma resposta: o seletor do cabeçalho e o
 * caixa aberto. Com o caixa #1 aberto em Juazeiro e o cabeçalho trocado para
 * Petrolina, a venda era gravada com loja_id de Petrolina amarrada ao caixa
 * de Juazeiro — estoque baixado na loja errada e venda fora do fechamento do
 * caixa que recebeu o dinheiro.
 *
 * Regra: caixa aberto manda. O seletor só decide ONDE abrir o próximo caixa.
 */
export function lojaEfetivaDoPdv(
  caixaAberto: { loja_id?: string | null } | null | undefined,
  lojaDoCabecalho: string | null | undefined,
): string | null {
  return caixaAberto?.loja_id ?? lojaDoCabecalho ?? null;
}

/** O seletor de loja pode ser trocado? Não, enquanto houver caixa aberto. */
export function podeTrocarDeLoja(
  caixaAberto: { loja_id?: string | null } | null | undefined,
): boolean {
  return !caixaAberto?.loja_id;
}

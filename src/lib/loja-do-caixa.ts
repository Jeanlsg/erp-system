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
  /** a tela está NA frente de venda? false quando o operador saiu dela */
  naFrente = true,
): string | null {
  if (naFrente && caixaAberto?.loja_id) return caixaAberto.loja_id;
  return lojaDoCabecalho ?? null;
}

/**
 * O seletor de loja pode ser trocado?
 *
 * Não durante a venda: o cupom sairia numa loja com o caixa em outra. Mas sim
 * quando o operador sai da frente de caixa — é de lá que o admin abre um
 * segundo caixa, e um segundo caixa na mesma loja do primeiro raramente é o
 * que se quer. Sem esta abertura, "abrir outro caixa" nunca alcançaria a
 * outra loja.
 */
export function podeTrocarDeLoja(
  caixaAberto: { loja_id?: string | null } | null | undefined,
  naFrente = true,
): boolean {
  if (!naFrente) return true;
  return !caixaAberto?.loja_id;
}

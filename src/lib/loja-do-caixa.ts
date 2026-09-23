/**
 * Qual filial e qual caixa a frente de caixa opera.
 *
 * A filial é a do seletor do topo, como em toda tela. O PDV opera o caixa
 * aberto do usuário NAQUELA filial; se não houver, mostra a abertura dela.
 *
 * Antes era o contrário: o caixa aberto mandava na filial. O PDV operava o
 * último caixa aberto, fosse de que loja fosse, e ao entrar ainda devolvia o
 * seletor para a loja desse caixa. Com o caixa de Petrolina aberto, escolher
 * Juazeiro no topo não levava a Juazeiro — o PDV travava em Petrolina.
 *
 * A garantia que motivou aquela regra continua de pé por construção: o caixa
 * operado é sempre da filial do topo, então venda e caixa nunca ficam em
 * lojas diferentes.
 */

type CaixaAberto = { id: string; loja_id?: string | null };

/** O caixa que o PDV opera: o escolhido, se for desta filial; senão o mais recente dela. */
export function caixaAtivoNaLoja<T extends CaixaAberto>(
  abertos: T[] | null | undefined,
  lojaId: string | null | undefined,
  escolhidoId: string | null | undefined,
): T | null {
  if (!lojaId || !abertos?.length) return null;
  const daLoja = abertos.filter((c) => c.loja_id === lojaId);
  if (daLoja.length === 0) return null;
  return daLoja.find((c) => c.id === escolhidoId) ?? daLoja[0];
}

/** Caixas do usuário que ficaram abertos em outra filial. */
export function caixasEmOutrasLojas<T extends CaixaAberto>(
  abertos: T[] | null | undefined,
  lojaId: string | null | undefined,
): T[] {
  return (abertos ?? []).filter((c) => c.loja_id !== lojaId);
}

/**
 * Pode trocar de filial na frente de caixa? Só não com venda em andamento:
 * o cupom começado numa loja não pode terminar na outra.
 */
export function podeTrocarDeLoja(cupomComItens: boolean): boolean {
  return !cupomComItens;
}

/**
 * Pode abrir mais um caixa?
 *
 * Quem não pode manter vários (só o admin pode) e já tem um aberto, em
 * qualquer filial, é recusado aqui. No banco, abrir o segundo FECHA SOZINHO o
 * primeiro, sem ninguém contar a gaveta — e trocar de filial no topo tornou
 * esse caminho fácil de pisar: bastava escolher a outra loja e abrir.
 */
export function podeAbrirOutroCaixa<T extends CaixaAberto>(
  abertos: T[] | null | undefined,
  podeVarios: boolean,
): { ok: true } | { ok: false; aberto: T } {
  if (podeVarios || !abertos?.length) return { ok: true };
  return { ok: false, aberto: abertos[0] };
}

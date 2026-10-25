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
type CaixaDeAlguem = CaixaAberto & { usuario_id?: string | null };

/**
 * Os caixas que a frente pode operar: os do próprio usuário e, para o
 * vendedor, os turnos abertos por quem está acima dele que o banco liberou
 * (erp.caixas_operaveis, migration 113).
 *
 * Os próprios vêm primeiro: com o caixa dele aberto, é nele que o vendedor
 * cai. Nenhum aparece duas vezes — a lista do banco também traz os próprios.
 * A escolha entre eles continua sendo de `caixaAtivoNaLoja`.
 */
export function caixasParaOperar<T extends CaixaAberto>(
  proprios: T[] | null | undefined,
  operaveis: T[] | null | undefined,
): T[] {
  const vistos = new Set<string>();
  const todos: T[] = [];
  for (const c of [...(proprios ?? []), ...(operaveis ?? [])]) {
    if (vistos.has(c.id)) continue;
    vistos.add(c.id);
    todos.push(c);
  }
  return todos;
}

/** O turno foi aberto por outra pessoa (o vendedor operando o caixa de quem está acima)? */
export function caixaDeOutraPessoa(
  caixa: CaixaDeAlguem | null | undefined,
  usuarioId: string | null | undefined,
): boolean {
  return !!caixa?.usuario_id && caixa.usuario_id !== usuarioId;
}

/**
 * Por que este usuário não pode fechar o caixa da frente — ou null, se pode.
 *
 * Fechar exige a permissão (o master tira do vendedor ao criar o login) E ter
 * aberto o caixa: quem conta a gaveta e assina a diferença é quem abriu. O
 * vendedor no caixa de outra pessoa vende, mas não fecha; o turno alheio
 * esquecido se fecha por fora (fechar_caixa_indireto, gerente/master).
 */
export function motivoParaNaoFechar(
  caixa: CaixaDeAlguem | null | undefined,
  usuarioId: string | null | undefined,
  temPermissao: boolean,
  nomeDeQuemAbriu?: string | null,
): string | null {
  if (!caixa) return "Nenhum caixa aberto.";
  if (!temPermissao) return "Seu usuário não tem permissão para fechar caixa. Fale com o usuário master.";
  if (caixaDeOutraPessoa(caixa, usuarioId)) {
    return `Este caixa foi aberto por ${nomeDeQuemAbriu || "outra pessoa"}: só quem abriu fecha o caixa.`;
  }
  return null;
}

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

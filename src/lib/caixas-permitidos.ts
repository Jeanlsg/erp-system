/**
 * Quais caixas uma conta pode abrir, e qual caixa a frente de caixa opera.
 *
 * Duas regras que decidem onde o dinheiro entra, por isso moram fora do
 * componente e têm teste.
 *
 * A lista de permissão é uma ALLOWLIST com padrão aberto: conta sem nenhuma
 * linha abre qualquer caixa. É o que mantém as contas que já existiam
 * funcionando — a trava só passa a valer quando alguém for de fato
 * restringido na tela de usuários. O banco aplica a mesma regra no gatilho de
 * abertura (migration 092); aqui é só para não oferecer o que vai ser negado.
 */

export type Ponto = { id: string };

/** Os caixas desta loja que a conta pode abrir. */
export function pontosQuePodeAbrir<T extends Ponto>(
  pontos: T[],
  permitidos: string[] | undefined,
): T[] {
  if (!permitidos || permitidos.length === 0) return pontos;
  const ok = new Set(permitidos);
  return pontos.filter((p) => ok.has(p.id));
}

/**
 * Qual caixa aberto a tela opera.
 *
 * O escolhido, se ainda estiver aberto; senão o mais recente. A segunda parte
 * importa: o caixa escolhido some da lista quando é fechado — de outro
 * terminal, ou pelo fechamento indireto — e sem o recuo a tela ficaria presa
 * num caixa que não existe mais.
 */
export function caixaAtivo<T extends { id: string }>(
  abertos: T[],
  escolhidoId: string | null | undefined,
): T | null {
  if (!abertos || abertos.length === 0) return null;
  return abertos.find((c) => c.id === escolhidoId) ?? abertos[0];
}

/**
 * A conta pode manter mais de um caixa aberto ao mesmo tempo?
 *
 * Só administrador. Gerente e caixa seguem com um turno por vez: dois caixas
 * abertos no mesmo nome são duas gavetas sob a mesma conferência, e quem
 * responde por isso é a administração. Espelha erp.pode_multiplos_caixas —
 * a decisão de verdade é a do banco, esta existe para a tela não oferecer o
 * que seria recusado.
 */
export function podeVariosCaixas(
  user: { admin_principal?: boolean | null; role?: string | null; papeis?: string[] | null } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.admin_principal) return true;
  if (user.role === "admin") return true;
  return !!user.papeis?.includes("admin");
}

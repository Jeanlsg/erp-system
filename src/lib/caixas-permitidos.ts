/**
 * Quais caixas uma conta pode abrir, e se ela pode manter vários abertos.
 * Qual caixa a frente de caixa opera está em lib/loja-do-caixa.
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

/**
 * Pode cadastrar, renomear e apagar caixas? Admin ou gerente — o mesmo
 * critério de erp.is_erp_admin(), que é quem de fato recusa no banco. Aqui é
 * para não mostrar ao operador botões que falhariam.
 */
export function podeGerirCaixas(
  user: { admin_principal?: boolean | null; role?: string | null; papeis?: string[] | null } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.admin_principal) return true;
  const papeis = user.papeis?.length ? user.papeis : [user.role ?? ""];
  return papeis.some((p) => p === "admin" || p === "gerente");
}

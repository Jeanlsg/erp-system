/**
 * Em quais filiais o usuário trabalha, e qual abre.
 *
 * O dono trabalha em todas; os demais, nas filiais cadastradas para eles na
 * tela de usuários (erp_usuario_lojas, migration 095). Quem tem uma só não
 * vê seletor de filial; quem tem duas ou mais vê só as suas.
 *
 * A regra de "quem vê o quê" é do banco (erp.lojas_do_usuario). Aqui fica só
 * a escolha de qual das permitidas abre.
 */

export type LojaResumo = { id: string; matriz?: boolean | null };

/**
 * Qual filial deixar selecionada.
 *
 *   1. a que já está, se for permitida — trocar sozinho irrita;
 *   2. a loja padrão do usuário, se permitida;
 *   3. a matriz entre as permitidas;
 *   4. a primeira permitida.
 *
 * A primeira regra também corrige o navegador: a loja fica guardada nele, e
 * se o administrador tirar o usuário daquela filial, ela deixa de valer.
 */
export function lojaInicial(
  permitidas: LojaResumo[],
  atual: string | null | undefined,
  padrao: string | null | undefined,
): string | null {
  if (permitidas.length === 0) return null;
  if (atual && permitidas.some((l) => l.id === atual)) return atual;
  if (padrao && permitidas.some((l) => l.id === padrao)) return padrao;
  return (permitidas.find((l) => l.matriz) ?? permitidas[0]).id;
}

/** O seletor de filial aparece? Só para quem trabalha em mais de uma. */
export function alternaFiliais(permitidas: LojaResumo[]): boolean {
  return permitidas.length > 1;
}

/**
 * Normaliza o retorno de erp.lojas_do_usuario. Função SETOF uuid pode vir da
 * API como lista de textos ou de objetos, conforme a versão do PostgREST.
 */
export function idsDeLojas(bruto: unknown): string[] {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .map((x) => (typeof x === "string" ? x : (x as any)?.lojas_do_usuario ?? (x as any)?.id))
    .filter((x): x is string => typeof x === "string");
}

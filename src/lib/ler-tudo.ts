// ============================================================
// Ler uma lista INTEIRA pelo PostgREST.
//
// O PostgREST da VPS devolve no máximo 1000 linhas por pedido
// (PGRST_DB_MAX_ROWS=1000) e corta o resto SEM erro. Uma lista de produtos com
// 1.200 itens chegava com 1.000 — e a tela de Produtos, que lê uma linha por
// produto POR LOJA, parava em 500 produtos com as duas filiais. Busca no PDV,
// seletor de cliente e "estoque baixo" do painel erravam do mesmo jeito.
//
// Aqui o pedido é repetido em páginas até vir uma incompleta. `montar` tem de
// devolver um construtor NOVO a cada chamada (o do supabase-js não é
// reaproveitável) e com ordenação TOTAL — termine com uma coluna única (`id`),
// senão linhas com o mesmo nome podem pular ou repetir entre as páginas.
// ============================================================

/** Tamanho da página: o mesmo limite do servidor. */
export const LINHAS_POR_PAGINA = 1000;

interface Paginavel<T> {
  range(de: number, ate: number): PromiseLike<{ data: T[] | null; error: unknown }>;
}

export async function lerTudo<T = any>(
  montar: () => Paginavel<T>,
  pagina = LINHAS_POR_PAGINA,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += pagina) {
    const { data, error } = await montar().range(de, de + pagina - 1);
    if (error) throw error;
    const lote = data ?? [];
    linhas.push(...lote);
    if (lote.length < pagina) return linhas;
  }
}

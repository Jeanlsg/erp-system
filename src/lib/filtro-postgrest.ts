/**
 * Texto digitado dentro de um filtro .or() do PostgREST. Sem aspas, uma
 * vírgula ou um parêntese no texto partia o filtro ("Whey (900g)" quebrava a
 * busca) — varredura de 03/11/2026. Entre aspas o PostgREST lê o valor
 * inteiro; aspas e barra do próprio texto vão escapadas.
 */
export function valorDoFiltro(texto: string): string {
  return `"${texto.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

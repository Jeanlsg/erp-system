// ============================================================
// Valor de atacado do produto (migration 115) — o que gravar a partir do
// campo do formulário.
//
// Pedido da loja (10/2026): o sistema anterior tinha "Valor de atacado" no
// cadastro do produto. O campo é opcional e vazio quer dizer "sem atacado"
// (nulo no banco), o que cria uma armadilha que os outros preços não têm:
// campo vazio pode ser "a pessoa limpou" ou "o valor nunca chegou à tela".
//
// O formulário de produto é hidratado do cadastro completo, mas cai na
// linha da view (que não tem esta coluna) quando a lista ainda não carregou,
// e o banco sem a 115 também não devolve a coluna. Nesses casos o campo
// aparece vazio e, se o Salvar mandasse nulo, apagaria em silêncio o atacado
// que já estava gravado. Por isso a regra recebe o valor ORIGINAL e só
// manda nulo quando sabe que havia algo para limpar.
// ============================================================

export type PrecoAtacadoGravado = number | string | null | undefined;

/** Valor gravado → texto do campo ("" quando não há atacado). */
export function textoPrecoAtacado(gravado: PrecoAtacadoGravado): string {
  if (gravado === null || gravado === undefined || gravado === "") return "";
  const n = Number(gravado);
  return Number.isFinite(n) ? String(n) : "";
}

/** Valor que veio do banco: undefined quando o registro não trouxe a coluna. */
export function precoAtacadoOriginal(registro: Record<string, any> | null | undefined): number | null | undefined {
  if (!registro || !("preco_atacado" in registro)) return undefined;
  const v = registro.preco_atacado;
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Pedaço do payload do produto com o atacado.
 *
 * @param texto    o que está no campo (vazio = sem atacado)
 * @param original o que está gravado: número, null (sem atacado) ou
 *                 undefined quando não se sabe — produto novo, linha da view
 *                 ou banco sem a coluna.
 *
 * - Sem original conhecido, campo vazio não vai no payload: em produto novo
 *   o banco já grava nulo, e em edição não há como saber se havia valor.
 *   Isso também deixa cadastrar e editar funcionando antes da 115 ser
 *   aplicada, enquanto ninguém digitar um atacado.
 * - Valor igual ao gravado também não vai: salvar sem mexer não toca a coluna.
 * - Campo limpo com valor gravado vai como null.
 */
export function precoAtacadoNoPayload(
  texto: string,
  original: number | null | undefined,
): { ok: true; campos: { preco_atacado?: number | null } } | { ok: false; erro: string } {
  const t = String(texto ?? "").trim();
  let valor: number | null;
  if (t === "") {
    valor = null;
  } else {
    // com vírgula, ela é o decimal e o ponto é milhar (1.234,56)
    const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
    if (!Number.isFinite(n)) return { ok: false, erro: "Valor de atacado inválido." };
    if (n < 0) return { ok: false, erro: "O valor de atacado não pode ser negativo." };
    valor = Math.round(n * 100) / 100;
  }

  if (original === undefined) {
    return { ok: true, campos: valor === null ? {} : { preco_atacado: valor } };
  }
  if (valor === original) return { ok: true, campos: {} };
  return { ok: true, campos: { preco_atacado: valor } };
}

/**
 * Quantidade de um lançamento no PDV.
 *
 * Existia como `Math.max(1, parseFloat(campo) || 1)` seguido de um laço que
 * chamava a inclusão UMA VEZ POR UNIDADE. Duas consequências, as duas vistas
 * em uso:
 *
 *   1. O campo de quantidade não tinha teto. O TAB no código joga o foco
 *      exatamente ali, então bipar o próximo produto punha um código de
 *      barras no lugar da quantidade. Treze dígitos viram trilhões de voltas,
 *      cada uma empilhando uma atualização de estado: a aba morre de memória,
 *      o cupom se perde e nenhum aviso aparece — porque não sobra tela para
 *      mostrar aviso.
 *
 *   2. O laço conta em inteiros. Quantidade 2,5 lançava 3. Em produto vendido
 *      a peso isso é diferença de faturamento em toda venda.
 *
 * O teto é baixo de propósito. Acima dele, em balcão de suplementos, é sempre
 * erro de digitação ou bipe no campo errado — e recusar com aviso é melhor
 * que lançar e descobrir no estoque.
 */

export const QTD_MAXIMA_POR_LANCAMENTO = 1000;

export type QtdValida = { ok: true; qtd: number };
export type QtdInvalida = { ok: false; erro: string };

/**
 * Lê o que está no campo de quantidade.
 *
 * Campo vazio vale 1: o operador que bipa e dá Enter sem tocar na quantidade
 * está vendendo uma unidade, e obrigá-lo a digitar "1" atrasaria a fila.
 */
export function quantidadeParaLancar(bruto: string | null | undefined): QtdValida | QtdInvalida {
  const t = String(bruto ?? "").trim();
  if (t === "") return { ok: true, qtd: 1 };

  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n)) {
    return { ok: false, erro: "Quantidade inválida. Digite um número." };
  }
  if (n <= 0) {
    return { ok: false, erro: "A quantidade precisa ser maior que zero." };
  }
  if (n > QTD_MAXIMA_POR_LANCAMENTO) {
    return {
      ok: false,
      erro: `Quantidade de ${n} é maior que o limite de ${QTD_MAXIMA_POR_LANCAMENTO} por lançamento. `
        + "Confira se um código de barras não foi bipado no campo de quantidade.",
    };
  }
  // três casas bastam para peso; mais que isso é ruído de ponto flutuante
  return { ok: true, qtd: Math.round(n * 1000) / 1000 };
}

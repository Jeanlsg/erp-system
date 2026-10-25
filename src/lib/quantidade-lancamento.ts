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
  // O estoque é contado em unidades inteiras (erp_estoque, movimentações,
  // lotes e kits são integer; registrar_venda_pdv converte a quantidade com
  // ::integer — conferido no banco em 25/10/2026). Uma fração passava daqui
  // e a venda morria no servidor com "invalid input syntax for type
  // integer"; na fila offline ela ficava bloqueada com a mercadoria já
  // entregue. Recusar aqui, com o cliente na frente, é o lugar certo.
  if (!Number.isInteger(n)) {
    return { ok: false, erro: "A quantidade tem de ser um número inteiro: o estoque é controlado por unidade." };
  }
  return { ok: true, qtd: n };
}

/**
 * "Quantidade em Dinheiro" (Ctrl+R), como no sistema anterior: o cliente diz
 * quanto quer gastar e o campo de quantidade passa a receber o VALOR. Como o
 * estoque é por unidade inteira, a quantidade é quantas unidades o valor
 * compra (para baixo: R$ 10 de um item de R$ 3 = 3), com o mesmo teto do
 * lançamento comum.
 */
export function quantidadePorValor(
  bruto: string | null | undefined,
  precoUnitario: number,
): QtdValida | QtdInvalida {
  const v = Number(String(bruto ?? "").trim().replace(",", "."));
  if (!Number.isFinite(v) || v <= 0) {
    return { ok: false, erro: "Informe o valor em dinheiro, maior que zero." };
  }
  if (!(precoUnitario > 0)) {
    return { ok: false, erro: "Produto sem preço de venda: não dá para calcular a quantidade pelo valor." };
  }
  // centavos antes de dividir: 0,1 + 0,2 não pode virar 0,30000000000000004
  const qtd = Math.floor(Math.round(v * 100) / Math.round(precoUnitario * 100) + 1e-9);
  if (qtd < 1) {
    return { ok: false, erro: "O valor informado não compra nem uma unidade deste produto." };
  }
  return quantidadeParaLancar(String(qtd));
}

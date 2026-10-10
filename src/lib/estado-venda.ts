// ============================================================
// O que pertence a UMA venda no PDV, e quando isso tem de ser esquecido.
//
// ⚠️ Defeito visto pela loja em 10/10/2026: um desconto dado num teste
// continuou na venda seguinte (e não apagava, porque o campo trava com
// pagamento lançado), e uma venda de R$ 15 abriu com os pagamentos da venda
// anterior — "os pagamentos passaram do total em R$ 64,00". Só a venda
// finalizada e o F11 zeravam o estado; tirar os itens do cupom, ou trocar os
// itens depois de lançar pagamento, deixava tudo da venda anterior.
//
// Regra: cupom vazio = venda nova (zera tudo); itens mudaram depois de lançar
// pagamento = os pagamentos eram de outro total (descarta e avisa).
// ============================================================

export interface ItemDoCupom {
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  desconto?: number;
}

/** Retrato do que está sendo vendido: muda quando muda item, quantidade, preço ou desconto do item. */
export function assinaturaDoCupom(itens: ItemDoCupom[]): string {
  return itens
    .map((i) => `${i.produto_id}:${i.quantidade}:${i.preco_unitario}:${Number(i.desconto) || 0}`)
    .sort()
    .join("|");
}

export type ReacaoAoCupom = "nada" | "zerar_venda" | "descartar_pagamentos";

/**
 * O que fazer quando o cupom mudou.
 * @param antes assinatura anterior
 * @param agora assinatura atual
 * @param temPagamentos se já há pagamento lançado
 */
export function reacaoAoCupom(antes: string, agora: string, temPagamentos: boolean): ReacaoAoCupom {
  if (antes === agora) return "nada";
  if (agora === "") return "zerar_venda";
  if (temPagamentos) return "descartar_pagamentos";
  return "nada";
}

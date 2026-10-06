// ============================================================
// Cancelar venda — a ordem dos passos.
//
// Nota fiscal e venda são canceladas em lugares diferentes (a nota na SEFAZ,
// pela edge erp-eventos-fiscais; a venda no banco, por erp.cancelar_venda) e
// não há transação entre os dois. A ordem é o que evita estado torto:
//
//   1. simular no banco — caixa fechado, devolução, parcela recebida e
//      permissão recusam AQUI, antes de tocar na SEFAZ;
//   2. cancelar na SEFAZ cada nota autorizada da venda;
//   3. cancelar a venda.
//
// ⚠️ Invertido, uma recusa do banco depois do passo 2 deixaria a nota
// cancelada e a venda de pé, contando no caixa e no estoque. Nota ainda não
// transmitida (contingência) não tem o que cancelar na SEFAZ: recusa e manda
// transmitir antes.
// ============================================================

export interface NotaDaVenda {
  id: string;
  numero: number | string;
  tipo: string;
  status: string;
}

export interface ResultadoCancelamento {
  cancelada: boolean;
  itens_ao_estoque?: number;
  contas_canceladas?: number;
  pontos_estornados?: number;
  comissao_ja_paga?: boolean;
  pedido_entrega_cancelado?: boolean;
}

export interface PassosCancelamento {
  simular: () => Promise<unknown>;
  notas: () => Promise<NotaDaVenda[]>;
  cancelarNota: (notaId: string) => Promise<unknown>;
  cancelar: () => Promise<ResultadoCancelamento>;
  /** avisa a tela do andamento (opcional) */
  aoAvancar?: (etapa: string) => void;
}

export const MOTIVO_MINIMO = 15;

const rotuloNota = (n: NotaDaVenda) => `${n.tipo === "nfce" ? "NFC-e" : "NF-e"} nº ${n.numero}`;

export async function cancelarVendaEmOrdem(p: PassosCancelamento): Promise<{
  resultado: ResultadoCancelamento;
  notasCanceladas: string[];
}> {
  p.aoAvancar?.("Conferindo se a venda pode ser cancelada…");
  await p.simular();

  const notas = await p.notas();
  const naoTransmitidas = notas.filter((n) => n.status === "pendente_transmissao" || n.status === "pendente_arquivo");
  if (naoTransmitidas.length) {
    throw new Error(
      `${naoTransmitidas.map(rotuloNota).join(", ")} ainda não foi transmitida/concluída — ` +
      "resolva em Notas Fiscais antes de cancelar a venda.",
    );
  }

  const notasCanceladas: string[] = [];
  for (const n of notas.filter((x) => x.status === "autorizada")) {
    p.aoAvancar?.(`Cancelando a ${rotuloNota(n)} na SEFAZ…`);
    try {
      await p.cancelarNota(n.id);
    } catch (e: any) {
      throw new Error(
        `A SEFAZ não cancelou a ${rotuloNota(n)}: ${e?.message ?? e}. ` +
        "A venda NÃO foi cancelada. Se o prazo de cancelamento da nota passou, use Devolução.",
      );
    }
    notasCanceladas.push(rotuloNota(n));
  }

  p.aoAvancar?.("Cancelando a venda…");
  const resultado = await p.cancelar();
  return { resultado, notasCanceladas };
}

/** Resumo para o operador do que o cancelamento desfez. */
export function resumoCancelamento(r: ResultadoCancelamento, notasCanceladas: string[]): string {
  const partes = [
    notasCanceladas.length ? `${notasCanceladas.join(", ")} cancelada(s) na SEFAZ` : null,
    r.itens_ao_estoque ? `${r.itens_ao_estoque} item(ns) de volta ao estoque` : null,
    r.contas_canceladas ? `${r.contas_canceladas} conta(s) a receber cancelada(s)` : null,
    r.pontos_estornados ? `${r.pontos_estornados} ponto(s) de fidelidade estornado(s)` : null,
    r.pedido_entrega_cancelado ? "pedido de entrega cancelado" : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Venda cancelada.";
}

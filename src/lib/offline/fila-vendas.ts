// ============================================================
// Fila de vendas do PDV
//
// A venda offline não é um rascunho: é um fato que já aconteceu no balcão.
// Por isso ela entra na fila ANTES de qualquer tentativa de envio, e só sai
// quando o servidor confirma. Se o navegador fechar no meio, ela continua lá.
//
// O reenvio é seguro porque a chave de idempotência (uuid_local) é gerada no
// caixa: o servidor devolve a mesma venda em vez de criar outra. É o que
// permite reenviar sem medo quando não se sabe se a primeira tentativa chegou.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  enfileirar, lerFila, removerDaFila, type VendaEnfileirada,
} from "./db";
import { ehErroDeRede, estaOnline, marcarFalhaDeRede, marcarSucessoDeRede } from "./conexao";

export type { VendaEnfileirada };

function novoUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Navegador sem randomUUID (http em rede local, por exemplo).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface ResultadoVenda {
  venda_id: string;
  numero: number;
  duplicada: boolean;
}

async function enviar(payload: any): Promise<ResultadoVenda> {
  const { data, error } = await supabase.schema("erp").rpc("registrar_venda_pdv", { p_venda: payload });
  if (error) throw error;
  marcarSucessoDeRede();
  return data as ResultadoVenda;
}

/**
 * Registra a venda. Online, vai direto; offline (ou se a rede cair no meio),
 * fica na fila. Nos dois casos a venda existe do ponto de vista do caixa —
 * o retorno diz apenas onde ela está.
 */
export async function registrarVenda(
  venda: any,
): Promise<{ enviada: boolean; resultado?: ResultadoVenda; uuid_local: string }> {
  const uuid_local = venda.uuid_local ?? novoUuid();
  const payload = {
    ...venda,
    uuid_local,
    criada_em_local: venda.criada_em_local ?? new Date().toISOString(),
  };

  const item: VendaEnfileirada = {
    uuid_local,
    loja_id: venda.loja_id,
    criado_em: payload.criada_em_local,
    payload,
    tentativas: 0,
    status: "pendente",
  };

  // Entra na fila primeiro. Se o envio funcionar, sai logo em seguida; o
  // custo é uma escrita local, e o benefício é nunca haver uma janela em que
  // a venda não está em lugar nenhum.
  await enfileirar(item);

  if (!estaOnline()) return { enviada: false, uuid_local };

  try {
    const resultado = await enviar({ ...payload, origem_offline: false });
    await removerDaFila(uuid_local);
    return { enviada: true, resultado, uuid_local };
  } catch (err) {
    if (ehErroDeRede(err)) {
      marcarFalhaDeRede();
      return { enviada: false, uuid_local };
    }
    // Erro de regra (estoque, permissão): não adianta reenviar sozinho.
    await enfileirar({
      ...item,
      tentativas: 1,
      status: "bloqueada",
      ultimo_erro: (err as any)?.message ?? String(err),
    });
    throw err;
  }
}

/** Tenta enviar tudo que está pendente. Devolve o que aconteceu com cada uma. */
export async function drenarFila(): Promise<{ enviadas: number; falharam: number; bloqueadas: number }> {
  const fila = await lerFila();
  let enviadas = 0, falharam = 0, bloqueadas = 0;

  for (const item of fila) {
    if (item.status === "bloqueada") { bloqueadas++; continue; }
    try {
      // origem_offline=true é o que autoriza o servidor a aceitar saldo
      // negativo: a mercadoria saiu quando não havia como conferir.
      await enviar({ ...item.payload, origem_offline: true });
      await removerDaFila(item.uuid_local);
      enviadas++;
    } catch (err) {
      if (ehErroDeRede(err)) {
        marcarFalhaDeRede();
        falharam++;
        break; // rede caiu de novo: parar em vez de queimar a fila inteira
      }
      await enfileirar({
        ...item,
        tentativas: item.tentativas + 1,
        status: "bloqueada",
        ultimo_erro: (err as any)?.message ?? String(err),
      });
      bloqueadas++;
    }
  }
  return { enviadas, falharam, bloqueadas };
}

/** Desiste de uma venda travada — some da fila e não volta. */
export async function descartarDaFila(uuid_local: string) {
  await removerDaFila(uuid_local);
}

/** Reabilita uma venda bloqueada depois que a causa foi corrigida. */
export async function reabilitarNaFila(item: VendaEnfileirada) {
  await enfileirar({ ...item, status: "pendente", ultimo_erro: null });
}

export function useFilaVendas(online: boolean) {
  const [itens, setItens] = useState<VendaEnfileirada[]>([]);
  const [drenando, setDrenando] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      setItens(await lerFila());
    } catch {
      setItens([]);
    }
  }, []);

  useEffect(() => { void recarregar(); }, [recarregar]);

  const drenar = useCallback(async () => {
    setDrenando(true);
    try {
      const r = await drenarFila();
      await recarregar();
      return r;
    } finally {
      setDrenando(false);
    }
  }, [recarregar]);

  // Assim que a conexão volta, esvazia a fila sozinha: esperar o operador
  // lembrar de apertar um botão é como as vendas se perdem.
  useEffect(() => {
    if (!online) return;
    let cancelado = false;
    (async () => {
      const fila = await lerFila().catch(() => []);
      if (cancelado || fila.every((i) => i.status === "bloqueada")) return;
      await drenar();
    })();
    return () => { cancelado = true; };
  }, [online, drenar]);

  return {
    itens,
    pendentes: itens.filter((i) => i.status === "pendente").length,
    bloqueadas: itens.filter((i) => i.status === "bloqueada").length,
    drenando,
    drenar,
    recarregar,
  };
}

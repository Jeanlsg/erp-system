// ============================================================
// Catálogo do PDV para uso offline
//
// Sem internet, o caixa não consegue nem listar o que vende. O catálogo é
// espelhado localmente sempre que chega do servidor; quando a rede cai, a
// tela passa a ler o espelho.
//
// A cópia é deliberadamente enxuta: só o que o PDV usa para vender. Guardar
// o produto inteiro encheria o armazenamento local com dado que ninguém lê
// no balcão.
// ============================================================

import { useEffect, useState } from "react";
import { lerCache, salvarCache } from "./db";

export interface ProdutoOffline {
  id: string;
  nome: string;
  /** String vazia em vez de null: a busca do PDV chama .toLowerCase() direto. */
  sku: string;
  codigo_barras: string | null;
  preco_venda: number;
  preco_custo: number;
  estoque: number;
  imagem_url?: string | null;
  /** true quando o item é um kit (o servidor desmembra na venda) */
  ehKit?: boolean;
}

const chave = (lojaId: string) => `catalogo:${lojaId}`;

function enxugar(produtos: any[]): ProdutoOffline[] {
  return produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    sku: p.sku ?? "",
    codigo_barras: p.codigo_barras ?? null,
    preco_venda: Number(p.preco_venda ?? 0),
    preco_custo: Number(p.preco_custo ?? 0),
    // O saldo é o do momento da cópia. Offline ele só serve de referência
    // visual: quem decide o que sai da prateleira é o operador, e a baixa
    // real é conciliada no reenvio.
    estoque: Number(p.estoque ?? p.quantidade ?? 0),
    imagem_url: p.imagem_url ?? null,
    ...(p.ehKit ? { ehKit: true } : {}),
  }));
}

/**
 * Mantém o espelho local em dia enquanto há rede e devolve o que usar quando
 * não há. `produtos` é a lista que veio do servidor (vazia quando offline).
 */
export function useCatalogoOffline(lojaId: string | null | undefined, produtos: any[], online: boolean) {
  const [espelho, setEspelho] = useState<ProdutoOffline[]>([]);
  const [copiadoEm, setCopiadoEm] = useState<string | null>(null);

  // Salva enquanto dá — inclusive quando o operador nem sabe que vai precisar.
  useEffect(() => {
    if (!lojaId || !online || produtos.length === 0) return;
    void salvarCache(chave(lojaId), enxugar(produtos));
  }, [lojaId, online, produtos]);

  useEffect(() => {
    if (!lojaId) return;
    let cancelado = false;
    void lerCache<ProdutoOffline[]>(chave(lojaId)).then((c) => {
      if (cancelado || !c) return;
      setEspelho(c.dados ?? []);
      setCopiadoEm(c.atualizado_em);
    });
    return () => { cancelado = true; };
  }, [lojaId, online, produtos.length]);

  const usandoEspelho = !online && produtos.length === 0 && espelho.length > 0;

  return {
    produtos: usandoEspelho ? espelho : produtos,
    usandoEspelho,
    copiadoEm,
    /** Offline e sem cópia: não há como vender, e é melhor dizer isso. */
    semCatalogo: !online && produtos.length === 0 && espelho.length === 0,
  };
}

// ============================================================
// Catálogo de relatórios financeiros.
//
// Antes cada botão de "Relatórios Financeiros" abria um pop-up de 3
// colunas, altura fixa e sem nada: nem filtro próprio, nem ordenação, nem
// exportação, preso ao período da tela de trás. Para conferir um mês era
// preciso fechar, mudar a data, abrir de novo.
//
// Aqui cada relatório é uma tela de verdade: define a própria consulta e
// as próprias colunas, e a tela genérica (pages/relatorio-detalhe) entrega
// filtro de período, ordenação por coluna, totais e planilha.
// ============================================================

import { supabase } from "@/lib/supabase";
import type { Coluna } from "@/lib/exportar-csv";

export interface FiltrosRelatorio {
  de: string;
  ate: string;
  lojaId?: string;
  /** id do funcionário, quando o relatório aceita esse filtro */
  vendedorId?: string;
}

export interface Relatorio {
  titulo: string;
  descricao: string;
  /** o que o operador faz com este número */
  paraQue?: string;
  colunas: Coluna<any>[];
  /** filtros próprios além de período e loja */
  filtros?: ("vendedor")[];
  buscar: (f: FiltrosRelatorio) => Promise<any[]>;
}

const ate = (d: string) => d + "T23:59:59";

export const RELATORIOS: Record<string, Relatorio> = {
  fechamentos: {
    titulo: "Fechamentos de caixa",
    descricao: "Cada turno fechado, com o esperado na gaveta, o contado e a diferença.",
    paraQue: "Diferença que se repete no mesmo operador ou no mesmo caixa é o sinal de olhar a gaveta.",
    filtros: ["vendedor"],
    colunas: [
      { chave: "data_fechamento", titulo: "Fechamento", tipo: "data" },
      { chave: "caixa", titulo: "Caixa", valor: (f) => f.caixa?.ponto?.nome ?? (f.caixa?.numero_caixa != null ? `Caixa ${f.caixa.numero_caixa}` : "—") },
      { chave: "operador", titulo: "Operador", valor: (f) => f.usuario?.nome ?? "—" },
      { chave: "qtd_vendedores", titulo: "Qtd. vendedor", tipo: "numero" },
      { chave: "valor_inicial", titulo: "Saldo inicial (troco)", tipo: "dinheiro", total: true },
      { chave: "valor_entradas", titulo: "Entradas extra caixa", tipo: "dinheiro", total: true },
      { chave: "valor_sangrias", titulo: "Total sangria", tipo: "dinheiro", total: true },
      { chave: "total_frete", titulo: "Total frete", tipo: "dinheiro", total: true },
      { chave: "valor_vendas", titulo: "Total vendas", tipo: "dinheiro", total: true },
      { chave: "esperado", titulo: "Esperado", tipo: "dinheiro", total: true,
        valor: (f) => Number(f.valor_final ?? 0) - Number(f.diferenca ?? 0) },
      { chave: "total_entradas", titulo: "Total entradas", tipo: "dinheiro", total: true,
        valor: (f) => Number(f.valor_inicial ?? 0) + Number(f.valor_vendas ?? 0) + Number(f.valor_entradas ?? 0) },
      // o que passou pelo caixa em TODAS as formas, não só na gaveta
      { chave: "valor_em_caixa", titulo: "Valor em caixa", tipo: "dinheiro", total: true,
        valor: (f) => ["valor_dinheiro","valor_pix","valor_cartao_credito","valor_cartao_debito",
                       "valor_crediario","valor_boleto","valor_outros"]
          .reduce((t, k) => t + Number(f[k] ?? 0), 0) },
      { chave: "valor_final", titulo: "Informado no fechamento", tipo: "dinheiro", total: true },
      { chave: "diferenca", titulo: "Saldo (diferença)", tipo: "dinheiro", total: true },
      { chave: "tipo_fechamento", titulo: "Tipo fechamento", valor: () => "Normal" },
      { chave: "origem", titulo: "Origem", valor: (f) => f.origem ?? "PDV" },
      { chave: "abertura", titulo: "Abertura caixa", tipo: "data", valor: (f) => f.caixa?.data_abertura },
      { chave: "recibo", titulo: "Cód. recibo", valor: (f) => String(f.id ?? "").slice(0, 8) },
    ],
    buscar: async ({ de, ate: fim, lojaId, vendedorId }) => {
      const { data, error } = await supabase
        .from("erp_fechamentos_caixa")
        .select("*, caixa:erp_caixa(numero_caixa, loja_id, data_abertura, usuario_id, ponto:erp_pontos_venda(nome)), usuario:erp_usuarios(nome)")
        .gte("data_fechamento", de).lte("data_fechamento", ate(fim))
        .order("data_fechamento", { ascending: false });
      if (error) throw error;
      let linhas = (data ?? []).filter((f: any) => !lojaId || f.caixa?.loja_id === lojaId);

      // Quantos vendedores atuaram, quanto de frete e de onde vieram as
      // vendas. Uma consulta para todos os turnos da lista — por linha
      // seriam dezenas de idas ao banco.
      const ids = linhas.map((f: any) => f.caixa_id).filter(Boolean);
      if (ids.length) {
        const { data: vendas } = await supabase
          .from("erp_vendas")
          .select("caixa_id, vendedor_id, taxa_entrega, tipo_venda, origem_offline")
          .in("caixa_id", ids)
          .eq("status", "finalizada");
        const porCaixa = new Map<string, { vendedores: Set<string>; frete: number; origens: Set<string> }>();
        for (const v of (vendas ?? []) as any[]) {
          const a = porCaixa.get(v.caixa_id) ?? { vendedores: new Set<string>(), frete: 0, origens: new Set<string>() };
          if (v.vendedor_id) a.vendedores.add(v.vendedor_id);
          a.frete += Number(v.taxa_entrega ?? 0);
          a.origens.add(v.origem_offline ? "Offline" : (v.tipo_venda ?? "PDV"));
          porCaixa.set(v.caixa_id, a);
        }
        linhas = linhas.map((f: any) => {
          const a = porCaixa.get(f.caixa_id);
          return {
            ...f,
            qtd_vendedores: a?.vendedores.size ?? 0,
            total_frete: a?.frete ?? 0,
            origem: a && a.origens.size ? [...a.origens].join(", ") : "PDV",
          };
        });
      }

      if (vendedorId) {
        // o fechamento guarda o USUÁRIO; o filtro é por funcionário, então
        // passa pelo vínculo usuario_id de v_erp_vendedores
        const { data: v } = await supabase
          .from("v_erp_vendedores").select("usuario_id").eq("id", vendedorId).maybeSingle();
        const uid = (v as any)?.usuario_id;
        linhas = linhas.filter((f: any) => f.usuario_id === uid || f.caixa?.usuario_id === uid);
      }
      return linhas;
    },
  },

  sangrias: {
    titulo: "Sangrias de caixa",
    descricao: "Retiradas do caixa no período, com motivo e de onde saiu o dinheiro.",
    paraQue: "Só a sangria em dinheiro reduz o que se espera contar na gaveta; PIX e transferência saem do caixa sem passar por ela.",
    colunas: [
      { chave: "data_hora", titulo: "Quando", tipo: "data" },
      { chave: "caixa", titulo: "Caixa", valor: (s) => s.caixa?.ponto?.nome ?? (s.caixa?.numero_caixa != null ? `Caixa ${s.caixa.numero_caixa}` : "—") },
      { chave: "operador", titulo: "Quem retirou", valor: (s) => s.usuario?.nome ?? "—" },
      { chave: "motivo", titulo: "Motivo" },
      { chave: "forma_pagamento", titulo: "Saiu de", valor: (s) => String(s.forma_pagamento ?? "dinheiro").replace("_", " ") },
      { chave: "valor", titulo: "Valor", tipo: "dinheiro", total: true },
      { chave: "saldo_inicial", titulo: "Saldo inicial do caixa", tipo: "dinheiro",
        valor: (s) => Number(s.caixa?.valor_inicial ?? 0) },
      { chave: "observacoes", titulo: "Observações" },
    ],
    filtros: ["vendedor"],
    buscar: async ({ de, ate: fim, lojaId, vendedorId }) => {
      const { data, error } = await supabase
        .from("erp_sangrias")
        .select("*, usuario:erp_usuarios(nome), caixa:erp_caixa(numero_caixa, loja_id, valor_inicial, ponto:erp_pontos_venda(nome))")
        .gte("data_hora", de).lte("data_hora", ate(fim))
        .order("data_hora", { ascending: false });
      if (error) throw error;
      let linhas = (data ?? []).filter((s: any) => !lojaId || s.caixa?.loja_id === lojaId);
      if (vendedorId) {
        const { data: v } = await supabase
          .from("v_erp_vendedores").select("usuario_id").eq("id", vendedorId).maybeSingle();
        linhas = linhas.filter((s: any) => s.usuario_id === (v as any)?.usuario_id);
      }
      return linhas;
    },
  },

  entradas_extra: {
    titulo: "Entradas extras no caixa",
    descricao: "Dinheiro que entrou no caixa fora da venda — reforço de troco, recebimento avulso.",
    // A consulta antiga lia erp_caixa_movimentacoes, tabela que ninguém
    // alimenta: o PDV grava em erp_entradas_extras. O relatório vinha vazio
    // mesmo com entradas registradas.
    colunas: [
      { chave: "data_hora", titulo: "Quando", tipo: "data" },
      { chave: "caixa", titulo: "Caixa", valor: (e) => e.caixa?.ponto?.nome ?? (e.caixa?.numero_caixa != null ? `Caixa ${e.caixa.numero_caixa}` : "—") },
      { chave: "operador", titulo: "Quem lançou", valor: (e) => e.usuario?.nome ?? "—" },
      { chave: "motivo", titulo: "Motivo" },
      { chave: "forma_pagamento", titulo: "Forma", valor: (e) => String(e.forma_pagamento ?? "dinheiro").replace("_", " ") },
      { chave: "valor", titulo: "Valor", tipo: "dinheiro", total: true },
      { chave: "observacoes", titulo: "Observações" },
    ],
    buscar: async ({ de, ate: fim, lojaId }) => {
      const { data, error } = await supabase
        .from("erp_entradas_extras")
        .select("*, usuario:erp_usuarios(nome), caixa:erp_caixa(numero_caixa, loja_id, ponto:erp_pontos_venda(nome))")
        .gte("data_hora", de).lte("data_hora", ate(fim))
        .order("data_hora", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((e: any) => !lojaId || e.caixa?.loja_id === lojaId);
    },
  },

  vendas_excluidas: {
    titulo: "Vendas canceladas e devolvidas",
    descricao: "O que saiu do faturamento no período, com o motivo registrado.",
    paraQue: "Cancelamento concentrado num operador ou num horário merece conversa.",
    colunas: [
      { chave: "data_venda", titulo: "Data", tipo: "data" },
      { chave: "numero_pedido", titulo: "Pedido" },
      { chave: "cliente", titulo: "Cliente", valor: (v) => v.cliente?.nome_razao ?? "—" },
      { chave: "status", titulo: "Situação" },
      { chave: "motivo", titulo: "Motivo", valor: (v) => v.motivo_cancelamento ?? v.observacoes ?? "—" },
      { chave: "data_cancelamento", titulo: "Cancelada em", tipo: "data" },
      { chave: "total", titulo: "Valor", tipo: "dinheiro", total: true },
    ],
    buscar: async ({ de, ate: fim, lojaId }) => {
      let q = supabase.from("erp_vendas")
        .select("numero_pedido, data_venda, total, status, motivo_cancelamento, observacoes, data_cancelamento, cliente:erp_pessoas(nome_razao)")
        .in("status", ["cancelada", "devolvida"])
        .gte("data_venda", de).lte("data_venda", ate(fim))
        .order("data_venda", { ascending: false });
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  },

  contas_excluidas: {
    titulo: "Contas canceladas",
    descricao: "Contas a pagar e a receber que foram canceladas no período.",
    paraQue: "Inclui as substituídas por crediário e as zeradas por devolução.",
    colunas: [
      { chave: "updated_at", titulo: "Cancelada em", tipo: "data" },
      { chave: "tipo", titulo: "Tipo" },
      { chave: "descricao", titulo: "Descrição" },
      { chave: "pessoa", titulo: "Pessoa", valor: (c) => c.pessoa?.nome_razao ?? "—" },
      { chave: "data_vencimento", titulo: "Vencia em", tipo: "data" },
      { chave: "observacoes", titulo: "Observações" },
      { chave: "valor", titulo: "Valor", tipo: "dinheiro", total: true },
    ],
    buscar: async ({ de, ate: fim, lojaId }) => {
      let q = supabase.from("erp_contas")
        .select("descricao, tipo, valor, updated_at, data_vencimento, observacoes, pessoa:erp_pessoas(nome_razao)")
        .eq("status", "cancelado")
        .gte("updated_at", de).lte("updated_at", ate(fim))
        .order("updated_at", { ascending: false });
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  },

  entradas_canceladas: {
    titulo: "Notas de entrada canceladas",
    descricao: "Notas que o fornecedor cancelou depois de emitidas, detectadas pelo canal da SEFAZ.",
    paraQue: "Nota cancelada que já deu entrada no estoque deixa saldo a mais na prateleira.",
    colunas: [
      { chave: "data_emissao", titulo: "Emissão", tipo: "data" },
      { chave: "numero", titulo: "Nota" },
      { chave: "serie", titulo: "Série" },
      { chave: "emitente_nome", titulo: "Fornecedor" },
      { chave: "motivo_cancelamento", titulo: "Motivo" },
      { chave: "valor_total", titulo: "Valor", tipo: "dinheiro", total: true },
    ],
    buscar: async ({ lojaId }) => {
      let q = supabase.from("erp_nfe_entrada")
        .select("numero, serie, emitente_nome, valor_total, data_emissao, motivo_cancelamento")
        .eq("status", "cancelada")
        .order("data_emissao", { ascending: false });
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  },

  servicos: {
    titulo: "Extrato de serviços",
    descricao: "Serviços vendidos no período, com o pedido que os originou.",
    colunas: [
      { chave: "data", titulo: "Data", tipo: "data", valor: (i) => i.venda?.data_venda },
      { chave: "pedido", titulo: "Pedido", valor: (i) => i.venda?.numero_pedido ?? "—" },
      { chave: "servico", titulo: "Serviço", valor: (i) => i.servico?.nome ?? i.nome },
      { chave: "quantidade", titulo: "Qtd", tipo: "numero", total: true },
      { chave: "subtotal", titulo: "Valor", tipo: "dinheiro", total: true },
    ],
    buscar: async ({ de, ate: fim, lojaId }) => {
      const { data, error } = await supabase.from("erp_venda_itens")
        .select("nome, quantidade, subtotal, servico:erp_servicos(nome), venda:erp_vendas!inner(numero_pedido, data_venda, loja_id, status)")
        .not("servico_id", "is", null)
        .gte("venda.data_venda", de).lte("venda.data_venda", ate(fim))
        .eq("venda.status", "finalizada");
      if (error) throw error;
      return (data ?? []).filter((i: any) => !lojaId || i.venda?.loja_id === lojaId);
    },
  },
};

export type TipoRelatorio = keyof typeof RELATORIOS;

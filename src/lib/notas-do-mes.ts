// ============================================================
// Notas fiscais de um mês da filial — o que o Relatório da Contadora e o
// Painel do Contador mostram. Um lugar só para a consulta, para os dois
// números nunca divergirem.
// ============================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { lerTudo } from "@/lib/ler-tudo";
import { intervaloDoMes, type NotaRel } from "@/lib/relatorio-contadora";

export interface EventoDoMes { nota_id: string; tipo: string; sequencia: number; xml_path: string | null }
export interface InutilizacaoDoMes {
  modelo: number; serie: number; numero_inicial: number; numero_final: number;
  ambiente: string | null; created_at: string; xml_path: string | null;
}

export function useNotasDoMes(lojaId: string | null | undefined, mes: string) {
  return useQuery({
    queryKey: ["erp_notas_do_mes", lojaId, mes],
    enabled: !!lojaId && /^\d{4}-\d{2}$/.test(mes),
    queryFn: async () => {
      const { de, ate } = intervaloDoMes(mes);
      const notas = await lerTudo<NotaRel>(() => supabase.from("erp_notas_fiscais")
        .select("id, tipo, numero, serie, status, ambiente, finalidade, data_emissao, valor_total, chave_acesso, xml_path, consumidor_nome, venda_id")
        .eq("loja_id", lojaId!).gte("data_emissao", de).lt("data_emissao", ate)
        .order("data_emissao").order("id"));
      const entradas = await lerTudo<any>(() => supabase.from("erp_nfe_entrada")
        .select("id, numero, serie, emitente_nome, emitente_cnpj, data_emissao, valor_total, chave_acesso, status")
        .eq("loja_id", lojaId!).gte("data_emissao", de).lt("data_emissao", ate)
        .order("data_emissao").order("id"));
      const { data: inut, error } = await supabase.from("erp_inutilizacoes")
        .select("modelo, serie, numero_inicial, numero_final, ambiente, inutilizada, created_at, xml_path")
        .eq("loja_id", lojaId!).eq("inutilizada", true).gte("created_at", de).lt("created_at", ate).order("created_at");
      if (error) throw error;
      // Cancelamento e CC-e aceitos das notas do mês: o XML do evento vai no ZIP
      const eventos = await lerTudo<EventoDoMes>(() => supabase.from("erp_nfe_eventos")
        .select("nota_id, tipo, sequencia, xml_path")
        .eq("loja_id", lojaId!).eq("aceito", true).gte("created_at", de).order("created_at").order("id"));
      const idsDoMes = new Set(notas.map((n) => n.id));
      return {
        notas,
        entradas: entradas.filter((e) => e.status !== "cancelada"),
        inutilizacoes: (inut ?? []) as InutilizacaoDoMes[],
        eventos: eventos.filter((e) => idsDoMes.has(e.nota_id)),
      };
    },
  });
}

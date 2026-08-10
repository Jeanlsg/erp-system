// ============================================================
// Hook: useNotificacoesHeader
// Consolida avisos importantes para exibir no header como ícones
//
// Tipos de notificação:
//   - estoque_baixo: produtos abaixo do mínimo
//   - aniversariantes: clientes aniversariando no mês/semana
//   - contas_vencidas: contas a pagar/receber vencidas
//   - lotes_vencendo: lotes próximos do vencimento
//   - certific_vencendo: certificado digital vencendo
//   - ocorrencias: pendências/ocorrências em aberto
// ============================================================

import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface NotificacaoItem {
  id: string;
  titulo: string;
  subtitulo?: string;
  valor?: string;
  link: string;
}

export interface NotificacoesHeader {
  estoque_baixo: { count: number; itens: NotificacaoItem[] };
  aniversariantes: { count: number; itens: NotificacaoItem[] };
  contas_vencidas: { count: number; itens: NotificacaoItem[] };
  lotes_vencendo: { count: number; itens: NotificacaoItem[] };
  cert_vencendo: { count: number; itens: NotificacaoItem[] };
  ocorrencias: { count: number; itens: NotificacaoItem[] };
  total: number;
}

export function useNotificacoesHeader(lojaId?: string | null) {
  return useQuery<NotificacoesHeader>({
    queryKey: ["notificacoes_header", lojaId],
    queryFn: async () => {
      const empty: NotificacoesHeader = {
        estoque_baixo: { count: 0, itens: [] },
        aniversariantes: { count: 0, itens: [] },
        contas_vencidas: { count: 0, itens: [] },
        lotes_vencendo: { count: 0, itens: [] },
        cert_vencendo: { count: 0, itens: [] },
        ocorrencias: { count: 0, itens: [] },
        total: 0,
      };

      if (!isSupabaseConfigured()) return empty;

      const data: NotificacoesHeader = { ...empty };

      // ============ 1) ESTOQUE BAIXO ============
      // Produtos com quantidade <= estoque_minimo na loja atual
      try {
        if (lojaId) {
          // Query: produtos com estoque <= mínimo na loja
          const { data: estoqueBaixo, error } = await supabase
            .from("erp_estoque")
            .select(`
              quantidade,
              produto:erp_produtos(id, nome, sku, estoque_minimo)
            `)
            .eq("loja_id", lojaId);

          if (!error && estoqueBaixo) {
            const itens = (estoqueBaixo as any[])
              .filter((e) => {
                const min = Number(e.produto?.estoque_minimo ?? 0);
                return min > 0 && Number(e.quantidade) <= min;
              })
              .slice(0, 5)
              .map((e, idx) => ({
                id: `${e.produto?.id ?? idx}`,
                titulo: e.produto?.nome ?? "Produto",
                subtitulo: `Mín: ${e.produto?.estoque_minimo ?? 0}`,
                valor: `${e.quantidade} ${e.produto?.sku ? "· " + e.produto.sku : ""}`,
                link: "/produtos-estoque",
              }));
            data.estoque_baixo = { count: itens.length, itens };
          }
        }
      } catch (_) {}

      // ============ 2) ANIVERSARIANTES DO MÊS ============
      try {
        const { data: ani, error: aniErr } = await supabase
          .from("v_erp_aniversariantes_mes")
          .select("id, nome_razao, data_nascimento, email, telefone, celular, mes, dia, idade")
          .limit(50);

        if (!aniErr && ani) {
          const hoje = new Date();
          const mesAtual = hoje.getMonth() + 1;

          // Filtrar só os do mês atual
          const doMes = (ani as any[]).filter(
            (a) => a.mes === mesAtual
          );

          // Ordenar: mais próximos primeiro (que ainda não passaram)
          const ordenados = [...doMes].sort((a, b) => {
            const diaA = a.dia ?? 0;
            const diaB = b.dia ?? 0;
            const hoje_dia = hoje.getDate();
            const passouA = diaA < hoje_dia;
            const passouB = diaB < hoje_dia;
            // Não passados primeiro, depois passados
            if (passouA !== passouB) return passouA ? 1 : -1;
            return diaA - diaB;
          });

          const itens = ordenados.slice(0, 5).map((a: any) => {
            const dia = a.dia;
            const passou = dia < hoje.getDate();
            const idade = a.idade;
            return {
              id: a.id,
              titulo: a.nome_razao,
              subtitulo: passou ? `Aniversariou dia ${dia}` : `Aniversaria dia ${dia}`,
              valor: a.celular ?? a.telefone ?? a.email ?? `${idade} anos`,
              link: `/gestao/localizar-pessoas`,
            };
          });
          data.aniversariantes = { count: doMes.length, itens };
        }
      } catch (_) {}

      // ============ 3) CONTAS VENCIDAS ============
      // Contas a pagar/receber com data_vencimento < hoje e status = pendente
      try {
        if (lojaId) {
          const { data: contas, error: contasErr } = await supabase
            .from("erp_contas")
            .select("id, descricao, valor, data_vencimento, tipo, status")
            .eq("loja_id", lojaId)
            .eq("status", "pendente")
            .lt("data_vencimento", new Date().toISOString().slice(0, 10))
            .limit(50);

          if (!contasErr && contas) {
            const itens = (contas as any[]).slice(0, 5).map((c: any) => {
              const valor = Number(c.valor ?? 0).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              });
              const tipo = c.tipo === "pagar" ? "A pagar" : "A receber";
              return {
                id: c.id,
                titulo: c.descricao ?? tipo,
                subtitulo: `${tipo} · vencida`,
                valor,
                link: "/financeiro",
              };
            });
            data.contas_vencidas = { count: contas.length, itens };
          }
        }
      } catch (_) {}

      // ============ 4) LOTES / PRODUTOS VENCENDO ============
      // Lotes com data_validade <= hoje + 90 dias
      try {
        const { data: lotes, error: lotesErr } = await supabase
          .from("v_erp_lotes_vencendo")
          .select("lote_id, produto_nome, produto_sku, data_validade, dias_para_vencer, severidade")
          .limit(20);

        if (!lotesErr && lotes) {
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);

          // Classificar por severidade
          const vencidos = (lotes as any[]).filter((l) => l.severidade === "vencido");
          const criticos = (lotes as any[]).filter(
            (l) => l.severidade === "critico" || (l.dias_para_vencer >= 0 && l.dias_para_vencer <= 30)
          );
          const alertas = (lotes as any[]).filter(
            (l) => l.severidade === "alerta" || (l.dias_para_vencer > 30 && l.dias_para_vencer <= 60)
          );

          // Ordenar: vencidos primeiro, depois por proximidade do vencimento
          const todosOrdenados = [...vencidos, ...criticos, ...alertas].sort(
            (a, b) => a.dias_para_vencer - b.dias_para_vencer
          );

          // Top 5 mais críticos
          const itensCriticos = todosOrdenados.slice(0, 5).map((l: any) => {
            let subtitulo = "";
            if (l.severidade === "vencido" || l.dias_para_vencer < 0) {
              subtitulo = `🚨 Vencido há ${Math.abs(l.dias_para_vencer)}d`;
            } else if (l.severidade === "critico" || l.dias_para_vencer <= 30) {
              subtitulo = `⚠️ Vence em ${l.dias_para_vencer}d (crítico)`;
            } else {
              subtitulo = `Vence em ${l.dias_para_vencer}d (alerta)`;
            }
            return {
              id: l.lote_id,
              titulo: l.produto_nome,
              subtitulo,
              valor: l.data_validade,
              link: "/lotes",
            };
          });

          data.lotes_vencendo = {
            count: lotes.length,
            itens: itensCriticos,
          };
        }
      } catch (_) {}

      // ============ 5) CERTIFICADO VENCENDO ============
      // Certificados A1 com data_validade <= hoje + 30 dias
      try {
        if (lojaId) {
          const { data: certs, error: certsErr } = await supabase
            .from("erp_certificados_digitais")
            .select("id, titular, cnpj_cpf, data_validade, ativo")
            .eq("loja_id", lojaId)
            .eq("ativo", true);

          if (!certsErr && certs) {
            const hoje = new Date();
            const proximos = (certs as any[]).filter((c) => {
              if (!c.data_validade) return false;
              const d = new Date(c.data_validade);
              const dias = Math.floor((d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
              return dias <= 60;
            });
            const itens = proximos.map((c: any) => ({
              id: c.id,
              titulo: c.titular,
              subtitulo: "Certificado digital",
              valor: `Validade: ${c.data_validade}`,
              link: "/gestao/nfe-certificado",
            }));
            data.cert_vencendo = { count: proximos.length, itens };
          }
        }
      } catch (_) {}

      // ============ 6) OCORRÊNCIAS EM ABERTO ============
      // Pendências/ocorrências status='aberto' ou 'em_andamento'
      try {
        if (lojaId) {
          const { data: ocorr, error: ocorrErr } = await supabase
            .from("erp_ocorrencias")
            .select("id, titulo, tipo, prioridade, status, created_at")
            .eq("loja_id", lojaId)
            .in("status", ["aberto", "em_andamento"])
            .order("created_at", { ascending: false })
            .limit(50);

          if (!ocorrErr && ocorr) {
            const urgentes = (ocorr as any[]).filter((o) => o.prioridade === "urgente" || o.prioridade === "alta");
            const itens = urgentes.slice(0, 5).map((o: any) => ({
              id: o.id,
              titulo: o.titulo,
              subtitulo: `${o.tipo} · ${o.prioridade}`,
              valor: o.status,
              link: "/gestao/ocorrencias",
            }));
            data.ocorrencias = { count: ocorr.length, itens };
          }
        }
      } catch (_) {}

      // Total
      data.total =
        data.estoque_baixo.count +
        data.aniversariantes.count +
        data.contas_vencidas.count +
        data.lotes_vencendo.count +
        data.cert_vencendo.count +
        data.ocorrencias.count;

      return data;
    },
    staleTime: 1000 * 60 * 2, // 2 min
    refetchInterval: 1000 * 60 * 5, // 5 min
    enabled: !!lojaId,
  });
}
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/supabase";
import type {
  Loja,
  Produto,
  Estoque,
  Venda,
  VendaCompleta,
  Categoria,
  Pessoa,
  Conta,
  ProdutoComEstoque,
} from "@/types/database";

export { isSupabaseConfigured };

// ========================================
// LOJAS
// ========================================
export function useLojas() {
  return useQuery<Loja[]>({
    queryKey: ["erp_lojas"],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from("erp_lojas")
        .select("*")
        .eq("ativo", true)
        .order("matriz", { ascending: false })
        .order("apelido");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 30,
  });
}

// ========================================
// CATEGORIAS
// ========================================
export function useCategorias() {
  return useQuery<Categoria[]>({
    queryKey: ["erp_categorias"],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from("erp_categorias")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 30,
  });
}

// ========================================
// PRODUTOS
// ========================================
export function useProdutos(filters?: { lojaId?: string; search?: string }) {
  return useQuery<Produto[]>({
    queryKey: ["erp_produtos", filters],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from("erp_produtos")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (filters?.search) {
        query = query.or(`nome.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProdutosComEstoque(lojaId?: string) {
  return useQuery<ProdutoComEstoque[]>({
    queryKey: ["erp_produtos-com-estoque", lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const [produtosRes, estoqueRes] = await Promise.all([
        supabase.from("erp_produtos").select("*, categoria:erp_categorias(*)").eq("ativo", true).order("nome"),
        lojaId
          ? supabase.from("erp_estoque").select("*").eq("loja_id", lojaId)
          : supabase.from("erp_estoque").select("*"),
      ]);

      if (produtosRes.error) throw produtosRes.error;
      if (estoqueRes.error) throw estoqueRes.error;

      const estoqueMap: Record<string, Record<string, number>> = {};
      for (const e of estoqueRes.data ?? []) {
        if (!estoqueMap[e.loja_id]) estoqueMap[e.loja_id] = {};
        estoqueMap[e.loja_id][e.produto_id] = e.quantidade;
      }

      return (produtosRes.data ?? []).map((p: any) => ({
        ...p,
        estoque_por_loja: lojaId
          ? { [lojaId]: estoqueMap[lojaId]?.[p.id] ?? 0 }
          : estoqueMap[p.id] ? estoqueMap : {},
      }));
    },
  });
}

export function useEstoqueLoja(lojaId: string | undefined) {
  return useQuery<Estoque[]>({
    queryKey: ["erp_estoque", lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured() || !lojaId) return [];
      const { data, error } = await supabase
        .from("erp_estoque")
        .select("*")
        .eq("loja_id", lojaId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!lojaId,
  });
}

// ========================================
// VENDAS
// ========================================
export function useVendas(filters?: { lojaId?: string; status?: string; dataInicio?: string; dataFim?: string }) {
  return useQuery<VendaCompleta[]>({
    queryKey: ["erp_vendas", filters],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from("erp_vendas")
        .select(`
          *,
          itens:erp_venda_itens(*),
          cliente:erp_pessoas(*),
          loja:erp_lojas(*),
          usuario:erp_usuarios(*)
        `)
        .order("data_venda", { ascending: false })
        .limit(200);

      if (filters?.lojaId) query = query.eq("loja_id", filters.lojaId);
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.dataInicio) query = query.gte("data_venda", filters.dataInicio);
      if (filters?.dataFim) query = query.lte("data_venda", filters.dataFim);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

export function useVendasPorDia(lojaId: string, dias: number = 7) {
  return useQuery<{ dia: string; total: number; tickets: number }[]>({
    queryKey: ["erp_vendas-por-dia", lojaId, dias],
    queryFn: async () => {
      if (!isSupabaseConfigured() || !lojaId) return [];

      const desde = new Date();
      desde.setDate(desde.getDate() - dias);

      const { data, error } = await supabase
        .from("erp_vendas")
        .select("data_venda, total, status")
        .eq("loja_id", lojaId)
        .eq("status", "finalizada")
        .gte("data_venda", desde.toISOString());

      if (error) throw error;

      const mapa: Record<string, { total: number; tickets: number }> = {};
      for (const v of data ?? []) {
        const dia = v.data_venda.slice(0, 10);
        if (!mapa[dia]) mapa[dia] = { total: 0, tickets: 0 };
        mapa[dia].total += Number(v.total);
        mapa[dia].tickets += 1;
      }

      return Object.entries(mapa).map(([dia, vals]) => ({
        dia,
        total: vals.total,
        tickets: vals.tickets,
      }));
    },
    enabled: !!lojaId,
  });
}

export function useVendasHoje(lojaId: string | undefined) {
  return useQuery({
    queryKey: ["erp_vendas-hoje", lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured() || !lojaId) {
        return { total: 0, tickets: 0, ticketMedio: 0 };
      }
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("erp_vendas")
        .select("total")
        .eq("loja_id", lojaId)
        .eq("status", "finalizada")
        .gte("data_venda", hoje.toISOString());

      if (error) throw error;
      const total = (data ?? []).reduce((s, v) => s + Number(v.total), 0);
      const tickets = data?.length ?? 0;
      return { total, tickets, ticketMedio: tickets > 0 ? total / tickets : 0 };
    },
    enabled: !!lojaId,
  });
}

export function useTopProdutos(lojaId: string, limite: number = 5, dias: number = 7) {
  return useQuery({
    queryKey: ["erp_top-produtos", lojaId, limite, dias],
    queryFn: async () => {
      if (!isSupabaseConfigured() || !lojaId) return [];
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);

      const { data, error } = await supabase
        .from("erp_venda_itens")
        .select(`
          nome,
          quantidade,
          subtotal,
          venda:erp_vendas!inner(loja_id, status, data_venda)
        `)
        .eq("venda.loja_id", lojaId)
        .eq("venda.status", "finalizada")
        .gte("venda.data_venda", desde.toISOString())
        .limit(limite * 10);

      if (error) throw error;

      const mapa: Record<string, { nome: string; quantidade: number; total: number }> = {};
      for (const item of data ?? []) {
        if (!mapa[item.nome]) mapa[item.nome] = { nome: item.nome, quantidade: 0, total: 0 };
        mapa[item.nome].quantidade += Number(item.quantidade);
        mapa[item.nome].total += Number(item.subtotal);
      }

      return Object.values(mapa)
        .sort((a, b) => b.total - a.total)
        .slice(0, limite);
    },
    enabled: !!lojaId,
  });
}

// ========================================
// PESSOAS
// ========================================
export function useClientes() {
  return useQuery<Pessoa[]>({
    queryKey: ["erp_clientes"],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from("erp_pessoas")
        .select("*")
        .eq("ativo", true)
        .order("nome_razao");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// CONTAS
// ========================================
export function useContas(filters?: { tipo?: "pagar" | "receber"; status?: string; lojaId?: string }) {
  return useQuery<Conta[]>({
    queryKey: ["erp_contas", filters],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from("erp_contas")
        .select("*")
        .order("data_vencimento", { ascending: true })
        .limit(500);

      if (filters?.tipo) query = query.eq("tipo", filters.tipo);
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.lojaId) query = query.eq("loja_id", filters.lojaId);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useContasVencidas(lojaId?: string) {
  return useQuery({
    queryKey: ["erp_contas-vencidas", lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const hoje = new Date().toISOString().slice(0, 10);
      let query = supabase
        .from("erp_contas")
        .select("*")
        .lt("data_vencimento", hoje)
        .neq("status", "pago")
        .neq("status", "cancelado");

      if (lojaId) query = query.eq("loja_id", lojaId);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// DASHBOARD AGREGADO
// ========================================
export function useDashboardStats(lojaId: string | undefined) {
  return useQuery({
    queryKey: ["erp_dashboard-stats", lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured() || !lojaId) {
        return {
          vendasHoje: 0,
          ticketsHoje: 0,
          ticketMedio: 0,
          produtosEstoqueBaixo: 0,
          contasVencidas: 0,
          valorContasVencidas: 0,
        };
      }

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeStr = hoje.toISOString().slice(0, 10);

      const { data: vendasHoje } = await supabase
        .from("erp_vendas")
        .select("total")
        .eq("loja_id", lojaId)
        .eq("status", "finalizada")
        .gte("data_venda", hoje.toISOString());

      const totalVendas = (vendasHoje ?? []).reduce((s, v) => s + Number(v.total), 0);
      const tickets = vendasHoje?.length ?? 0;

      const { data: produtos } = await supabase
        .from("erp_produtos")
        .select("id, estoque_minimo");

      const { data: estoque } = await supabase
        .from("erp_estoque")
        .select("produto_id, quantidade")
        .eq("loja_id", lojaId);

      const estoqueMap: Record<string, number> = {};
      for (const e of estoque ?? []) {
        estoqueMap[e.produto_id] = Number(e.quantidade);
      }

      const baixoEstoque = (produtos ?? []).filter((p) => {
        const q = estoqueMap[p.id] ?? 0;
        return q <= p.estoque_minimo;
      }).length;

      const { data: contasVenc } = await supabase
        .from("erp_contas")
        .select("valor")
        .eq("loja_id", lojaId)
        .neq("status", "pago")
        .neq("status", "cancelado")
        .lt("data_vencimento", hojeStr);

      const valorVencido = (contasVenc ?? []).reduce((s, c) => s + Number(c.valor), 0);

      return {
        vendasHoje: totalVendas,
        ticketsHoje: tickets,
        ticketMedio: tickets > 0 ? totalVendas / tickets : 0,
        produtosEstoqueBaixo: baixoEstoque,
        contasVencidas: contasVenc?.length ?? 0,
        valorContasVencidas: valorVencido,
      };
    },
    enabled: !!lojaId,
  });
}

// ========================================
// MUTATIONS
// ========================================
export function useCreateVenda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (venda: Partial<Venda> & { itens: any[] }) => {
      const { itens, ...vendaData } = venda;
      const { data: vendaCriada, error } = await supabase
        .from("erp_vendas")
        .insert(vendaData)
        .select()
        .single();
      if (error) throw error;

      if (itens && itens.length > 0) {
        const { error: errItens } = await supabase
          .from("erp_venda_itens")
          .insert(itens.map((i) => ({ ...i, venda_id: vendaCriada.id })));
        if (errItens) throw errItens;
      }

      return vendaCriada;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["erp_vendas"] });
      qc.invalidateQueries({ queryKey: ["erp_dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["erp_vendas-por-dia"] });
      qc.invalidateQueries({ queryKey: ["erp_vendas-hoje"] });
      qc.invalidateQueries({ queryKey: ["erp_top-produtos"] });
    },
  });
}

export function useCreateProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (produto: Partial<Produto>) => {
      const { data, error } = await supabase.from("erp_produtos").insert(produto).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["erp_produtos"] }),
  });
}

export function useUpdateEstoque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ produtoId, lojaId, quantidade }: { produtoId: string; lojaId: string; quantidade: number }) => {
      const { data, error } = await supabase
        .from("erp_estoque")
        .upsert({ produto_id: produtoId, loja_id: lojaId, quantidade, updated_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["erp_estoque"] });
      qc.invalidateQueries({ queryKey: ["erp_produtos-com-estoque"] });
      qc.invalidateQueries({ queryKey: ["erp_dashboard-stats"] });
    },
  });
}

// ========================================
// FORNECEDORES
// ========================================
export function useFornecedores() {
  return useQuery<Pessoa[]>({
    queryKey: ['erp_fornecedores'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from('erp_pessoas')
        .select('*')
        .eq('ativo', true)
        .order('nome_razao');
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// CONTAS (MUTATIONS)
// ========================================
export function useCreateConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conta: Partial<Conta>) => {
      const { data, error } = await supabase
        .from('erp_contas')
        .insert(conta)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_contas'] });
      qc.invalidateQueries({ queryKey: ['erp_contas-vencidas'] });
      qc.invalidateQueries({ queryKey: ['erp_dashboard-stats'] });
    },
  });
}

export function useUpdateConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Conta> & { id: string }) => {
      const { data, error } = await supabase
        .from('erp_contas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_contas'] });
      qc.invalidateQueries({ queryKey: ['erp_contas-vencidas'] });
    },
  });
}

export function useDeleteConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_contas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_contas'] });
      qc.invalidateQueries({ queryKey: ['erp_contas-vencidas'] });
    },
  });
}

// ========================================
// AGENDA COMPROMISSOS
// ========================================
export function useAgendaCompromissos(usuarioId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_agenda', usuarioId],
    queryFn: async () => {
      if (!isSupabaseConfigured() || !usuarioId) return [];
      const { data, error } = await supabase
        .from('erp_agenda_compromissos')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('data_inicio', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!usuarioId,
  });
}

export function useCreateAgendaItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase
        .from('erp_agenda_compromissos')
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_agenda'] }),
  });
}

export function useToggleAgendaItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('erp_agenda_compromissos')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_agenda'] }),
  });
}

export function useDeleteAgendaItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_agenda_compromissos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_agenda'] }),
  });
}

// ========================================
// LOTES
// ========================================
export function useLotes(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_lotes', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('erp_lotes')
        .select('*, produto:erp_produtos(id, nome, sku)')
        .order('data_validade', { ascending: true });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      // Mapear para o formato esperado
      return (data ?? []).map((l: any) => ({
        ...l,
        produto_nome: l.produto?.nome,
      }));
    },
  });
}

export function useCreateLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lote: any) => {
      const { data, error } = await supabase.from('erp_lotes').insert(lote).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_lotes'] });
      qc.invalidateQueries({ queryKey: ['erp_lotes-vencendo'] });
    },
  });
}

// ========================================
// NOTIFICAÇÕES
// ========================================
export function useNotificacoes(usuarioId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_notificacoes', usuarioId],
    queryFn: async () => {
      if (!isSupabaseConfigured() || !usuarioId) return [];
      const { data, error } = await supabase
        .from('erp_notificacoes')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!usuarioId,
  });
}

export function useCreateNotificacao() {
  return useMutation({
    mutationFn: async (notif: any) => {
      const { data, error } = await supabase.from('erp_notificacoes').insert(notif).select().single();
      if (error) throw error;
      return data;
    },
  });
}

export function useMarcarNotificacaoLida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('erp_notificacoes')
        .update({ lida: true, data_leitura: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_notificacoes'] }),
  });
}

// ========================================
// VIEWS
// ========================================
export function useEstoqueBaixo(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_estoque-baixo', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from('v_erp_estoque_baixo')
        .select('*')
        .order('deficit', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLotesVencendo(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_lotes-vencendo', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from('v_erp_lotes_vencendo')
        .select('*')
        .order('dias_para_vencer', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAniversariantes() {
  return useQuery<any[]>({
    queryKey: ['erp_aniversariantes'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from('v_erp_aniversariantes_mes')
        .select('*')
        .order('dia');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFluxoCaixa(lojaId?: string, dataInicio?: string, dataFim?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_fluxo-caixa', lojaId, dataInicio, dataFim],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('v_erp_fluxo_caixa')
        .select('*')
        .order('data', { ascending: false });
      if (lojaId) query = query.eq('loja_id', lojaId);
      if (dataInicio) query = query.gte('data', dataInicio);
      if (dataFim) query = query.lte('data', dataFim);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTopProdutosView(lojaId?: string, limite: number = 10) {
  return useQuery<any[]>({
    queryKey: ['erp_top-produtos-view', lojaId, limite],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('v_erp_top_produtos')
        .select('*')
        .order('receita_total', { ascending: false })
        .limit(limite);
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// BOLETOS / CHEQUES / PROMISSÓRIAS
// ========================================
export function useBoletos(filters?: { lojaId?: string; status?: string }) {
  return useQuery<any[]>({
    queryKey: ['erp_boletos', filters],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('erp_boletos')
        .select('*')
        .order('data_vencimento', { ascending: true });
      if (filters?.lojaId) query = query.eq('loja_id', filters.lojaId);
      if (filters?.status) query = query.eq('status', filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCheques(filters?: { lojaId?: string; status?: string }) {
  return useQuery<any[]>({
    queryKey: ['erp_cheques', filters],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('erp_cheques')
        .select('*')
        .order('data_vencimento', { ascending: true });
      if (filters?.lojaId) query = query.eq('loja_id', filters.lojaId);
      if (filters?.status) query = query.eq('status', filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePromissorias(filters?: { lojaId?: string; status?: string }) {
  return useQuery<any[]>({
    queryKey: ['erp_promissorias', filters],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('erp_promissorias')
        .select('*')
        .order('data_vencimento', { ascending: true });
      if (filters?.lojaId) query = query.eq('loja_id', filters.lojaId);
      if (filters?.status) query = query.eq('status', filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// SANGRIAS / ENTRADAS EXTRAS
// ========================================
export function useSangrias(caixaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_sangrias', caixaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('erp_sangrias')
        .select('*')
        .order('data_hora', { ascending: false });
      if (caixaId) query = query.eq('caixa_id', caixaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateSangria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sangria: any) => {
      const { data, error } = await supabase.from('erp_sangrias').insert(sangria).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_sangrias'] }),
  });
}

export function useEntradasExtras(caixaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_entradas-extras', caixaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('erp_entradas_extras')
        .select('*')
        .order('data_hora', { ascending: false });
      if (caixaId) query = query.eq('caixa_id', caixaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateEntradaExtra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entrada: any) => {
      const { data, error } = await supabase.from('erp_entradas_extras').insert(entrada).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_entradas-extras'] }),
  });
}

// ========================================
// CHAVES PIX / CONTAS BANCÁRIAS
// ========================================
export function useChavesPix(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_chaves-pix', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('erp_chaves_pix')
        .select('*')
        .eq('ativo', true);
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useContasBancarias(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_contas-bancarias', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('erp_contas_bancarias')
        .select('*')
        .eq('ativo', true);
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useVendasPorDiaView(lojaId?: string, dias: number = 7) {
  return useQuery<any[]>({
    queryKey: ['erp_vendas-por-dia-view', lojaId, dias],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);
      let query = supabase
        .from('v_erp_vendas_por_dia')
        .select('*')
        .gte('dia', desde.toISOString().slice(0, 10))
        .order('dia', { ascending: true });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}
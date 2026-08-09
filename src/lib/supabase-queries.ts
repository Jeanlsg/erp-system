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
  Veiculo,
  VeiculoAbastecimento,
  VeiculoManutencao,
  RegiaoEntrega,
  Transportadora,
  Contato,
  FeatureFlag,
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
      const { data, error } = await supabase.from('erp_produtos').insert(produto).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_produtos'] }),
  });
}

export function useUpdateProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Produto> & { id: string }) => {
      const { data, error } = await supabase.from('erp_produtos').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_produtos'] }),
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

// ========================================
// VEÍCULOS / FROTA
// ========================================
export function useVeiculos(lojaId?: string) {
  return useQuery<Veiculo[]>({
    queryKey: ['erp_veiculos', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_veiculos').select('*').order('placa');
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateVeiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (veiculo: Partial<Veiculo>) => {
      const { data, error } = await supabase.from('erp_veiculos').insert(veiculo).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_veiculos'] }),
  });
}

export function useUpdateVeiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Veiculo> & { id: string }) => {
      const { data, error } = await supabase.from('erp_veiculos').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_veiculos'] }),
  });
}

export function useDeleteVeiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_veiculos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_veiculos'] }),
  });
}

export function useAbastecimentos(veiculoId?: string) {
  return useQuery<VeiculoAbastecimento[]>({
    queryKey: ['erp_veiculo_abastecimentos', veiculoId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_veiculo_abastecimentos').select('*').order('data_abastecimento', { ascending: false });
      if (veiculoId) query = query.eq('veiculo_id', veiculoId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateAbastecimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<VeiculoAbastecimento>) => {
      const { data, error } = await supabase.from('erp_veiculo_abastecimentos').insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_veiculo_abastecimentos'] }),
  });
}

export function useManutencoes(veiculoId?: string) {
  return useQuery<VeiculoManutencao[]>({
    queryKey: ['erp_veiculo_manutencoes', veiculoId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_veiculo_manutencoes').select('*').order('data_manutencao', { ascending: false });
      if (veiculoId) query = query.eq('veiculo_id', veiculoId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateManutencao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<VeiculoManutencao>) => {
      const { data, error } = await supabase.from('erp_veiculo_manutencoes').insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_veiculo_manutencoes'] }),
  });
}

// ========================================
// REGIÕES DE ENTREGA
// ========================================
export function useRegioesEntrega(lojaId?: string) {
  return useQuery<RegiaoEntrega[]>({
    queryKey: ['erp_regioes_entrega', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_regioes_entrega').select('*').eq('ativo', true).order('nome');
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateRegiao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (regiao: Partial<RegiaoEntrega>) => {
      const { data, error } = await supabase.from('erp_regioes_entrega').insert(regiao).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_regioes_entrega'] }),
  });
}

export function useDeleteRegiao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_regioes_entrega').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_regioes_entrega'] }),
  });
}

// ========================================
// TRANSPORTADORAS
// ========================================
export function useTransportadoras(lojaId?: string) {
  return useQuery<Transportadora[]>({
    queryKey: ['erp_transportadoras', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_transportadoras').select('*').eq('ativo', true).order('nome');
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateTransportadora() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Partial<Transportadora>) => {
      const { data, error } = await supabase.from('erp_transportadoras').insert(t).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_transportadoras'] }),
  });
}

export function useDeleteTransportadora() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_transportadoras').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_transportadoras'] }),
  });
}

// ========================================
// AGENDA TELEFÔNICA / CONTATOS
// ========================================
export function useContatos(lojaId?: string) {
  return useQuery<Contato[]>({
    queryKey: ['erp_agenda_telefonica', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_agenda_telefonica').select('*').order('nome');
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Partial<Contato>) => {
      const { data, error } = await supabase.from('erp_agenda_telefonica').insert(c).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_agenda_telefonica'] }),
  });
}

export function useDeleteContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_agenda_telefonica').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_agenda_telefonica'] }),
  });
}

// ========================================
// FUNCIONÁRIOS
// ========================================
export function useFuncionarios(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_funcionarios', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from('erp_funcionarios')
        .select('*, pessoa:erp_pessoas(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (func: any) => {
      const { data, error } = await supabase.from('erp_funcionarios').insert(func).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_funcionarios'] }),
  });
}

export function useUpdateFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase.from('erp_funcionarios').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_funcionarios'] }),
  });
}

export function useDeleteFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_funcionarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_funcionarios'] }),
  });
}

// ========================================
// DOCUMENTOS
// ========================================
export function useDocumentos(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_documentos', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_documentos').select('*').order('data_upload', { ascending: false });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: any) => {
      const { data, error } = await supabase.from('erp_documentos').insert(doc).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_documentos'] }),
  });
}

export function useDeleteDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_documentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_documentos'] }),
  });
}

// ========================================
// DOWNLOADS
// ========================================
export function useDownloads() {
  return useQuery<any[]>({
    queryKey: ['erp_downloads'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from('erp_downloads')
        .select('*')
        .eq('ativo', true)
        .order('categoria', { ascending: true })
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// EMAIL MARKETING
// ========================================
export function useEmailMarketing(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_email_marketing', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_email_marketing').select('*').order('created_at', { ascending: false });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateEmailMarketing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from('erp_email_marketing').insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_email_marketing'] }),
  });
}

// ========================================
// CLIENTES / FORNECEDORES (CRUD)
// ========================================
export function useCreatePessoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pessoa: Partial<Pessoa>) => {
      const { data, error } = await supabase.from('erp_pessoas').insert(pessoa).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_clientes'] });
      qc.invalidateQueries({ queryKey: ['erp_fornecedores'] });
    },
  });
}

export function useUpdatePessoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Pessoa> & { id: string }) => {
      const { data, error } = await supabase.from('erp_pessoas').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_clientes'] });
      qc.invalidateQueries({ queryKey: ['erp_fornecedores'] });
    },
  });
}

export function useDeletePessoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_pessoas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_clientes'] });
      qc.invalidateQueries({ queryKey: ['erp_fornecedores'] });
    },
  });
}

// ========================================
// PEDIDOS / DELIVERY
// ========================================
export function usePedidos(filters?: { lojaId?: string; status?: string }) {
  return useQuery<any[]>({
    queryKey: ['erp_pedidos', filters],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_pedidos').select('*').order('created_at', { ascending: false }).limit(200);
      if (filters?.lojaId) query = query.eq('loja_id', filters.lojaId);
      if (filters?.status) query = query.eq('status', filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpdatePedidoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase.from('erp_pedidos').update({ status }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_pedidos'] }),
  });
}

// ========================================
// NOTAS FISCAIS
// ========================================
export function useNotasFiscais(filters?: { lojaId?: string; tipo?: string; status?: string }) {
  return useQuery<any[]>({
    queryKey: ['erp_notas_fiscais', filters],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_notas_fiscais').select('*').order('created_at', { ascending: false }).limit(200);
      if (filters?.lojaId) query = query.eq('loja_id', filters.lojaId);
      if (filters?.tipo) query = query.eq('tipo', filters.tipo);
      if (filters?.status) query = query.eq('status', filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// AVALIAÇÕES / RECOMENDAÇÕES (CRM)
// ========================================
export function useAvaliacoes(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_avaliacoes', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_avaliacoes').select('*, cliente:erp_pessoas(nome_razao)').order('data_avaliacao', { ascending: false });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// BANDEIRAS CARTÃO
// ========================================
export function useBandeirasCartao() {
  return useQuery<any[]>({
    queryKey: ['erp_bandeiras_cartao'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase.from('erp_bandeiras_cartao').select('*').eq('ativo', true).order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// SERVIÇOS
// ========================================
export function useServicos(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_servicos', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_servicos').select('*').eq('ativo', true).order('nome');
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// KITS
// ========================================
export function useKits(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_kits', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_kits').select('*, itens:erp_kit_itens(*)').eq('ativo', true).order('nome');
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// CAIXA
// ========================================
export function useCaixas(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_caixa', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_caixa').select('*').order('data_abertura', { ascending: false });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCaixaMovimentacoes(caixaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_caixa_movimentacoes', caixaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_caixa_movimentacoes').select('*').order('data_movimento', { ascending: false });
      if (caixaId) query = query.eq('caixa_id', caixaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// COMPRAS
// ========================================
export function useCompras(filters?: { lojaId?: string }) {
  return useQuery<any[]>({
    queryKey: ['erp_compras', filters],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_compras').select('*').order('data_compra', { ascending: false }).limit(200);
      if (filters?.lojaId) query = query.eq('loja_id', filters.lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// CERTIFICADOS DIGITAIS / SEFAZ / DADOS EMPRESARIAIS
// ========================================
export function useDadosEmpresariais(lojaId?: string) {
  return useQuery<any | null>({
    queryKey: ['erp_dados_empresariais', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured() || !lojaId) return null;
      const { data, error } = await supabase.from('erp_dados_empresariais').select('*').eq('loja_id', lojaId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertDadosEmpresariais() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from('erp_dados_empresariais').upsert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_dados_empresariais'] }),
  });
}

export function useCertificados(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_certificados_digitais', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_certificados_digitais').select('*').order('data_validade', { ascending: true });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useConfiguracoesSefaz(lojaId?: string) {
  return useQuery<any | null>({
    queryKey: ['erp_configuracoes_sefaz', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured() || !lojaId) return null;
      const { data, error } = await supabase.from('erp_configuracoes_sefaz').select('*').eq('loja_id', lojaId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ========================================
// PARCERIAS / NEGATIVAÇÕES / PROTESTOS
// ========================================
export function useParcerias(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_parcerias', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_parcerias').select('*').order('created_at', { ascending: false });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNegativacoes(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_negativacoes', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_negativacoes').select('*').order('data_negativacao', { ascending: false });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateNegativacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from('erp_negativacoes').insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_negativacoes'] }),
  });
}

export function useProtestos(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_protestos', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_protestos').select('*').order('data_protesto', { ascending: false });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useParcelamentos(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_parcelamentos', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_parcelamentos').select('*').order('data_contrato', { ascending: false });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateParcelamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from('erp_parcelamentos').insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_parcelamentos'] }),
  });
}

// ========================================
// CARTÃO FIDELIDADE
// ========================================
export function useCartoesFidelidade(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_cartao_fidelidade', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_cartao_fidelidade').select('*').order('created_at', { ascending: false });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateCartaoFidelidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from('erp_cartao_fidelidade').insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_cartao_fidelidade'] }),
  });
}

// ========================================
// MALA DIRETA / TORPEDOS
// ========================================
export function useMalaDireta(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_mala_direta', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_mala_direta').select('*').order('created_at', { ascending: false });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTorpedos(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_torpedos', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_torpedos').select('*').order('created_at', { ascending: false });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// RELATÓRIOS FINANCEIROS · FLUXO DE CAIXA
// ========================================
export interface FluxoCaixaKpis {
  vendas_count: number;
  vendas_finalizadas: number;
  vendas_nao_finalizadas: number;
  vendas_canceladas: number;
  itens_vendidos: number;
  descontos: number;
  custo_total: number;
  lucro_total: number;
  total_geral: number;
}

export function useFluxoCaixaKpis(
  lojaId: string | undefined,
  dataInicio?: string,
  dataFim?: string
) {
  return useQuery<FluxoCaixaKpis>({
    queryKey: ['erp_fluxo-caixa-kpis', lojaId, dataInicio, dataFim],
    queryFn: async () => {
      const empty: FluxoCaixaKpis = {
        vendas_count: 0,
        vendas_finalizadas: 0,
        vendas_nao_finalizadas: 0,
        vendas_canceladas: 0,
        itens_vendidos: 0,
        descontos: 0,
        custo_total: 0,
        lucro_total: 0,
        total_geral: 0,
      };
      if (!isSupabaseConfigured()) return empty;

      let query = supabase
        .from('erp_vendas')
        .select('id, total, custo_total, lucro_total, desconto, status, data_venda')
        .order('data_venda', { ascending: false })
        .limit(2000);
      if (lojaId) query = query.eq('loja_id', lojaId);
      if (dataInicio) query = query.gte('data_venda', dataInicio);
      if (dataFim) query = query.lte('data_venda', dataFim + 'T23:59:59');

      const { data: vendas, error } = await query;
      if (error) throw error;
      if (!vendas || vendas.length === 0) return empty;

      // Buscar itens das vendas do período
      const vendaIds = vendas.map((v: any) => v.id);
      const { data: itens } = await supabase
        .from('erp_venda_itens')
        .select('venda_id, quantidade')
        .in('venda_id', vendaIds);

      const itensPorVenda: Record<string, number> = {};
      for (const it of itens ?? []) {
        itensPorVenda[it.venda_id] = (itensPorVenda[it.venda_id] ?? 0) + Number(it.quantidade);
      }

      let finalizadas = 0, naoFinalizadas = 0, canceladas = 0;
      let descontos = 0, custo = 0, lucro = 0, totalGeral = 0;
      let itensVendidos = 0;

      for (const v of vendas) {
        const t = Number(v.total ?? 0);
        const c = Number(v.custo_total ?? 0);
        const l = Number(v.lucro_total ?? 0);
        const d = Number(v.desconto ?? 0);
        const qtd = itensPorVenda[v.id] ?? 0;

        if (v.status === 'finalizada') finalizadas += t;
        else if (v.status === 'cancelada') canceladas += t;
        else naoFinalizadas += t;

        if (v.status !== 'cancelada') {
          descontos += d;
          custo += c;
          lucro += l;
          totalGeral += t;
          itensVendidos += qtd;
        }
      }

      return {
        vendas_count: vendas.length,
        vendas_finalizadas: finalizadas,
        vendas_nao_finalizadas: naoFinalizadas,
        vendas_canceladas: canceladas,
        itens_vendidos: itensVendidos,
        descontos,
        custo_total: custo,
        lucro_total: lucro,
        total_geral: totalGeral,
      };
    },
    enabled: !!lojaId,
  });
}

// Breakdown por forma de pagamento (vendas finalizadas no período)
export function useFormasRecebimento(
  lojaId: string | undefined,
  dataInicio?: string,
  dataFim?: string
) {
  return useQuery<{ forma: string; total: number; count: number }[]>({
    queryKey: ['erp_formas-recebimento', lojaId, dataInicio, dataFim],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('erp_vendas')
        .select('forma_pagamento, total, status')
        .eq('status', 'finalizada')
        .limit(2000);
      if (lojaId) query = query.eq('loja_id', lojaId);
      if (dataInicio) query = query.gte('data_venda', dataInicio);
      if (dataFim) query = query.lte('data_venda', dataFim + 'T23:59:59');

      const { data, error } = await query;
      if (error) throw error;

      const mapa: Record<string, { total: number; count: number }> = {};
      for (const v of data ?? []) {
        const fp = v.forma_pagamento ?? 'outros';
        if (!mapa[fp]) mapa[fp] = { total: 0, count: 0 };
        mapa[fp].total += Number(v.total ?? 0);
        mapa[fp].count += 1;
      }
      return Object.entries(mapa).map(([forma, v]) => ({ forma, ...v }));
    },
    enabled: !!lojaId,
  });
}

// Top 10 produtos mais vendidos no período
export function useTopProdutosVendidos(
  lojaId: string | undefined,
  dataInicio?: string,
  dataFim?: string,
  limite: number = 10
) {
  return useQuery<{
    posicao: number;
    produto_id: string | null;
    nome: string;
    sku: string | null;
    quantidade: number;
    preco_unitario: number;
    receita_total: number;
    custo_total: number;
    imagem_url: string | null;
  }[]>({
    queryKey: ['erp-top-produtos-vendidos', lojaId, dataInicio, dataFim, limite],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];

      let query = supabase
        .from('erp_venda_itens')
        .select(`
          nome, quantidade, preco_unitario, preco_custo, subtotal, produto_id,
          venda:erp_vendas!inner(loja_id, status, data_venda)
        `)
        .eq('venda.status', 'finalizada')
        .limit(5000);
      if (lojaId) query = query.eq('venda.loja_id', lojaId);
      if (dataInicio) query = query.gte('venda.data_venda', dataInicio);
      if (dataFim) query = query.lte('venda.data_venda', dataFim + 'T23:59:59');

      const { data, error } = await query;
      if (error) throw error;

      const mapa: Record<string, { nome: string; sku: string | null; produto_id: string | null; quantidade: number; receita_total: number; custo_total: number; preco_unitario: number; }> = {};
      for (const it of data ?? []) {
        const key = it.nome;
        if (!mapa[key]) {
          mapa[key] = {
            nome: it.nome,
            sku: null,
            produto_id: it.produto_id ?? null,
            quantidade: 0,
            receita_total: 0,
            custo_total: 0,
            preco_unitario: Number(it.preco_unitario ?? 0),
          };
        }
        mapa[key].quantidade += Number(it.quantidade ?? 0);
        mapa[key].receita_total += Number(it.subtotal ?? 0);
        mapa[key].custo_total += Number(it.preco_custo ?? 0) * Number(it.quantidade ?? 0);
      }

      // Buscar SKU + imagem_url dos produtos relacionados
      const produtoIds = Array.from(new Set(Object.values(mapa).map((m) => m.produto_id).filter(Boolean)));
      let produtoMap: Record<string, { sku: string | null; imagem_url: string | null }> = {};
      if (produtoIds.length > 0) {
        const { data: produtos } = await supabase
          .from('erp_produtos')
          .select('id, sku, imagem_url')
          .in('id', produtoIds);
        for (const p of produtos ?? []) {
          produtoMap[p.id] = { sku: p.sku, imagem_url: p.imagem_url };
        }
      }
      for (const m of Object.values(mapa)) {
        if (m.produto_id && produtoMap[m.produto_id]) {
          m.sku = produtoMap[m.produto_id].sku;
        }
      }

      return Object.values(mapa)
        .sort((a, b) => b.receita_total - a.receita_total)
        .slice(0, limite)
        .map((m, idx) => ({
          posicao: idx + 1,
          ...m,
          imagem_url: m.produto_id ? produtoMap[m.produto_id]?.imagem_url ?? null : null,
        }));
    },
    enabled: !!lojaId,
  });
}

// Taxas de cartões (bandeiras cadastradas + total vendido em cartão no período)
export function useTaxasCartao(
  lojaId: string | undefined,
  dataInicio?: string,
  dataFim?: string
) {
  return useQuery<{ bandeira: string; tipo: string; taxa: number; total_vendido: number; custo_taxa: number }[]>({
    queryKey: ['erp-taxas-cartao', lojaId, dataInicio, dataFim],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];

      const { data: bandeiras } = await supabase
        .from('erp_bandeiras_cartao')
        .select('*')
        .eq('ativo', true);
      if (!bandeiras || bandeiras.length === 0) return [];

      let queryVendas = supabase
        .from('erp_vendas')
        .select('total, forma_pagamento, status')
        .eq('status', 'finalizada')
        .in('forma_pagamento', ['cartao_credito', 'cartao_debito']);
      if (lojaId) queryVendas = queryVendas.eq('loja_id', lojaId);
      if (dataInicio) queryVendas = queryVendas.gte('data_venda', dataInicio);
      if (dataFim) queryVendas = queryVendas.lte('data_venda', dataFim + 'T23:59:59');
      const { data: vendas } = await queryVendas;

      // Total vendido em cada tipo (credito/debito)
      const totaisPorTipo: Record<string, number> = { credito: 0, debito: 0 };
      for (const v of vendas ?? []) {
        const tipo = v.forma_pagamento === 'cartao_credito' ? 'credito' : 'debito';
        totaisPorTipo[tipo] = (totaisPorTipo[tipo] ?? 0) + Number(v.total ?? 0);
      }

      return bandeiras.map((b: any) => {
        const taxa = b.tipo === 'credito' ? Number(b.taxa_credito_vista ?? 0) : Number(b.taxa_debito ?? 0);
        const totalVendido = totaisPorTipo[b.tipo] ?? 0;
        const custoTaxa = totalVendido * (taxa / 100);
        return {
          bandeira: b.nome,
          tipo: b.tipo,
          taxa,
          total_vendido: totalVendido,
          custo_taxa: custoTaxa,
        };
      });
    },
    enabled: !!lojaId,
  });
}

// Sangrias por período
export function useSangriasPorPeriodo(
  lojaId: string | undefined,
  dataInicio?: string,
  dataFim?: string
) {
  return useQuery<any[]>({
    queryKey: ['erp-sangrias-periodo', lojaId, dataInicio, dataFim],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let qCaixa = supabase.from('erp_caixa').select('id');
      if (lojaId) qCaixa = qCaixa.eq('loja_id', lojaId);
      const { data: caixas } = await qCaixa;
      const caixaIds = (caixas ?? []).map((c: any) => c.id);
      if (caixaIds.length === 0) return [];

      let query = supabase
        .from('erp_sangrias')
        .select('*')
        .in('caixa_id', caixaIds)
        .order('data_hora', { ascending: false });
      if (dataInicio) query = query.gte('data_hora', dataInicio);
      if (dataFim) query = query.lte('data_hora', dataFim + 'T23:59:59');
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!lojaId,
  });
}

// Entradas extras por período
export function useEntradasExtrasPorPeriodo(
  lojaId: string | undefined,
  dataInicio?: string,
  dataFim?: string
) {
  return useQuery<any[]>({
    queryKey: ['erp-entradas-extras-periodo', lojaId, dataInicio, dataFim],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let qCaixa = supabase.from('erp_caixa').select('id');
      if (lojaId) qCaixa = qCaixa.eq('loja_id', lojaId);
      const { data: caixas } = await qCaixa;
      const caixaIds = (caixas ?? []).map((c: any) => c.id);
      if (caixaIds.length === 0) return [];

      let query = supabase
        .from('erp_entradas_extras')
        .select('*')
        .in('caixa_id', caixaIds)
        .order('data_hora', { ascending: false });
      if (dataInicio) query = query.gte('data_hora', dataInicio);
      if (dataFim) query = query.lte('data_hora', dataFim + 'T23:59:59');
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!lojaId,
  });
}

// Vendas por dia (para gráfico)
export function useVendasPorPeriodo(
  lojaId: string | undefined,
  dataInicio?: string,
  dataFim?: string
) {
  return useQuery<{ dia: string; total: number; count: number }[]>({
    queryKey: ['erp-vendas-por-periodo', lojaId, dataInicio, dataFim],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('erp_vendas')
        .select('data_venda, total, status')
        .eq('status', 'finalizada')
        .limit(5000);
      if (lojaId) query = query.eq('loja_id', lojaId);
      if (dataInicio) query = query.gte('data_venda', dataInicio);
      if (dataFim) query = query.lte('data_venda', dataFim + 'T23:59:59');

      const { data, error } = await query;
      if (error) throw error;

      const mapa: Record<string, { total: number; count: number }> = {};
      for (const v of data ?? []) {
        const dia = v.data_venda.slice(0, 10);
        if (!mapa[dia]) mapa[dia] = { total: 0, count: 0 };
        mapa[dia].total += Number(v.total ?? 0);
        mapa[dia].count += 1;
      }
      return Object.entries(mapa)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dia, v]) => ({ dia, ...v }));
    },
    enabled: !!lojaId,
  });
}

// ========================================
// CHEQUES
// ========================================
export function useChequesFull(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_cheques_full', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_cheques').select('*, pessoa:erp_pessoas(nome_razao, cpf_cnpj)').order('data_vencimento', { ascending: true });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateCheque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from('erp_cheques').insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_cheques'] }),
  });
}

export function useUpdateCheque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase.from('erp_cheques').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_cheques'] }),
  });
}

export function useDeleteCheque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_cheques').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_cheques'] }),
  });
}

// ========================================
// PROTESTOS
// ========================================
export function useProtestosFull(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_protestos_full', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_protestos').select('*, pessoa:erp_pessoas(nome_razao, cpf_cnpj)').order('data_protesto', { ascending: false });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateProtesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from('erp_protestos').insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_protestos'] }),
  });
}

export function useDeleteProtesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_protestos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_protestos'] }),
  });
}

// ========================================
// NEGATIVAÇÕES
// ========================================
export function useNegativacoesFull(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_negativacoes_full', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_negativacoes').select('*, pessoa:erp_pessoas(nome_razao, cpf_cnpj)').order('data_negativacao', { ascending: false });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDeleteNegativacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_negativacoes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_negativacoes'] }),
  });
}

export function useDesnegativar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data, error } = await supabase.from('erp_negativacoes').update({
        status: 'desnegativado',
        desnegativacao_data: new Date().toISOString().slice(0, 10),
        desnegativacao_motivo: motivo,
      }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_negativacoes'] }),
  });
}

// ========================================
// PARCELAMENTOS
// ========================================
export function useParcelamentosFull(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_parcelamentos_full', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_parcelamentos').select('*, pessoa:erp_pessoas(nome_razao, cpf_cnpj), parcelas:erp_parcelamento_parcelas(*)').order('data_contrato', { ascending: false });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// RECOMENDAÇÕES
// ========================================
export function useRecomendacoes(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_recomendacoes', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from('erp_recomendacoes')
        .select('*, cliente:erp_pessoas!cliente_id(nome_razao), recomendado:erp_pessoas!pessoa_recomendada_id(nome_razao)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// PARCERIAS (CRUD)
// ========================================
export function useCreateParceria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from('erp_parcerias').insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_parcerias'] }),
  });
}

// ========================================
// CONFIGURAÇÕES GERAIS DO SISTEMA
// ========================================
export function useConfiguracoesGerais() {
  return useQuery<any[]>({
    queryKey: ['erp_configuracoes_gerais'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase.from('erp_configuracoes_sistema').select('*').order('categoria').order('chave');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertConfiguracao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from('erp_configuracoes_sistema').upsert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_configuracoes_gerais'] }),
  });
}

// ========================================
// CERTIFICADOS (CRUD)
// ========================================
export function useCreateCertificado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from('erp_certificados_digitais').insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_certificados_digitais'] }),
  });
}

export function useDeleteCertificado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_certificados_digitais').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_certificados_digitais'] }),
  });
}

// ========================================
// CONFIGURAÇÕES SEFAZ (CRUD)
// ========================================
export function useUpsertConfiguracaoSefaz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from('erp_configuracoes_sefaz').upsert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_configuracoes_sefaz'] }),
  });
}

// ========================================
// OCORRÊNCIAS / PENDÊNCIAS
// ========================================
export function useOcorrencias(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_ocorrencias', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_ocorrencias').select('*').order('created_at', { ascending: false });
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateOcorrencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from('erp_ocorrencias').insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_ocorrencias'] }),
  });
}

export function useUpdateOcorrencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase.from('erp_ocorrencias').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_ocorrencias'] }),
  });
}

// ========================================
// FEATURE FLAGS (controle de páginas)
// ========================================

/** Busca todas as feature flags (cache global compartilhado por toda a UI). */
export function useFeatureFlags() {
  return useQuery<FeatureFlag[]>({
    queryKey: ['erp_feature_flags'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from('erp_feature_flags')
        .select('*')
        .order('categoria')
        .order('ordem');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000, // cache por 30s ? bom para não ter refetch constante
  });
}

/** Retorna um Map<path, ativo> para consulta rápida na sidebar. */
export function useFeatureFlagsMap() {
  const { data } = useFeatureFlags();
  const map: Record<string, boolean> = {};
  for (const f of data ?? []) {
    map[f.path] = f.ativo;
  }
  return map;
}

/** Verifica se uma rota/path está ativa. Retorna `true` se a flag não existir (fail-open). */
export function useIsFeatureEnabled(path: string) {
  const { data } = useFeatureFlags();
  if (!data) return true; // enquanto carrega, permite
  const flag = data.find((f) => f.path === path);
  if (!flag) return true; // fail-open para rotas sem flag
  return flag.ativo;
}

/** Atualiza o estado ativo/inativo de uma flag (somente admin). */
export function useToggleFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo, motivo, userId }: { id: string; ativo: boolean; motivo?: string; userId?: string }) => {
      // A proteção contra desativação de flags do sistema essenciais
      // (`is_protegida`) é feita **apenas na UI** do painel admin
      // (/config/sistema) ? o switch fica travado e o motivo é mostrado
      // como tooltip. A tabela aceita UPDATE de admin para qualquer flag,
      // inclusive protegidas, para permitir ajustes via SQL se necessário.
      const payload: Record<string, unknown> = { ativo };
      if (!ativo) {
        payload.desativado_em = new Date().toISOString();
        payload.desativado_por = userId ?? null;
        if (motivo) payload.motivo_desativacao = motivo;
      } else {
        payload.desativado_em = null;
        payload.desativado_por = null;
        payload.motivo_desativacao = null;
      }
      const { data, error } = await supabase
        .from('erp_feature_flags')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_feature_flags'] }),
  });
}

/** Atualiza qualquer campo de uma flag. */
export function useUpdateFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FeatureFlag> & { id: string }) => {
      const { data, error } = await supabase
        .from('erp_feature_flags')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_feature_flags'] }),
  });
}

/** Cria nova feature flag customizada. */
export function useCreateFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<FeatureFlag>) => {
      const { data, error } = await supabase
        .from('erp_feature_flags')
        .insert({ ...item, is_system: false })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_feature_flags'] }),
  });
}
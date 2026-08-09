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
    queryKey: ["lojas"],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from("lojas")
        .select("*")
        .eq("ativo", true)
        .order("matriz", { ascending: false })
        .order("apelido");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 30, // 30 minutos (lojas mudam pouco)
  });
}

// ========================================
// CATEGORIAS
// ========================================
export function useCategorias() {
  return useQuery<Categoria[]>({
    queryKey: ["categorias"],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from("categorias")
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
    queryKey: ["produtos", filters],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from("produtos")
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
    queryKey: ["produtos-com-estoque", lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const [produtosRes, estoqueRes] = await Promise.all([
        supabase.from("produtos").select("*, categoria:categorias(*)").eq("ativo", true).order("nome"),
        lojaId
          ? supabase.from("estoque").select("*").eq("loja_id", lojaId)
          : supabase.from("estoque").select("*"),
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
    queryKey: ["estoque", lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured() || !lojaId) return [];
      const { data, error } = await supabase
        .from("estoque")
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
    queryKey: ["vendas", filters],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from("vendas")
        .select(`
          *,
          itens:venda_itens(*),
          cliente:pessoas(*),
          loja:lojas(*),
          usuario:usuarios(*)
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
    queryKey: ["vendas-por-dia", lojaId, dias],
    queryFn: async () => {
      if (!isSupabaseConfigured() || !lojaId) return [];

      const desde = new Date();
      desde.setDate(desde.getDate() - dias);

      const { data, error } = await supabase
        .from("vendas")
        .select("data_venda, total, status")
        .eq("loja_id", lojaId)
        .eq("status", "finalizada")
        .gte("data_venda", desde.toISOString());

      if (error) throw error;

      // Agrupa por dia
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
    queryKey: ["vendas-hoje", lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured() || !lojaId) {
        return { total: 0, tickets: 0, ticketMedio: 0 };
      }
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("vendas")
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
    queryKey: ["top-produtos", lojaId, limite, dias],
    queryFn: async () => {
      if (!isSupabaseConfigured() || !lojaId) return [];
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);

      const { data, error } = await supabase
        .from("venda_itens")
        .select(`
          nome,
          quantidade,
          subtotal,
          venda:vendas!inner(loja_id, status, data_venda)
        `)
        .eq("venda.loja_id", lojaId)
        .eq("venda.status", "finalizada")
        .gte("venda.data_venda", desde.toISOString())
        .limit(limite * 10);

      if (error) throw error;

      // Agrupa
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
// PESSOAS (clientes/fornecedores/funcionários)
// ========================================
export function useClientes() {
  return useQuery<Pessoa[]>({
    queryKey: ["clientes"],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from("pessoas")
        .select("*")
        .eq("ativo", true)
        .order("nome_razao");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// CONTAS A PAGAR/RECEBER
// ========================================
export function useContas(filters?: { tipo?: "pagar" | "receber"; status?: string; lojaId?: string }) {
  return useQuery<Conta[]>({
    queryKey: ["contas", filters],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from("contas")
        select("*")
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
    queryKey: ["contas-vencidas", lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const hoje = new Date().toISOString().slice(0, 10);
      let query = supabase
        .from("contas")
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
    queryKey: ["dashboard-stats", lojaId],
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

      // Vendas de hoje
      const { data: vendasHoje } = await supabase
        .from("vendas")
        .select("total")
        .eq("loja_id", lojaId)
        .eq("status", "finalizada")
        .gte("data_venda", hoje.toISOString());

      const totalVendas = (vendasHoje ?? []).reduce((s, v) => s + Number(v.total), 0);
      const tickets = vendasHoje?.length ?? 0;

      // Produtos com estoque baixo
      const { data: produtos } = await supabase
        .from("produtos")
        .select("id, estoque_minimo");

      const { data: estoque } = await supabase
        .from("estoque")
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

      // Contas vencidas
      const { data: contasVenc } = await supabase
        .from("contas")
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
// MUTATIONS (criar/atualizar/excluir)
// ========================================
export function useCreateVenda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (venda: Partial<Venda> & { itens: any[] }) => {
      const { itens, ...vendaData } = venda;
      const { data: vendaCriada, error } = await supabase
        .from("vendas")
        .insert(vendaData)
        .select()
        .single();
      if (error) throw error;

      if (itens && itens.length > 0) {
        const { error: errItens } = await supabase
          .from("venda_itens")
          .insert(itens.map((i) => ({ ...i, venda_id: vendaCriada.id })));
        if (errItens) throw errItens;
      }

      return vendaCriada;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["vendas-por-dia"] });
      qc.invalidateQueries({ queryKey: ["vendas-hoje"] });
      qc.invalidateQueries({ queryKey: ["top-produtos"] });
    },
  });
}

export function useCreateProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (produto: Partial<Produto>) => {
      const { data, error } = await supabase.from("produtos").insert(produto).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["produtos"] }),
  });
}

export function useUpdateEstoque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ produtoId, lojaId, quantidade }: { produtoId: string; lojaId: string; quantidade: number }) => {
      const { data, error } = await supabase
        .from("estoque")
        .upsert({ produto_id: produtoId, loja_id: lojaId, quantidade, updated_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque"] });
      qc.invalidateQueries({ queryKey: ["produtos-com-estoque"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}
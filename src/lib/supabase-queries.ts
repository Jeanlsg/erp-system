import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/supabase";
import type {
  Loja,
  Usuario,
  Produto,
  Estoque,
  Venda,
  VendaCompleta,
  Categoria,
  Pessoa,
  Conta,
  ProdutoComEstoque,
  RegiaoEntrega,
  Transportadora,
  Contato,
  FeatureFlag,
  Caixa,
} from "@/types/database";

export { isSupabaseConfigured, supabase };

// ========================================
// USURIOS
// ========================================

export function useUsuarios() {
  return useQuery<Usuario[]>({
    queryKey: ["erp_usuarios"],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from("erp_usuarios")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Usuario[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Usuario> & { id: string }) => {
      const { data, error } = await supabase
        .from("erp_usuarios")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["erp_usuarios"] });
    },
  });
}

export function useToggleUsuarioAtivo() {
  const updateUsuario = useUpdateUsuario();
  return {
    mutate: ({ id, ativo }: { id: string; ativo: boolean }) =>
      updateUsuario.mutateAsync({ id, ativo }),
    mutateAsync: ({ id, ativo }: { id: string; ativo: boolean }) =>
      updateUsuario.mutateAsync({ id, ativo }),
    isPending: updateUsuario.isPending,
  };
}

export function useDesbloquearUsuario() {
  const updateUsuario = useUpdateUsuario();
  return {
    mutate: (id: string) =>
      updateUsuario.mutateAsync({
        id,
        bloqueado: false,
        tentativas_login: 0,
      }),
    mutateAsync: (id: string) =>
      updateUsuario.mutateAsync({
        id,
        bloqueado: false,
        tentativas_login: 0,
      }),
  };
}

/**
 * Atualiza as permisses granulares de um usurio.
 * O campo `permissoes`  um JSONB no formato:
 *   { "pdv.usar": true, "caixa.abrir": false, ... }
 * Se uma permisso no estiver listada, usa a permisso padro do role.
 */
export function useUpdatePermissoesUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, permissoes }: { id: string; permissoes: Record<string, boolean> }) => {
      const { data, error } = await supabase
        .from("erp_usuarios")
        .update({ permissoes })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["erp_usuarios"] });
    },
  });
}

/**
 * Reseta a senha de um usurio (apenas admin).
 * Nota: A senha em si  gerenciada pelo Supabase Auth.
 * Aqui apenas resetamos tentativas e desbloqueamos.
 */
export function useResetarAcessoUsuario() {
  const updateUsuario = useUpdateUsuario();
  return {
    mutate: (id: string) =>
      updateUsuario.mutateAsync({
        id,
        bloqueado: false,
        tentativas_login: 0,
      }),
  };
}

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
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 30,
  });
}

export function useCreateCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (categoria: Partial<Categoria>) => {
      const { data, error } = await supabase.from("erp_categorias").insert(categoria).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["erp_categorias"] }),
  });
}

export function useUpdateCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Categoria> & { id: string }) => {
      const { data, error } = await supabase.from("erp_categorias").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["erp_categorias"] }),
  });
}

export function useDeleteCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("erp_categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["erp_categorias"] }),
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

// ===== VIEW CONSOLIDADA: Produtos + Estoque + Lotes =====
export interface ProdutoCompleto {
  produto_id: string;
  sku: string;
  nome: string;
  descricao: string | null;
  categoria_id: string | null;
  categoria_nome: string | null;
  marca: string | null;
  modelo: string | null;
  unidade: string;
  codigo_barras: string | null;
  imagem_url: string | null;
  preco_custo: number;
  preco_venda: number;
  estoque_minimo: number;
  estoque_maximo: number | null;
  peso: number | null;
  volume: number | null;
  ncm: string | null;
  cfop: string | null;
  icms: number | null;
  ipi: number | null;
  pis: number | null;
  cofins: number | null;
  cest: string | null;
  orig: string | null;
  comissao_percentual: number;
  tipo_produto: string;
  controla_lote: boolean;
  controla_serie: boolean;
  ativo: boolean;
  produto_created_at: string;
  produto_updated_at: string;
  loja_id: string;
  loja_apelido: string;
  loja_nome: string;
  estoque_atual: number;
  localizacao: string | null;
  estoque_updated_at: string | null;
  status_estoque: "sem_estoque" | "baixo" | "ok" | "excesso";
  valor_estoque: number;
  qtd_lotes: number;
  qtd_total_lotes: number;
  lote_mais_proximo_validade: string | null;
  lote_mais_proximo_dias: number | null;
  lote_mais_proximo_severidade: "vencido" | "critico" | "alerta" | "ok" | null;
}

/**
 * Hook que consome a view consolidada v_erp_produto_completo.
 * Combina dados de produtos + estoque por loja + resumo de lotes.
 *
 * @param filters.lojaId - filtra por loja especfica (undefined = todas)
 * @param filters.search - busca por nome, SKU ou cdigo de barras
 * @param filters.statusEstoque - filtra por status (sem_estoque, baixo, ok, excesso)
 * @param filters.severidadeLote - filtra por severidade do lote mais prximo
 */
export function useProdutosCompleto(filters?: {
  lojaId?: string;
  search?: string;
  statusEstoque?: string;
  severidadeLote?: string;
}) {
  return useQuery<ProdutoCompleto[]>({
    queryKey: ["erp_produto_completo", filters],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from("v_erp_produto_completo").select("*");

      if (filters?.lojaId) query = query.eq("loja_id", filters.lojaId);
      if (filters?.statusEstoque) query = query.eq("status_estoque", filters.statusEstoque);
      if (filters?.severidadeLote) query = query.eq("lote_mais_proximo_severidade", filters.severidadeLote);

      const { data, error } = await query.order("nome");
      if (error) throw error;

      // Filtro de busca no client (no pode usar ilike em views sem permisses)
      let result = (data ?? []) as ProdutoCompleto[];
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        result = result.filter(
          (p) =>
            p.nome.toLowerCase().includes(s) ||
            p.sku.toLowerCase().includes(s) ||
            (p.codigo_barras ?? "").toLowerCase().includes(s) ||
            (p.marca ?? "").toLowerCase().includes(s)
        );
      }
      return result;
    },
  });
}

/**
 * Verso agregada (sem filtro de loja): uma linha por produto
 * com estoque total somado de todas as lojas.
 */
export function useProdutosTotal(filters?: {
  search?: string;
  statusEstoque?: string;
}) {
  return useQuery<any[]>({
    queryKey: ["erp_produto_total", filters],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from("v_erp_produto_total").select("*");
      if (filters?.statusEstoque) query = query.eq("status_estoque", filters.statusEstoque);

      const { data, error } = await query.order("nome");
      if (error) throw error;

      let result = (data ?? []) as any[];
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        result = result.filter(
          (p) =>
            p.nome.toLowerCase().includes(s) ||
            p.sku.toLowerCase().includes(s) ||
            (p.codigo_barras ?? "").toLowerCase().includes(s) ||
            (p.marca ?? "").toLowerCase().includes(s)
        );
      }
      return result;
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
        .select("*, pessoa:erp_pessoas(id, nome_razao), plano:erp_plano_contas(codigo, nome)")
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
      // Faz 3 queries em paralelo: lotes, produtos e estoque
      const [lotesRes, produtosRes, estoqueRes] = await Promise.all([
        supabase
          .from('erp_lotes')
          .select('*')
          .order('data_validade', { ascending: true }),
        supabase
          .from('erp_produtos')
          .select('id, sku, nome, marca, unidade, estoque_minimo, preco_custo, preco_venda, controla_lote, ativo'),
        lojaId
          ? supabase.from('erp_estoque').select('*').eq('loja_id', lojaId)
          : supabase.from('erp_estoque').select('*'),
      ]);

      if (lotesRes.error) throw lotesRes.error;
      if (produtosRes.error) throw produtosRes.error;
      if (estoqueRes.error) throw estoqueRes.error;

      // Mapas para lookup rpido
      const produtoMap: Record<string, any> = {};
      for (const p of produtosRes.data ?? []) produtoMap[p.id] = p;

      const estoqueMap: Record<string, Record<string, number>> = {};
      for (const e of estoqueRes.data ?? []) {
        if (!estoqueMap[e.produto_id]) estoqueMap[e.produto_id] = {};
        estoqueMap[e.produto_id][e.loja_id] = Number(e.quantidade);
      }

      // Enriquece cada lote com dados do produto + estoque
      let result = (lotesRes.data ?? []).map((l: any) => {
        const produto = produtoMap[l.produto_id] || {};
        const estoquePorLoja = estoqueMap[l.produto_id] || {};
        const estoqueTotal = Object.values(estoquePorLoja).reduce((s: number, v: any) => s + Number(v), 0);
        const estoqueLoja = Number(estoquePorLoja[l.loja_id] ?? 0);
        const estoqueMinimo = Number(produto.estoque_minimo ?? 0);

        return {
          ...l,
          // Produto
          produto_sku: produto.sku,
          produto_nome: produto.nome,
          produto_marca: produto.marca,
          produto_unidade: produto.unidade ?? "UN",
          produto_estoque_minimo: estoqueMinimo,
          produto_preco_custo: Number(produto.preco_custo ?? 0),
          produto_preco_venda: Number(produto.preco_venda ?? 0),
          produto_ativo: produto.ativo !== false,
          produto_controla_lote: produto.controla_lote === true,
          // Estoque
          estoque_total: estoqueTotal,
          estoque_loja: estoqueLoja,
          // Status calculado
          status_estoque: estoqueLoja === 0
            ? "sem_estoque"
            : estoqueLoja <= estoqueMinimo
              ? "baixo"
              : "ok",
        };
      });

      // Filtra por loja se especificado (filtro client-side pois j temos o join)
      if (lojaId) {
        result = result.filter((l) => l.loja_id === lojaId);
      }

      return result;
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
      qc.invalidateQueries({ queryKey: ['erp_produto_completo'] });
      qc.invalidateQueries({ queryKey: ['erp_produto_total'] });
    },
  });
}

export function useUpdateLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from('erp_lotes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_lotes'] });
      qc.invalidateQueries({ queryKey: ['erp_lotes-vencendo'] });
      qc.invalidateQueries({ queryKey: ['erp_produto_completo'] });
      qc.invalidateQueries({ queryKey: ['erp_produto_total'] });
    },
  });
}

export function useDeleteLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_lotes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_lotes'] });
      qc.invalidateQueries({ queryKey: ['erp_lotes-vencendo'] });
      qc.invalidateQueries({ queryKey: ['erp_produto_completo'] });
      qc.invalidateQueries({ queryKey: ['erp_produto_total'] });
    },
  });
}

// ========================================
// NOTIFICAES
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_feature_flags'] }),
  });
}

// ========================================
// CAIXA / FRENTE DE CAIXA PDV
// ========================================

export function useCaixas(lojaId?: string) {
  return useQuery<Caixa[]>({
    queryKey: ['erp_caixa', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('erp_caixa')
        .select(`
          *,
          loja:erp_lojas(id, nome, apelido),
          usuario:erp_usuarios(id, nome)
        `)
        .order('data_abertura', { ascending: false })
        .limit(100);
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

export function useCaixaAberto(usuarioId?: string) {
  return useQuery<Caixa | null>({
    queryKey: ['erp_caixa-aberto', usuarioId],
    queryFn: async () => {
      if (!isSupabaseConfigured() || !usuarioId) return null;
      const { data, error } = await supabase
        .from('erp_caixa')
        .select('*')
        .eq('usuario_id', usuarioId)
        .eq('status', 'aberto')
        .is('data_fechamento', null)
        .order('data_abertura', { ascending: false })
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!usuarioId,
  });
}

export function useCaixaPorId(caixaId?: string) {
  return useQuery<Caixa | null>({
    queryKey: ['erp_caixa', caixaId],
    queryFn: async () => {
      if (!isSupabaseConfigured() || !caixaId) return null;
      const { data, error } = await supabase
        .from('erp_caixa')
        .select(`
          *,
          loja:erp_lojas(*),
          usuario:erp_usuarios(id, nome)
        `)
        .eq('id', caixaId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!caixaId,
  });
}

export function useCreateCaixa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (caixa: Partial<Caixa>) => {
      const { data, error } = await supabase
        .from('erp_caixa')
        .insert({ ...caixa, status: 'aberto' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_caixa'] });
      qc.invalidateQueries({ queryKey: ['erp_caixa-aberto'] });
    },
  });
}

export function useFecharCaixa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      caixaId,
      valorFinal,
      valorDinheiro,
      valorPix,
      valorCartaoCredito,
      valorCartaoDebito,
      valorCrediario,
      valorBoleto,
      valorOutros,
      observacoes,
      encerradoPor,
    }: {
      caixaId: string;
      valorFinal: number;
      valorDinheiro?: number;
      valorPix?: number;
      valorCartaoCredito?: number;
      valorCartaoDebito?: number;
      valorCrediario?: number;
      valorBoleto?: number;
      valorOutros?: number;
      observacoes?: string;
      encerradoPor?: string;
    }) => {
      const { error: errorCaixa } = await supabase
        .from('erp_caixa')
        .update({
          status: 'fechado',
          data_fechamento: new Date().toISOString(),
          valor_final: valorFinal,
          encerrado_por: encerradoPor,
          observacoes,
        })
        .eq('id', caixaId);
      if (errorCaixa) throw errorCaixa;

      const { data: caixa } = await supabase
        .from('erp_caixa')
        .select('*')
        .eq('id', caixaId)
        .single();

      if (caixa) {
        const diferenca = valorFinal - (caixa.valor_inicial + caixa.total_vendas - caixa.total_sangrias + caixa.total_entradas_extras - caixa.valor_troco);
        // Upsert por caixa_id: evita duplicidade caso um trigger do banco
        // também registre o fechamento (UNIQUE em caixa_id no banco)
        const { error: errorFechamento } = await supabase
          .from('erp_fechamentos_caixa')
          .upsert({
            caixa_id: caixaId,
            usuario_id: caixa.usuario_id,
            data_fechamento: new Date().toISOString(),
            valor_inicial: caixa.valor_inicial,
            valor_final: valorFinal,
            valor_vendas: caixa.total_vendas,
            valor_sangrias: caixa.total_sangrias,
            valor_entradas: caixa.total_entradas_extras,
            valor_troco: caixa.valor_troco,
            valor_dinheiro: valorDinheiro ?? 0,
            valor_pix: valorPix ?? 0,
            valor_cartao_credito: valorCartaoCredito ?? 0,
            valor_cartao_debito: valorCartaoDebito ?? 0,
            valor_crediario: valorCrediario ?? 0,
            valor_boleto: valorBoleto ?? 0,
            valor_outros: valorOutros ?? 0,
            diferenca,
            observacoes,
          }, { onConflict: 'caixa_id' });
        if (errorFechamento) throw errorFechamento;
      }

      return { success: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_caixa'] });
      qc.invalidateQueries({ queryKey: ['erp_caixa-aberto'] });
      qc.invalidateQueries({ queryKey: ['erp_fechamentos-caixa'] });
    },
  });
}

export function useFechamentosCaixa(caixaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_fechamentos-caixa', caixaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('erp_fechamentos_caixa')
        .select('*')
        .order('data_fechamento', { ascending: false })
        .limit(100);
      if (caixaId) query = query.eq('caixa_id', caixaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCaixaConfig() {
  return useQuery<{ quantidade_caixas: number }>({
    queryKey: ['erp_caixa-config'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return { quantidade_caixas: 2 };
      const { data, error } = await supabase
        .from('erp_configuracoes_sistema')
        .select('valor')
        .eq('chave', 'quantidade_caixas')
        .maybeSingle();
      if (error || !data) return { quantidade_caixas: 2 };
      const num = parseInt(data.valor || '2', 10);
      return { quantidade_caixas: isNaN(num) ? 2 : num };
    },
  });
}

export function useUpdateCaixaConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quantidadeCaixas: number) => {
      const { data, error } = await supabase
        .from('erp_configuracoes_sistema')
        .upsert(
          { chave: 'quantidade_caixas', valor: String(quantidadeCaixas), categoria: 'caixa' },
          { onConflict: 'chave' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_caixa-config'] });
      qc.invalidateQueries({ queryKey: ['erp_configuracoes_gerais'] });
    },
  });
}

// Nova verso de useCreateVenda com integrao de caixa
export function useCreateVenda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (venda: Partial<Venda> & { itens: any[]; caixa_id?: string }) => {
      const { itens, ...vendaData } = venda;
      const { data: vendaCriada, error } = await supabase
        .from('erp_vendas')
        .insert(vendaData)
        .select()
        .single();
      if (error) throw error;

      if (itens && itens.length > 0) {
        const { error: errItens } = await supabase
          .from('erp_venda_itens')
          .insert(itens.map((i) => ({ ...i, venda_id: vendaCriada.id })));
        if (errItens) throw errItens;
      }

      if (venda.caixa_id) {
        const { data: caixa } = await supabase
          .from('erp_caixa')
          .select('total_vendas, valor_troco')
          .eq('id', venda.caixa_id)
          .single();
        if (caixa) {
          await supabase
            .from('erp_caixa')
            .update({
              total_vendas: (caixa.total_vendas ?? 0) + Number(venda.total),
              valor_troco: (caixa.valor_troco ?? 0) + Number(venda.troco ?? 0),
            })
            .eq('id', venda.caixa_id);
        }
      }

      return vendaCriada;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_vendas'] });
      qc.invalidateQueries({ queryKey: ['erp_dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['erp_vendas-por-dia'] });
      qc.invalidateQueries({ queryKey: ['erp_vendas-hoje'] });
      qc.invalidateQueries({ queryKey: ['erp_top-produtos'] });
      qc.invalidateQueries({ queryKey: ['erp_caixa'] });
      qc.invalidateQueries({ queryKey: ['erp_caixa'] });
    },
  });
}

// Atualizar estoque aps venda (baixa atmica via RPC no banco)
export function useBaixarEstoqueVenda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lojaId,
      itens,
      origem = 'venda',
      documentoId,
    }: { lojaId: string; itens: any[]; origem?: string; documentoId?: string }) => {
      const pItens = itens
        .filter((item) => item.produto_id && Number(item.quantidade) > 0)
        .map((item) => ({
          produto_id: item.produto_id,
          quantidade: Number(item.quantidade),
        }));
      if (pItens.length === 0) return { success: true };

      const { error } = await supabase
        .schema('erp')
        .rpc('baixar_estoque_atomico', {
          p_loja_id: lojaId,
          p_itens: pItens,
          p_origem: origem,
          p_documento_id: documentoId ?? null,
        });
      if (error) throw new Error(`Falha na baixa de estoque: ${error.message}`);
      return { success: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_estoque'] });
      qc.invalidateQueries({ queryKey: ['erp_estoque_movimentacoes'] });
    },
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
// BOLETOS / CHEQUES / PROMISSRIAS
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_sangrias'] });
      qc.invalidateQueries({ queryKey: ['erp_caixa'] });
      qc.invalidateQueries({ queryKey: ['erp_caixa-aberto'] });
    },
  });
}

// =====================================
// NFE ENTRADA (Importao de XML)
// =====================================
export function useNFeEntrada(filters?: { lojaId?: string; status?: string }) {
  return useQuery<any[]>({
    queryKey: ['erp_nfe_entrada', filters],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('erp_nfe_entrada')
        .select('*')
        .order('data_emissao', { ascending: false })
        .limit(200);
      if (filters?.lojaId) query = query.eq('loja_id', filters.lojaId);
      if (filters?.status) query = query.eq('status', filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateNFeEntrada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase
        .from('erp_nfe_entrada')
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_nfe_entrada'] }),
  });
}

export function useUpdateNFeEntrada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from('erp_nfe_entrada')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_nfe_entrada'] }),
  });
}

export function useDeleteNFeEntrada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_nfe_entrada').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_nfe_entrada'] }),
  });
}

/**
 * Importa uma NFe completa: cria produtos novos (se necessrio), atualiza estoque,
 * cria compra e registra os itens. Tudo em uma transao lgica.
 */
export function useImportarNFe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      loja_id: string;
      usuario_id: string;
      nfe: any;
      itens: any[]; // itens com produto_id mapeado
      fornecedor_id?: string;
    }) => {
      const { loja_id, usuario_id, nfe, itens, fornecedor_id } = params;

      // 0. Bloquear reimportação da mesma NFe (por chave de acesso)
      if (nfe.chave_acesso) {
        const { data: jaImportada, error: dupErr } = await supabase
          .from('erp_nfe_entrada')
          .select('id, numero, serie')
          .eq('chave_acesso', nfe.chave_acesso)
          .maybeSingle();
        if (dupErr) throw dupErr;
        if (jaImportada) {
          throw new Error(
            `Esta NFe (chave ${nfe.chave_acesso}) já foi importada anteriormente (NFe ${jaImportada.numero}/${jaImportada.serie}).`
          );
        }
      }

      // 1. Criar/buscar fornecedor
      let fId = fornecedor_id;
      if (!fId && nfe.emitente.cnpj) {
        const { data: existente } = await supabase
          .from('erp_pessoas')
          .select('id')
          .eq('cpf_cnpj', nfe.emitente.cnpj)
          .maybeSingle();

        if (existente) {
          fId = existente.id;
        } else {
          const { data: novo, error: novoErr } = await supabase
            .from('erp_pessoas')
            .insert({
              tipo: nfe.emitente.cnpj.length === 11 ? 'fisica' : 'juridica',
              cpf_cnpj: nfe.emitente.cnpj,
              nome_razao: nfe.emitente.nome,
              nome_fantasia: nfe.emitente.fantasia || null,
              email: null,
              telefone: null,
              endereco: nfe.emitente.endereco || null,
              ativo: true,
            })
            .select()
            .single();
          if (novoErr) throw new Error(`Erro ao cadastrar fornecedor: ${novoErr.message}`);
          fId = novo.id;
        }
      }

      // 2. Criar compra
      const { data: compra, error: compraErr } = await supabase
        .from('erp_compras')
        .insert({
          loja_id,
          fornecedor_id: fId,
          usuario_id,
          data_compra: nfe.data_emissao,
          total: nfe.valor_total,
          status: 'processada',
          observacoes: `Importado da NFe ${nfe.numero}/${nfe.serie}`,
        })
        .select()
        .single();
      if (compraErr) throw compraErr;

      // 3. Criar NFe de entrada
      const { data: nfeEntrada, error: nfeErr } = await supabase
        .from('erp_nfe_entrada')
        .insert({
          loja_id,
          fornecedor_id: fId,
          compra_id: compra.id,
          chave_acesso: nfe.chave_acesso,
          numero: nfe.numero,
          serie: nfe.serie,
          tipo: 'nfe',
          data_emissao: nfe.data_emissao,
          valor_produtos: nfe.valor_produtos,
          valor_frete: nfe.valor_frete,
          valor_seguro: nfe.valor_seguro,
          valor_desconto: nfe.valor_desconto,
          valor_icms: nfe.valor_icms,
          valor_ipi: nfe.valor_ipi,
          valor_pis: nfe.valor_pis,
          valor_cofins: nfe.valor_cofins,
          valor_total: nfe.valor_total,
          emitente_cnpj: nfe.emitente.cnpj,
          emitente_nome: nfe.emitente.nome,
          emitente_fantasia: nfe.emitente.fantasia,
          emitente_endereco: nfe.emitente.endereco || null,
          xml_original: nfe.xml_original,
          status: 'processada',
          usuario_id,
        })
        .select()
        .single();
      if (nfeErr) throw nfeErr;

      // 4. Processar cada item
      for (const item of itens) {
        if (!item.quantidade || Number(item.quantidade) <= 0) {
          throw new Error(
            `Item ${item.numero_item} (${item.nome}) tem quantidade inválida (${item.quantidade}).`
          );
        }
        let produtoId = item.produto_id;

        // Criar produto se no existir
        if (!produtoId || item.acao === 'criar_novo') {
          const sku = item.codigo_produto || `NFe-${nfe.numero}-${item.numero_item}`;
          const precoCusto = item.valor_unitario;
          const precoVenda = precoCusto * (1 + (item.margem_desejada || 0.5));

          const { data: novoProduto, error: prodErr } = await supabase
            .from('erp_produtos')
            .insert({
              sku,
              nome: item.nome,
              codigo_barras: item.codigo_ean || null,
              preco_custo: precoCusto,
              preco_venda: precoVenda,
              unidade: item.unidade || 'UN',
              ncm: item.ncm || null,
              ativo: true,
              tipo_produto: 'revenda',
            })
            .select()
            .single();
          if (prodErr) throw prodErr;
          produtoId = novoProduto.id;
        } else {
          // Atualizar preo de custo se necessrio
          const { error: precoErr } = await supabase
            .from('erp_produtos')
            .update({
              preco_custo: item.valor_unitario,
              updated_at: new Date().toISOString(),
            })
            .eq('id', produtoId);
          if (precoErr) {
            throw new Error(`Erro ao atualizar custo do produto "${item.nome}": ${precoErr.message}`);
          }
        }

        // Criar item da compra
        const { error: compraItemErr } = await supabase.from('erp_compra_itens').insert({
          compra_id: compra.id,
          produto_id: produtoId,
          preco_custo: item.valor_unitario,
          quantidade: item.quantidade,
          subtotal: item.valor_total,
        });
        if (compraItemErr) {
          throw new Error(`Erro ao registrar item da compra "${item.nome}": ${compraItemErr.message}`);
        }

        // Entrada de estoque pela RPC: escritura o kardex e recalcula o
        // custo médio móvel com o custo real da nota (nunca no cliente).
        const { error: creditoErr } = await supabase
          .schema('erp')
          .rpc('creditar_estoque_atomico', {
            p_loja_id: loja_id,
            p_itens: [{
              produto_id: produtoId,
              quantidade: item.quantidade,
              custo_unitario: item.custo_unitario_final ?? item.valor_unitario ?? null,
            }],
            p_origem: 'nfe_entrada',
            p_documento_id: compra.id,
          });
        if (creditoErr) {
          throw new Error(`Erro ao dar entrada no estoque de "${item.nome}": ${creditoErr.message}`);
        }

        // Registrar item da NFe de entrada
        const { error: nfeItemErr } = await supabase.from('erp_nfe_entrada_itens').insert({
          nfe_entrada_id: nfeEntrada.id,
          produto_id: produtoId,
          numero_item: item.numero_item,
          codigo_produto: item.codigo_produto,
          codigo_ean: item.codigo_ean,
          nome: item.nome,
          ncm: item.ncm,
          cfop: item.cfop,
          unidade: item.unidade,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.valor_total,
          valor_desconto: item.valor_desconto || 0,
          icms_origem: item.icms_origem,
          icms_csosn: item.icms_csosn,
          icms_aliquota: item.icms_aliquota || 0,
          icms_valor: item.icms_valor || 0,
          ipi_valor: item.ipi_valor || 0,
          produto_criado: item.acao === 'criar_novo',
          estoque_atualizado: true,
          custo_unitario_final: item.valor_unitario + (item.ipi_valor || 0) / item.quantidade,
        });
        if (nfeItemErr) {
          throw new Error(`Erro ao registrar item da NFe "${item.nome}": ${nfeItemErr.message}`);
        }
      }

      // Contas a pagar: as duplicatas da NF-e trazem o parcelamento real.
      // Sem elas a RPC cai numa parcela única no prazo padrão da loja.
      const { data: parcelas, error: contasErr } = await supabase
        .schema('erp')
        .rpc('gerar_contas_pagar_compra', {
          p_compra_id: compra.id,
          p_duplicatas: nfe.duplicatas ?? [],
        });
      if (contasErr) {
        throw new Error(
          `Estoque e compra registrados, mas falhou ao gerar contas a pagar: ${contasErr.message}`
        );
      }

      return { nfeEntrada, compra, contas_geradas: parcelas ?? 0 };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_nfe_entrada'] });
      qc.invalidateQueries({ queryKey: ['erp_produtos'] });
      qc.invalidateQueries({ queryKey: ['erp_estoque'] });
      qc.invalidateQueries({ queryKey: ['erp_estoque_movimentacoes'] });
      qc.invalidateQueries({ queryKey: ['erp_compras'] });
      qc.invalidateQueries({ queryKey: ['erp_contas'] });
      qc.invalidateQueries({ queryKey: ['erp_pessoas'] });
    },
  });
}

// =====================================
// REMESSAS ENTRE FILIAIS
// =====================================
export function useRemessas(filters?: { lojaId?: string; status?: string; tipo?: string }) {
  return useQuery<any[]>({
    queryKey: ['erp_remessas', filters],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('erp_remessas')
        .select(`
          *,
          origem:erp_lojas!loja_origem_id(id, nome, apelido, cnpj, uf),
          destino:erp_lojas!loja_destino_id(id, nome, apelido, cnpj, uf),
          itens:erp_remessa_itens(
            *,
            produto:erp_produtos(id, nome, sku, preco_custo, preco_venda)
          ),
          usuario:erp_usuarios(id, nome)
        `)
        .order('data_remessa', { ascending: false })
        .limit(200);
      if (filters?.lojaId) {
        query = query.or(`loja_origem_id.eq.${filters.lojaId},loja_destino_id.eq.${filters.lojaId}`);
      }
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.tipo) query = query.eq('tipo', filters.tipo);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateRemessa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: any) => {
      const { itens, ...remessa } = params;

      // Criar remessa
      const { data: novaRemessa, error } = await supabase
        .from('erp_remessas')
        .insert({ ...remessa, status: 'rascunho' })
        .select()
        .single();
      if (error) throw error;

      // Criar itens
      if (itens && itens.length > 0) {
        const itensParaInserir = itens.map((i: any) => ({
          ...i,
          remessa_id: novaRemessa.id,
        }));
        const { error: itensErr } = await supabase
          .from('erp_remessa_itens')
          .insert(itensParaInserir);
        if (itensErr) throw itensErr;

        // Atualizar valor total (produtos + frete + seguro)
        const total = itens.reduce((s: number, i: any) => s + Number(i.subtotal || 0), 0);
        const { error: totalErr } = await supabase
          .from('erp_remessas')
          .update({
            valor_produtos: total,
            valor_total: total + Number(remessa.valor_frete || 0) + Number(remessa.valor_seguro || 0),
          })
          .eq('id', novaRemessa.id);
        if (totalErr) throw totalErr;
      }

      return novaRemessa;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_remessas'] }),
  });
}

export function useUpdateRemessa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from('erp_remessas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_remessas'] }),
  });
}

export function useDeleteRemessa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_remessas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_remessas'] }),
  });
}

/**
 * Emite a NF-e da remessa via Edge Function `emitir-nfe` (emissão REAL na SEFAZ
 * pelo microserviço nfe-service — sped-nfe). Substitui a antiga emissão simulada.
 */
export function useEmitirNFeRemessa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ remessa_id, loja_id }: { remessa_id: string; loja_id: string }) => {
      const { data, error } = await supabase.functions.invoke('erp-emitir-nfe', {
        body: { remessa_id, loja_id },
      });
      if (error) {
        // FunctionsHttpError: o corpo tem o motivo real (pré-requisito, rejeição, etc.)
        let detalhe = error.message;
        try {
          const ctx = await (error as any).context?.json?.();
          if (ctx?.erro) detalhe = ctx.faltas ? `${ctx.erro}: ${ctx.faltas.join(', ')}` : ctx.erro;
        } catch { /* mantém a mensagem padrão */ }
        throw new Error(detalhe);
      }
      if (data && data.autorizada === false) {
        throw new Error(`SEFAZ rejeitou (cStat ${data.cstat}): ${data.motivo}`);
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_remessas'] });
      qc.invalidateQueries({ queryKey: ['erp_estoque'] });
      qc.invalidateQueries({ queryKey: ['erp_notas_fiscais'] });
    },
  });
}

/**
 * Emite a NF-e de uma VENDA finalizada via Edge Function `emitir-nfe`.
 */
export function useEmitirNFeVenda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      venda_id, loja_id, tipo = 'nfe',
    }: { venda_id: string; loja_id: string; tipo?: 'nfe' | 'nfce' }) => {
      const { data, error } = await supabase.functions.invoke('erp-emitir-nfe', {
        body: { venda_id, loja_id, tipo },
      });
      if (error) {
        let detalhe = error.message;
        try {
          const ctx = await (error as any).context?.json?.();
          if (ctx?.erro) detalhe = ctx.faltas ? `${ctx.erro}: ${ctx.faltas.join(', ')}` : (ctx.produtos ? `${ctx.erro} (${ctx.produtos.join(', ')})` : ctx.erro);
        } catch { /* mantém a mensagem padrão */ }
        throw new Error(detalhe);
      }
      if (data && data.autorizada === false) {
        throw new Error(`SEFAZ rejeitou (cStat ${data.cstat}): ${data.motivo}`);
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_notas_fiscais'] });
      qc.invalidateQueries({ queryKey: ['erp_notas_fiscais-venda-ids'] });
      qc.invalidateQueries({ queryKey: ['erp_vendas'] });
    },
  });
}

export function useReceberRemessa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ remessa_id, usuario_id }: { remessa_id: string; usuario_id: string }) => {
      // Update condicional: só transiciona se ainda estiver em status recebível.
      // Evita recebimento duplicado por dois usuários simultâneos.
      const { data: atualizadas, error: statusErr } = await supabase
        .from('erp_remessas')
        .update({
          status: 'recebida',
          data_recebimento: new Date().toISOString(),
          recebido_por: usuario_id,
        })
        .eq('id', remessa_id)
        .in('status', ['nf_emitida', 'em_transito'])
        .select();
      if (statusErr) throw statusErr;
      if (!atualizadas || atualizadas.length === 0) {
        throw new Error('Remessa não está em status recebível (já foi recebida ou cancelada).');
      }
      const remessaAtual = atualizadas[0];

      const { data: itensRemessa, error: itensErr } = await supabase
        .from('erp_remessa_itens')
        .select('*')
        .eq('remessa_id', remessa_id);
      if (itensErr) throw itensErr;

      // Crédito de estoque atômico via RPC no banco
      const pItens = (itensRemessa ?? [])
        .filter((i: any) => i.produto_id && Number(i.quantidade) > 0)
        .map((i: any) => ({ produto_id: i.produto_id, quantidade: Number(i.quantidade) }));
      if (pItens.length > 0) {
        const { error: creditoErr } = await supabase
          .schema('erp')
          .rpc('creditar_estoque_atomico', {
            p_loja_id: remessaAtual.loja_destino_id,
            p_itens: pItens,
            p_origem: 'remessa',
            p_documento_id: remessa_id,
          });
        if (creditoErr) throw new Error(`Falha ao creditar estoque no destino: ${creditoErr.message}`);
      }

      // Marcar itens como recebidos
      const { error: marcaErr } = await supabase
        .from('erp_remessa_itens')
        .update({
          estoque_destino_adicionado: true,
          data_entrada_destino: new Date().toISOString(),
        })
        .eq('remessa_id', remessa_id);
      if (marcaErr) throw marcaErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_remessas'] });
      qc.invalidateQueries({ queryKey: ['erp_estoque'] });
    },
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
// CHAVES PIX / CONTAS BANCRIAS
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
// REGIES DE ENTREGA
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
// AGENDA TELEFNICA / CONTATOS
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
// FUNCIONRIOS
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
      let query = supabase
        .from('erp_pedidos')
        .select('*, cliente:erp_pessoas(nome_razao, telefone, celular), venda:erp_vendas(numero_pedido, total)')
        .order('created_at', { ascending: false })
        .limit(200);
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

/**
 * Busca apenas os venda_id de TODAS as notas da loja (sem filtro de
 * status/tipo e sem limit) — usado para saber quais vendas já têm NF-e.
 */
export function useNotasFiscaisVendaIds(lojaId?: string) {
  return useQuery<string[]>({
    queryKey: ['erp_notas_fiscais-venda-ids', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('erp_notas_fiscais')
        .select('venda_id')
        .not('venda_id', 'is', null);
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((n: any) => n.venda_id).filter(Boolean);
    },
  });
}

// ========================================
// AVALIAES / RECOMENDAES (CRM)
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
// BANDEIRAS CARTO
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
// SERVIOS
// ========================================
export function useServicos(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_servicos', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      // erp_servicos nao tem loja_id — servicos sao globais
      const { data, error } = await supabase.from('erp_servicos').select('*').order('nome');
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
      // erp_kits nao tem loja_id — kits sao globais
      const { data, error } = await supabase.from('erp_kits').select('*, itens:erp_kit_itens(*, produto:erp_produtos(nome, preco_venda))').eq('ativo', true).order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// CAIXA
// ========================================
export function useCaixa(lojaId?: string) {
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
      let query = supabase.from('erp_compras').select('*, fornecedor:erp_pessoas!erp_compras_fornecedor_id_fkey(nome_razao), itens:erp_compra_itens(*)').order('data_compra', { ascending: false }).limit(200);
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
// PARCERIAS / NEGATIVAES / PROTESTOS
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
// CARTO FIDELIDADE
// ========================================
export function useCartoesFidelidade(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_cartao_fidelidade', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase
        .from('erp_cartao_fidelidade')
        .select('*, cliente:erp_pessoas(id, nome_razao, cpf_cnpj, telefone)')
        .order('total_pontos_acumulados', { ascending: false });
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
// RELATRIOS FINANCEIROS  FLUXO DE CAIXA
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

      // Buscar itens das vendas do perodo
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

// Breakdown por forma de pagamento (vendas finalizadas no perodo)
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

// Top 10 produtos mais vendidos no perodo
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
      const produtoMap: Record<string, { sku: string | null; imagem_url: string | null }> = {};
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

// Taxas de cartes (bandeiras cadastradas + total vendido em carto no perodo)
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

// Sangrias por perodo
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

// Entradas extras por perodo
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

// Vendas por dia (para grfico)
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
// NEGATIVAES
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
// RECOMENDAES
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
// CONFIGURAES GERAIS DO SISTEMA
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
      const { data, error } = await supabase.from('erp_configuracoes_sistema').upsert(item, { onConflict: 'chave' }).select().single();
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
// CONFIGURAES SEFAZ (CRUD)
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
// OCORRNCIAS / PENDNCIAS
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
// FEATURE FLAGS (controle de pginas)
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
    staleTime: 30_000, // cache por 30s ? bom para no ter refetch constante
  });
}

/** Retorna um Map<path, ativo> para consulta rpida na sidebar. */
export function useFeatureFlagsMap() {
  const { data } = useFeatureFlags();
  const map: Record<string, boolean> = {};
  for (const f of data ?? []) {
    map[f.path] = f.ativo;
  }
  return map;
}

/** Verifica se uma rota/path est ativa. Retorna `true` se a flag no existir (fail-open). */
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
      // A proteo contra desativao de flags do sistema essenciais
      // (`is_protegida`)  feita **apenas na UI** do painel admin
      // (/config/sistema) ? o switch fica travado e o motivo  mostrado
      // como tooltip. A tabela aceita UPDATE de admin para qualquer flag,
      // inclusive protegidas, para permitir ajustes via SQL se necessrio.
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
// ========================================
// KITS — CRUD (kit + itens)
// ========================================

export function useCreateKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itens, ...kit }: { nome: string; descricao?: string | null; preco_kit: number; itens: { produto_id: string; quantidade: number }[] }) => {
      const { data, error } = await supabase.from('erp_kits').insert({ ...kit, ativo: true }).select().single();
      if (error) throw error;
      if (itens.length > 0) {
        const { error: e2 } = await supabase.from('erp_kit_itens').insert(itens.map((i) => ({ ...i, kit_id: data.id })));
        if (e2) throw e2;
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_kits'] }),
  });
}

export function useUpdateKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, itens, ...updates }: { id: string; nome?: string; descricao?: string | null; preco_kit?: number; itens?: { produto_id: string; quantidade: number }[] }) => {
      const { data, error } = await supabase.from('erp_kits').update(updates).eq('id', id).select().single();
      if (error) throw error;
      if (itens) {
        await supabase.from('erp_kit_itens').delete().eq('kit_id', id);
        if (itens.length > 0) {
          const { error: e2 } = await supabase.from('erp_kit_itens').insert(itens.map((i) => ({ ...i, kit_id: id })));
          if (e2) throw e2;
        }
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_kits'] }),
  });
}

export function useDeleteKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_kits').update({ ativo: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_kits'] }),
  });
}

// ========================================
// LOJAS — CRUD
// ========================================

export function useCreateLoja() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (loja: Partial<Loja>) => {
      const { data, error } = await supabase.from('erp_lojas').insert(loja).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_lojas'] }),
  });
}

export function useUpdateLoja() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Loja> & { id: string }) => {
      const { data, error } = await supabase.from('erp_lojas').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_lojas'] }),
  });
}

// ========================================
// COMPRAS — criação manual
// ========================================

export function useCreateCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itens, ...compra }: {
      loja_id: string; fornecedor_id: string; usuario_id: string;
      observacoes?: string | null; status?: string;
      itens: { produto_id: string; preco_custo: number; quantidade: number }[];
    }) => {
      const total = itens.reduce((s, i) => s + i.preco_custo * i.quantidade, 0);
      const { data, error } = await supabase.from('erp_compras')
        .insert({ ...compra, total, status: compra.status ?? 'pendente' })
        .select().single();
      if (error) throw error;
      if (itens.length > 0) {
        const { error: e2 } = await supabase.from('erp_compra_itens')
          .insert(itens.map((i) => ({ ...i, compra_id: data.id, subtotal: i.preco_custo * i.quantidade })));
        if (e2) throw e2;
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_compras'] }),
  });
}

export function useUpdateCompraStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('erp_compras').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_compras'] }),
  });
}

// ========================================
// PEDIDOS — criação
// ========================================

export function useCreatePedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pedido: {
      loja_id: string; cliente_id: string; endereco_entrega: any;
      tipo_pedido?: string; taxa_entrega?: number; observacoes?: string | null;
      previsao_entrega?: string | null; status?: string;
    }) => {
      const { data, error } = await supabase.from('erp_pedidos')
        .insert({ status: 'pendente', ...pedido })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_pedidos'] }),
  });
}

// ========================================
// SERVIÇOS — CRUD
// ========================================

export function useCreateServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (servico: { nome: string; descricao?: string | null; valor: number; comissao_percentual?: number | null }) => {
      const { data, error } = await supabase.from('erp_servicos').insert({ ...servico, ativo: true }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_servicos'] }),
  });
}

export function useUpdateServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; nome?: string; descricao?: string | null; valor?: number; comissao_percentual?: number | null; ativo?: boolean }) => {
      const { data, error } = await supabase.from('erp_servicos').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_servicos'] }),
  });
}

export function useDeleteServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('erp_servicos').update({ ativo: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_servicos'] }),
  });
}

// ========================================
// DEVOLUÇÕES — registrar devolução de venda
// ========================================

export function useRegistrarDevolucao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ vendaId, motivo, estornarEstoque, lojaId }: { vendaId: string; motivo?: string; estornarEstoque: boolean; lojaId?: string }) => {
      // 1) Marca a venda como devolvida
      const { data: venda, error } = await supabase.from('erp_vendas')
        .update({ status: 'devolvida', observacoes: motivo ?? null })
        .eq('id', vendaId).select('id, loja_id').single();
      if (error) throw error;

      // 2) Estorna estoque dos itens (opcional)
      if (estornarEstoque) {
        const { data: itens, error: e2 } = await supabase.from('erp_venda_itens')
          .select('produto_id, quantidade').eq('venda_id', vendaId).not('produto_id', 'is', null);
        if (e2) throw e2;
        const loja = lojaId ?? venda.loja_id;
        for (const item of itens ?? []) {
          const { data: est } = await supabase.from('erp_estoque')
            .select('id, quantidade').eq('produto_id', item.produto_id).eq('loja_id', loja).maybeSingle();
          if (est) {
            await supabase.from('erp_estoque').update({ quantidade: est.quantidade + item.quantidade }).eq('id', est.id);
          }
        }
      }
      return venda;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_devolucoes'] });
      qc.invalidateQueries({ queryKey: ['erp_vendas'] });
      qc.invalidateQueries({ queryKey: ['erp_estoque'] });
    },
  });
}

// ========================================
// CONTROLE COMERCIAL — Orçamentos, OS, Consignações, Locações
// (migration 037_controle_comercial.sql)
// ========================================

export function useOrcamentos(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_orcamentos', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_orcamentos')
        .select('*, cliente:erp_pessoas(nome_razao), itens:erp_orcamento_itens(*)')
        .order('created_at', { ascending: false }).limit(200);
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itens, ...orc }: {
      loja_id: string; cliente_id?: string | null; validade?: string | null; observacoes?: string | null;
      itens: { descricao: string; quantidade: number; valor_unitario: number }[];
    }) => {
      const total = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
      const { data, error } = await supabase.from('erp_orcamentos').insert({ ...orc, total, status: 'aberto' }).select().single();
      if (error) throw error;
      if (itens.length > 0) {
        const { error: e2 } = await supabase.from('erp_orcamento_itens')
          .insert(itens.map((i) => ({ ...i, orcamento_id: data.id, subtotal: i.quantidade * i.valor_unitario })));
        if (e2) throw e2;
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_orcamentos'] }),
  });
}

export function useUpdateOrcamentoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('erp_orcamentos').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_orcamentos'] }),
  });
}

export function useOrdensServico(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_ordens_servico', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_ordens_servico')
        .select('*, cliente:erp_pessoas(nome_razao)')
        .order('created_at', { ascending: false }).limit(200);
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateOrdemServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (os: {
      loja_id: string; cliente_id?: string | null; descricao: string; equipamento?: string | null;
      defeito_relatado?: string | null; valor_servicos?: number; valor_pecas?: number; previsao?: string | null;
    }) => {
      const { data, error } = await supabase.from('erp_ordens_servico')
        .insert({ ...os, status: 'aberta', valor_servicos: os.valor_servicos ?? 0, valor_pecas: os.valor_pecas ?? 0 })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_ordens_servico'] }),
  });
}

export function useUpdateOrdemServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string; valor_servicos?: number; valor_pecas?: number; laudo?: string | null }) => {
      const { error } = await supabase.from('erp_ordens_servico').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_ordens_servico'] }),
  });
}

export function useConsignacoes(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_consignacoes', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_consignacoes')
        .select('*, cliente:erp_pessoas(nome_razao), itens:erp_consignacao_itens(*, produto:erp_produtos(nome))')
        .order('created_at', { ascending: false }).limit(200);
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateConsignacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itens, ...cons }: {
      loja_id: string; cliente_id: string; data_acerto_prevista?: string | null; observacoes?: string | null;
      itens: { produto_id: string; quantidade: number; valor_unitario: number }[];
    }) => {
      const total = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
      const { data, error } = await supabase.from('erp_consignacoes').insert({ ...cons, total, status: 'aberta' }).select().single();
      if (error) throw error;
      if (itens.length > 0) {
        const { error: e2 } = await supabase.from('erp_consignacao_itens')
          .insert(itens.map((i) => ({ ...i, consignacao_id: data.id, quantidade_devolvida: 0, quantidade_vendida: 0 })));
        if (e2) throw e2;
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_consignacoes'] }),
  });
}

export function useUpdateConsignacaoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === 'acertada') updates.data_acerto = new Date().toISOString();
      const { error } = await supabase.from('erp_consignacoes').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_consignacoes'] }),
  });
}

export function useLocacoes(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_locacoes', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('erp_locacoes')
        .select('*, cliente:erp_pessoas(nome_razao)')
        .order('created_at', { ascending: false }).limit(200);
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateLocacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (loc: {
      loja_id: string; cliente_id: string; descricao_item: string; data_inicio: string;
      data_fim_prevista?: string | null; valor_periodo: number; caucao?: number | null; observacoes?: string | null;
    }) => {
      const { data, error } = await supabase.from('erp_locacoes').insert({ ...loc, status: 'ativa' }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_locacoes'] }),
  });
}

export function useUpdateLocacaoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === 'devolvida') updates.data_devolucao = new Date().toISOString();
      const { error } = await supabase.from('erp_locacoes').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_locacoes'] }),
  });
}

// ========================================
// KARDEX / MOVIMENTAÇÕES DE ESTOQUE
// (migration 045 — o livro de estoque; nunca editável)
// ========================================
export interface EstoqueMovimentacaoFiltro {
  lojaId?: string;
  produtoId?: string;
  tipo?: string;
  origem?: string;
  dataInicio?: string;
  dataFim?: string;
  limite?: number;
}

export function useEstoqueMovimentacoes(filtros: EstoqueMovimentacaoFiltro = {}) {
  return useQuery<any[]>({
    queryKey: ['erp_estoque_movimentacoes', filtros],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let q = supabase
        .from('erp_estoque_movimentacoes')
        .select('*, produto:erp_produtos(id, nome, sku, unidade), loja:erp_lojas(id, nome)')
        .order('created_at', { ascending: false })
        .limit(filtros.limite ?? 300);

      if (filtros.lojaId) q = q.eq('loja_id', filtros.lojaId);
      if (filtros.produtoId) q = q.eq('produto_id', filtros.produtoId);
      if (filtros.tipo) q = q.eq('tipo', filtros.tipo);
      if (filtros.origem) q = q.eq('origem', filtros.origem);
      if (filtros.dataInicio) q = q.gte('created_at', filtros.dataInicio);
      if (filtros.dataFim) q = q.lte('created_at', filtros.dataFim);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAjustarEstoque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lojaId, produtoId, novaQuantidade, observacao,
    }: { lojaId: string; produtoId: string; novaQuantidade: number; observacao?: string }) => {
      const { error } = await supabase
        .schema('erp')
        .rpc('ajustar_estoque_atomico', {
          p_loja_id: lojaId,
          p_produto_id: produtoId,
          p_nova_quantidade: novaQuantidade,
          p_observacao: observacao ?? null,
        });
      if (error) throw new Error(`Falha ao ajustar estoque: ${error.message}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_estoque'] });
      qc.invalidateQueries({ queryKey: ['erp_estoque_movimentacoes'] });
    },
  });
}

// ========================================
// INVENTÁRIO / BALANÇO
// ========================================
export function useInventarios(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_inventarios', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let q = supabase
        .from('erp_inventarios')
        .select('*, loja:erp_lojas(id, nome)')
        .order('created_at', { ascending: false });
      if (lojaId) q = q.eq('loja_id', lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInventarioItens(inventarioId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_inventario_itens', inventarioId],
    enabled: !!inventarioId,
    queryFn: async () => {
      if (!isSupabaseConfigured() || !inventarioId) return [];
      const { data, error } = await supabase
        .from('erp_inventario_itens')
        .select('*, produto:erp_produtos(id, nome, sku, unidade)')
        .eq('inventario_id', inventarioId);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAbrirInventario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lojaId, observacoes }: { lojaId: string; observacoes?: string }) => {
      const { data, error } = await supabase
        .schema('erp')
        .rpc('abrir_inventario', { p_loja_id: lojaId, p_observacoes: observacoes ?? null });
      if (error) throw new Error(`Falha ao abrir inventário: ${error.message}`);
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_inventarios'] }),
  });
}

export function useSalvarContagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, quantidadeContada }: { itemId: string; quantidadeContada: number | null }) => {
      const { error } = await supabase
        .from('erp_inventario_itens')
        .update({ quantidade_contada: quantidadeContada })
        .eq('id', itemId);
      if (error) throw new Error(`Falha ao salvar contagem: ${error.message}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_inventario_itens'] }),
  });
}

export function useAplicarInventario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inventarioId: string) => {
      const { data, error } = await supabase
        .schema('erp')
        .rpc('aplicar_inventario', { p_inventario_id: inventarioId });
      if (error) throw new Error(`Falha ao aplicar inventário: ${error.message}`);
      return data as { inventario_id: string; itens_ajustados: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_inventarios'] });
      qc.invalidateQueries({ queryKey: ['erp_inventario_itens'] });
      qc.invalidateQueries({ queryKey: ['erp_estoque'] });
      qc.invalidateQueries({ queryKey: ['erp_estoque_movimentacoes'] });
    },
  });
}

// ========================================
// PLANO DE CONTAS / CENTROS DE CUSTO / DRE
// ========================================
export function usePlanoContas() {
  return useQuery<any[]>({
    queryKey: ['erp_plano_contas'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from('erp_plano_contas')
        .select('*')
        .eq('ativo', true)
        .order('codigo');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCentrosCusto() {
  return useQuery<any[]>({
    queryKey: ['erp_centros_custo'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from('erp_centros_custo')
        .select('*, loja:erp_lojas(id, nome)')
        .eq('ativo', true)
        .order('codigo');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDreMensal(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_dre_mensal', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let q = supabase.from('vw_dre_resumo').select('*').order('competencia', { ascending: false });
      if (lojaId) q = q.eq('loja_id', lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// AUDITORIA (somente admin — RLS garante)
// ========================================
export function useAuditoria(filtros: { tabela?: string; registroId?: string; limite?: number } = {}) {
  return useQuery<any[]>({
    queryKey: ['erp_auditoria', filtros],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let q = supabase
        .from('erp_auditoria')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(filtros.limite ?? 200);
      if (filtros.tabela) q = q.eq('tabela', filtros.tabela);
      if (filtros.registroId) q = q.eq('registro_id', filtros.registroId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// EVENTOS FISCAIS (migration 047)
// cancelamento, carta de correção, inutilização e devolução
// ========================================
export function useNfeEventos(notaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_nfe_eventos', notaId],
    enabled: !!notaId,
    queryFn: async () => {
      if (!isSupabaseConfigured() || !notaId) return [];
      const { data, error } = await supabase
        .from('erp_nfe_eventos')
        .select('*')
        .eq('nota_id', notaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInutilizacoes(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_inutilizacoes', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let q = supabase
        .from('erp_inutilizacoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (lojaId) q = q.eq('loja_id', lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Extrai a mensagem real da Edge Function (que responde com { erro, detalhe }). */
async function erroEdgeFunction(error: any, fallback: string): Promise<string> {
  let detalhe = error?.message ?? fallback;
  try {
    const ctx = await error?.context?.json?.();
    if (ctx?.erro) {
      detalhe = ctx.detalhe?.motivo ? `${ctx.erro}: ${ctx.detalhe.motivo}` : ctx.erro;
      if (ctx.numeros?.length) detalhe += ` (números: ${ctx.numeros.join(', ')})`;
      if (ctx.faltas?.length) detalhe += `: ${ctx.faltas.join(', ')}`;
    }
  } catch { /* mantém a mensagem padrão */ }
  return detalhe;
}

export function useCancelarNFe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nota_id, justificativa }: { nota_id: string; justificativa: string }) => {
      const { data, error } = await supabase.functions.invoke('erp-eventos-fiscais', {
        body: { acao: 'cancelar', nota_id, justificativa },
      });
      if (error) throw new Error(await erroEdgeFunction(error, 'falha ao cancelar'));
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_notas_fiscais'] });
      qc.invalidateQueries({ queryKey: ['erp_nfe_eventos'] });
    },
  });
}

export function useCartaCorrecao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nota_id, correcao }: { nota_id: string; correcao: string }) => {
      const { data, error } = await supabase.functions.invoke('erp-eventos-fiscais', {
        body: { acao: 'cce', nota_id, correcao },
      });
      if (error) throw new Error(await erroEdgeFunction(error, 'falha na carta de correção'));
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_nfe_eventos'] }),
  });
}

export function useInutilizarNumeracao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      loja_id: string; serie: number; numero_inicial: number;
      numero_final: number; justificativa: string; modelo?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('erp-eventos-fiscais', {
        body: { acao: 'inutilizar', ...params },
      });
      if (error) throw new Error(await erroEdgeFunction(error, 'falha na inutilização'));
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_inutilizacoes'] }),
  });
}

export function useEmitirDevolucao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nota_id, loja_id }: { nota_id: string; loja_id: string }) => {
      const { data, error } = await supabase.functions.invoke('erp-emitir-nfe', {
        body: { devolucao_de: nota_id, loja_id },
      });
      if (error) throw new Error(await erroEdgeFunction(error, 'falha na devolução'));
      if (data && data.autorizada === false) {
        throw new Error(`SEFAZ rejeitou (cStat ${data.cstat}): ${data.motivo}`);
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_notas_fiscais'] }),
  });
}

// ========================================
// CONTAS A PAGAR / RECEBER (migration 049)
// ========================================
export function useBaixarConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contaId, valor, data, forma,
    }: { contaId: string; valor?: number; data?: string; forma?: string }) => {
      const { error } = await supabase
        .schema('erp')
        .rpc('baixar_conta', {
          p_conta_id: contaId,
          p_valor: valor ?? null,
          p_data: data ?? null,
          p_forma: forma ?? null,
        });
      if (error) throw new Error(`Falha ao baixar conta: ${error.message}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_contas'] });
      qc.invalidateQueries({ queryKey: ['erp_dre_mensal'] });
    },
  });
}

// ========================================
// FASE 3 — ciclo comercial (migration 050)
// ========================================
export function useConverterOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orcamentoId, formaPagamento = 'dinheiro', caixaId,
    }: { orcamentoId: string; formaPagamento?: string; caixaId?: string }) => {
      const { data, error } = await supabase
        .schema('erp')
        .rpc('converter_orcamento_em_venda', {
          p_orcamento_id: orcamentoId,
          p_forma_pagamento: formaPagamento,
          p_caixa_id: caixaId ?? null,
        });
      if (error) throw new Error(`Falha ao converter orçamento: ${error.message}`);
      return data as string;  // id da venda criada
    },
    onSuccess: () => {
      // A conversão baixa estoque e gera a conta a receber, então invalida tudo isso
      qc.invalidateQueries({ queryKey: ['erp_orcamentos'] });
      qc.invalidateQueries({ queryKey: ['erp_vendas'] });
      qc.invalidateQueries({ queryKey: ['erp_estoque'] });
      qc.invalidateQueries({ queryKey: ['erp_estoque_movimentacoes'] });
      qc.invalidateQueries({ queryKey: ['erp_contas'] });
    },
  });
}

export function useTabelasPreco(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_tabelas_preco', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let q = supabase
        .from('erp_tabelas_preco')
        .select('*, itens:erp_tabela_preco_itens(id, produto_id, preco, quantidade_minima)')
        .order('prioridade', { ascending: false });
      if (lojaId) q = q.or(`loja_id.eq.${lojaId},loja_id.is.null`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSalvarTabelaPreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tabela: any) => {
      // itens vai numa chamada à parte (erp_tabela_preco_itens)
      const { itens: _itens, ...cabecalho } = tabela;
      const { data, error } = await supabase
        .from('erp_tabelas_preco')
        .upsert(cabecalho)
        .select()
        .single();
      if (error) throw new Error(`Falha ao salvar tabela de preços: ${error.message}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_tabelas_preco'] }),
  });
}

export function useSalvarPrecoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: {
      id?: string; tabela_id: string; produto_id: string;
      preco: number; quantidade_minima?: number;
    }) => {
      const { error } = await supabase
        .from('erp_tabela_preco_itens')
        .upsert({ quantidade_minima: 1, ...item }, { onConflict: 'tabela_id,produto_id,quantidade_minima' });
      if (error) throw new Error(`Falha ao salvar preço: ${error.message}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_tabelas_preco'] }),
  });
}

/**
 * Preço efetivo de um produto: item específico > ajuste da tabela > preço do
 * produto. Resolvido no banco para o PDV e o front usarem a MESMA regra.
 */
export function usePrecoEfetivo(params: {
  produtoId?: string; lojaId?: string; clienteId?: string; quantidade?: number;
}) {
  return useQuery<number | null>({
    queryKey: ['erp_preco_efetivo', params],
    enabled: !!params.produtoId,
    queryFn: async () => {
      if (!isSupabaseConfigured() || !params.produtoId) return null;
      const { data, error } = await supabase
        .schema('erp')
        .rpc('preco_efetivo', {
          p_produto_id: params.produtoId,
          p_loja_id: params.lojaId ?? null,
          p_cliente_id: params.clienteId ?? null,
          p_quantidade: params.quantidade ?? 1,
        });
      if (error) throw error;
      return data === null ? null : Number(data);
    },
  });
}

// ========================================
// FASE 6 — distribuição DF-e (migration 051)
//
// A SEFAZ entrega toda NF-e emitida contra o nosso CNPJ. Enquanto a nota
// estiver como `resumo`, só temos cabeçalho e valor: os itens (e portanto o
// custo real) só chegam depois da manifestação.
// ========================================
export function useDfePendentes(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_dfe_pendentes', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let q = supabase
        .schema('erp')
        .from('vw_dfe_pendentes')
        .select('*')
        .order('data_emissao', { ascending: false });
      if (lojaId) q = q.eq('loja_id', lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDfeStatus() {
  return useQuery<any[]>({
    queryKey: ['erp_dfe_nsu'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .schema('erp')
        .from('erp_dfe_nsu')
        .select('*, loja:erp_lojas(id, nome, uf)');
      if (error) throw error;
      return data ?? [];
    },
    // O NSU muda quando a varredura roda; 60s evita a tela mentir por muito tempo.
    refetchInterval: 60_000,
  });
}

export function useDfeConsultas(lojaId?: string, limite = 20) {
  return useQuery<any[]>({
    queryKey: ['erp_dfe_consultas', lojaId, limite],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let q = supabase
        .schema('erp')
        .from('erp_dfe_consultas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limite);
      if (lojaId) q = q.eq('loja_id', lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

function invalidarDfe(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['erp_dfe_pendentes'] });
  qc.invalidateQueries({ queryKey: ['erp_dfe_nsu'] });
  qc.invalidateQueries({ queryKey: ['erp_dfe_consultas'] });
}

export function useSincronizarDfe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ loja_id, forcar }: { loja_id: string; forcar?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('erp-dfe', {
        body: { acao: 'sincronizar', loja_id, forcar },
      });
      if (error) throw new Error(await erroEdgeFunction(error, 'falha ao consultar a SEFAZ'));
      return data;
    },
    onSuccess: () => invalidarDfe(qc),
  });
}

export function useManifestarDfe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      nfe_entrada_id, tipo, justificativa,
    }: { nfe_entrada_id: string; tipo: string; justificativa?: string }) => {
      const { data, error } = await supabase.functions.invoke('erp-dfe', {
        body: { acao: 'manifestar', nfe_entrada_id, tipo, justificativa },
      });
      if (error) throw new Error(await erroEdgeFunction(error, 'falha ao manifestar'));
      return data;
    },
    onSuccess: () => invalidarDfe(qc),
  });
}

export function useBaixarNfePorChave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ loja_id, chave }: { loja_id: string; chave: string }) => {
      const { data, error } = await supabase.functions.invoke('erp-dfe', {
        body: { acao: 'baixar_chave', loja_id, chave },
      });
      if (error) throw new Error(await erroEdgeFunction(error, 'falha ao baixar a nota'));
      return data;
    },
    onSuccess: () => invalidarDfe(qc),
  });
}

// ========================================
// FASE 5 — PDV offline (migration 052)
// ========================================
/**
 * Saldos negativos: o passivo que a venda offline deixa. Não é erro a
 * corrigir na mão — é a lista do que precisa de contagem no inventário.
 */
export function useEstoqueNegativo(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_estoque_negativo', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let q = supabase
        .schema('erp')
        .from('vw_estoque_negativo')
        .select('*')
        .order('quantidade', { ascending: true });
      if (lojaId) q = q.eq('loja_id', lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// FASE 4 — BI sobre a fundação da fase 1 (migration 053)
// ========================================
/**
 * Curva ABC sobre venda REALIZADA. Calculada a partir de preço de tabela
 * seria uma opinião; a partir do que saiu do caixa é um fato.
 */
export function useCurvaAbc(params: { lojaId?: string; desde?: string; ate?: string } = {}) {
  return useQuery<any[]>({
    queryKey: ['erp_curva_abc', params],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .schema('erp')
        .rpc('curva_abc', {
          p_loja_id: params.lojaId ?? null,
          p_desde: params.desde ?? null,
          p_ate: params.ate ?? null,
        });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSugestaoCompra(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_sugestao_compra', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let q = supabase.from('vw_sugestao_compra').select('*').order('dias_de_cobertura', { ascending: true, nullsFirst: false });
      if (lojaId) q = q.eq('loja_id', lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEstoqueParado(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_estoque_parado', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let q = supabase.from('vw_estoque_parado').select('*').order('capital_parado', { ascending: false });
      if (lojaId) q = q.eq('loja_id', lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ========================================
// FASE 7 — escrituração fiscal (migration 054)
// ========================================
export function useSpedArquivos(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_sped_arquivos', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      // `conteudo` fica de fora da listagem de propósito: o arquivo pode ter
      // megabytes e só o que vai ser baixado precisa dele.
      let q = supabase
        .from('erp_sped_arquivos')
        .select('id, loja_id, tipo, competencia, data_inicial, data_final, finalidade, perfil, linhas, bytes, avisos, created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      if (lojaId) q = q.eq('loja_id', lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useGerarSped() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      loja_id: string; competencia: string; tipo?: 'efd' | 'sintegra'; finalidade?: '0' | '1';
    }) => {
      const { data, error } = await supabase.functions.invoke('erp-sped', { body: params });
      if (error) throw new Error(await erroEdgeFunction(error, 'falha ao gerar a escrituração'));
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_sped_arquivos'] }),
  });
}

/** Busca o conteúdo só na hora de baixar. */
export async function baixarSped(arquivoId: string): Promise<string> {
  const { data, error } = await supabase
    .from('erp_sped_arquivos')
    .select('conteudo')
    .eq('id', arquivoId)
    .single();
  if (error) throw new Error(`Falha ao ler o arquivo: ${error.message}`);
  return data.conteudo as string;
}

/**
 * Lê no cadastro da SEFAZ os dados do próprio CNPJ da loja. O endereço daqui
 * é o do EMITENTE em toda NF-e e NFC-e — digitado à mão ele diverge em
 * silêncio, e a divergência só aparece quando a nota é recusada.
 *
 * Sem `aplicar` a chamada só compara e devolve as divergências.
 */
export function useConsultarCadastroSefaz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ loja_id, aplicar }: { loja_id: string; aplicar?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('erp-consultar-cadastro', {
        body: { loja_id, aplicar },
      });
      if (error) throw new Error(await erroEdgeFunction(error, 'falha ao consultar a SEFAZ'));
      return data;
    },
    onSuccess: (d: any) => {
      if (d?.aplicado) qc.invalidateQueries({ queryKey: ['erp_lojas'] });
    },
  });
}

// ========================================
// FASE 8 — crediário próprio e fidelidade (migration 055)
// ========================================
export function useCrediarioContratos(lojaId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_crediario_contratos', lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let q = supabase
        .from('erp_crediario_parcelas')
        .select('*, cliente:erp_pessoas(id, nome_razao, cpf_cnpj, telefone), parcelas:erp_crediario_parcela_itens(*)')
        .order('created_at', { ascending: false });
      if (lojaId) q = q.eq('loja_id', lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Quem deve, quanto, e quanto ainda cabe no limite. */
export function useCrediarioClientes() {
  return useQuery<any[]>({
    queryKey: ['erp_crediario_clientes'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from('vw_crediario_clientes')
        .select('*')
        .order('em_atraso', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAbrirCrediario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      vendaId: string; parcelas: number; jurosMensal?: number;
      tipoJuros?: 'simples' | 'composto'; primeiraData?: string; entrada?: number;
    }) => {
      const { data, error } = await supabase.schema('erp').rpc('abrir_crediario', {
        p_venda_id: p.vendaId,
        p_parcelas: p.parcelas,
        p_juros_mensal: p.jurosMensal ?? null,
        p_tipo_juros: p.tipoJuros ?? 'composto',
        p_primeira_data: p.primeiraData ?? null,
        p_entrada: p.entrada ?? 0,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      // O contrato substitui a conta a receber da venda, então o financeiro muda junto.
      qc.invalidateQueries({ queryKey: ['erp_crediario_contratos'] });
      qc.invalidateQueries({ queryKey: ['erp_crediario_clientes'] });
      qc.invalidateQueries({ queryKey: ['erp_contas'] });
    },
  });
}

export function useBaixarParcelaCrediario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { itemId: string; valor?: number; data?: string; forma?: string }) => {
      const { data, error } = await supabase.schema('erp').rpc('baixar_parcela_crediario', {
        p_item_id: p.itemId,
        p_valor: p.valor ?? null,
        p_data: p.data ?? null,
        p_forma: p.forma ?? null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['erp_crediario_contratos'] });
      qc.invalidateQueries({ queryKey: ['erp_crediario_clientes'] });
      qc.invalidateQueries({ queryKey: ['erp_contas'] });
    },
  });
}

export function useEmitirCartaoFidelidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { clienteId: string; lojaId: string }) => {
      const { data, error } = await supabase.schema('erp').rpc('emitir_cartao_fidelidade', {
        p_cliente_id: p.clienteId,
        p_loja_id: p.lojaId,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_cartao_fidelidade'] }),
  });
}

export function useResgatarPontos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { cartaoId: string; pontos: number; vendaId?: string }) => {
      const { data, error } = await supabase.schema('erp').rpc('resgatar_pontos', {
        p_cartao_id: p.cartaoId,
        p_pontos: p.pontos,
        p_venda_id: p.vendaId ?? null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp_cartao_fidelidade'] }),
  });
}

export function useMovimentacoesFidelidade(cartaoId?: string) {
  return useQuery<any[]>({
    queryKey: ['erp_fidelidade_movimentacoes', cartaoId],
    enabled: !!cartaoId,
    queryFn: async () => {
      if (!isSupabaseConfigured() || !cartaoId) return [];
      const { data, error } = await supabase
        .from('erp_cartao_fidelidade_movimentacoes')
        .select('*')
        .eq('cartao_id', cartaoId)
        .order('data_movimentacao', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

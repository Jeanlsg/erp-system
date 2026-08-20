// ============================================================
// Página: Cadastro e Estoque de Produtos
// Baseado no layout HTML do sistema Excellent Sistemas
// (estoque_view.php)
//
// Layout:
//   1. Header com breadcrumb (Início > Estoque)
//   2. Painel de botões de ações rápidas (grid)
//   3. Painel de busca
//   4. Tabela unificada de produtos/estoque/lotes
// ============================================================

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Package, Search, Loader2, Save, Plus,
  Edit, Trash2, Boxes, Calendar, Barcode,
  Tag, AlertCircle, Clock,
  TrendingUp,
  ChevronLeft, ChevronRight, ArrowDownToLine,
} from "lucide-react";
import {
  useProdutosCompleto, useProdutos, useCreateProduto, useUpdateProduto,
  useCreateCategoria, useUpdateCategoria, useDeleteCategoria,
  useCategorias, useLojas,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";
import { imprimirEtiquetas } from "@/lib/etiquetas";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";

// =============================
// Ações rápidas (botões topo)
// =============================
const ACOES_RAPIDAS = [
  { id: "cadastrar-produto", label: "Cadastrar Produto", icon: Plus, primary: true },
  { id: "classificacao", label: "Classificação", icon: Tag },
  { id: "movimentacao-estoque", label: "Movimentação Estoque", icon: ArrowDownToLine },
  { id: "reajuste-precos", label: "Reajustes de Preços", icon: TrendingUp },
  { id: "lote", label: "Lote", icon: Calendar },
  { id: "catalogo", label: "Catálogo", icon: Package },
  { id: "gerar-etiquetas", label: "Gerar Etiquetas", icon: Barcode },
  { id: "kit-combo", label: "Kit/Combo", icon: Boxes },
  { id: "inventario", label: "Inventário Estoque", icon: Boxes },
  { id: "relatorios", label: "Relatórios", icon: Package },
  { id: "produtos-excluidos", label: "Produtos Excluídos", icon: Trash2 },
] as const;

type AcaoId = typeof ACOES_RAPIDAS[number]["id"];

export function ProdutosEstoqueLotesPage() {
  const { lojaId: lojaIdHook } = useAutoSelectLoja();
  const [lojaFiltro, setLojaFiltro] = useState<string>(lojaIdHook ?? "");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");

  // Modais
  const [modalProduto, setModalProduto] = useState(false);
  const [modalCategoria, setModalCategoria] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCategoriaId, setEditCategoriaId] = useState<string | null>(null);

  // Form
  const [formProduto, setFormProduto] = useState({
    sku: "", nome: "", preco_custo: "0", preco_venda: "0",
    unidade: "UN", estoque_minimo: "0", duracao_dias: "", marca: "", codigo_barras: "",
    categoria_id: "", ncm: "", cest: "", cfop_padrao: "5102", csosn: "102",
  });
  const [formCategoria, setFormCategoria] = useState({ nome: "", descricao: "" });

  // ===== Queries =====
  const { data: lojas = [] } = useLojas();
  const { data: categorias = [] } = useCategorias();
  const { data: produtos = [] } = useProdutos({});
  // View consolidada: 1 linha por produto+loja
  const { data: produtosCompletos = [], isLoading: loadingCompleto } = useProdutosCompleto({
    lojaId: lojaFiltro || undefined,
    search: search || undefined,
  });

  const createProduto = useCreateProduto();
  const updateProduto = useUpdateProduto();
  const createCategoria = useCreateCategoria();
  const updateCategoria = useUpdateCategoria();
  const deleteCategoria = useDeleteCategoria();

  // ===== Filtros e paginação =====
  const filtered = useMemo(() => {
    let lista = produtosCompletos;
    if (categoriaFiltro !== "todas") {
      // Filtra também pelo nome da categoria (caso a view não tenha o id)
      const catNome = categorias.find((c) => c.id === categoriaFiltro)?.nome;
      if (catNome) {
        lista = lista.filter((p) => p.categoria_nome === catNome);
      }
    }
    return lista;
  }, [produtosCompletos, categoriaFiltro, categorias]);

  // Depois de TODOS os hooks: retornar antes muda a ordem das chamadas entre
  // renders, que é o que a regra dos hooks proíbe.
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ---- Reajuste de preços em massa ----
  const [modalReajuste, setModalReajuste] = useState(false);
  const [percReajuste, setPercReajuste] = useState("");
  const [aplicandoReajuste, setAplicandoReajuste] = useState(false);

  // ---- Produtos excluídos (ativo = false) ----
  // Todas as listagens filtram ativo=true, então um produto desativado some
  // do sistema inteiro. Esta é a única porta de volta.
  const [modalExcluidos, setModalExcluidos] = useState(false);
  const { data: excluidos = [] } = useQuery<any[]>({
    queryKey: ["erp_produtos_excluidos"],
    enabled: modalExcluidos,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("erp_produtos").select("id, sku, nome, preco_venda")
        .eq("ativo", false).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const reativarProduto = async (id: string) => {
    const { error } = await supabase.from("erp_produtos").update({ ativo: true }).eq("id", id);
    if (error) { toast.error(`Falha ao reativar: ${error.message}`); return; }
    toast.success("Produto reativado — volta a aparecer no catálogo e no PDV.");
    qc.invalidateQueries({ queryKey: ["erp_produtos_excluidos"] });
    qc.invalidateQueries({ queryKey: ["erp_produtos"] });
  };

  // Aplica o percentual sobre o preço de venda dos produtos FILTRADOS na
  // tela — o filtro de categoria vira o escopo do reajuste, o que permite
  // "aumenta 10% só nos suplementos" sem tela nova.
  const aplicarReajuste = async () => {
    const perc = Number(percReajuste.replace(",", "."));
    if (!Number.isFinite(perc) || perc === 0) {
      toast.error("Informe um percentual diferente de zero (negativo reduz).");
      return;
    }
    setAplicandoReajuste(true);
    try {
      let ok = 0;
      for (const p of filtered) {
        const novo = Math.round(Number(p.preco_venda) * (1 + perc / 100) * 100) / 100;
        if (novo <= 0) continue;
        const { error } = await supabase.from("erp_produtos")
          .update({ preco_venda: novo }).eq("id", p.produto_id);
        if (!error) ok++;
      }
      toast.success(`${ok} produto(s) reajustado(s) em ${perc > 0 ? "+" : ""}${perc}%.`);
      qc.invalidateQueries({ queryKey: ["erp_produtos"] });
      qc.invalidateQueries({ queryKey: ["erp_produtos_completo"] });
      setModalReajuste(false);
      setPercReajuste("");
    } finally {
      setAplicandoReajuste(false);
    }
  };


  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Cadastro e Estoque de Produtos" />;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  // ===== KPIs =====
  const totalProdutos = produtos.length;
  const baixoEstoque = produtosCompletos.filter((p) => p.status_estoque === "baixo").length;
  const semEstoque = produtosCompletos.filter((p) => p.status_estoque === "sem_estoque").length;
  const valorTotalEstoque = produtosCompletos.reduce((acc, p) => acc + Number(p.valor_estoque || 0), 0);

  const produtosComLoteVencido = produtosCompletos.filter(
    (p) => p.lote_mais_proximo_severidade === "vencido"
  ).length;
  const produtosComLoteCritico = produtosCompletos.filter(
    (p) => p.lote_mais_proximo_severidade === "critico"
  ).length;

  // ===== Handlers de ação rápida =====
  const handleAcao = (id: AcaoId) => {
    switch (id) {
      case "cadastrar-produto":
        abrirNovoProduto();
        break;
      case "classificacao":
        abrirNovaCategoria();
        break;
      case "movimentacao-estoque":
        navigate("/estoque/movimentacoes");
        break;
      case "reajuste-precos":
        setModalReajuste(true);
        break;
      case "lote":
        toast.info("Use a tabela abaixo para gerenciar lotes");
        break;
      case "catalogo":
        window.print();
        break;
      case "gerar-etiquetas": {
        if (filtered.length === 0) { toast.error("Nenhum produto no filtro atual."); break; }
        const r = imprimirEtiquetas(filtered.map((p: any) => ({
          nome: p.nome, sku: p.sku, codigo_barras: p.codigo_barras, preco_venda: p.preco_venda,
        })));
        if (r.semBarras > 0) {
          toast.warning(`${r.semBarras} etiqueta(s) saíram sem código de barras: EAN ausente ou com dígito verificador inválido.`);
        }
        break;
      }
      case "kit-combo":
        navigate("/kits");
        break;
      case "inventario":
        navigate("/estoque/inventario");
        break;
      case "relatorios":
        navigate("/relatorios");
        break;
      case "produtos-excluidos":
        setModalExcluidos(true);
        break;
    }
  };

  // ===== Handlers: Produto =====
  const abrirNovoProduto = () => {
    setEditId(null);
    setFormProduto({
      sku: "", nome: "", preco_custo: "0", preco_venda: "0",
      unidade: "UN", estoque_minimo: "0", duracao_dias: "", marca: "", codigo_barras: "",
      ncm: "", cest: "", cfop_padrao: "5102", csosn: "102",
      categoria_id: "",
    });
    setModalProduto(true);
  };

  const abrirEdicaoProduto = (p: any) => {
    setEditId(p.id);
    // Encontra o categoria_id correspondente pelo nome
    const cat = categorias.find((c) => c.nome === p.categoria_nome);
    setFormProduto({
      sku: p.sku ?? p.produto_sku ?? "",
      nome: p.nome ?? p.produto_nome ?? "",
      preco_custo: String(p.preco_custo ?? 0),
      preco_venda: String(p.preco_venda ?? 0),
      unidade: p.unidade ?? "UN",
      estoque_minimo: String(p.estoque_minimo ?? 0),
      duracao_dias: p.duracao_dias != null ? String(p.duracao_dias) : "",
      marca: p.marca ?? "",
      codigo_barras: p.codigo_barras ?? "",
      categoria_id: cat?.id ?? "",
      ncm: p.ncm ?? "", cest: p.cest ?? "",
      cfop_padrao: p.cfop_padrao ?? "5102", csosn: p.csosn ?? "102",
    });
    setModalProduto(true);
  };

  const salvarProduto = async () => {
    if (!formProduto.sku || !formProduto.nome) {
      toast.error("Preencha SKU e Nome");
      return;
    }
    const payload = {
      sku: formProduto.sku,
      nome: formProduto.nome,
      preco_custo: parseFloat(formProduto.preco_custo) || 0,
      preco_venda: parseFloat(formProduto.preco_venda) || 0,
      unidade: formProduto.unidade,
      estoque_minimo: parseInt(formProduto.estoque_minimo) || 0,
      duracao_dias: formProduto.duracao_dias === "" ? null : (parseInt(formProduto.duracao_dias) || null),
      marca: formProduto.marca || null,
      codigo_barras: formProduto.codigo_barras || null,
      categoria_id: formProduto.categoria_id || null,
      ncm: formProduto.ncm.replace(/\D/g, "") || null,
      cest: formProduto.cest.replace(/\D/g, "") || null,
      cfop_padrao: formProduto.cfop_padrao || "5102",
      csosn: formProduto.csosn || "102",
    };
    try {
      if (editId) {
        await updateProduto.mutateAsync({ id: editId, ...payload });
        toast.success("Produto atualizado");
      } else {
        await createProduto.mutateAsync(payload);
        toast.success("Produto criado");
      }
      setModalProduto(false);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  // ===== Handlers: Categoria =====
  const abrirNovaCategoria = () => {
    setEditCategoriaId(null);
    setFormCategoria({ nome: "", descricao: "" });
    setModalCategoria(true);
  };

  const abrirEdicaoCategoria = (c: any) => {
    setEditCategoriaId(c.id);
    setFormCategoria({ nome: c.nome ?? "", descricao: c.descricao ?? "" });
    setModalCategoria(true);
  };

  const salvarCategoria = async () => {
    if (!formCategoria.nome) {
      toast.error("Informe o nome da categoria");
      return;
    }
    try {
      if (editCategoriaId) {
        await updateCategoria.mutateAsync({ id: editCategoriaId, ...formCategoria });
        toast.success("Categoria atualizada");
      } else {
        await createCategoria.mutateAsync(formCategoria);
        toast.success("Categoria criada");
      }
      setModalCategoria(false);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const excluirCategoria = async (id: string) => {
    if (!confirm("Excluir esta categoria?")) return;
    try {
      await deleteCategoria.mutateAsync(id);
      toast.success("Categoria excluída");
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* ============== HEADER + BREADCRUMB ============== */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">
          Cadastro e Estoque de Produtos
        </h2>
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <span>Você está em:</span>
        <a href="/" className="hover:underline">Início</a>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">Estoque</span>
      </div>

      {/* ============== BOTÕES DE AÇÕES RÁPIDAS ============== */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {ACOES_RAPIDAS.map((acao) => {
              const Icon = acao.icon;
              return (
                <Button
                  key={acao.id}
                  variant={"primary" in acao && acao.primary ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleAcao(acao.id)}
                  className="font-medium"
                >
                  <Icon className="h-4 w-4 mr-1.5" />
                  {acao.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ============== KPIs ============== */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Total Produtos</p>
            <p className="text-xl font-semibold">{totalProdutos}</p>
          </CardContent>
        </Card>
        <Card className={semEstoque > 0 ? "border-red-500" : ""}>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Sem Estoque</p>
            <p className={`text-xl font-semibold ${semEstoque > 0 ? "text-red-600" : ""}`}>
              {semEstoque}
            </p>
          </CardContent>
        </Card>
        <Card className={baixoEstoque > 0 ? "border-orange-500" : ""}>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Estoque Baixo</p>
            <p className={`text-xl font-semibold ${baixoEstoque > 0 ? "text-orange-600" : ""}`}>
              {baixoEstoque}
            </p>
          </CardContent>
        </Card>
        <Card className={produtosComLoteVencido > 0 ? "border-red-500" : ""}>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Lotes Vencidos</p>
            <p className={`text-xl font-semibold ${produtosComLoteVencido > 0 ? "text-red-600" : ""}`}>
              {produtosComLoteVencido}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Valor em Estoque</p>
            <p className="text-xl font-semibold">{brl(valorTotalEstoque)}</p>
          </CardContent>
        </Card>
      </div>

      {/* ============== PAINEL DE BUSCA + FILTROS ============== */}
      <Card>
        <CardContent className="p-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label className="text-xs">Busca Avançada</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, SKU, código de barras..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Filtrar por Loja</Label>
              <Select value={lojaFiltro || "todas"} onValueChange={(v) => { setLojaFiltro(v === "todas" ? "" : v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as lojas</SelectItem>
                  {lojas.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.apelido || l.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Classificação</Label>
              <Select value={categoriaFiltro} onValueChange={(v) => { setCategoriaFiltro(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============== TABELA UNIFICADA ============== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produtos Cadastrados
              <Badge variant="outline" className="ml-2">
                {filtered.length} {filtered.length === 1 ? "registro" : "registros"}
              </Badge>
              {produtosComLoteCritico > 0 && (
                <Badge variant="outline" className="ml-1 text-orange-600 border-orange-500">
                  <Clock className="h-3 w-3 mr-1" />
                  {produtosComLoteCritico} vencendo
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Por página:</Label>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[80px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingCompleto ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              {search || categoriaFiltro !== "todas" ? "Nenhum produto encontrado com os filtros atuais" : "Nenhum produto cadastrado"}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-2">Código de Barras</th>
                      <th className="text-left p-2">Nome Produto</th>
                      <th className="text-center p-2">Qtde. Estoque</th>
                      <th className="text-center p-2">Loja</th>
                      <th className="text-left p-2">Classificação</th>
                      <th className="text-right p-2">Valor Custo</th>
                      <th className="text-right p-2">Valor Venda</th>
                      <th className="text-right p-2">Margem</th>
                      <th className="text-center p-2">Lote</th>
                      <th className="text-center p-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((p) => {
                      const rowKey = `${p.produto_id}-${p.loja_id}`;
                      const semEstoque = p.status_estoque === "sem_estoque";
                      const baixo = p.status_estoque === "baixo";
                      const loteVencido = p.lote_mais_proximo_severidade === "vencido";
                      const loteCritico = p.lote_mais_proximo_severidade === "critico";
                      const rowClass = semEstoque
                        ? "bg-red-50 dark:bg-red-950/10"
                        : baixo
                          ? "bg-orange-50 dark:bg-orange-950/10"
                          : loteVencido
                            ? "bg-red-50 dark:bg-red-950/10"
                            : "";
                      const margem = Number(p.preco_custo) > 0
                        ? ((Number(p.preco_venda) - Number(p.preco_custo)) / Number(p.preco_custo)) * 100
                        : 0;
                      return (
                        <tr key={rowKey} className={`border-b hover:bg-accent transition-colors ${rowClass}`}>
                          <td className="p-2 font-mono text-xs">
                            {p.codigo_barras || p.sku || "—"}
                          </td>
                          <td className="p-2">
                            <div className="font-medium">{p.nome}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.marca && <span>{p.marca} · </span>}
                              <span className="font-mono">{p.sku}</span>
                            </div>
                          </td>
                          <td className="p-2 text-center tabular-nums">
                            <span className={`font-semibold ${semEstoque ? "text-red-600" : baixo ? "text-orange-600" : ""}`}>
                              {p.estoque_atual}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-1">
                              {p.unidade}
                            </span>
                            {p.estoque_minimo > 0 && (
                              <div className="text-[10px] text-muted-foreground">
                                mín: {p.estoque_minimo}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-center text-xs">{p.loja_apelido}</td>
                          <td className="p-2 text-xs">{p.categoria_nome ?? "—"}</td>
                          <td className="p-2 text-right tabular-nums text-red-600">
                            {brl(p.preco_custo)}
                          </td>
                          <td className="p-2 text-right tabular-nums text-green-600 font-semibold">
                            {brl(p.preco_venda)}
                          </td>
                          <td className="p-2 text-right">
                            <Badge variant={margem >= 50 ? "default" : margem >= 25 ? "outline" : "destructive"} className="text-[10px]">
                              {margem.toFixed(0)}%
                            </Badge>
                          </td>
                          <td className="p-2 text-center">
                            {p.qtd_lotes > 0 ? (
                              <div className="flex flex-col items-center gap-0.5">
                                {loteVencido ? (
                                  <Badge variant="destructive" className="text-[10px]">
                                    <AlertCircle className="h-2 w-2 mr-0.5" />
                                    Vencido
                                  </Badge>
                                ) : loteCritico ? (
                                  <Badge variant="outline" className="text-orange-600 border-orange-500 text-[10px]">
                                    <Clock className="h-2 w-2 mr-0.5" />
                                    {p.lote_mais_proximo_dias}d
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px]">
                                    {p.lote_mais_proximo_dias}d
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => abrirEdicaoProduto(p)}
                                title="Editar produto"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
                <div className="text-muted-foreground">
                  Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, filtered.length)} de {filtered.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <span className="text-xs px-2">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ============== MODAL: PRODUTO ============== */}
      <Dialog open={modalProduto} onOpenChange={setModalProduto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Produto" : "Cadastrar Produto"}</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>SKU *</Label>
                <Input
                  value={formProduto.sku}
                  onChange={(e) => setFormProduto({ ...formProduto, sku: e.target.value })}
                />
              </div>
              <div>
                <Label>Cód. Barras</Label>
                <Input
                  value={formProduto.codigo_barras}
                  onChange={(e) => setFormProduto({ ...formProduto, codigo_barras: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Nome do Produto *</Label>
              <Input
                value={formProduto.nome}
                onChange={(e) => setFormProduto({ ...formProduto, nome: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Valor Custo</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formProduto.preco_custo}
                  onChange={(e) => setFormProduto({ ...formProduto, preco_custo: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor Venda</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formProduto.preco_venda}
                  onChange={(e) => setFormProduto({ ...formProduto, preco_venda: e.target.value })}
                />
              </div>
              <div>
                <Label>Estoque Mín.</Label>
                <Input
                  type="number"
                  value={formProduto.estoque_minimo}
                  onChange={(e) => setFormProduto({ ...formProduto, estoque_minimo: e.target.value })}
                />
              </div>
              <div>
                <Label>Duração típica (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Ex.: 30"
                  value={formProduto.duracao_dias}
                  onChange={(e) => setFormProduto({ ...formProduto, duracao_dias: e.target.value })}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Quanto tempo o produto dura em uso típico. Alimenta a previsão de recompra no CRM.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Marca</Label>
                <Input
                  value={formProduto.marca}
                  onChange={(e) => setFormProduto({ ...formProduto, marca: e.target.value })}
                />
              </div>
              <div>
                <Label>Unidade</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={formProduto.unidade}
                  onChange={(e) => setFormProduto({ ...formProduto, unidade: e.target.value })}
                >
                  <option value="UN">UN</option>
                  <option value="KG">KG</option>
                  <option value="L">L</option>
                  <option value="CX">CX</option>
                  <option value="PCT">PCT</option>
                </select>
              </div>
              <div>
                <Label>Classificação</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={formProduto.categoria_id}
                  onChange={(e) => setFormProduto({ ...formProduto, categoria_id: e.target.value })}
                >
                  <option value="">— Selecione —</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ===== DADOS FISCAIS (obrigatórios para emitir NF-e) ===== */}
            <div className="border rounded-md p-3 space-y-3">
              <p className="text-sm font-medium">Dados Fiscais <span className="text-xs text-muted-foreground">(NCM é obrigatório para NF-e)</span></p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>NCM *</Label>
                  <Input maxLength={8} placeholder="21069090" value={formProduto.ncm}
                    onChange={(e) => setFormProduto({ ...formProduto, ncm: e.target.value })} />
                </div>
                <div>
                  <Label>CEST</Label>
                  <Input maxLength={7} placeholder="1706200" value={formProduto.cest}
                    onChange={(e) => setFormProduto({ ...formProduto, cest: e.target.value })} />
                </div>
                <div>
                  <Label>CFOP padrão</Label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={formProduto.cfop_padrao}
                    onChange={(e) => setFormProduto({ ...formProduto, cfop_padrao: e.target.value })}>
                    <option value="5102">5102 — Venda (dentro do estado)</option>
                    <option value="5405">5405 — Venda ST (dentro do estado)</option>
                    <option value="6102">6102 — Venda (fora do estado)</option>
                    <option value="6404">6404 — Venda ST (fora do estado)</option>
                  </select>
                </div>
                <div>
                  <Label>CSOSN (Simples Nacional)</Label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={formProduto.csosn}
                    onChange={(e) => setFormProduto({ ...formProduto, csosn: e.target.value })}>
                    <option value="102">102 — Sem permissão de crédito</option>
                    <option value="101">101 — Com permissão de crédito</option>
                    <option value="500">500 — ICMS cobrado por ST</option>
                    <option value="400">400 — Não tributada pelo Simples</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalProduto(false)}>Cancelar</Button>
            <Button onClick={salvarProduto} disabled={!formProduto.sku || !formProduto.nome}>
              {editId ? "Salvar Alterações" : "Cadastrar Produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============== MODAL: CLASSIFICAÇÃO (CATEGORIAS) ============== */}
      <Dialog open={modalCategoria} onOpenChange={setModalCategoria}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editCategoriaId ? "Editar Classificação" : "Gerenciar Classificações"}</DialogTitle>
            <DialogClose />
          </DialogHeader>

          {/* Form de cadastro */}
          <div className="space-y-3 border-b pb-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label>Nome</Label>
                <Input
                  value={formCategoria.nome}
                  onChange={(e) => setFormCategoria({ ...formCategoria, nome: e.target.value })}
                  placeholder="Ex: Suplementos"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={salvarCategoria} className="w-full">
                  {editCategoriaId ? <Save className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  {editCategoriaId ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={formCategoria.descricao}
                onChange={(e) => setFormCategoria({ ...formCategoria, descricao: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          </div>

          {/* Lista de categorias existentes */}
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Classificações existentes ({categorias.length})
            </p>
            {categorias.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma classificação cadastrada
              </p>
            ) : (
              categorias.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 hover:bg-accent rounded">
                  <div>
                    <p className="font-medium text-sm">{c.nome}</p>
                    {c.descricao && (
                      <p className="text-xs text-muted-foreground">{c.descricao}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => abrirEdicaoCategoria(c)}
                      title="Editar"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => excluirCategoria(c.id)}
                      title="Excluir"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalCategoria(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Reajuste de preços em massa ===== */}
      <Dialog open={modalReajuste} onOpenChange={setModalReajuste}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> Reajuste de preços
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Aplica o percentual sobre o preço de venda dos{" "}
              <b>{filtered.length} produto(s) do filtro atual</b>. Use o filtro de
              categoria acima para restringir o escopo antes de aplicar.
            </p>
            <div>
              <Label>Percentual (%)</Label>
              <Input
                type="number" step="0.1" placeholder="Ex.: 10 aumenta · -5 reduz"
                value={percReajuste} onChange={(e) => setPercReajuste(e.target.value)}
              />
            </div>
            {percReajuste && Number(percReajuste.replace(",", ".")) !== 0 && filtered[0] && (
              <p className="text-xs text-muted-foreground">
                Exemplo: {filtered[0].nome} — {brl(Number(filtered[0].preco_venda))} →{" "}
                {brl(Math.round(Number(filtered[0].preco_venda) * (1 + Number(percReajuste.replace(",", ".")) / 100) * 100) / 100)}
              </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={aplicarReajuste} disabled={aplicandoReajuste || !percReajuste}>
              {aplicandoReajuste && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aplicar em {filtered.length} produto(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Produtos excluídos (desativados) ===== */}
      <Dialog open={modalExcluidos} onOpenChange={setModalExcluidos}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Produtos excluídos
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Produto desativado some de todas as listagens e do PDV. Reativar o
            traz de volta com cadastro e histórico intactos.
          </p>
          {excluidos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum produto desativado.
            </p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {excluidos.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.nome}</p>
                    <p className="font-mono text-xs text-muted-foreground">{p.sku} · {brl(Number(p.preco_venda))}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => reativarProduto(p.id)}>
                    Reativar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
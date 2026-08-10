// ============================================================
// Página Unificada: Produtos & Estoque
// Combina as funcionalidades de:
//   - Catálogo de produtos (CRUD)
//   - Controle de estoque por loja
//   - Alertas de estoque baixo e validade
//
// Navegação por abas:
//   [Produtos] [Estoque] [Movimentações]
// ============================================================

import { useState, useMemo } from "react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Package, Search, Loader2, AlertTriangle, Save, Plus,
  Edit, Trash2, Package2, Boxes, TrendingDown, TrendingUp,
  Calendar, Barcode, Filter, ChevronLeft, ChevronRight,
  ArrowUpCircle, ArrowDownCircle, RefreshCw,
} from "lucide-react";
import {
  useProdutosComEstoque, useUpdateEstoque, useLojas,
  useProdutos, useCreateProduto, useUpdateProduto, useLotesVencendo,
  useCreatePessoa, useDeletePessoa,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { useLojaAtualStore } from "@/lib/store/loja-atual";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";

type TabValue = "produtos" | "estoque" | "movimentacoes";

export function ProdutosEstoquePage() {
  const { lojaId: lojaIdHook } = useAutoSelectLoja();
  const lojaId = lojaIdHook;
  const setLojaIdGlobal = useLojaAtualStore((s) => s.setCurrentLojaId);

  // Local state para filtro de loja na tabela
  const [lojaFiltro, setLojaFiltro] = useState<string>(lojaId ?? "");
  const [tab, setTab] = useState<TabValue>("produtos");
  const [search, setSearch] = useState("");

  // ===== ABA PRODUTOS =====
  const { data: produtos = [], isLoading: loadingProdutos } = useProdutos({ search });
  const createProduto = useCreateProduto();
  const updateProduto = useUpdateProduto();

  // ===== ABA ESTOQUE =====
  const { data: lojas = [] } = useLojas();
  const { data: produtosEstoque = [], isLoading: loadingEstoque } = useProdutosComEstoque(lojaFiltro || undefined);
  const updateEstoque = useUpdateEstoque();
  const { data: lotesVencendo = [] } = useLotesVencendo(lojaFiltro || undefined);

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [modalProduto, setModalProduto] = useState(false);
  const [formProduto, setFormProduto] = useState({
    sku: "", nome: "", preco_custo: "0", preco_venda: "0",
    unidade: "UN", estoque_minimo: "0", marca: "", codigo_barras: "",
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Produtos & Estoque" />;

  // ===== Estatísticas =====
  const totalProdutos = produtos.length;
  const produtosBaixoEstoque = produtosEstoque.filter((p: any) => {
    const q = lojaFiltro
      ? Number(p.estoque_por_loja?.[lojaFiltro] ?? 0)
      : Object.values(p.estoque_por_loja ?? {}).reduce((s: number, v: any) => s + Number(v), 0);
    return q <= p.estoque_minimo;
  });
  const produtosVencendo = lotesVencendo.length;
  const valorTotalEstoque = produtosEstoque.reduce((acc, p: any) => {
    const q = lojaFiltro
      ? Number(p.estoque_por_loja?.[lojaFiltro] ?? 0)
      : Object.values(p.estoque_por_loja ?? {}).reduce((s: number, v: any) => s + Number(v), 0);
    return acc + (q * Number(p.preco_custo));
  }, 0);

  // ===== Handlers: Produtos =====
  const abrirEdicao = (p: any) => {
    setEditId(p.id);
    setFormProduto({
      sku: p.sku,
      nome: p.nome,
      preco_custo: String(p.preco_custo ?? 0),
      preco_venda: String(p.preco_venda ?? 0),
      unidade: p.unidade ?? "UN",
      estoque_minimo: String(p.estoque_minimo ?? 0),
      marca: p.marca ?? "",
      codigo_barras: p.codigo_barras ?? "",
    });
    setModalProduto(true);
  };

  const novoProduto = () => {
    setEditId(null);
    setFormProduto({
      sku: "", nome: "", preco_custo: "0", preco_venda: "0",
      unidade: "UN", estoque_minimo: "0", marca: "", codigo_barras: "",
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
      marca: formProduto.marca || null,
      codigo_barras: formProduto.codigo_barras || null,
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

  // ===== Handlers: Estoque =====
  const getQuantidade = (p: any): number => {
    if (!lojaFiltro) {
      return Object.values(p.estoque_por_loja ?? {}).reduce((s: number, v: any) => s + Number(v), 0);
    }
    return Number(p.estoque_por_loja?.[lojaFiltro] ?? 0);
  };

  const salvarEstoque = async (produtoId: string) => {
    if (!lojaFiltro) {
      toast.error("Selecione uma loja para ajustar estoque");
      return;
    }
    const novoValor = edits[produtoId];
    if (novoValor === undefined) return;
    await updateEstoque.mutateAsync({
      produtoId,
      lojaId: lojaFiltro,
      quantidade: parseInt(novoValor) || 0,
    });
    setEdits((prev) => {
      const c = { ...prev };
      delete c[produtoId];
      return c;
    });
    toast.success("Estoque atualizado");
  };

  const produtosFiltrados = useMemo(() => {
    if (!search) return produtos;
    const s = search.toLowerCase();
    return produtos.filter((p: any) =>
      p.nome.toLowerCase().includes(s) ||
      p.sku.toLowerCase().includes(s) ||
      (p.codigo_barras ?? "").includes(s) ||
      (p.marca ?? "").toLowerCase().includes(s)
    );
  }, [produtos, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" /> Produtos & Estoque
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catálogo unificado com controle de estoque por loja
          </p>
        </div>
        {tab === "produtos" && (
          <Button onClick={novoProduto}>
            <Plus className="mr-2 h-4 w-4" /> Novo Produto
          </Button>
        )}
      </div>

      {/* KPIs globais */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Produtos</p>
            <p className="text-2xl font-semibold">{totalProdutos}</p>
          </CardContent>
        </Card>
        <Card className={produtosBaixoEstoque.length > 0 ? "border-orange-500" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown className="h-6 w-6 text-orange-600" />
            <div>
              <p className="text-xs uppercase text-muted-foreground">Estoque Baixo</p>
              <p className={`text-2xl font-semibold ${produtosBaixoEstoque.length > 0 ? "text-orange-600" : ""}`}>
                {produtosBaixoEstoque.length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className={produtosVencendo > 0 ? "border-red-500" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-6 w-6 text-red-600" />
            <div>
              <p className="text-xs uppercase text-muted-foreground">Lotes Vencendo</p>
              <p className={`text-2xl font-semibold ${produtosVencendo > 0 ? "text-red-600" : ""}`}>
                {produtosVencendo}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Valor em Estoque</p>
            <p className="text-2xl font-semibold">{brl(valorTotalEstoque)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Abas */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="produtos">
            <Package2 className="h-4 w-4 mr-2" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="estoque">
            <Boxes className="h-4 w-4 mr-2" /> Estoque
          </TabsTrigger>
        </TabsList>

        {/* ============================ */}
        {/* ABA: PRODUTOS (CRUD)        */}
        {/* ============================ */}
        <TabsContent value="produtos" className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, SKU, código de barras ou marca..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Card>
            <CardContent className="p-0">
              {loadingProdutos ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </div>
              ) : produtosFiltrados.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  {search ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
                </div>
              ) : (
                <table className="w-full">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">SKU</th>
                      <th className="text-left p-3">Produto</th>
                      <th className="text-left p-3">Marca</th>
                      <th className="text-right p-3">Custo</th>
                      <th className="text-right p-3">Venda</th>
                      <th className="text-right p-3">Margem</th>
                      <th className="text-center p-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtosFiltrados.map((p: any) => {
                      const custo = Number(p.preco_custo);
                      const venda = Number(p.preco_venda);
                      const margem = custo > 0 ? ((venda - custo) / custo) * 100 : 0;
                      return (
                        <tr key={p.id} className="border-b hover:bg-accent">
                          <td className="p-3 font-mono text-xs">{p.sku}</td>
                          <td className="p-3">
                            <p className="font-medium text-sm">{p.nome}</p>
                            {p.codigo_barras && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Barcode className="h-3 w-3" /> {p.codigo_barras}
                              </p>
                            )}
                          </td>
                          <td className="p-3 text-sm">{p.marca ?? "—"}</td>
                          <td className="p-3 text-right tabular-nums text-red-600">{brl(custo)}</td>
                          <td className="p-3 text-right tabular-nums text-green-600 font-semibold">{brl(venda)}</td>
                          <td className="p-3 text-right tabular-nums">
                            <Badge variant={margem >= 50 ? "default" : margem >= 25 ? "outline" : "destructive"}>
                              {margem.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Button size="sm" variant="ghost" onClick={() => abrirEdicao(p)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================ */}
        {/* ABA: ESTOQUE (por loja)     */}
        {/* ============================ */}
        <TabsContent value="estoque" className="space-y-4">
          {/* Filtros */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="min-w-[200px]">
              <Label className="text-xs">Filtrar por Loja</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={lojaFiltro}
                onChange={(e) => setLojaFiltro(e.target.value)}
              >
                <option value="">Todas as lojas (somado)</option>
                {lojas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.apelido}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou SKU..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Tabela de estoque */}
          <Card>
            <CardContent className="p-0">
              {loadingEstoque ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </div>
              ) : (
                <table className="w-full">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">SKU</th>
                      <th className="text-left p-3">Produto</th>
                      <th className="text-center p-3">Categoria</th>
                      <th className="text-center p-3">Qtd Atual</th>
                      <th className="text-center p-3">Mín.</th>
                      <th className="text-center p-3">Ajustar</th>
                      <th className="text-center p-3">Status</th>
                      <th className="text-center p-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtosEstoque
                      .filter((p: any) =>
                        !search ||
                        p.nome.toLowerCase().includes(search.toLowerCase()) ||
                        p.sku.toLowerCase().includes(search.toLowerCase())
                      )
                      .map((p: any) => {
                        const qtd = getQuantidade(p);
                        const editVal = edits[p.id];
                        const baixo = qtd <= p.estoque_minimo;
                        const vencendo = lotesVencendo.find((l) => l.produto_id === p.id);
                        return (
                          <tr
                            key={p.id}
                            className={`border-b hover:bg-accent ${
                              baixo ? "bg-orange-50 dark:bg-orange-950/10" : ""
                            }`}
                          >
                            <td className="p-3 font-mono text-xs">{p.sku}</td>
                            <td className="p-3">
                              <p className="font-medium">{p.nome}</p>
                              {vencendo && (
                                <p className="text-xs text-red-600 flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Vence em {vencendo.dias_para_vencer}d
                                </p>
                              )}
                            </td>
                            <td className="p-3 text-center text-xs">{p.categoria?.nome ?? "—"}</td>
                            <td className="p-3 text-center tabular-nums font-semibold">{qtd}</td>
                            <td className="p-3 text-center tabular-nums text-xs text-muted-foreground">
                              {p.estoque_minimo}
                            </td>
                            <td className="p-3">
                              <Input
                                type="number"
                                className="h-8 w-20 text-center mx-auto"
                                placeholder={String(qtd)}
                                value={editVal ?? ""}
                                onChange={(e) =>
                                  setEdits({ ...edits, [p.id]: e.target.value })
                                }
                                disabled={!lojaFiltro}
                              />
                            </td>
                            <td className="p-3 text-center">
                              {baixo ? (
                                <Badge variant="destructive">
                                  <TrendingDown className="h-3 w-3 mr-1" /> Baixo
                                </Badge>
                              ) : (
                                <Badge variant="default">
                                  <TrendingUp className="h-3 w-3 mr-1" /> OK
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {editVal !== undefined && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => salvarEstoque(p.id)}
                                  disabled={!lojaFiltro}
                                >
                                  <Save className="h-3 w-3" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Alerta de validade */}
          {lotesVencendo.length > 0 && (
            <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900 dark:text-red-200">
                    {lotesVencendo.length} lote(s) próximo(s) do vencimento
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Verifique a aba "Lotes & Validade" no menu para detalhes
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de Produto (CRUD) */}
      <Dialog open={modalProduto} onOpenChange={setModalProduto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
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
                <Label>Nome *</Label>
                <Input
                  value={formProduto.nome}
                  onChange={(e) => setFormProduto({ ...formProduto, nome: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Custo</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formProduto.preco_custo}
                  onChange={(e) =>
                    setFormProduto({ ...formProduto, preco_custo: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Venda</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formProduto.preco_venda}
                  onChange={(e) =>
                    setFormProduto({ ...formProduto, preco_venda: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Estoque Mín.</Label>
                <Input
                  type="number"
                  value={formProduto.estoque_minimo}
                  onChange={(e) =>
                    setFormProduto({ ...formProduto, estoque_minimo: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Marca</Label>
                <Input
                  value={formProduto.marca}
                  onChange={(e) => setFormProduto({ ...formProduto, marca: e.target.value })}
                />
              </div>
              <div>
                <Label>Cód. Barras (EAN)</Label>
                <Input
                  value={formProduto.codigo_barras}
                  onChange={(e) =>
                    setFormProduto({ ...formProduto, codigo_barras: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Unidade</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={formProduto.unidade}
                onChange={(e) => setFormProduto({ ...formProduto, unidade: e.target.value })}
              >
                <option value="UN">UN (Unidade)</option>
                <option value="KG">KG (Quilo)</option>
                <option value="L">L (Litro)</option>
                <option value="CX">CX (Caixa)</option>
                <option value="PCT">PCT (Pacote)</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalProduto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarProduto} disabled={!formProduto.sku || !formProduto.nome}>
              {editId ? "Salvar Alterações" : "Criar Produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
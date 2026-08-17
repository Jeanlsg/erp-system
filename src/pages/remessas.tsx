// ============================================================
// Página: Remessas entre Filiais
// Permite criar transferências de produtos entre lojas,
// emitindo NFe de remessa (CFOP 5152/6152) e controlando estoque.
// ============================================================

import { useState, useEffect } from "react";
import {
  Card, CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Send, Plus, Loader2, ArrowRight, FileText, CheckCircle2,
  X, Trash2, Truck, Filter,
} from "lucide-react";
import {
  useLojas, useProdutos, useRemessas,
  useCreateRemessa, useEmitirNFeRemessa, useReceberRemessa,
  useUpdateRemessa, useDeleteRemessa,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { useAuth } from "@/lib/store/auth-store";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

interface ItemForm {
  produto_id: string;
  quantidade: number;
  preco_custo: number;
  preco_venda_praticado?: number;
  subtotal: number;
}

export function RemessasPage() {
  const { lojaId } = useAutoSelectLoja();
  const { user } = useAuth();
  const { data: lojas = [] } = useLojas();
  const { data: produtos = [] } = useProdutos();
  const { data: remessas = [], isLoading } = useRemessas({
    lojaId: lojaId ?? undefined,
  });

  const createRemessa = useCreateRemessa();
  const updateRemessa = useUpdateRemessa();
  const deleteRemessa = useDeleteRemessa();
  const emitirNFe = useEmitirNFeRemessa();
  const receberRemessa = useReceberRemessa();

  const [modal, setModal] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");

  const [form, setForm] = useState({
    loja_origem_id: "",
    loja_destino_id: "",
    tipo: "remessa" as "remessa" | "retorno" | "transferencia_simples" | "venda_filial",
    data_previsao_chegada: "",
    valor_frete: "0",
    valor_seguro: "0",
    observacoes: "",
    itens: [] as ItemForm[],
  });

  const [itemSearch, setItemSearch] = useState("");

  // Inicializar loja origem com a loja atual. Fica junto dos demais hooks:
  // depois de um early return, a ordem das chamadas mudaria entre renders.
  useEffect(() => {
    setForm((f) => (f.loja_origem_id || !lojaId ? f : { ...f, loja_origem_id: lojaId }));
  }, [lojaId]);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Remessas" />;

  const lojasAtivas = lojas.filter((l) => l.ativo);
  const filteredRemessas = remessas.filter((r: any) => {
    if (filtroStatus && r.status !== filtroStatus) return false;
    if (filtroTipo && r.tipo !== filtroTipo) return false;
    return true;
  });

  const totalValor = filteredRemessas.reduce((s: number, r: any) => s + Number(r.valor_total ?? 0), 0);
  const totalPendentes = filteredRemessas.filter((r: any) =>
    ["rascunho", "nf_emitida", "em_transito"].includes(r.status)
  ).length;

  const STATUS_VARIANT: Record<string, any> = {
    rascunho: "outline",
    nf_emitida: "default",
    em_transito: "outline",
    recebida: "default",
    cancelada: "destructive",
    rejeitada: "destructive",
  };

  const STATUS_LABEL: Record<string, string> = {
    rascunho: "Rascunho",
    nf_emitida: "NFe Emitida",
    em_transito: "Em Trânsito",
    recebida: "Recebida",
    cancelada: "Cancelada",
    rejeitada: "Rejeitada",
  };

  const TIPO_LABEL: Record<string, string> = {
    remessa: "Remessa",
    retorno: "Retorno",
    transferencia_simples: "Transf. Simples",
    venda_filial: "Venda entre Filiais",
  };

  const resetForm = () => {
    setForm({
      loja_origem_id: lojaId ?? "",
      loja_destino_id: "",
      tipo: "remessa",
      data_previsao_chegada: "",
      valor_frete: "0",
      valor_seguro: "0",
      observacoes: "",
      itens: [],
    });
    setItemSearch("");
  };

  const adicionarItem = (produto: any) => {
    const novoItem: ItemForm = {
      produto_id: produto.id,
      quantidade: 1,
      preco_custo: Number(produto.preco_custo),
      preco_venda_praticado: Number(produto.preco_venda),
      subtotal: Number(produto.preco_custo),
    };
    setForm({ ...form, itens: [...form.itens, novoItem] });
    setItemSearch("");
  };

  const atualizarItem = (idx: number, campo: string, valor: any) => {
    const novosItens = [...form.itens];
    novosItens[idx] = { ...novosItens[idx], [campo]: valor };
    // Recalcular subtotal
    if (campo === "quantidade" || campo === "preco_custo") {
      novosItens[idx].subtotal = Number(novosItens[idx].quantidade) * Number(novosItens[idx].preco_custo);
    }
    setForm({ ...form, itens: novosItens });
  };

  const removerItem = (idx: number) => {
    setForm({ ...form, itens: form.itens.filter((_, i) => i !== idx) });
  };

  const calcularValorTotal = () => {
    const subtotal = form.itens.reduce((s, i) => s + Number(i.subtotal || 0), 0);
    return subtotal + Number(form.valor_frete || 0) + Number(form.valor_seguro || 0);
  };

  const calcularCFOP = () => {
    const origem = lojas.find((l) => l.id === form.loja_origem_id);
    const destino = lojas.find((l) => l.id === form.loja_destino_id);
    if (!origem || !destino) return "";
    const mesmaUF = origem.uf === destino.uf;
    if (form.tipo === "retorno") return mesmaUF ? "5202" : "6202";
    if (form.tipo === "venda_filial") return mesmaUF ? "5102" : "6102";
    return mesmaUF ? "5152" : "6152";
  };

  const handleSalvar = async () => {
    if (!user || !form.loja_destino_id || form.itens.length === 0) {
      alert("Preencha todos os campos e adicione pelo menos 1 item");
      return;
    }
    if (form.loja_origem_id === form.loja_destino_id) {
      alert("Origem e destino devem ser diferentes");
      return;
    }

    const valorProdutos = form.itens.reduce((s, i) => s + Number(i.subtotal || 0), 0);
    const valorTotal = calcularValorTotal();

    try {
      await createRemessa.mutateAsync({
        loja_origem_id: form.loja_origem_id,
        loja_destino_id: form.loja_destino_id,
        usuario_id: user.id,
        tipo: form.tipo,
        cfop_utilizado: calcularCFOP() || null,
        data_previsao_chegada: form.data_previsao_chegada || null,
        valor_produtos: valorProdutos,
        valor_frete: Number(form.valor_frete),
        valor_seguro: Number(form.valor_seguro),
        valor_total: valorTotal,
        itens: form.itens,
        observacoes: form.observacoes || null,
      });

      setModal(false);
      resetForm();
      toast.success("Remessa criada com sucesso!");
    } catch (err: any) {
      toast.error(`Erro ao salvar remessa: ${err.message}`);
    }
  };

  const handleEmitirNFe = async (r: any) => {
    // A NF-e é sempre emitida pela loja de ORIGEM da remessa
    if (!confirm("Emitir NFe de remessa? Estoque da origem será baixado.")) return;
    try {
      await emitirNFe.mutateAsync({ remessa_id: r.id, loja_id: r.loja_origem_id });
      toast.success("NFe emitida com sucesso!");
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`, { duration: 10000 });
    }
  };

  const handleReceber = async (remessaId: string) => {
    if (!user) return;
    if (!confirm("Confirmar recebimento no destino? Estoque será adicionado.")) return;
    try {
      await receberRemessa.mutateAsync({ remessa_id: remessaId, usuario_id: user.id });
      toast.success("Recebimento confirmado!");
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleMarcarTransito = async (remessaId: string) => {
    try {
      await updateRemessa.mutateAsync({ id: remessaId, status: "em_transito" });
      toast.success("Remessa marcada como em trânsito.");
    } catch (err: any) {
      toast.error(`Erro ao marcar trânsito: ${err.message}`);
    }
  };

  const handleCancelar = async (remessaId: string) => {
    if (!confirm("Cancelar esta remessa?")) return;
    try {
      await updateRemessa.mutateAsync({
        id: remessaId,
        status: "cancelada",
        motivo_cancelamento: "Cancelado pelo usuário",
      });
      toast.success("Remessa cancelada.");
    } catch (err: any) {
      toast.error(`Erro ao cancelar: ${err.message}`);
    }
  };

  const handleExcluir = async (remessaId: string) => {
    if (!confirm("Excluir esta remessa (apenas rascunhos)?")) return;
    try {
      await deleteRemessa.mutateAsync(remessaId);
      toast.success("Remessa excluída.");
    } catch (err: any) {
      toast.error(`Erro ao excluir: ${err.message}`);
    }
  };

  const produtosFiltrados = itemSearch
    ? produtos.filter((p: any) =>
        p.nome.toLowerCase().includes(itemSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(itemSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Send className="h-6 w-6" /> Remessas entre Filiais
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Transferência de produtos entre lojas com emissão de NFe
          </p>
        </div>
        <Button onClick={() => { resetForm(); setModal(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nova Remessa
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Total Remessas</p>
            <p className="text-2xl font-semibold">{filteredRemessas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Pendentes</p>
            <p className="text-2xl font-semibold text-orange-600">{totalPendentes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Valor Total</p>
            <p className="text-2xl font-semibold">{brl(totalValor)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4" />
          <select
            className="h-9 rounded border border-input bg-transparent px-2 text-sm"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="">Todos status</option>
            <option value="rascunho">Rascunho</option>
            <option value="nf_emitida">NFe Emitida</option>
            <option value="em_transito">Em Trânsito</option>
            <option value="recebida">Recebida</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <select
            className="h-9 rounded border border-input bg-transparent px-2 text-sm"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          >
            <option value="">Todos tipos</option>
            <option value="remessa">Remessa</option>
            <option value="retorno">Retorno</option>
            <option value="transferencia_simples">Transf. Simples</option>
            <option value="venda_filial">Venda entre Filiais</option>
          </select>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : filteredRemessas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma remessa encontrada
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nº</th>
                  <th className="text-left p-3">Origem → Destino</th>
                  <th className="text-center p-3">Tipo</th>
                  <th className="text-center p-3">CFOP</th>
                  <th className="text-center p-3">Itens</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRemessas.map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono text-xs">#{r.numero_remessa ?? r.id.slice(0, 8)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{r.origem?.apelido}</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline">{r.destino?.apelido}</Badge>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="outline">{TIPO_LABEL[r.tipo] ?? r.tipo}</Badge>
                    </td>
                    <td className="p-3 text-center font-mono text-xs">
                      {r.cfop_utilizado ?? "—"}
                    </td>
                    <td className="p-3 text-center">
                      {r.itens?.length ?? 0}
                    </td>
                    <td className="p-3 text-right tabular-nums font-semibold">
                      {brl(r.valor_total)}
                    </td>
                    <td className="p-3 text-xs">{date(r.data_remessa)}</td>
                    <td className="p-3 text-center">
                      <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex gap-1 justify-center flex-wrap">
                        {r.status === "rascunho" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={emitirNFe.isPending || lojaId !== r.loja_origem_id}
                              title={lojaId !== r.loja_origem_id ? "Somente a loja de origem pode emitir a NFe" : undefined}
                              onClick={() => handleEmitirNFe(r)}
                            >
                              <FileText className="h-3 w-3 mr-1" /> NFe
                            </Button>
                            <Button size="sm" variant="ghost" disabled={deleteRemessa.isPending} onClick={() => handleExcluir(r.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </>
                        )}
                        {r.status === "nf_emitida" && (
                          <>
                            <Button size="sm" variant="outline" disabled={updateRemessa.isPending} onClick={() => handleMarcarTransito(r.id)}>
                              <Truck className="h-3 w-3 mr-1" /> Trânsito
                            </Button>
                            <Button size="sm" variant="default" disabled={receberRemessa.isPending} onClick={() => handleReceber(r.id)}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Receber
                            </Button>
                          </>
                        )}
                        {r.status === "em_transito" && (
                          <Button size="sm" variant="default" disabled={receberRemessa.isPending} onClick={() => handleReceber(r.id)}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Receber
                          </Button>
                        )}
                        {(r.status === "rascunho" || r.status === "nf_emitida") && (
                          <Button size="sm" variant="ghost" disabled={updateRemessa.isPending} onClick={() => handleCancelar(r.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Modal de Nova Remessa */}
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Remessa entre Filiais</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <div className="space-y-4">
            {/* Origem/Destino */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Loja Origem *</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  value={form.loja_origem_id}
                  onChange={(e) => setForm({ ...form, loja_origem_id: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {lojasAtivas.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.apelido} ({l.uf})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Loja Destino *</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  value={form.loja_destino_id}
                  onChange={(e) => setForm({ ...form, loja_destino_id: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {lojasAtivas.filter((l) => l.id !== form.loja_origem_id).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.apelido} ({l.uf})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tipo *</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value as any })}
                >
                  <option value="remessa">Remessa</option>
                  <option value="retorno">Retorno</option>
                  <option value="transferencia_simples">Transf. Simples</option>
                  <option value="venda_filial">Venda entre Filiais</option>
                </select>
              </div>
              <div>
                <Label>Previsão Chegada</Label>
                <Input
                  type="date"
                  value={form.data_previsao_chegada}
                  onChange={(e) => setForm({ ...form, data_previsao_chegada: e.target.value })}
                />
              </div>
              <div>
                <Label>CFOP Automático</Label>
                <Input value={calcularCFOP()} disabled className="font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Frete</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor_frete}
                  onChange={(e) => setForm({ ...form, valor_frete: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor Seguro</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor_seguro}
                  onChange={(e) => setForm({ ...form, valor_seguro: e.target.value })}
                />
              </div>
            </div>

            {/* Adicionar Produtos */}
            <div>
              <Label>Adicionar Produtos</Label>
              <Input
                placeholder="Buscar produto por nome ou SKU..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
              />
              {produtosFiltrados.length > 0 && (
                <div className="mt-1 border rounded max-h-40 overflow-y-auto">
                  {produtosFiltrados.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => adicionarItem(p)}
                      className="w-full text-left p-2 hover:bg-accent border-b"
                    >
                      <p className="text-sm font-medium">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.sku} · Custo: {brl(p.preco_custo)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Itens Adicionados */}
            {form.itens.length > 0 && (
              <div>
                <Label>Itens da Remessa ({form.itens.length})</Label>
                <div className="border rounded max-h-60 overflow-y-auto">
                  {form.itens.map((item, idx) => {
                    const produto = produtos.find((p: any) => p.id === item.produto_id);
                    return (
                      <div key={idx} className="flex items-center gap-2 p-2 border-b">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{produto?.nome}</p>
                          <p className="text-xs text-muted-foreground">{produto?.sku}</p>
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.quantidade}
                          onChange={(e) => atualizarItem(idx, "quantidade", Number(e.target.value))}
                          className="w-20"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          value={item.preco_custo}
                          onChange={(e) => atualizarItem(idx, "preco_custo", Number(e.target.value))}
                          className="w-24"
                        />
                        <div className="w-24 text-right text-sm font-semibold">
                          {brl(item.subtotal)}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removerItem(idx)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <Label>Observações</Label>
              <textarea
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[80px]"
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </div>

            {/* Resumo */}
            <div className="bg-muted p-3 rounded space-y-1">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{brl(form.itens.reduce((s, i) => s + Number(i.subtotal || 0), 0))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Frete + Seguro:</span>
                <span>{brl(Number(form.valor_frete) + Number(form.valor_seguro))}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-1 border-t">
                <span>Total:</span>
                <span className="text-green-600">{brl(calcularValorTotal())}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSalvar}
              disabled={
                createRemessa.isPending ||
                !form.loja_destino_id ||
                form.itens.length === 0
              }
            >
              {createRemessa.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                </>
              ) : (
                "Criar Remessa"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
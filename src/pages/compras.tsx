import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboboxBusca } from "@/components/ui/combobox-busca";
import { ShoppingCart, Loader2, Plus, Upload, X, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
  useCompras, useFornecedores, useProdutos, useCreateCompra, useUpdateCompraStatus, isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { useAuth } from "@/lib/store/auth-store";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

type ItemForm = { produto_id: string; preco_custo: number; quantidade: number };

export function ComprasPage() {
  const { lojaId } = useAutoSelectLoja();
  const { user } = useAuth();
  const { data: compras = [], isLoading } = useCompras({ lojaId: lojaId ?? undefined });
  const { data: fornecedores = [] } = useFornecedores();
  const { data: produtos = [] } = useProdutos({ lojaId: lojaId ?? undefined });
  const createCompra = useCreateCompra();
  const updateStatus = useUpdateCompraStatus();

  const [modalAberto, setModalAberto] = useState(false);
  const [fornecedorId, setFornecedorId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [novoProduto, setNovoProduto] = useState("");
  const [novoCusto, setNovoCusto] = useState("");
  const [novaQtd, setNovaQtd] = useState("1");

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Compras" />;

  const nomeProduto = (id: string) => produtos.find((p: any) => p.id === id)?.nome ?? id.slice(0, 8);
  const totalForm = itens.reduce((s, i) => s + i.preco_custo * i.quantidade, 0);

  const adicionarItem = () => {
    if (!novoProduto || !novoCusto) return;
    setItens((prev) => [...prev, { produto_id: novoProduto, preco_custo: parseFloat(novoCusto), quantidade: parseInt(novaQtd) || 1 }]);
    setNovoProduto(""); setNovoCusto(""); setNovaQtd("1");
  };

  const handleCriar = async () => {
    if (!lojaId || !user?.id || !fornecedorId || itens.length === 0) return;
    await createCompra.mutateAsync({
      loja_id: lojaId,
      fornecedor_id: fornecedorId,
      usuario_id: user.id,
      observacoes: observacoes || null,
      itens,
    });
    setModalAberto(false);
    setFornecedorId(""); setObservacoes(""); setItens([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" /> Compras
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{compras.length} pedido(s) de compra</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/compras/importar-nfe"><Upload className="mr-2 h-4 w-4" /> Importar NFe</Link>
          </Button>
          <Button onClick={() => setModalAberto(true)}><Plus className="mr-2 h-4 w-4" /> Nova Compra</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Pedidos de Compra</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : compras.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma compra registrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nº</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Fornecedor</th>
                  <th className="text-center p-3">Itens</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {compras.map((c: any) => (
                  <tr key={c.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono">#{c.numero_pedido ?? c.id.slice(0, 8)}</td>
                    <td className="p-3 text-sm">{c.data_compra ? date(c.data_compra) : "—"}</td>
                    <td className="p-3 text-sm">{c.fornecedor?.nome_razao ?? "—"}</td>
                    <td className="p-3 text-center">{(c.itens ?? []).length}</td>
                    <td className="p-3 text-right tabular-nums">{brl(c.total ?? 0)}</td>
                    <td className="p-3 text-center"><Badge variant={c.status === "recebida" ? "default" : "outline"}>{c.status ?? "—"}</Badge></td>
                    <td className="p-3 text-center">
                      {c.status === "pendente" && (
                        <Button variant="ghost" size="sm" title="Marcar como recebida"
                          onClick={() => updateStatus.mutate({ id: c.id, status: "recebida" })}>
                          <Check className="h-4 w-4 mr-1" /> Receber
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Compra</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Fornecedor *</Label>
              <ComboboxBusca
                itens={fornecedores.map((f: any) => ({ id: f.id, rotulo: f.nome_razao, detalhe: f.cpf_cnpj ?? undefined }))}
                value={fornecedorId}
                onChange={setFornecedorId}
                placeholder="Buscar fornecedor…"
              />
            </div>

            <div className="border rounded-md p-3 space-y-2">
              <Label>Itens da compra *</Label>
              <div className="flex gap-2">
                <select className="flex-1 h-9 rounded-md border bg-background px-2 text-sm" value={novoProduto} onChange={(e) => setNovoProduto(e.target.value)}>
                  <option value="">Produto...</option>
                  {produtos.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
                <Input type="number" step="0.01" placeholder="Custo" className="w-24" value={novoCusto} onChange={(e) => setNovoCusto(e.target.value)} />
                <Input type="number" min="1" className="w-16" value={novaQtd} onChange={(e) => setNovaQtd(e.target.value)} />
                <Button type="button" variant="outline" onClick={adicionarItem} disabled={!novoProduto || !novoCusto}>Add</Button>
              </div>
              {itens.length > 0 && (
                <ul className="space-y-1">
                  {itens.map((i, idx) => (
                    <li key={idx} className="flex items-center justify-between text-sm bg-muted rounded px-2 py-1">
                      <span>{i.quantidade}x {nomeProduto(i.produto_id)} — {brl(i.preco_custo)} un.</span>
                      <button type="button" onClick={() => setItens((prev) => prev.filter((_, x) => x !== idx))}>
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-right text-sm font-semibold">Total: {brl(totalForm)}</p>
            </div>

            <div><Label>Observações</Label><Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={createCompra.isPending || !fornecedorId || itens.length === 0}>
              {createCompra.isPending ? "Salvando..." : "Registrar Compra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

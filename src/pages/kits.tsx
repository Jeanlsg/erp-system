import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Plus, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useKits, useProdutos, useCreateKit, useUpdateKit, useDeleteKit, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";

type ItemForm = { produto_id: string; quantidade: number };

export function KitsPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: kits = [], isLoading } = useKits();
  const { data: produtos = [] } = useProdutos({ lojaId: lojaId ?? undefined });
  const createKit = useCreateKit();
  const updateKit = useUpdateKit();
  const deleteKit = useDeleteKit();

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", preco_kit: "" });
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [novoProduto, setNovoProduto] = useState("");
  const [novaQtd, setNovaQtd] = useState("1");

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Kits" />;

  const abrirNovo = () => {
    setEditando(null);
    setForm({ nome: "", descricao: "", preco_kit: "" });
    setItens([]);
    setModalAberto(true);
  };

  const abrirEdicao = (k: any) => {
    setEditando(k);
    setForm({ nome: k.nome, descricao: k.descricao ?? "", preco_kit: String(k.preco_kit ?? "") });
    setItens((k.itens ?? []).map((i: any) => ({ produto_id: i.produto_id, quantidade: i.quantidade })));
    setModalAberto(true);
  };

  const adicionarItem = () => {
    if (!novoProduto) return;
    const qtd = parseInt(novaQtd) || 1;
    setItens((prev) => {
      const existente = prev.find((i) => i.produto_id === novoProduto);
      if (existente) return prev.map((i) => (i.produto_id === novoProduto ? { ...i, quantidade: i.quantidade + qtd } : i));
      return [...prev, { produto_id: novoProduto, quantidade: qtd }];
    });
    setNovoProduto("");
    setNovaQtd("1");
  };

  const nomeProduto = (id: string) => produtos.find((p: any) => p.id === id)?.nome ?? id.slice(0, 8);

  const handleSalvar = async () => {
    if (!form.nome || !form.preco_kit) return;
    const payload = {
      nome: form.nome,
      descricao: form.descricao || null,
      preco_kit: parseFloat(form.preco_kit),
      itens,
    };
    if (editando) await updateKit.mutateAsync({ id: editando.id, ...payload });
    else await createKit.mutateAsync(payload);
    setModalAberto(false);
  };

  const salvando = createKit.isPending || updateKit.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" /> Kits
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{kits.length} kit(s) cadastrado(s)</p>
        </div>
        <Button onClick={abrirNovo}><Plus className="mr-2 h-4 w-4" /> Novo Kit</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? <div className="col-span-full text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> :
          kits.length === 0 ? <p className="col-span-full text-center text-muted-foreground p-8">Nenhum kit cadastrado</p> :
          kits.map((k: any) => (
            <Card key={k.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{k.nome}</CardTitle>
                    {k.descricao && <p className="text-xs text-muted-foreground">{k.descricao}</p>}
                  </div>
                  <div className="flex">
                    <Button variant="ghost" size="icon" onClick={() => abrirEdicao(k)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" title="Excluir" onClick={() => { if (confirm(`Excluir o kit "${k.nome}"?`)) deleteKit.mutate(k.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {(k.itens ?? []).map((i: any) => (
                    <li key={i.produto_id}>{i.quantidade}x {i.produto?.nome ?? nomeProduto(i.produto_id)}</li>
                  ))}
                  {(k.itens ?? []).length === 0 && <li>Sem produtos vinculados</li>}
                </ul>
                <p className="text-2xl font-semibold mt-2 text-green-600">{brl(k.preco_kit)}</p>
              </CardContent>
            </Card>
          ))
        }
      </div>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editando ? "Editar Kit" : "Novo Kit"}</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div><Label>Preço do Kit (R$) *</Label><Input type="number" step="0.01" value={form.preco_kit} onChange={(e) => setForm({ ...form, preco_kit: e.target.value })} /></div>

            <div className="border rounded-md p-3 space-y-2">
              <Label>Produtos do kit</Label>
              <div className="flex gap-2">
                <select className="flex-1 h-9 rounded-md border bg-background px-2 text-sm" value={novoProduto} onChange={(e) => setNovoProduto(e.target.value)}>
                  <option value="">Selecione um produto...</option>
                  {produtos.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
                <Input type="number" min="1" className="w-20" value={novaQtd} onChange={(e) => setNovaQtd(e.target.value)} />
                <Button type="button" variant="outline" onClick={adicionarItem} disabled={!novoProduto}>Add</Button>
              </div>
              {itens.length > 0 && (
                <ul className="space-y-1">
                  {itens.map((i) => (
                    <li key={i.produto_id} className="flex items-center justify-between text-sm bg-muted rounded px-2 py-1">
                      <span>{i.quantidade}x {nomeProduto(i.produto_id)}</span>
                      <button type="button" onClick={() => setItens((prev) => prev.filter((x) => x.produto_id !== i.produto_id))}>
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando || !form.nome || !form.preco_kit}>
              {salvando ? "Salvando..." : editando ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

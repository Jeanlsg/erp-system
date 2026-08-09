import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Search, Loader2, AlertTriangle, Save } from "lucide-react";
import { useProdutosComEstoque, useUpdateEstoque, useLojas, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useLojaAtualStore } from "@/lib/store/loja-atual";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";

export function EstoquePage() {
  const lojaId = useLojaAtualStore((s) => s.currentLojaId);
  const setLojaId = useLojaAtualStore((s) => s.setCurrentLojaId);
  const { data: lojas = [] } = useLojas();
  const { data: produtos = [], isLoading } = useProdutosComEstoque(lojaId ?? undefined);
  const updateEstoque = useUpdateEstoque();
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Estoque" />;

  const filtrados = produtos.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.nome.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s);
  });

  const baixoEstoque = produtos.filter((p: any) => {
    const q = (lojaId ? (p.estoque_por_loja?.[lojaId] ?? 0) : Object.values(p.estoque_por_loja ?? {}).reduce((s: number, v: any) => s + Number(v), 0));
    return Number(q) <= p.estoque_minimo;
  });

  const handleSalvar = async (produtoId: string) => {
    const novoValor = edits[produtoId];
    if (novoValor === undefined || !lojaId) return;
    await updateEstoque.mutateAsync({ produtoId, lojaId, quantidade: parseInt(novoValor) || 0 });
    setEdits((prev) => {
      const c = { ...prev };
      delete c[produtoId];
      return c;
    });
  };

  const getQuantidade = (p: any): number => {
    if (!lojaId) return Object.values(p.estoque_por_loja ?? {}).reduce((s: number, v: any) => s + Number(v), 0);
    return Number(p.estoque_por_loja?.[lojaId] ?? 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" /> Estoque de Produtos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{produtos.length} produto(s) cadastrado(s)</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Total de Produtos</p>
            <p className="text-2xl font-semibold">{produtos.length}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-orange-600" />
            <div>
              <p className="text-xs uppercase text-orange-600">Estoque Baixo</p>
              <p className="text-2xl font-semibold text-orange-600">{baixoEstoque.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Label className="text-xs">Loja</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              value={lojaId ?? ""}
              onChange={(e) => setLojaId(e.target.value || null as any)}
            >
              <option value="">Todas</option>
              {lojas.map((l) => <option key={l.id} value={l.id}>{l.apelido}</option>)}
            </select>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou SKU..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Produtos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p: any) => {
                  const qtd = getQuantidade(p);
                  const editKey = String(edits[p.id] !== undefined ? edits[p.id] : "");
                  const baixo = qtd <= p.estoque_minimo;
                  return (
                    <tr key={p.id} className={`border-b hover:bg-accent ${baixo ? "bg-orange-50 dark:bg-orange-950/10" : ""}`}>
                      <td className="p-3 font-mono text-xs">{p.sku}</td>
                      <td className="p-3 font-medium">{p.nome}</td>
                      <td className="p-3 text-center text-xs">{p.categoria?.nome ?? "—"}</td>
                      <td className="p-3 text-center tabular-nums font-semibold">{qtd}</td>
                      <td className="p-3 text-center tabular-nums text-xs text-muted-foreground">{p.estoque_minimo}</td>
                      <td className="p-3">
                        <Input
                          type="number"
                          className="h-8 w-20 text-center mx-auto"
                          placeholder={String(qtd)}
                          value={editKey}
                          onChange={(e) => setEdits({ ...edits, [p.id]: e.target.value })}
                        />
                      </td>
                      <td className="p-3 text-center">
                        {baixo ? (
                          <Badge variant="destructive">Baixo</Badge>
                        ) : (
                          <Badge variant="default">OK</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {edits[p.id] !== undefined && (
                          <Button size="sm" variant="outline" onClick={() => handleSalvar(p.id)}>
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
    </div>
  );
}
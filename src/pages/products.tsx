import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { useLojaAtualStore } from "@/lib/store/loja-atual";
import { useProdutosComEstoque, isSupabaseConfigured } from "@/lib/supabase-queries";

export function ProductsPage() {
  const lojaId = useLojaAtualStore((s) => s.currentLojaId);
  const { data: produtos = [], isLoading } = useProdutosComEstoque(lojaId ?? undefined);

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" /> Produtos
          </h1>
        </div>
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <p className="mb-2">Configure as variáveis do Supabase no arquivo <code>.env</code>:</p>
            <code className="text-xs">VITE_SUPABASE_URL</code> e <code className="text-xs">VITE_SUPABASE_ANON_KEY</code>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" /> Produtos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {produtos.length} produto(s) cadastrado(s)
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo Produto
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : produtos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum produto encontrado. Cadastre produtos no Supabase.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Venda</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map((p) => {
                  const estoque = lojaId ? p.estoque_por_loja[lojaId] ?? 0 : 0;
                  const baixo = estoque <= p.estoque_minimo;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(p.preco_custo)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{brl(p.preco_venda)}</TableCell>
                      <TableCell className="text-right tabular-nums">{estoque}</TableCell>
                      <TableCell className="text-right">
                        {baixo ? <Badge variant="destructive">Baixo</Badge> : <Badge variant="outline">OK</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
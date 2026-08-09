import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { useProdutos, getEstoqueLoja } from "@/lib/store/products-store";
import { useCurrentLojaId } from "@/lib/store/stores-store";

export function ProductsPage() {
  const produtos = useProdutos();
  const lojaId = useCurrentLojaId();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" /> Produtos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie seu catálogo de produtos
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo Produto
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Venda</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((p) => {
                const estoque = getEstoqueLoja(p.id, lojaId);
                const baixo = estoque <= p.estoqueMinimo;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>{p.categoria}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(p.precoCusto)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{brl(p.precoVenda)}</TableCell>
                    <TableCell className="text-right tabular-nums">{estoque}</TableCell>
                    <TableCell className="text-right">
                      {baixo ? (
                        <Badge variant="destructive">Baixo</Badge>
                      ) : (
                        <Badge variant="outline">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
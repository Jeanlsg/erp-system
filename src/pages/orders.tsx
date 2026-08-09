import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { brl, dateTime } from "@/lib/format";
import { useVendas } from "@/lib/store/sales-store";
import { useCurrentLojaId } from "@/lib/store/stores-store";

const FORMA: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Crédito",
  cartao_debito: "Débito",
  crediario: "Crediário",
};

export function OrdersPage() {
  const vendas = useVendas();
  const lojaId = useCurrentLojaId();
  const vendasLoja = vendas.filter((v) => v.lojaId === lojaId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" /> Pedidos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe todos os pedidos</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo Pedido
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar pedido..." className="pl-9" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendasLoja.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum pedido registrado
                  </TableCell>
                </TableRow>
              ) : (
                vendasLoja.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">#{v.id.slice(0, 8)}</TableCell>
                    <TableCell>{dateTime(v.data)}</TableCell>
                    <TableCell>{v.itens.length} {v.itens.length === 1 ? "item" : "itens"}</TableCell>
                    <TableCell><Badge variant="outline">{FORMA[v.formaPagamento]}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{brl(v.total)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="default">Concluída</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Plus, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { brl, dateTime } from "@/lib/format";
import { useVendas, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";

const FORMA: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Crédito",
  cartao_debito: "Débito",
  crediario: "Crediário",
  boleto: "Boleto",
  promissoria: "Promissória",
  cheque: "Cheque",
  transferencia: "Transferência",
};

const STATUS: Record<string, { label: string; variant: "default" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "outline" },
  finalizada: { label: "Concluída", variant: "default" },
  cancelada: { label: "Cancelada", variant: "destructive" },
  devolvida: { label: "Devolvida", variant: "destructive" },
};

export function OrdersPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: vendas = [], isLoading } = useVendas({ lojaId: lojaId ?? undefined });
  const [search, setSearch] = useState("");

  if (!isSupabaseConfigured()) {
    return <SupabaseNotConfigured title="Pedidos" />;
  }

  if (!lojaId) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const vendasFiltradas = vendas.filter((v) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      String(v.numero_pedido).includes(s) ||
      v.cliente?.nome_razao?.toLowerCase().includes(s) ||
      v.itens.some((i) => i.nome.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" /> Pedidos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {vendas.length} pedido(s) registrado(s)
          </p>
        </div>
        <Button asChild>
          <Link to="/pdv"><Plus className="mr-2 h-4 w-4" /> Novo Pedido (PDV)</Link>
          </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pedido, cliente ou produto..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Carregando pedidos...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendasFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum pedido encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  vendasFiltradas.map((v) => {
                    const status = STATUS[v.status] ?? { label: v.status, variant: "outline" as const };
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">#{v.numero_pedido}</TableCell>
                        <TableCell>{dateTime(v.data_venda)}</TableCell>
                        <TableCell>{v.cliente?.nome_razao ?? "—"}</TableCell>
                        <TableCell>{v.itens?.length ?? 0} {(v.itens?.length ?? 0) === 1 ? "item" : "itens"}</TableCell>
                        <TableCell><Badge variant="outline">{FORMA[v.forma_pagamento] ?? v.forma_pagamento}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{brl(v.total)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
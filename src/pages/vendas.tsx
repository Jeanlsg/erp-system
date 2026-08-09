import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, Loader2 } from "lucide-react";
import { useVendas, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function VendasPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: vendas = [], isLoading } = useVendas({ lojaId: lojaId ?? undefined });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Vendas" />;

  const STATUS_VARIANT: Record<string, "default" | "destructive" | "outline"> = {
    pendente: "outline", finalizada: "default", cancelada: "destructive", devolvida: "outline",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Receipt className="h-6 w-6" /> Vendas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{vendas.length} venda(s) registrada(s)</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Histórico de Vendas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : vendas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma venda encontrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nº</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-center p-3">Forma</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v: any) => (
                  <tr key={v.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono">#{v.numero_pedido ?? v.id.slice(0, 8)}</td>
                    <td className="p-3 text-sm">{v.data_venda ? date(v.data_venda) : "—"}</td>
                    <td className="p-3 text-sm">{v.cliente?.nome_razao ?? "Consumidor"}</td>
                    <td className="p-3 text-right tabular-nums font-semibold">{brl(v.total)}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{v.forma_pagamento}</Badge></td>
                    <td className="p-3 text-center"><Badge variant={STATUS_VARIANT[v.status] ?? "outline"}>{v.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
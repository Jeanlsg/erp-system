import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Loader2 } from "lucide-react";
import { useCompras, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function ComprasPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: compras = [], isLoading } = useCompras({ lojaId: lojaId ?? undefined });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Compras" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ShoppingCart className="h-6 w-6" /> Compras
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{compras.length} pedido(s) de compra</p>
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
                  <th className="text-right p-3">Total</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {compras.map((c: any) => (
                  <tr key={c.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono">#{c.id.slice(0, 8)}</td>
                    <td className="p-3 text-sm">{c.data_compra ? date(c.data_compra) : "—"}</td>
                    <td className="p-3 text-sm">{c.fornecedor_nome ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{brl(c.valor_total ?? 0)}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{c.status ?? "—"}</Badge></td>
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
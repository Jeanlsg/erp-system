import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Receipt, Loader2, Ban } from "lucide-react";
import { useAuth } from "@/lib/store/auth-store";
import { CancelarVendaDialog } from "@/components/cancelar-venda-dialog";
import { useVendas, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";
import { NOME_FORMA } from "@/lib/dados-fechamento";
import { Badge } from "@/components/ui/badge";

export function VendasPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: vendas = [], isLoading } = useVendas({ lojaId: lojaId ?? undefined });
  const { can } = useAuth();
  const podeCancelar = can("venda.cancelar");
  const [cancelando, setCancelando] = useState<any | null>(null);

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
                  {podeCancelar && <th className="p-3" />}
                </tr>
              </thead>
              <tbody>
                {vendas.map((v: any) => (
                  <tr key={v.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono">#{v.numero_pedido ?? v.id.slice(0, 8)}</td>
                    <td className="p-3 text-sm">{v.data_venda ? date(v.data_venda) : "—"}</td>
                    <td className="p-3 text-sm">{v.cliente?.nome_razao ?? "Consumidor"}</td>
                    <td className="p-3 text-right tabular-nums font-semibold">{brl(v.total)}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{NOME_FORMA[v.forma_pagamento] ?? v.forma_pagamento}</Badge></td>
                    <td className="p-3 text-center">
                      <Badge variant={STATUS_VARIANT[v.status] ?? "outline"}>{v.status}</Badge>
                      {v.status === "cancelada" && v.motivo_cancelamento && (
                        <span className="mt-1 block max-w-[14rem] truncate text-[11px] text-muted-foreground" title={v.motivo_cancelamento}>
                          {v.motivo_cancelamento}
                        </span>
                      )}
                    </td>
                    {podeCancelar && (
                      <td className="p-3 text-right">
                        {v.status === "finalizada" && (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setCancelando(v)}>
                            <Ban className="mr-1 h-4 w-4" /> Cancelar
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <CancelarVendaDialog venda={cancelando} aoFechar={() => setCancelando(null)} />
    </div>
  );
}
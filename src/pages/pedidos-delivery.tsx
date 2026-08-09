import { Card, CardContent } from "@/components/ui/card";
import { Bike, Loader2, Filter } from "lucide-react";
import { usePedidos, useUpdatePedidoStatus, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";

export function PedidosDeliveryPage() {
  const { lojaId } = useAutoSelectLoja();
  const [status, setStatus] = useState("");
  const { data: pedidos = [], isLoading } = usePedidos({ lojaId: lojaId ?? undefined, status: status || undefined });
  const update = useUpdatePedidoStatus();

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Pedidos Delivery" />;

  const STATUS_VARIANT: Record<string, "default" | "destructive" | "outline"> = {
    pendente: "outline", em_preparo: "outline", saiu_entrega: "default", entregue: "default", cancelado: "destructive",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Bike className="h-6 w-6" /> Pedidos Delivery
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{pedidos.length} pedido(s)</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <select className="h-9 rounded border border-input bg-transparent px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos status</option>
              <option value="pendente">Pendente</option>
              <option value="em_preparo">Em Preparo</option>
              <option value="saiu_entrega">Saiu p/ Entrega</option>
              <option value="entregue">Entregue</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : pedidos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum pedido encontrado</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Pedido</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono text-xs">#{p.numero_pedido ?? p.id.slice(0, 8)}</td>
                    <td className="p-3">{p.cliente_nome ?? "—"}</td>
                    <td className="p-3 text-sm">{p.created_at ? new Date(p.created_at).toLocaleString("pt-BR") : "—"}</td>
                    <td className="p-3 text-right tabular-nums">{brl(p.total ?? 0)}</td>
                    <td className="p-3 text-center"><Badge variant={STATUS_VARIANT[p.status] ?? "outline"}>{p.status}</Badge></td>
                    <td className="p-3 text-center">
                      <Button size="sm" variant="outline" onClick={() => update.mutate({ id: p.id, status: "em_preparo" })}>
                        Avançar
                      </Button>
                    </td>
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
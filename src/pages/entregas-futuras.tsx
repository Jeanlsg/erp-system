import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Loader2, Calendar as CalIcon, MapPin } from "lucide-react";
import { usePedidos, useUpdatePedidoStatus, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { date } from "@/lib/format";

export function EntregasFuturasPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: pedidos = [], isLoading } = usePedidos({ lojaId: lojaId ?? undefined });
  const updateStatus = useUpdatePedidoStatus();

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Entregas Futuras" />;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const futuras = pedidos.filter((p: any) => {
    if (!p.data_entrega_prevista) return false;
    return new Date(p.data_entrega_prevista) >= hoje && p.status !== "cancelado";
  });

  const STATUS_VARIANT: Record<string, "default" | "destructive" | "outline"> = {
    pendente: "outline", em_preparo: "outline", saiu_entrega: "default", entregue: "default", cancelado: "destructive",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Truck className="h-6 w-6" /> Entregas Futuras
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{futuras.length} entrega(s) programada(s)</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Programação de Entregas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : futuras.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma entrega programada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Pedido</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Data Prevista</th>
                  <th className="text-left p-3">Endereço</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {futuras.map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono text-xs">#{p.numero_pedido ?? p.id.slice(0, 8)}</td>
                    <td className="p-3 font-medium">{p.cliente_nome ?? "—"}</td>
                    <td className="p-3 text-sm">
                      <div className="flex items-center gap-1">
                        <CalIcon className="h-3 w-3" />
                        {p.data_entrega_prevista ? date(p.data_entrega_prevista) : "—"}
                      </div>
                    </td>
                    <td className="p-3 text-xs">
                      {p.endereco_entrega && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{p.endereco_entrega}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center"><Badge variant={STATUS_VARIANT[p.status] ?? "outline"}>{p.status}</Badge></td>
                    <td className="p-3 text-center">
                      <select
                        className="h-8 rounded border border-input bg-transparent px-2 text-xs"
                        value={p.status}
                        onChange={(e) => updateStatus.mutate({ id: p.id, status: e.target.value })}
                      >
                        <option value="pendente">Pendente</option>
                        <option value="em_preparo">Em Preparo</option>
                        <option value="saiu_entrega">Saiu p/ Entrega</option>
                        <option value="entregue">Entregue</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
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
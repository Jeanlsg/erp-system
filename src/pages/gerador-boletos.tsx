import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Barcode, Loader2 } from "lucide-react";
import { useBoletos, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";

export function GeradorBoletosPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: boletos = [], isLoading } = useBoletos({ lojaId: lojaId ?? undefined });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Gerador de Boletos" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Barcode className="h-6 w-6" /> Gerador de Boletos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{boletos.length} boleto(s) emitido(s)</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Emitidos</p><p className="text-2xl font-semibold">{boletos.filter((b: any) => b.status === "emitido").length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Vencidos</p><p className="text-2xl font-semibold text-red-600">{boletos.filter((b: any) => b.status === "vencido" || (b.status === "emitido" && new Date(b.data_vencimento) < new Date())).length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Pagos</p><p className="text-2xl font-semibold text-green-600">{boletos.filter((b: any) => b.status === "pago").length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Boletos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : boletos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum boleto emitido</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nosso Número</th>
                  <th className="text-left p-3">Vencimento</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-right p-3">Pago</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {boletos.map((b: any) => (
                  <tr key={b.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono text-xs">{b.nosso_numero ?? "—"}</td>
                    <td className="p-3 text-sm">{b.data_vencimento ? date(b.data_vencimento) : "—"}</td>
                    <td className="p-3 text-right tabular-nums">{brl(b.valor)}</td>
                    <td className="p-3 text-right tabular-nums">{brl(b.valor_pago)}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{b.status}</Badge></td>
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
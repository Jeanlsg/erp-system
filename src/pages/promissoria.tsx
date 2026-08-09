import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2 } from "lucide-react";
import { usePromissorias, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";

export function PromissoriaPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: promissorias = [], isLoading } = usePromissorias({ lojaId: lojaId ?? undefined });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Promissórias" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6" /> Promissórias
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{promissorias.length} promissória(s)</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Promissórias Emitidas/Recebidas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : promissorias.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma promissória cadastrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Número</th>
                  <th className="text-left p-3">Vencimento</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {promissorias.map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-accent">
                    <td className="p-3"><Badge variant={p.tipo === "emitida" ? "outline" : "default"}>{p.tipo}</Badge></td>
                    <td className="p-3 font-mono text-xs">{p.numero ?? "—"}</td>
                    <td className="p-3 text-sm">{p.data_vencimento ? date(p.data_vencimento) : "—"}</td>
                    <td className="p-3 text-right tabular-nums">{brl(p.valor)}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{p.status}</Badge></td>
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
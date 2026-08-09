import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Loader2 } from "lucide-react";
import { useMalaDireta, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";

export function MalaDiretaPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: campanhas = [], isLoading } = useMalaDireta(lojaId ?? undefined);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Mala Direta" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Mail className="h-6 w-6" /> Mala Direta
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{campanhas.length} campanha(s)</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Campanhas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : campanhas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma campanha cadastrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Descrição</th>
                  <th className="text-left p-3">Data Envio</th>
                  <th className="text-right p-3">Destinatários</th>
                  <th className="text-right p-3">Custo</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {campanhas.map((c: any) => (
                  <tr key={c.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{c.nome}</td>
                    <td className="p-3 text-sm">{c.descricao ?? "—"}</td>
                    <td className="p-3 text-sm">{c.data_envio ? date(c.data_envio) : "—"}</td>
                    <td className="p-3 text-right tabular-nums">{c.total_destinatarios ?? 0}</td>
                    <td className="p-3 text-right tabular-nums">{brl(c.custo_total ?? 0)}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{c.status}</Badge></td>
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
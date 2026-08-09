import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Loader2 } from "lucide-react";
import { useTorpedos, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";

export function TorpedosPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: torpedos = [], isLoading } = useTorpedos(lojaId ?? undefined);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Torpedos SMS" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-6 w-6" /> Torpedos SMS
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{torpedos.length} campanha(s)</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Campanhas SMS</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : torpedos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma campanha SMS cadastrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Mensagem</th>
                  <th className="text-right p-3">Destinatários</th>
                  <th className="text-right p-3">Enviados</th>
                  <th className="text-right p-3">Custo</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {torpedos.map((t: any) => (
                  <tr key={t.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{t.nome}</td>
                    <td className="p-3 text-sm line-clamp-1">{t.mensagem ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{t.total_destinatarios ?? 0}</td>
                    <td className="p-3 text-right tabular-nums">{t.total_enviados ?? 0}</td>
                    <td className="p-3 text-right tabular-nums">{brl(t.custo_total ?? 0)}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{t.status}</Badge></td>
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
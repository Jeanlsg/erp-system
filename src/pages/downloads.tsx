import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Barcode, Loader2 } from "lucide-react";
import { useDownloads, isSupabaseConfigured } from "@/lib/supabase-queries";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { Badge } from "@/components/ui/badge";

export function DownloadsPage() {
  const { data: downloads = [], isLoading } = useDownloads();

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Downloads" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Barcode className="h-6 w-6" /> Downloads
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{downloads.length} arquivo(s) disponível(is)</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Arquivos para Download</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : downloads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum download disponível</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-center p-3">Categoria</th>
                  <th className="text-center p-3">Versão</th>
                  <th className="text-center p-3">Downloads</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {downloads.map((d: any) => (
                  <tr key={d.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{d.nome}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{d.categoria}</Badge></td>
                    <td className="p-3 text-center text-xs">{d.versao ?? "—"}</td>
                    <td className="p-3 text-center tabular-nums">{d.download_count ?? 0}</td>
                    <td className="p-3 text-center">
                      {d.url_externa && <a href={d.url_externa} target="_blank" rel="noopener" className="text-blue-600 hover:underline text-xs">Baixar</a>}
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
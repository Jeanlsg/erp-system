import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store, Loader2 } from "lucide-react";
import { useLojas, isSupabaseConfigured } from "@/lib/supabase-queries";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";

export function LojasPage() {
  const { data: lojas = [], isLoading } = useLojas();

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Lojas" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Store className="h-6 w-6" /> Lojas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{lojas.length} loja(s) cadastrada(s)</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Lojas/Filiais</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : lojas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma loja cadastrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Apelido</th>
                  <th className="text-left p-3">CNPJ</th>
                  <th className="text-center p-3">Tipo</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {lojas.map((l) => (
                  <tr key={l.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{l.nome}</td>
                    <td className="p-3">{l.apelido}</td>
                    <td className="p-3 font-mono text-xs">{l.cnpj ?? "—"}</td>
                    <td className="p-3 text-center"><Badge variant={l.matriz ? "default" : "outline"}>{l.matriz ? "Matriz" : "Filial"}</Badge></td>
                    <td className="p-3 text-center"><Badge variant={l.ativo ? "default" : "outline"}>{l.ativo ? "Ativa" : "Inativa"}</Badge></td>
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
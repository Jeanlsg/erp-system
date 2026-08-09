import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Loader2 } from "lucide-react";
import { useCartoesFidelidade, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { date } from "@/lib/format";

export function CartaoFidelidadePage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: cartoes = [], isLoading } = useCartoesFidelidade(lojaId ?? undefined);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Cartão Fidelidade" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <CreditCard className="h-6 w-6" /> Cartão Fidelidade
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{cartoes.length} cartão(ões) emitido(s)</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Cartões Emitidos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : cartoes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum cartão emitido</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Número</th>
                  <th className="text-left p-3">Cliente ID</th>
                  <th className="text-center p-3">Pontos</th>
                  <th className="text-center p-3">Nível</th>
                  <th className="text-left p-3">Validade</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {cartoes.map((c: any) => (
                  <tr key={c.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono text-xs">{c.numero_cartao}</td>
                    <td className="p-3 text-xs">{c.cliente_id?.slice(0, 8)}...</td>
                    <td className="p-3 text-center tabular-nums font-semibold">{c.saldo_pontos ?? 0}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{c.nivel}</Badge></td>
                    <td className="p-3 text-sm">{c.data_validade ? date(c.data_validade) : "—"}</td>
                    <td className="p-3 text-center"><Badge variant={c.ativo ? "default" : "outline"}>{c.ativo ? "Ativo" : "Inativo"}</Badge></td>
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
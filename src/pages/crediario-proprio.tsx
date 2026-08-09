import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Loader2 } from "lucide-react";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export function CrediarioProprioPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: contratos = [], isLoading } = useQuery<any[]>({
    queryKey: ["erp_crediario_parcelas", lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let q = supabase.from("erp_crediario_parcelas").select("*").order("data_primeira_parcela", { ascending: false });
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Crediário Próprio" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <CreditCard className="h-6 w-6" /> Crediário Próprio
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{contratos.length} contrato(s) ativo(s)</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Contratos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : contratos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum contrato cadastrado</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Contrato</th>
                  <th className="text-center p-3">Parcelas</th>
                  <th className="text-right p-3">Valor Total</th>
                  <th className="text-left p-3">1ª Parcela</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((c: any) => (
                  <tr key={c.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono text-xs">{c.numero_contrato ?? c.id.slice(0, 8)}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{c.numero_parcelas}x</Badge></td>
                    <td className="p-3 text-right tabular-nums">{brl(c.valor_total)}</td>
                    <td className="p-3 text-sm">{c.data_primeira_parcela ? date(c.data_primeira_parcela) : "—"}</td>
                    <td className="p-3 text-center"><Badge variant={c.status === "ativo" ? "default" : "outline"}>{c.status}</Badge></td>
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
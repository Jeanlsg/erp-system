import { Card, CardContent } from "@/components/ui/card";
import { Send, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function DevolucoesPage() {
  const { data: devolucoes = [], isLoading } = useQuery<any[]>({
    queryKey: ["erp_devolucoes"],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase.from("erp_vendas").select("id, numero_pedido, total, data_venda, status").eq("status", "devolvida").order("data_venda", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Devoluções" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Send className="h-6 w-6" /> Devoluções
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{devolucoes.length} devolução(ões) registrada(s)</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : devolucoes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma devolução registrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nº</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {devolucoes.map((v: any) => (
                  <tr key={v.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono">#{v.numero_pedido ?? v.id.slice(0, 8)}</td>
                    <td className="p-3 text-sm">{v.data_venda ? date(v.data_venda) : "—"}</td>
                    <td className="p-3 text-right tabular-nums">{brl(v.total)}</td>
                    <td className="p-3 text-center"><Badge variant="outline">Devolvida</Badge></td>
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
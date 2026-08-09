import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Filter } from "lucide-react";
import { useNotasFiscais, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";

export function NotasFiscaisPage() {
  const { lojaId } = useAutoSelectLoja();
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const { data: notas = [], isLoading } = useNotasFiscais({
    lojaId: lojaId ?? undefined,
    tipo: filtroTipo || undefined,
    status: filtroStatus || undefined,
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Notas Fiscais" />;

  const STATUS_VARIANT: Record<string, "default" | "destructive" | "outline"> = {
    autorizada: "default", cancelada: "destructive", denegada: "destructive", rejeitada: "destructive",
  };

  const total = notas.reduce((s, n: any) => s + Number(n.valor_total ?? 0), 0);
  const autorizadas = notas.filter((n: any) => n.status === "autorizada").length;
  const canceladas = notas.filter((n: any) => n.status === "cancelada").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6" /> Notas Fiscais
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{notas.length} nota(s) emitida(s)</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total Emitidas</p><p className="text-2xl font-semibold">{notas.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Autorizadas</p><p className="text-2xl font-semibold text-green-600">{autorizadas}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Canceladas</p><p className="text-2xl font-semibold text-red-600">{canceladas}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Valor Total</p><p className="text-2xl font-semibold">{brl(total)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4" />
            <select className="h-9 rounded border border-input bg-transparent px-2 text-sm" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Todos tipos</option>
              <option value="nfe">NF-e</option>
              <option value="nfce">NFC-e</option>
              <option value="cfe">CF-e</option>
            </select>
            <select className="h-9 rounded border border-input bg-transparent px-2 text-sm" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos status</option>
              <option value="autorizada">Autorizada</option>
              <option value="cancelada">Cancelada</option>
              <option value="denegada">Denegada</option>
              <option value="rejeitada">Rejeitada</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : notas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma nota encontrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Número</th>
                  <th className="text-center p-3">Tipo</th>
                  <th className="text-left p-3">Data Emissão</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {notas.map((n: any) => (
                  <tr key={n.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono text-xs">{n.numero ?? "—"}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{n.tipo?.toUpperCase()}</Badge></td>
                    <td className="p-3 text-sm">{n.data_emissao ? date(n.data_emissao) : "—"}</td>
                    <td className="p-3 text-sm">{n.consumidor_nome ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{brl(n.valor_total ?? 0)}</td>
                    <td className="p-3 text-center"><Badge variant={STATUS_VARIANT[n.status] ?? "outline"}>{n.status}</Badge></td>
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
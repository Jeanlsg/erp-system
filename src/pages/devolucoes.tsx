import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useRegistrarDevolucao } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function DevolucoesPage() {
  const { lojaId } = useAutoSelectLoja();
  const registrar = useRegistrarDevolucao();
  const [modalAberto, setModalAberto] = useState(false);
  const [vendaId, setVendaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [estornar, setEstornar] = useState(true);

  const { data: devolucoes = [], isLoading } = useQuery<any[]>({
    queryKey: ["erp_devolucoes"],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase.from("erp_vendas").select("id, numero_pedido, total, data_venda, status, observacoes").eq("status", "devolvida").order("data_venda", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: vendasFinalizadas = [] } = useQuery<any[]>({
    queryKey: ["erp_vendas_finalizadas_devolucao", lojaId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      let q = supabase.from("erp_vendas").select("id, numero_pedido, total, data_venda").eq("status", "finalizada").order("data_venda", { ascending: false }).limit(100);
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: modalAberto,
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Devoluções" />;

  const handleRegistrar = async () => {
    if (!vendaId) return;
    await registrar.mutateAsync({ vendaId, motivo: motivo ? `Devolução: ${motivo}` : undefined, estornarEstoque: estornar, lojaId: lojaId ?? undefined });
    setModalAberto(false);
    setVendaId(""); setMotivo("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Send className="h-6 w-6" /> Devoluções
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{devolucoes.length} devolução(ões) registrada(s)</p>
        </div>
        <Button onClick={() => setModalAberto(true)}><Plus className="mr-2 h-4 w-4" /> Registrar Devolução</Button>
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
                  <th className="text-left p-3">Motivo</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {devolucoes.map((v: any) => (
                  <tr key={v.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono">#{v.numero_pedido ?? v.id.slice(0, 8)}</td>
                    <td className="p-3 text-sm">{v.data_venda ? date(v.data_venda) : "—"}</td>
                    <td className="p-3 text-sm text-muted-foreground">{v.observacoes ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{brl(v.total)}</td>
                    <td className="p-3 text-center"><Badge variant="outline">Devolvida</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Devolução</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Venda *</Label>
              <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={vendaId} onChange={(e) => setVendaId(e.target.value)}>
                <option value="">Selecione a venda finalizada...</option>
                {vendasFinalizadas.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    #{v.numero_pedido ?? v.id.slice(0, 8)} — {date(v.data_venda)} — {brl(v.total)}
                  </option>
                ))}
              </select>
            </div>
            <div><Label>Motivo</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Produto com defeito, arrependimento..." /></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={estornar} onChange={(e) => setEstornar(e.target.checked)} />
              Estornar itens ao estoque
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleRegistrar} disabled={registrar.isPending || !vendaId}>
              {registrar.isPending ? "Registrando..." : "Confirmar Devolução"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

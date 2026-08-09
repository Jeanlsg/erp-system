import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Plus, Loader2, Trash2 } from "lucide-react";
import { useRegioesEntrega, useCreateRegiao, useDeleteRegiao, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";

export function RegioesEntregaPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: regioes = [], isLoading } = useRegioesEntrega(lojaId ?? undefined);
  const create = useCreateRegiao();
  const del = useDeleteRegiao();
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cep_inicio: "",
    cep_fim: "",
    bairros: "",
    taxa: "",
    prazo_dias: "1",
    valor_minimo: "",
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Regiões de Entrega" />;

  const handleCriar = async () => {
    if (!form.nome) return;
    await create.mutateAsync({
      loja_id: lojaId ?? null,
      nome: form.nome,
      cep_inicio: form.cep_inicio || null,
      cep_fim: form.cep_fim || null,
      bairros: form.bairros ? form.bairros.split(",").map((b) => b.trim()) : null,
      taxa: parseFloat(form.taxa) || 0,
      prazo_dias: parseInt(form.prazo_dias) || null,
      valor_minimo: form.valor_minimo ? parseFloat(form.valor_minimo) : null,
      ativo: true,
    });
    setModalAberto(false);
    setForm({ nome: "", cep_inicio: "", cep_fim: "", bairros: "", taxa: "", prazo_dias: "1", valor_minimo: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6" /> Regiões de Entrega
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{regioes.length} região(ões) cadastrada(s)</p>
        </div>
        <Button onClick={() => setModalAberto(true)}><Plus className="mr-2 h-4 w-4" /> Nova Região</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Zonas de Entrega</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : regioes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma região cadastrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Faixa de CEP</th>
                  <th className="text-right p-3">Taxa</th>
                  <th className="text-right p-3">Mínimo</th>
                  <th className="text-center p-3">Prazo</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {regioes.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{r.nome}</td>
                    <td className="p-3 text-sm font-mono">
                      {r.cep_inicio && r.cep_fim ? `${r.cep_inicio} - ${r.cep_fim}` : "—"}
                      {(r.bairros ?? []).length > 0 && <div className="text-xs text-muted-foreground">{(r.bairros ?? []).slice(0, 3).join(", ")}{(r.bairros ?? []).length > 3 ? "…" : ""}</div>}
                    </td>
                    <td className="p-3 text-right tabular-nums font-semibold">{brl(r.taxa)}</td>
                    <td className="p-3 text-right tabular-nums">{r.valor_minimo ? brl(r.valor_minimo) : "—"}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{r.prazo_dias ?? "—"} dia(s)</Badge></td>
                    <td className="p-3 text-center">
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir?")) del.mutate(r.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Região de Entrega</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Centro" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CEP Início</Label><Input value={form.cep_inicio} onChange={(e) => setForm({ ...form, cep_inicio: e.target.value })} placeholder="00000-000" /></div>
              <div><Label>CEP Fim</Label><Input value={form.cep_fim} onChange={(e) => setForm({ ...form, cep_fim: e.target.value })} placeholder="99999-999" /></div>
            </div>
            <div><Label>Bairros (separados por vírgula)</Label><Input value={form.bairros} onChange={(e) => setForm({ ...form, bairros: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Taxa (R$)</Label><Input type="number" step="0.01" value={form.taxa} onChange={(e) => setForm({ ...form, taxa: e.target.value })} /></div>
              <div><Label>Pedido Mínimo</Label><Input type="number" step="0.01" value={form.valor_minimo} onChange={(e) => setForm({ ...form, valor_minimo: e.target.value })} /></div>
              <div><Label>Prazo (dias)</Label><Input type="number" value={form.prazo_dias} onChange={(e) => setForm({ ...form, prazo_dias: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={create.isPending || !form.nome}>{create.isPending ? "Salvando..." : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
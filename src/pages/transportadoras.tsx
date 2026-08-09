import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Plus, Search, Loader2, Trash2 } from "lucide-react";
import { useTransportadoras, useCreateTransportadora, useDeleteTransportadora, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";

export function TransportadorasPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: transportadoras = [], isLoading } = useTransportadoras(lojaId ?? undefined);
  const create = useCreateTransportadora();
  const del = useDeleteTransportadora();
  const [search, setSearch] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    prazo_entrega_dias: "3",
    valor_fixo: "",
    valor_kg: "",
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Transportadoras" />;

  const filtrados = transportadoras.filter((t) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return t.nome.toLowerCase().includes(s) || (t.cnpj ?? "").includes(s);
  });

  const handleCriar = async () => {
    if (!form.nome) return;
    await create.mutateAsync({
      loja_id: lojaId ?? null,
      nome: form.nome,
      cnpj: form.cnpj || null,
      prazo_entrega_dias: parseInt(form.prazo_entrega_dias) || null,
      valor_fixo: form.valor_fixo ? parseFloat(form.valor_fixo) : null,
      valor_kg: form.valor_kg ? parseFloat(form.valor_kg) : null,
      ativo: true,
    });
    setModalAberto(false);
    setForm({ nome: "", cnpj: "", prazo_entrega_dias: "3", valor_fixo: "", valor_kg: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6" /> Transportadoras
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{transportadoras.length} cadastrada(s)</p>
        </div>
        <Button onClick={() => setModalAberto(true)}><Plus className="mr-2 h-4 w-4" /> Nova Transportadora</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou CNPJ..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Lista de Transportadoras</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : filtrados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma transportadora cadastrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">CNPJ</th>
                  <th className="text-center p-3">Prazo (dias)</th>
                  <th className="text-right p-3">Valor Fixo</th>
                  <th className="text-right p-3">Por Kg</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{t.nome}</td>
                    <td className="p-3 font-mono text-xs">{t.cnpj ?? "—"}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{t.prazo_entrega_dias ?? "—"}</Badge></td>
                    <td className="p-3 text-right tabular-nums">{t.valor_fixo ? brl(t.valor_fixo) : "—"}</td>
                    <td className="p-3 text-right tabular-nums">{t.valor_kg ? brl(t.valor_kg) : "—"}</td>
                    <td className="p-3 text-center">
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir?")) del.mutate(t.id); }}>
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
          <DialogHeader><DialogTitle>Nova Transportadora</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Prazo (dias)</Label><Input type="number" value={form.prazo_entrega_dias} onChange={(e) => setForm({ ...form, prazo_entrega_dias: e.target.value })} /></div>
              <div><Label>Valor Fixo</Label><Input type="number" step="0.01" value={form.valor_fixo} onChange={(e) => setForm({ ...form, valor_fixo: e.target.value })} /></div>
              <div><Label>R$/Kg</Label><Input type="number" step="0.01" value={form.valor_kg} onChange={(e) => setForm({ ...form, valor_kg: e.target.value })} /></div>
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
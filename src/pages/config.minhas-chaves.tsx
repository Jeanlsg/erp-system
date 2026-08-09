import { Card, CardContent } from "@/components/ui/card";
import { Key, Loader2, Plus, Trash2 } from "lucide-react";
import { useChavesPix, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

export function ConfigChavesPixPage() {
  const { lojaId } = useAutoSelectLoja();
  const qc = useQueryClient();
  const { data: chaves = [], isLoading } = useChavesPix(lojaId ?? undefined);
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ tipo: "cpf", chave: "", titular: "", banco: "" });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Minhas Chaves PIX" />;

  const handleCriar = async () => {
    if (!lojaId || !form.chave || !form.titular) return;
    await supabase.from("erp_chaves_pix").insert({ loja_id: lojaId, ...form, ativo: true });
    setModalAberto(false);
    setForm({ tipo: "cpf", chave: "", titular: "", banco: "" });
    qc.invalidateQueries({ queryKey: ["erp_chaves-pix"] });
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Excluir chave?")) return;
    await supabase.from("erp_chaves_pix").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["erp_chaves-pix"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Key className="h-6 w-6" /> Minhas Chaves PIX
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{chaves.length} chave(s) cadastrada(s)</p>
        </div>
        <Button onClick={() => setModalAberto(true)}><Plus className="mr-2 h-4 w-4" /> Nova Chave</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> :
          chaves.length === 0 ? <p className="col-span-full text-center text-muted-foreground py-8">Nenhuma chave cadastrada</p> :
          chaves.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">{c.tipo.toUpperCase()}</Badge>
                  {c.principal && <Badge>Principal</Badge>}
                </div>
                <p className="font-mono text-sm break-all">{c.chave}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.titular}</p>
                {c.banco && <p className="text-xs text-muted-foreground">{c.banco}</p>}
                <Button variant="ghost" size="sm" className="mt-2 text-destructive" onClick={() => handleExcluir(c.id)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Excluir
                </Button>
              </CardContent>
            </Card>
          ))
        }
      </div>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Chave PIX</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">Email</option>
                <option value="telefone">Telefone</option>
                <option value="aleatoria">Aleatória</option>
              </select>
            </div>
            <div><Label>Chave</Label><Input value={form.chave} onChange={(e) => setForm({ ...form, chave: e.target.value })} /></div>
            <div><Label>Titular</Label><Input value={form.titular} onChange={(e) => setForm({ ...form, titular: e.target.value })} /></div>
            <div><Label>Banco</Label><Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={!form.chave || !form.titular}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
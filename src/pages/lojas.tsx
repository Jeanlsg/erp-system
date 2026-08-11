import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Store, Loader2, Plus, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useLojas, useCreateLoja, useUpdateLoja, isSupabaseConfigured } from "@/lib/supabase-queries";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import type { Loja } from "@/types/database";

const FORM_VAZIO = { nome: "", apelido: "", cnpj: "", telefone: "", email: "", cidade: "", uf: "", matriz: false };

export function LojasPage() {
  const { data: lojas = [], isLoading } = useLojas();
  const create = useCreateLoja();
  const update = useUpdateLoja();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Loja | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Lojas" />;

  const abrirNovo = () => { setEditando(null); setForm(FORM_VAZIO); setModalAberto(true); };
  const abrirEdicao = (l: Loja) => {
    setEditando(l);
    setForm({
      nome: l.nome, apelido: l.apelido, cnpj: l.cnpj ?? "", telefone: l.telefone ?? "",
      email: l.email ?? "", cidade: l.cidade ?? "", uf: l.uf ?? "", matriz: l.matriz,
    });
    setModalAberto(true);
  };

  const handleSalvar = async () => {
    if (!form.nome || !form.apelido) return;
    const payload = {
      nome: form.nome, apelido: form.apelido, cnpj: form.cnpj || null, telefone: form.telefone || null,
      email: form.email || null, cidade: form.cidade || null, uf: form.uf || null, matriz: form.matriz,
    };
    if (editando) await update.mutateAsync({ id: editando.id, ...payload } as any);
    else await create.mutateAsync({ ...payload, ativo: true } as any);
    setModalAberto(false);
  };

  const salvando = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Store className="h-6 w-6" /> Lojas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{lojas.length} loja(s) cadastrada(s)</p>
        </div>
        <Button onClick={abrirNovo}><Plus className="mr-2 h-4 w-4" /> Nova Loja</Button>
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
                  <th className="text-left p-3">Cidade</th>
                  <th className="text-center p-3">Tipo</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lojas.map((l) => (
                  <tr key={l.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{l.nome}</td>
                    <td className="p-3">{l.apelido}</td>
                    <td className="p-3 font-mono text-xs">{l.cnpj ?? "—"}</td>
                    <td className="p-3 text-sm">{l.cidade ? `${l.cidade}${l.uf ? `/${l.uf}` : ""}` : "—"}</td>
                    <td className="p-3 text-center"><Badge variant={l.matriz ? "default" : "outline"}>{l.matriz ? "Matriz" : "Filial"}</Badge></td>
                    <td className="p-3 text-center"><Badge variant={l.ativo ? "default" : "outline"}>{l.ativo ? "Ativa" : "Inativa"}</Badge></td>
                    <td className="p-3 text-center">
                      <Button variant="ghost" size="icon" onClick={() => abrirEdicao(l)} title="Editar"><Pencil className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{editando ? "Editar Loja" : "Nova Loja"}</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div><Label>Apelido *</Label><Input value={form.apelido} onChange={(e) => setForm({ ...form, apelido: e.target.value })} /></div>
            </div>
            <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <div><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
              <div><Label>UF</Label><Input maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.matriz} onChange={(e) => setForm({ ...form, matriz: e.target.checked })} />
              Esta loja é a matriz
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando || !form.nome || !form.apelido}>
              {salvando ? "Salvando..." : editando ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

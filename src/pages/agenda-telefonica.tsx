import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Plus, Search, Loader2, Trash2, Phone, Mail, MessageSquare } from "lucide-react";
import { useContatos, useCreateContato, useDeleteContato, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { useAuth } from "@/lib/store/auth-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";

export function AgendaTelefonicaPage() {
  const { user } = useAuth();
  const { lojaId } = useAutoSelectLoja();
  const { data: contatos = [], isLoading } = useContatos(lojaId ?? undefined);
  const create = useCreateContato();
  const del = useDeleteContato();
  const [search, setSearch] = useState("");
  const [filtroCat, setFiltroCat] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    empresa: "",
    cargo: "",
    categoria: "cliente",
    email: "",
    telefone: "",
    celular: "",
    whatsapp: "",
    favorito: false,
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Agenda Telefônica" />;

  const cats = Array.from(new Set(contatos.map((c) => c.categoria).filter(Boolean)));

  const filtrados = contatos.filter((c) => {
    if (filtroCat && c.categoria !== filtroCat) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return c.nome.toLowerCase().includes(s) ||
      (c.empresa ?? "").toLowerCase().includes(s) ||
      (c.email ?? "").toLowerCase().includes(s);
  });

  const handleCriar = async () => {
    if (!form.nome) return;
    await create.mutateAsync({
      loja_id: lojaId ?? null,
      usuario_id: user?.id ?? null,
      ...form,
    });
    setModalAberto(false);
    setForm({ nome: "", empresa: "", cargo: "", categoria: "cliente", email: "", telefone: "", celular: "", whatsapp: "", favorito: false });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6" /> Agenda Telefônica
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{contatos.length} contato(s) · {cats.length} categoria(s)</p>
        </div>
        <Button onClick={() => setModalAberto(true)}><Plus className="mr-2 h-4 w-4" /> Novo Contato</Button>
      </div>

      <div className="flex gap-2 max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, empresa ou email..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select
          className="flex h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          value={filtroCat}
          onChange={(e) => setFiltroCat(e.target.value)}
        >
          <option value="">Todas categorias</option>
          {cats.map((c) => <option key={String(c)} value={String(c)}>{String(c)}</option>)}
        </select>
      </div>

      <Card>
        <CardHeader><CardTitle>Contatos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : filtrados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum contato encontrado</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Empresa/Cargo</th>
                  <th className="text-left p-3">Contato</th>
                  <th className="text-center p-3">Categoria</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-accent">
                    <td className="p-3">
                      <p className="font-medium">{c.nome}</p>
                      {c.favorito && <Badge variant="default" className="mt-1 text-[10px]">★ Favorito</Badge>}
                    </td>
                    <td className="p-3 text-sm">
                      <div>{c.empresa ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.cargo ?? ""}</div>
                    </td>
                    <td className="p-3 text-xs space-y-1">
                      {c.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</div>}
                      {c.telefone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.telefone}</div>}
                      {c.celular && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.celular}</div>}
                      {c.whatsapp && <div className="flex items-center gap-1 text-green-600"><MessageSquare className="h-3 w-3" />{c.whatsapp}</div>}
                    </td>
                    <td className="p-3 text-center"><Badge variant="outline">{c.categoria ?? "—"}</Badge></td>
                    <td className="p-3 text-center">
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir?")) del.mutate(c.id); }}>
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
          <DialogHeader><DialogTitle>Novo Contato</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Empresa</Label><Input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} /></div>
              <div><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
            </div>
            <div>
              <Label>Categoria</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                <option value="cliente">Cliente</option>
                <option value="fornecedor">Fornecedor</option>
                <option value="funcionario">Funcionário</option>
                <option value="parceiro">Parceiro</option>
                <option value="pessoal">Pessoal</option>
              </select>
            </div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              <div><Label>Celular</Label><Input value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} /></div>
              <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
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
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Truck, Plus, Search, Phone, Mail, Loader2, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useFornecedores, useCreatePessoa, useUpdatePessoa, useDeletePessoa, isSupabaseConfigured } from "@/lib/supabase-queries";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import type { Pessoa } from "@/types/database";

const FORM_VAZIO = { tipo: "juridica" as "fisica" | "juridica", nome_razao: "", nome_fantasia: "", cpf_cnpj: "", email: "", telefone: "" };

export function FornecedoresPage() {
  const { data: pessoas = [], isLoading } = useFornecedores();
  const create = useCreatePessoa();
  const update = useUpdatePessoa();
  const del = useDeletePessoa();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Pessoa | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);

  const abrirNovo = () => { setEditando(null); setForm(FORM_VAZIO); setModalAberto(true); };
  const abrirEdicao = (p: Pessoa) => {
    setEditando(p);
    setForm({ tipo: p.tipo, nome_razao: p.nome_razao, nome_fantasia: p.nome_fantasia ?? "", cpf_cnpj: p.cpf_cnpj ?? "", email: p.email ?? "", telefone: p.telefone ?? "" });
    setModalAberto(true);
  };
  const handleSalvar = async () => {
    if (!form.nome_razao) return;
    const payload = {
      tipo: form.tipo, nome_razao: form.nome_razao, nome_fantasia: form.nome_fantasia || null,
      cpf_cnpj: form.cpf_cnpj || null, email: form.email || null, telefone: form.telefone || null,
    };
    if (editando) await update.mutateAsync({ id: editando.id, ...payload } as any);
    else await create.mutateAsync({ ...payload, ativo: true } as any);
    setModalAberto(false);
  };
  const salvando = create.isPending || update.isPending;

  if (!isSupabaseConfigured()) {
    return <SupabaseNotConfigured title="Fornecedores" />;
  }

  const filtrados = pessoas.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.nome_razao.toLowerCase().includes(s) ||
      (p.cpf_cnpj ?? "").toLowerCase().includes(s) ||
      (p.email ?? "").toLowerCase().includes(s)
    );
  });

  const toggleAll = () => {
    if (selected.length === filtrados.length) setSelected([]);
    else setSelected(filtrados.map((p) => p.id));
  };

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6" /> Fornecedores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pessoas.length} fornecedor(es) cadastrado(s)
          </p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="mr-2 h-4 w-4" /> Novo Fornecedor
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ ou email..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {selected.length > 0 && (
          <Badge variant="default">{selected.length} selecionado(s)</Badge>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Carregando fornecedores...
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left p-3 w-10">
                    <Checkbox checked={selected.length === filtrados.length && filtrados.length > 0} onCheckedChange={toggleAll} />
                  </th>
                  <th className="text-left p-3">Fornecedor</th>
                  <th className="text-left p-3">CNPJ</th>
                  <th className="text-left p-3">Contato</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum fornecedor encontrado
                    </td>
                  </tr>
                ) : (
                  filtrados.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-accent">
                      <td className="p-3">
                        <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{p.nome_razao}</div>
                        {p.nome_fantasia && (
                          <div className="text-xs text-muted-foreground">{p.nome_fantasia}</div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-xs">{p.cpf_cnpj ?? "—"}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-sm">
                          {p.email && <Mail className="h-3 w-3 text-muted-foreground" />}
                          <span>{p.email ?? "—"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {p.telefone && <Phone className="h-3 w-3" />}
                          <span>{p.telefone ?? p.celular ?? "—"}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{p.tipo.toUpperCase()}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={p.ativo ? "default" : "outline"}>
                          {p.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => abrirEdicao(p)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Excluir"
                          onClick={() => { if (confirm(`Excluir o fornecedor "${p.nome_razao}"?`)) del.mutate(p.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button type="button" variant={form.tipo === "juridica" ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, tipo: "juridica" })}>Pessoa Jurídica</Button>
              <Button type="button" variant={form.tipo === "fisica" ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, tipo: "fisica" })}>Pessoa Física</Button>
            </div>
            <div><Label>{form.tipo === "juridica" ? "Razão Social *" : "Nome *"}</Label><Input value={form.nome_razao} onChange={(e) => setForm({ ...form, nome_razao: e.target.value })} /></div>
            {form.tipo === "juridica" && (
              <div><Label>Nome Fantasia</Label><Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} /></div>
            )}
            <div><Label>{form.tipo === "juridica" ? "CNPJ" : "CPF"}</Label><Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando || !form.nome_razao}>
              {salvando ? "Salvando..." : editando ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
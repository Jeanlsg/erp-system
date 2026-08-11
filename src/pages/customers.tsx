import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Plus, Search, Loader2, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useClientes, useCreatePessoa, useUpdatePessoa, useDeletePessoa, isSupabaseConfigured } from "@/lib/supabase-queries";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import type { Pessoa } from "@/types/database";

const FORM_VAZIO = { tipo: "fisica" as "fisica" | "juridica", nome_razao: "", cpf_cnpj: "", email: "", telefone: "", celular: "" };

export function CustomersPage() {
  const { data: clientes = [], isLoading } = useClientes();
  const create = useCreatePessoa();
  const update = useUpdatePessoa();
  const del = useDeletePessoa();
  const [search, setSearch] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Pessoa | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);

  if (!isSupabaseConfigured()) {
    return <SupabaseNotConfigured title="Clientes" />;
  }

  const filtrados = clientes.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.nome_razao.toLowerCase().includes(s) ||
      (c.cpf_cnpj ?? "").toLowerCase().includes(s) ||
      (c.email ?? "").toLowerCase().includes(s)
    );
  });

  const abrirNovo = () => {
    setEditando(null);
    setForm(FORM_VAZIO);
    setModalAberto(true);
  };

  const abrirEdicao = (c: Pessoa) => {
    setEditando(c);
    setForm({
      tipo: c.tipo,
      nome_razao: c.nome_razao,
      cpf_cnpj: c.cpf_cnpj ?? "",
      email: c.email ?? "",
      telefone: c.telefone ?? "",
      celular: c.celular ?? "",
    });
    setModalAberto(true);
  };

  const handleSalvar = async () => {
    if (!form.nome_razao) return;
    const payload = {
      tipo: form.tipo,
      nome_razao: form.nome_razao,
      cpf_cnpj: form.cpf_cnpj || null,
      email: form.email || null,
      telefone: form.telefone || null,
      celular: form.celular || null,
    };
    if (editando) {
      await update.mutateAsync({ id: editando.id, ...payload } as any);
    } else {
      await create.mutateAsync({ ...payload, ativo: true } as any);
    }
    setModalAberto(false);
  };

  const salvando = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" /> Clientes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clientes.length} cliente(s) cadastrado(s)
          </p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="mr-2 h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF/CNPJ ou email..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Carregando clientes...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filtrados.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell><Badge variant="outline" className="text-xs uppercase">{c.tipo === "fisica" ? "PF" : "PJ"}</Badge></TableCell>
                      <TableCell className="font-medium">{c.nome_razao}</TableCell>
                      <TableCell className="font-mono text-xs">{c.cpf_cnpj ?? "—"}</TableCell>
                      <TableCell>{c.email ?? "—"}</TableCell>
                      <TableCell>{c.telefone ?? c.celular ?? "—"}</TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => abrirEdicao(c)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Inativar"
                          onClick={() => { if (confirm(`Inativar o cliente "${c.nome_razao}"?`)) del.mutate(c.id); }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button type="button" variant={form.tipo === "fisica" ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, tipo: "fisica" })}>Pessoa Física</Button>
              <Button type="button" variant={form.tipo === "juridica" ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, tipo: "juridica" })}>Pessoa Jurídica</Button>
            </div>
            <div><Label>{form.tipo === "fisica" ? "Nome *" : "Razão Social *"}</Label><Input value={form.nome_razao} onChange={(e) => setForm({ ...form, nome_razao: e.target.value })} /></div>
            <div><Label>{form.tipo === "fisica" ? "CPF" : "CNPJ"}</Label><Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} placeholder={form.tipo === "fisica" ? "000.000.000-00" : "00.000.000/0000-00"} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              <div><Label>Celular</Label><Input value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} /></div>
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

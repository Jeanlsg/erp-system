import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Plus, Search, Loader2, UserCheck, UserX, Mail, Phone } from "lucide-react";
import { useFuncionarios, useCreateFuncionario, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";

export function FuncionariosPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: funcionarios = [], isLoading } = useFuncionarios(lojaId ?? undefined);
  const create = useCreateFuncionario();
  const [search, setSearch] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    cargo: "",
    departamento: "",
    salario: "",
    data_admissao: new Date().toISOString().slice(0, 10),
    email: "",
    telefone: "",
    comissao: "0",
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Funcionários" />;

  const filtrados = funcionarios.filter((f: any) => {
    const nome = f.pessoa?.nome_razao ?? "";
    if (!search) return true;
    const s = search.toLowerCase();
    return nome.toLowerCase().includes(s) || (f.cargo ?? "").toLowerCase().includes(s);
  });

  const ativos = funcionarios.filter((f: any) => !f.data_demissao);
  const inativos = funcionarios.filter((f: any) => f.data_demissao);

  const handleCriar = async () => {
    if (!form.nome) return;
    // 1) cria pessoa
    const pessoaInsert: any = {
      tipo: "fisica",
      cpf_cnpj: form.cpf || `sem-cpf-${Date.now()}`,
      nome_razao: form.nome,
      email: form.email || null,
      telefone: form.telefone || null,
    };
    const { data: pessoa, error: eP } = await (await import("@/lib/supabase")).supabase
      .from("erp_pessoas").insert(pessoaInsert).select().single();
    if (eP) return alert(eP.message);

    await create.mutateAsync({
      pessoa_id: pessoa.id,
      cargo: form.cargo || null,
      departamento: form.departamento || null,
      salario: form.salario ? parseFloat(form.salario) : null,
      data_admissao: form.data_admissao || null,
      cpf: form.cpf || null,
      comissao_percentual: parseFloat(form.comissao) || 0,
      gerente: false,
    });
    setModalAberto(false);
    setForm({ nome: "", cpf: "", cargo: "", departamento: "", salario: "", data_admissao: new Date().toISOString().slice(0, 10), email: "", telefone: "", comissao: "0" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Funcionários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {funcionarios.length} funcionário(s) · {ativos.length} ativos
          </p>
        </div>
        <Button onClick={() => setModalAberto(true)}>
          <Plus className="mr-2 h-4 w-4" /> Novo Funcionário
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <UserCheck className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-xs uppercase text-muted-foreground">Ativos</p>
              <p className="text-2xl font-semibold">{ativos.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <UserX className="h-8 w-8 text-gray-500" />
            <div>
              <p className="text-xs uppercase text-muted-foreground">Inativos</p>
              <p className="text-2xl font-semibold">{inativos.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Folha Mensal (estimada)</p>
            <p className="text-2xl font-semibold">
              {brl(ativos.reduce((s: number, f: any) => s + (Number(f.salario) || 0), 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou cargo..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Equipe</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : filtrados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum funcionário encontrado</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Cargo</th>
                  <th className="text-left p-3">Departamento</th>
                  <th className="text-left p-3">Contato</th>
                  <th className="text-right p-3">Salário</th>
                  <th className="text-left p-3">Admissão</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((f: any) => (
                  <tr key={f.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{f.pessoa?.nome_razao ?? "—"}</td>
                    <td className="p-3 text-sm">{f.cargo ?? "—"}</td>
                    <td className="p-3 text-sm">{f.departamento ?? "—"}</td>
                    <td className="p-3 text-xs">
                      <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{f.pessoa?.email ?? "—"}</div>
                      <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{f.pessoa?.telefone ?? "—"}</div>
                    </td>
                    <td className="p-3 text-right tabular-nums">{f.salario ? brl(f.salario) : "—"}</td>
                    <td className="p-3 text-sm">{f.data_admissao ? date(f.data_admissao) : "—"}</td>
                    <td className="p-3 text-center">
                      <Badge variant={f.data_demissao ? "outline" : "default"}>
                        {f.data_demissao ? "Inativo" : "Ativo"}
                      </Badge>
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
          <DialogHeader><DialogTitle>Novo Funcionário</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
              <div><Label>Departamento</Label><Input value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Salário</Label><Input type="number" step="0.01" value={form.salario} onChange={(e) => setForm({ ...form, salario: e.target.value })} /></div>
              <div><Label>Comissão %</Label><Input type="number" step="0.01" value={form.comissao} onChange={(e) => setForm({ ...form, comissao: e.target.value })} /></div>
              <div><Label>Admissão</Label><Input type="date" value={form.data_admissao} onChange={(e) => setForm({ ...form, data_admissao: e.target.value })} /></div>
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
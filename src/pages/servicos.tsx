import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wrench, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useServicos, useCreateServico, useUpdateServico, useDeleteServico, isSupabaseConfigured } from "@/lib/supabase-queries";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";

const FORM_VAZIO = { nome: "", descricao: "", valor: "", comissao_percentual: "" };

export function ServicosPage() {
  const { data: servicos = [], isLoading } = useServicos();
  const create = useCreateServico();
  const update = useUpdateServico();
  const del = useDeleteServico();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Serviços" />;

  const ativos = servicos.filter((s: any) => s.ativo);

  const abrirNovo = () => { setEditando(null); setForm(FORM_VAZIO); setModalAberto(true); };
  const abrirEdicao = (s: any) => {
    setEditando(s);
    setForm({ nome: s.nome, descricao: s.descricao ?? "", valor: String(s.valor ?? ""), comissao_percentual: String(s.comissao_percentual ?? "") });
    setModalAberto(true);
  };

  const handleSalvar = async () => {
    if (!form.nome || !form.valor) return;
    const payload = {
      nome: form.nome,
      descricao: form.descricao || null,
      valor: parseFloat(form.valor),
      comissao_percentual: form.comissao_percentual ? parseFloat(form.comissao_percentual) : null,
    };
    if (editando) await update.mutateAsync({ id: editando.id, ...payload });
    else await create.mutateAsync(payload);
    setModalAberto(false);
  };

  const salvando = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Wrench className="h-6 w-6" /> Serviços Oferecidos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{ativos.length} serviço(s) ativo(s)</p>
        </div>
        <Button onClick={abrirNovo}><Plus className="mr-2 h-4 w-4" /> Novo Serviço</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Catálogo de Serviços</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : servicos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum serviço cadastrado</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Serviço</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-center p-3">Comissão</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map((s: any) => (
                  <tr key={s.id} className="border-b hover:bg-accent">
                    <td className="p-3">
                      <p className="font-medium">{s.nome}</p>
                      {s.descricao && <p className="text-xs text-muted-foreground">{s.descricao}</p>}
                    </td>
                    <td className="p-3 text-right tabular-nums">{brl(s.valor)}</td>
                    <td className="p-3 text-center">{s.comissao_percentual ? `${s.comissao_percentual}%` : "—"}</td>
                    <td className="p-3 text-center"><Badge variant={s.ativo ? "default" : "outline"}>{s.ativo ? "Ativo" : "Inativo"}</Badge></td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => abrirEdicao(s)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                      {s.ativo ? (
                        <Button variant="ghost" size="icon" title="Inativar" onClick={() => { if (confirm(`Inativar o serviço "${s.nome}"?`)) del.mutate(s.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => update.mutate({ id: s.id, ativo: true })}>Reativar</Button>
                      )}
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
          <DialogHeader><DialogTitle>{editando ? "Editar Serviço" : "Novo Serviço"}</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$) *</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
              <div><Label>Comissão (%)</Label><Input type="number" step="0.1" value={form.comissao_percentual} onChange={(e) => setForm({ ...form, comissao_percentual: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando || !form.nome || !form.valor}>
              {salvando ? "Salvando..." : editando ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Plus, Search, Loader2, Trash2, Download } from "lucide-react";
import { useDocumentos, useCreateDocumento, useDeleteDocumento, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { useAuth } from "@/lib/store/auth-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { date } from "@/lib/format";

export function DocumentosPage() {
  const { user } = useAuth();
  const { lojaId } = useAutoSelectLoja();
  const { data: documentos = [], isLoading } = useDocumentos(lojaId ?? undefined);
  const create = useCreateDocumento();
  const del = useDeleteDocumento();
  const [search, setSearch] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    tipo: "contrato",
    extensao: "pdf",
    tags: "",
    data_documento: new Date().toISOString().slice(0, 10),
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Documentos" />;

  const filtrados = documentos.filter((d) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return d.nome.toLowerCase().includes(s) || (d.tipo ?? "").toLowerCase().includes(s);
  });

  const handleCriar = async () => {
    if (!form.nome) return;
    await create.mutateAsync({
      loja_id: lojaId ?? null,
      usuario_id: user?.id ?? null,
      nome: form.nome,
      descricao: form.descricao || null,
      tipo: form.tipo,
      extensao: form.extensao,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : null,
      data_documento: form.data_documento,
      publico: false,
    });
    setModalAberto(false);
    setForm({ nome: "", descricao: "", tipo: "contrato", extensao: "pdf", tags: "", data_documento: new Date().toISOString().slice(0, 10) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6" /> Documentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{documentos.length} documento(s) armazenado(s)</p>
        </div>
        <Button onClick={() => setModalAberto(true)}><Plus className="mr-2 h-4 w-4" /> Novo Documento</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou tipo..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Documentos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : filtrados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum documento encontrado</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-center p-3">Tipo</th>
                  <th className="text-center p-3">Extensão</th>
                  <th className="text-left p-3">Tags</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d) => (
                  <tr key={d.id} className="border-b hover:bg-accent">
                    <td className="p-3">
                      <p className="font-medium">{d.nome}</p>
                      {d.descricao && <p className="text-xs text-muted-foreground">{d.descricao}</p>}
                    </td>
                    <td className="p-3 text-center"><Badge variant="outline">{d.tipo ?? "—"}</Badge></td>
                    <td className="p-3 text-center text-xs uppercase">{d.extensao ?? "—"}</td>
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        {(d.tags ?? []).map((t: string) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                      </div>
                    </td>
                    <td className="p-3 text-sm">{d.data_documento ? date(d.data_documento) : "—"}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {d.storage_path && (
                          <Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir?")) del.mutate(d.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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
          <DialogHeader><DialogTitle>Novo Documento</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tipo</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                  <option value="contrato">Contrato</option>
                  <option value="recibo">Recibo</option>
                  <option value="nota">Nota</option>
                  <option value="pdf">PDF</option>
                  <option value="imagem">Imagem</option>
                  <option value="planilha">Planilha</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <Label>Extensão</Label>
                <Input value={form.extensao} onChange={(e) => setForm({ ...form, extensao: e.target.value })} />
              </div>
              <div><Label>Data</Label><Input type="date" value={form.data_documento} onChange={(e) => setForm({ ...form, data_documento: e.target.value })} /></div>
            </div>
            <div><Label>Tags (separadas por vírgula)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="ex: fiscal, 2026, importante" /></div>
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
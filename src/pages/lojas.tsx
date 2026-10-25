import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Store, Loader2, Plus, Pencil, BadgeCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useLojas, useCreateLoja, useUpdateLoja, useConsultarCadastroSefaz, isSupabaseConfigured } from "@/lib/supabase-queries";
import { toast } from "sonner";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import type { Loja } from "@/types/database";

const FORM_VAZIO = {
  nome: "", apelido: "", cnpj: "", telefone: "", email: "", cidade: "", uf: "", matriz: false,
  // dados do emitente na nota fiscal (11/10/2026): antes não havia tela para
  // corrigir IE e endereço da filial — "Configurações Empresariais" grava em
  // outra tabela, que a nota não lê
  inscricao_estadual: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", codigo_municipio_ibge: "",
};

export function LojasPage() {
  const { data: lojas = [], isLoading } = useLojas();
  const create = useCreateLoja();
  const update = useUpdateLoja();
  const consultarSefaz = useConsultarCadastroSefaz();
  const [conferindo, setConferindo] = useState<string | null>(null);

  // Confere o cadastro contra a SEFAZ e corrige o que divergir. O endereço da
  // loja é o do emitente em toda nota fiscal, então errar aqui erra o documento.
  async function conferirNaSefaz(lojaId: string) {
    setConferindo(lojaId);
    try {
      const r: any = await consultarSefaz.mutateAsync({ loja_id: lojaId });
      if (!r?.ok) {
        toast.error(r?.motivo ?? "cadastro não localizado na SEFAZ");
        return;
      }
      const campos = Object.keys(r.divergencias ?? {}).filter((c) => c !== "nome");
      if (campos.length === 0) {
        toast.success("cadastro confere com a SEFAZ", {
          description: `IE ${r.ie} · ${r.habilitado ? "habilitado" : "situação irregular"}`,
        });
        return;
      }
      const resumo = campos
        .map((c) => `${c}: "${r.divergencias[c].erp ?? "—"}" → "${r.divergencias[c].sefaz}"`)
        .join("\n");
      if (!window.confirm(`A SEFAZ diverge do cadastro em ${campos.length} campo(s):\n\n${resumo}\n\nAplicar os dados da SEFAZ?`)) return;
      await consultarSefaz.mutateAsync({ loja_id: lojaId, aplicar: true });
      toast.success("cadastro atualizado com os dados da SEFAZ");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setConferindo(null);
    }
  }
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Loja | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);

  // CEP → rua, bairro, cidade, UF e código IBGE (o IBGE é obrigatório na nota)
  const buscarCep = async () => {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then((x) => x.json());
      if (r?.erro) { toast.error("CEP não encontrado."); return; }
      setForm((f) => ({ ...f, logradouro: r.logradouro || f.logradouro, bairro: r.bairro || f.bairro,
        cidade: r.localidade || f.cidade, uf: r.uf || f.uf, codigo_municipio_ibge: r.ibge || f.codigo_municipio_ibge }));
    } catch { /* sem a busca, digita à mão */ }
  };

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Lojas" />;

  const abrirNovo = () => { setEditando(null); setForm(FORM_VAZIO); setModalAberto(true); };
  const abrirEdicao = (l: Loja) => {
    setEditando(l);
    setForm({
      nome: l.nome, apelido: l.apelido, cnpj: l.cnpj ?? "", telefone: l.telefone ?? "",
      email: l.email ?? "", cidade: l.cidade ?? "", uf: l.uf ?? "", matriz: l.matriz,
      inscricao_estadual: (l as any).inscricao_estadual ?? "", cep: (l as any).cep ?? "",
      logradouro: (l as any).logradouro ?? "", numero: (l as any).numero ?? "", complemento: (l as any).complemento ?? "",
      bairro: (l as any).bairro ?? "", codigo_municipio_ibge: (l as any).codigo_municipio_ibge ?? "",
    });
    setModalAberto(true);
  };

  const handleSalvar = async () => {
    if (!form.nome || !form.apelido) return;
    const payload = {
      nome: form.nome, apelido: form.apelido, cnpj: form.cnpj || null, telefone: form.telefone || null,
      email: form.email || null, cidade: form.cidade || null, uf: form.uf || null, matriz: form.matriz,
      inscricao_estadual: form.inscricao_estadual.replace(/\D/g, "") || null,
      cep: form.cep.replace(/\D/g, "") || null,
      logradouro: form.logradouro.trim() || null, numero: form.numero.trim() || null,
      complemento: form.complemento.trim() || null, bairro: form.bairro.trim() || null,
      codigo_municipio_ibge: form.codigo_municipio_ibge.replace(/\D/g, "") || null,
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
                      <Button variant="ghost" size="icon" disabled={conferindo === l.id}
                        onClick={() => conferirNaSefaz(l.id)}
                        title="Conferir cadastro na SEFAZ (IE e endereço do emitente)">
                        {conferindo === l.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <BadgeCheck className="h-4 w-4" />}
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
          <DialogHeader><DialogTitle>{editando ? "Editar Loja" : "Nova Loja"}</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* O nome é o que sai na nota (emitente, fantasia, SPED); o apelido
                  ("Matriz", "Filial") é só o rótulo das telas — migration 114. */}
              <div><Label>Nome * <span className="text-xs font-normal text-muted-foreground">(sai na nota fiscal)</span></Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div><Label>Apelido * <span className="text-xs font-normal text-muted-foreground">(só nas telas)</span></Label><Input value={form.apelido} onChange={(e) => setForm({ ...form, apelido: e.target.value })} /></div>
            </div>
            <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-medium">Dados para a nota fiscal <span className="text-xs font-normal text-muted-foreground">(saem como emitente em toda nota desta filial)</span></p>
              <div><Label>Inscrição Estadual</Label><Input value={form.inscricao_estadual} onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })} placeholder="só números" /></div>
              <div className="grid grid-cols-[140px_1fr] gap-3">
                <div><Label>CEP</Label><Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} onBlur={() => void buscarCep()} placeholder="00000-000" /></div>
                <div><Label>Rua</Label><Input value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-[100px_1fr_1fr] gap-3">
                <div><Label>Número</Label><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
                <div><Label>Complemento</Label><Input value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} /></div>
                <div><Label>Bairro</Label><Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-[1fr_80px] gap-3">
                <div><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
                <div><Label>UF</Label><Input maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} /></div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Digite o CEP e saia do campo: rua, bairro, cidade, UF e o código do município (IBGE{form.codigo_municipio_ibge ? `: ${form.codigo_municipio_ibge}` : ""}) se preenchem sozinhos.
                Ou use "Conferir na SEFAZ" na lista para puxar IE e endereço do cadastro da SEFAZ.
              </p>
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

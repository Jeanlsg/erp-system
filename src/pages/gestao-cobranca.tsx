// ============================================================
// Páginas de Gestão Empresarial — adicionadas para cobrir 100%
// do MAPA_GESTAO_EMPRESARIAL.md
// ============================================================

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DollarSign, Search, Loader2, FileText, Trash2, Plus, CreditCard,
  AlertTriangle, CheckCircle, UserCheck, BarChart3, Shield, X, Send,
  Star, MapPin, Users, Calendar, Banknote, Receipt, Barcode,
  Edit, Eye, Lock, Unlock, Building2, Briefcase, Settings,
} from "lucide-react";
import {
  useChequesFull, useCreateCheque, useUpdateCheque, useDeleteCheque,
  useNegativacoesFull, useCreateNegativacao, useDeleteNegativacao, useDesnegativar,
  useParcelamentosFull, useCreateParcelamento,
  useProtestosFull, useCreateProtesto, useDeleteProtesto,
  useAvaliacoes, useRecomendacoes, useCreateParceria,
  useNotificacoes, useCreateNotificacao, useMarcarNotificacaoLida,
  useCertificados, useCreateCertificado, useDeleteCertificado,
  useConfiguracoesSefaz, useUpsertConfiguracaoSefaz,
  useConfiguracoesGerais, useUpsertConfiguracao,
  useOcorrencias, useCreateOcorrencia, useUpdateOcorrencia,
  useClientes, usePessoas, useLojas, useCreatePessoa, useUpdatePessoa,
  useProdutos, useCreateProduto, useContasVencidas,
  useVendas, useSangriasPorPeriodo, useEntradasExtrasPorPeriodo,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { useAuth } from "@/lib/store/auth-store";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date, dateTime } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Link } from "react-router-dom";

// ====================================================================
// 1) CONSULTA CHEQUE
// ====================================================================
export function ConsultaChequePage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: cheques = [], isLoading } = useChequesFull(lojaId ?? undefined);
  const create = useCreateCheque();
  const update = useUpdateCheque();
  const del = useDeleteCheque();

  const [modal, setModal] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [form, setForm] = useState({
    tipo: "recebido", pessoa_id: "", banco: "", agencia: "", conta: "",
    numero_cheque: "", valor: "", data_emissao: new Date().toISOString().slice(0, 10),
    data_vencimento: "", observacoes: "",
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Consulta de Cheques" />;

  const filtrados = cheques.filter((c: any) => !filtroStatus || c.status === filtroStatus);

  const totalEmCarteira = cheques.filter((c: any) => c.status === "em_carteira").reduce((s: number, c: any) => s + Number(c.valor), 0);
  const totalCompensado = cheques.filter((c: any) => c.status === "compensado").reduce((s: number, c: any) => s + Number(c.valor), 0);
  const totalDevolvido = cheques.filter((c: any) => c.status === "devolvido").reduce((s: number, c: any) => s + Number(c.valor), 0);

  const handleCriar = async () => {
    if (!lojaId || !form.banco || !form.numero_cheque || !form.valor) return;
    await create.mutateAsync({
      loja_id: lojaId,
      ...form,
      valor: parseFloat(form.valor),
      status: "em_carteira",
    });
    setModal(false);
    setForm({ tipo: "recebido", pessoa_id: "", banco: "", agencia: "", conta: "", numero_cheque: "", valor: "", data_emissao: new Date().toISOString().slice(0, 10), data_vencimento: "", observacoes: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6" /> Consulta de Cheques
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{cheques.length} cheque(s) cadastrado(s)</p>
        </div>
        <Button onClick={() => setModal(true)}><Plus className="mr-2 h-4 w-4" /> Novo Cheque</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Em Carteira</p><p className="text-2xl font-semibold">{brl(totalEmCarteira)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Compensados</p><p className="text-2xl font-semibold text-green-600">{brl(totalCompensado)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Devolvidos</p><p className="text-2xl font-semibold text-red-600">{brl(totalDevolvido)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <select className="h-9 rounded border border-input bg-transparent px-2 text-sm" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos status</option>
              <option value="em_carteira">Em Carteira</option>
              <option value="compensado">Compensado</option>
              <option value="devolvido">Devolvido</option>
              <option value="sustado">Sustado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Nº Cheque</th>
                  <th className="text-left p-3">Banco</th>
                  <th className="text-left p-3">Pessoa</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-left p-3">Vencimento</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c: any) => (
                  <tr key={c.id} className="border-b hover:bg-accent">
                    <td className="p-3"><Badge variant={c.tipo === "recebido" ? "default" : "outline"}>{c.tipo}</Badge></td>
                    <td className="p-3 font-mono text-xs">{c.numero_cheque}</td>
                    <td className="p-3 text-sm">{c.banco}</td>
                    <td className="p-3 text-sm">{c.pessoa?.nome_razao ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums font-semibold">{brl(c.valor)}</td>
                    <td className="p-3 text-sm">{date(c.data_vencimento)}</td>
                    <td className="p-3 text-center">
                      <Badge variant={c.status === "compensado" ? "default" : c.status === "devolvido" ? "destructive" : "outline"}>{c.status}</Badge>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex gap-1 justify-center">
                        {c.status === "em_carteira" && (
                          <Button size="sm" variant="outline" onClick={() => update.mutate({ id: c.id, status: "compensado", data_compensacao: new Date().toISOString().slice(0, 10) })}>
                            <CheckCircle className="h-3 w-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(c.id); }}>
                          <Trash2 className="h-3 w-3 text-destructive" />
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

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Cheque</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                  <option value="recebido">Recebido</option>
                  <option value="emitido">Emitido</option>
                </select>
              </div>
              <div><Label>Nº do Cheque *</Label><Input value={form.numero_cheque} onChange={(e) => setForm({ ...form, numero_cheque: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Banco *</Label><Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} /></div>
              <div><Label>Agência</Label><Input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} /></div>
              <div><Label>Conta</Label><Input value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
              <div><Label>Emissão</Label><Input type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} /></div>
              <div><Label>Vencimento</Label><Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={create.isPending || !form.banco || !form.numero_cheque || !form.valor}>{create.isPending ? "Salvando..." : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====================================================================
// 2) RECEBIMENTO POR CHEQUE (atalho para ConsultaCheque pré-filtrado)
// ====================================================================
export function RecebimentoChequePage() {
  return <ConsultaChequePage />;
}

// ====================================================================
// 3) NEGATIVAR DEVEDORES
// ====================================================================
export function NegativarDevedoresPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: negativacoes = [], isLoading } = useNegativacoesFull(lojaId ?? undefined);
  const create = useCreateNegativacao();
  const del = useDeleteNegativacao();
  const desnegativar = useDesnegativar();

  const [modal, setModal] = useState(false);
  const [desnegModal, setDesnegModal] = useState<{ id: string } | null>(null);
  const [motivo, setMotivo] = useState("");
  const { data: pessoas = [] } = useClientes();
  const { data: contasVencidas = [] } = useContasVencidas(lojaId ?? undefined);
  const [form, setForm] = useState({
    pessoa_id: "",
    valor_total: "",
    data_negativacao: new Date().toISOString().slice(0, 10),
    motivo: "",
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Negativar Devedores" />;

  const ativos = negativacoes.filter((n: any) => n.status === "ativo").length;
  const desnegativados = negativacoes.filter((n: any) => n.status === "desnegativado").length;
  const total = negativacoes.filter((n: any) => n.status === "ativo").reduce((s: number, n: any) => s + Number(n.valor_total), 0);

  const handleNegativar = async () => {
    if (!lojaId || !form.pessoa_id || !form.valor_total) return;
    await create.mutateAsync({
      loja_id: lojaId,
      pessoa_id: form.pessoa_id,
      valor_total: parseFloat(form.valor_total),
      data_negativacao: form.data_negativacao,
      motivo: form.motivo || null,
      status: "ativo",
    });
    setModal(false);
    setForm({ pessoa_id: "", valor_total: "", data_negativacao: new Date().toISOString().slice(0, 10), motivo: "" });
  };

  const handleDesnegativar = async () => {
    if (!desnegModal) return;
    await desnegativar.mutateAsync({ id: desnegModal.id, motivo });
    setDesnegModal(null);
    setMotivo("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" /> Negativar Devedores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de clientes inadimplentes (SPC/Serasa)</p>
        </div>
        <Button onClick={() => setModal(true)}><Plus className="mr-2 h-4 w-4" /> Nova Negativação</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Ativos</p><p className="text-2xl font-semibold text-red-600">{ativos}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Desnegativados</p><p className="text-2xl font-semibold text-green-600">{desnegativados}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Valor Total Negativado</p><p className="text-2xl font-semibold">{brl(total)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Negativações</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : negativacoes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma negativação registrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">CPF/CNPJ</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-left p-3">Data Negativação</th>
                  <th className="text-left p-3">Motivo</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {negativacoes.map((n: any) => (
                  <tr key={n.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{n.pessoa?.nome_razao ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{n.pessoa?.cpf_cnpj ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums font-semibold">{brl(n.valor_total)}</td>
                    <td className="p-3 text-sm">{date(n.data_negativacao)}</td>
                    <td className="p-3 text-sm">{n.motivo ?? "—"}</td>
                    <td className="p-3 text-center">
                      <Badge variant={n.status === "ativo" ? "destructive" : "default"}>{n.status}</Badge>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex gap-1 justify-center">
                        {n.status === "ativo" && (
                          <Button size="sm" variant="outline" onClick={() => setDesnegModal({ id: n.id })}>
                            Desnegar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(n.id); }}>
                          <Trash2 className="h-3 w-3 text-destructive" />
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

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Negativar Cliente</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente *</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.pessoa_id} onChange={(e) => setForm({ ...form, pessoa_id: e.target.value })}>
                <option value="">Selecione...</option>
                {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome_razao}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor Total</Label><Input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} /></div>
              <div><Label>Data</Label><Input type="date" value={form.data_negativacao} onChange={(e) => setForm({ ...form, data_negativacao: e.target.value })} /></div>
            </div>
            <div><Label>Motivo</Label><Input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ex: Inadimplência há 90+ dias" /></div>
            {contasVencidas.length > 0 && (
              <div className="bg-muted p-3 rounded text-xs">
                <p className="font-semibold">⚠ Existem {contasVencidas.length} contas vencidas no sistema</p>
                <Link to="/financeiro" className="text-blue-600 underline">Ver no Financeiro →</Link>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleNegativar} disabled={create.isPending || !form.pessoa_id || !form.valor_total}>{create.isPending ? "Salvando..." : "Negativar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!desnegModal} onOpenChange={(o) => !o && setDesnegModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Desnegar Cliente</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div><Label>Motivo da Desnegativação *</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: Pagamento confirmado" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDesnegModal(null)}>Cancelar</Button>
            <Button onClick={handleDesnegativar} disabled={!motivo}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====================================================================
// 4) PARCELAR DÉBITOS
// ====================================================================
export function ParcelarDebitosPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: parcelamentos = [], isLoading } = useParcelamentosFull(lojaId ?? undefined);
  const create = useCreateParcelamento();
  const { data: pessoas = [] } = useClientes();
  const { data: contasVencidas = [] } = useContasVencidas(lojaId ?? undefined);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    pessoa_id: "",
    divida_original: "",
    valor_entrada: "0",
    valor_total: "",
    juros_mensal: "0",
    numero_parcelas: "3",
    data_contrato: new Date().toISOString().slice(0, 10),
    data_primeira_parcela: "",
    observacoes: "",
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Parcelar Débitos" />;

  const ativos = parcelamentos.filter((p: any) => p.status === "ativo").length;
  const totalPago = parcelamentos.reduce((s: number, p: any) => s + Number(p.valor_total ?? 0), 0);

  const handleCriar = async () => {
    if (!lojaId || !form.pessoa_id || !form.valor_total) return;
    await create.mutateAsync({
      loja_id: lojaId,
      pessoa_id: form.pessoa_id,
      divida_original: parseFloat(form.divida_original) || 0,
      valor_entrada: parseFloat(form.valor_entrada) || 0,
      valor_total: parseFloat(form.valor_total),
      juros_mensal: parseFloat(form.juros_mensal) || 0,
      numero_parcelas: parseInt(form.numero_parcelas),
      data_contrato: form.data_contrato,
      data_primeira_parcela: form.data_primeira_parcela,
      observacoes: form.observacoes || null,
      status: "ativo",
    });
    setModal(false);
    setForm({ pessoa_id: "", divida_original: "", valor_entrada: "0", valor_total: "", juros_mensal: "0", numero_parcelas: "3", data_contrato: new Date().toISOString().slice(0, 10), data_primeira_parcela: "", observacoes: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6" /> Parcelar Débitos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Negociação e parcelamento de dívidas</p>
        </div>
        <Button onClick={() => setModal(true)}><Plus className="mr-2 h-4 w-4" /> Novo Parcelamento</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Contratos Ativos</p><p className="text-2xl font-semibold">{ativos}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Valor Total</p><p className="text-2xl font-semibold">{brl(totalPago)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Contratos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : parcelamentos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum parcelamento</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-right p-3">Dívida Original</th>
                  <th className="text-right p-3">Total c/ Juros</th>
                  <th className="text-center p-3">Parcelas</th>
                  <th className="text-left p-3">1ª Parcela</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {parcelamentos.map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{p.pessoa?.nome_razao ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{brl(p.divida_original)}</td>
                    <td className="p-3 text-right tabular-nums font-semibold">{brl(p.valor_total)}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{p.numero_parcelas}x</Badge></td>
                    <td className="p-3 text-sm">{date(p.data_primeira_parcela)}</td>
                    <td className="p-3 text-center"><Badge variant={p.status === "ativo" ? "default" : "outline"}>{p.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Parcelamento</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente *</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.pessoa_id} onChange={(e) => setForm({ ...form, pessoa_id: e.target.value })}>
                <option value="">Selecione...</option>
                {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome_razao}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Dívida Original</Label><Input type="number" step="0.01" value={form.divida_original} onChange={(e) => setForm({ ...form, divida_original: e.target.value })} /></div>
              <div><Label>Entrada</Label><Input type="number" step="0.01" value={form.valor_entrada} onChange={(e) => setForm({ ...form, valor_entrada: e.target.value })} /></div>
              <div><Label>Valor Total c/ Juros</Label><Input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Juros Mensal %</Label><Input type="number" step="0.01" value={form.juros_mensal} onChange={(e) => setForm({ ...form, juros_mensal: e.target.value })} /></div>
              <div><Label>Nº Parcelas</Label><Input type="number" value={form.numero_parcelas} onChange={(e) => setForm({ ...form, numero_parcelas: e.target.value })} /></div>
              <div><Label>1ª Parcela</Label><Input type="date" value={form.data_primeira_parcela} onChange={(e) => setForm({ ...form, data_primeira_parcela: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={create.isPending || !form.pessoa_id || !form.valor_total}>{create.isPending ? "Salvando..." : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====================================================================
// 5) ENCAMINHAR PROTESTO
// ====================================================================
export function EncaminharProtestoPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: protestos = [], isLoading } = useProtestosFull(lojaId ?? undefined);
  const create = useCreateProtesto();
  const del = useDeleteProtesto();
  const { data: pessoas = [] } = useClientes();

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    pessoa_id: "", tipo_titulo: "cheque", titulo_id: "",
    valor: "", data_protesto: new Date().toISOString().slice(0, 10),
    cartorio: "", numero_protocolo: "", custo_protesto: "",
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Encaminhar Protesto" />;

  const protestados = protestos.filter((p: any) => p.status === "protestado").length;
  const totalProtestado = protestos.filter((p: any) => p.status === "protestado").reduce((s: number, p: any) => s + Number(p.valor), 0);

  const handleCriar = async () => {
    if (!lojaId || !form.pessoa_id || !form.valor) return;
    await create.mutateAsync({
      loja_id: lojaId,
      pessoa_id: form.pessoa_id,
      tipo_titulo: form.tipo_titulo,
      titulo_id: form.titulo_id || null,
      valor: parseFloat(form.valor),
      data_protesto: form.data_protesto,
      cartorio: form.cartorio || null,
      numero_protocolo: form.numero_protocolo || null,
      custo_protesto: parseFloat(form.custo_protesto) || 0,
      status: "protestado",
    });
    setModal(false);
    setForm({ pessoa_id: "", tipo_titulo: "cheque", titulo_id: "", valor: "", data_protesto: new Date().toISOString().slice(0, 10), cartorio: "", numero_protocolo: "", custo_protesto: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" /> Encaminhar Protesto
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Títulos para protesto em cartório</p>
        </div>
        <Button onClick={() => setModal(true)}><Plus className="mr-2 h-4 w-4" /> Novo Protesto</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Protestados</p><p className="text-2xl font-semibold text-red-600">{protestados}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Valor Total</p><p className="text-2xl font-semibold">{brl(totalProtestado)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Protestos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : protestos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum protesto</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-center p-3">Tipo Título</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-left p-3">Cartório</th>
                  <th className="text-left p-3">Protocolo</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {protestos.map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{p.pessoa?.nome_razao ?? "—"}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{p.tipo_titulo}</Badge></td>
                    <td className="p-3 text-right tabular-nums font-semibold">{brl(p.valor)}</td>
                    <td className="p-3 text-sm">{p.cartorio ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{p.numero_protocolo ?? "—"}</td>
                    <td className="p-3 text-sm">{date(p.data_protesto)}</td>
                    <td className="p-3 text-center"><Badge variant={p.status === "protestado" ? "destructive" : "outline"}>{p.status}</Badge></td>
                    <td className="p-3 text-center">
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(p.id); }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Protesto</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente *</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.pessoa_id} onChange={(e) => setForm({ ...form, pessoa_id: e.target.value })}>
                <option value="">Selecione...</option>
                {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome_razao}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo Título</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.tipo_titulo} onChange={(e) => setForm({ ...form, tipo_titulo: e.target.value })}>
                  <option value="cheque">Cheque</option>
                  <option value="promissoria">Promissória</option>
                  <option value="duplicata">Duplicata</option>
                  <option value="nota">Nota</option>
                </select>
              </div>
              <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cartório</Label><Input value={form.cartorio} onChange={(e) => setForm({ ...form, cartorio: e.target.value })} /></div>
              <div><Label>Nº Protocolo</Label><Input value={form.numero_protocolo} onChange={(e) => setForm({ ...form, numero_protocolo: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Custo Protesto</Label><Input type="number" step="0.01" value={form.custo_protesto} onChange={(e) => setForm({ ...form, custo_protesto: e.target.value })} /></div>
              <div><Label>Data</Label><Input type="date" value={form.data_protesto} onChange={(e) => setForm({ ...form, data_protesto: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={create.isPending || !form.pessoa_id || !form.valor}>{create.isPending ? "Salvando..." : "Protestar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboboxBusca } from "@/components/ui/combobox-busca";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, FileText, Wrench, Truck, Store, Plus, Loader2, X, Check, Ban } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
  useClientes, useProdutos, usePedidos, useCreatePedido, useUpdatePedidoStatus,
  useOrcamentos, useCreateOrcamento, useUpdateOrcamentoStatus,
  useOrdensServico, useCreateOrdemServico, useUpdateOrdemServico,
  useConsignacoes, useCreateConsignacao, useUpdateConsignacaoStatus,
  useLocacoes, useCreateLocacao, useUpdateLocacaoStatus,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";

// ============================================================================
// Helpers compartilhados
// ============================================================================

function Cabecalho({ icon: Icon, titulo, subtitulo, onNovo, labelNovo }: {
  icon: any; titulo: string; subtitulo: string; onNovo: () => void; labelNovo: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Icon className="h-6 w-6" /> {titulo}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitulo}</p>
      </div>
      <Button onClick={onNovo}><Plus className="mr-2 h-4 w-4" /> {labelNovo}</Button>
    </div>
  );
}

function SelectCliente({ value, onChange, clientes, obrigatorio }: {
  value: string; onChange: (v: string) => void; clientes: any[]; obrigatorio?: boolean;
}) {
  return (
    <div>
      <Label>Cliente {obrigatorio ? "*" : ""}</Label>
      <ComboboxBusca
        className="mt-1"
        itens={clientes.map((c: any) => ({
          id: c.id, rotulo: c.nome_razao,
          detalhe: [c.cpf_cnpj, c.celular ?? c.telefone].filter(Boolean).join(" · "),
        }))}
        value={value}
        onChange={onChange}
        vazio={obrigatorio ? undefined : "Sem cliente"}
        placeholder="Buscar cliente por nome, CPF ou telefone…"
      />
    </div>
  );
}

type ItemLivre = { descricao: string; quantidade: number; valor_unitario: number };

function EditorItensLivres({ itens, setItens }: { itens: ItemLivre[]; setItens: (fn: (prev: ItemLivre[]) => ItemLivre[]) => void }) {
  const [desc, setDesc] = useState("");
  const [qtd, setQtd] = useState("1");
  const [valor, setValor] = useState("");
  const total = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
  return (
    <div className="border rounded-md p-3 space-y-2">
      <Label>Itens *</Label>
      <div className="flex gap-2">
        <Input placeholder="Descrição" className="flex-1" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Input type="number" min="1" className="w-16" value={qtd} onChange={(e) => setQtd(e.target.value)} />
        <Input type="number" step="0.01" placeholder="R$" className="w-24" value={valor} onChange={(e) => setValor(e.target.value)} />
        <Button type="button" variant="outline" disabled={!desc || !valor}
          onClick={() => { setItens((prev) => [...prev, { descricao: desc, quantidade: parseFloat(qtd) || 1, valor_unitario: parseFloat(valor) }]); setDesc(""); setQtd("1"); setValor(""); }}>
          Add
        </Button>
      </div>
      {itens.length > 0 && (
        <ul className="space-y-1">
          {itens.map((i, idx) => (
            <li key={idx} className="flex items-center justify-between text-sm bg-muted rounded px-2 py-1">
              <span>{i.quantidade}x {i.descricao} — {brl(i.valor_unitario)}</span>
              <button type="button" onClick={() => setItens((prev) => prev.filter((_, x) => x !== idx))}>
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-right text-sm font-semibold">Total: {brl(total)}</p>
    </div>
  );
}

// ============================================================================
// PEDIDO / PRÉ-VENDA (erp_pedidos, tipo_pedido = 'pre_venda')
// ============================================================================

export function PedidoPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: pedidos = [], isLoading } = usePedidos({ lojaId: lojaId ?? undefined });
  const { data: clientes = [] } = useClientes();
  const createPedido = useCreatePedido();
  const updateStatus = useUpdatePedidoStatus();

  const [modalAberto, setModalAberto] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [observacoes, setObservacoes] = useState("");

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Pedido / Pré-venda" />;

  const preVendas = pedidos.filter((p: any) => p.tipo_pedido === "pre_venda");

  const handleCriar = async () => {
    if (!lojaId || !clienteId) return;
    await createPedido.mutateAsync({
      loja_id: lojaId, cliente_id: clienteId, endereco_entrega: {},
      tipo_pedido: "pre_venda", observacoes: observacoes || null,
    });
    setModalAberto(false); setClienteId(""); setObservacoes("");
  };

  return (
    <div className="space-y-6">
      <Cabecalho icon={ShoppingCart} titulo="Pedido / Pré-venda" subtitulo={`${preVendas.length} pré-venda(s)`} onNovo={() => setModalAberto(true)} labelNovo="Nova Pré-venda" />
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : preVendas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma pré-venda registrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Observações</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {preVendas.map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-accent">
                    <td className="p-3 text-sm">{date(p.created_at)}</td>
                    <td className="p-3 text-sm">{clientes.find((c: any) => c.id === p.cliente_id)?.nome_razao ?? "—"}</td>
                    <td className="p-3 text-sm text-muted-foreground">{p.observacoes ?? "—"}</td>
                    <td className="p-3 text-center"><Badge variant={p.status === "concluido" ? "default" : "outline"}>{p.status}</Badge></td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {p.status === "pendente" && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: p.id, status: "concluido" })}><Check className="h-4 w-4 mr-1" /> Concluir</Button>
                          <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: p.id, status: "cancelado" })}><Ban className="h-4 w-4 mr-1" /> Cancelar</Button>
                        </>
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
          <DialogHeader><DialogTitle>Nova Pré-venda</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <SelectCliente value={clienteId} onChange={setClienteId} clientes={clientes} obrigatorio />
            <div><Label>Observações / itens desejados</Label><Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">A pré-venda reserva o interesse do cliente. A venda em si é concluída no PDV.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={createPedido.isPending || !clienteId}>{createPedido.isPending ? "Salvando..." : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// ORÇAMENTO (erp_orcamentos)
// ============================================================================

export function OrcamentoPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: orcamentos = [], isLoading } = useOrcamentos(lojaId ?? undefined);
  const { data: clientes = [] } = useClientes();
  const create = useCreateOrcamento();
  const updateStatus = useUpdateOrcamentoStatus();

  const [modalAberto, setModalAberto] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [validade, setValidade] = useState("");
  const [itens, setItens] = useState<ItemLivre[]>([]);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Orçamento" />;

  const handleCriar = async () => {
    if (!lojaId || itens.length === 0) return;
    await create.mutateAsync({
      loja_id: lojaId, cliente_id: clienteId || null, validade: validade || null, itens,
    });
    setModalAberto(false); setClienteId(""); setValidade(""); setItens([]);
  };

  const STATUS_VARIANT: Record<string, "default" | "outline" | "destructive"> = {
    aprovado: "default", recusado: "destructive", expirado: "destructive",
  };

  return (
    <div className="space-y-6">
      <Cabecalho icon={FileText} titulo="Orçamentos" subtitulo={`${orcamentos.length} orçamento(s)`} onNovo={() => setModalAberto(true)} labelNovo="Novo Orçamento" />
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : orcamentos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum orçamento registrado</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nº</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Validade</th>
                  <th className="text-center p-3">Itens</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {orcamentos.map((o: any) => (
                  <tr key={o.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono">#{o.numero}</td>
                    <td className="p-3 text-sm">{o.cliente?.nome_razao ?? "—"}</td>
                    <td className="p-3 text-sm">{o.validade ? date(o.validade) : "—"}</td>
                    <td className="p-3 text-center">{(o.itens ?? []).length}</td>
                    <td className="p-3 text-right tabular-nums">{brl(o.total)}</td>
                    <td className="p-3 text-center"><Badge variant={STATUS_VARIANT[o.status] ?? "outline"}>{o.status}</Badge></td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {o.status === "aberto" && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: o.id, status: "aprovado" })}><Check className="h-4 w-4 mr-1" /> Aprovar</Button>
                          <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: o.id, status: "recusado" })}><Ban className="h-4 w-4 mr-1" /> Recusar</Button>
                        </>
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Orçamento</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <SelectCliente value={clienteId} onChange={setClienteId} clientes={clientes} />
            <div><Label>Validade</Label><Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} /></div>
            <EditorItensLivres itens={itens} setItens={setItens} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={create.isPending || itens.length === 0}>{create.isPending ? "Salvando..." : "Criar Orçamento"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// ORDEM DE SERVIÇO (erp_ordens_servico)
// ============================================================================

const OS_STATUS_FLUXO: Record<string, string[]> = {
  aberta: ["em_andamento", "cancelada"],
  em_andamento: ["aguardando_peca", "concluida", "cancelada"],
  aguardando_peca: ["em_andamento", "cancelada"],
  concluida: ["entregue"],
};

export function OrdemServicoPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: ordens = [], isLoading } = useOrdensServico(lojaId ?? undefined);
  const { data: clientes = [] } = useClientes();
  const create = useCreateOrdemServico();
  const update = useUpdateOrdemServico();

  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ cliente_id: "", descricao: "", equipamento: "", defeito: "", valor_servicos: "", valor_pecas: "", previsao: "" });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Ordem de Serviço" />;

  const handleCriar = async () => {
    if (!lojaId || !form.descricao) return;
    await create.mutateAsync({
      loja_id: lojaId,
      cliente_id: form.cliente_id || null,
      descricao: form.descricao,
      equipamento: form.equipamento || null,
      defeito_relatado: form.defeito || null,
      valor_servicos: form.valor_servicos ? parseFloat(form.valor_servicos) : 0,
      valor_pecas: form.valor_pecas ? parseFloat(form.valor_pecas) : 0,
      previsao: form.previsao || null,
    });
    setModalAberto(false);
    setForm({ cliente_id: "", descricao: "", equipamento: "", defeito: "", valor_servicos: "", valor_pecas: "", previsao: "" });
  };

  return (
    <div className="space-y-6">
      <Cabecalho icon={Wrench} titulo="Ordens de Serviço" subtitulo={`${ordens.length} OS registrada(s)`} onNovo={() => setModalAberto(true)} labelNovo="Nova OS" />
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : ordens.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma OS registrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nº</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Descrição</th>
                  <th className="text-left p-3">Previsão</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Avançar</th>
                </tr>
              </thead>
              <tbody>
                {ordens.map((o: any) => (
                  <tr key={o.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono">#{o.numero}</td>
                    <td className="p-3 text-sm">{o.cliente?.nome_razao ?? "—"}</td>
                    <td className="p-3 text-sm">{o.descricao}{o.equipamento ? ` · ${o.equipamento}` : ""}</td>
                    <td className="p-3 text-sm">{o.previsao ? date(o.previsao) : "—"}</td>
                    <td className="p-3 text-right tabular-nums">{brl(Number(o.valor_servicos) + Number(o.valor_pecas))}</td>
                    <td className="p-3 text-center"><Badge variant={o.status === "entregue" ? "default" : o.status === "cancelada" ? "destructive" : "outline"}>{o.status.replace("_", " ")}</Badge></td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {(OS_STATUS_FLUXO[o.status] ?? []).map((prox) => (
                        <Button key={prox} variant="ghost" size="sm" onClick={() => update.mutate({ id: o.id, status: prox })}>
                          {prox.replace("_", " ")}
                        </Button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Ordem de Serviço</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <SelectCliente value={form.cliente_id} onChange={(v) => setForm({ ...form, cliente_id: v })} clientes={clientes} />
            <div><Label>Descrição do serviço *</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Equipamento</Label><Input value={form.equipamento} onChange={(e) => setForm({ ...form, equipamento: e.target.value })} /></div>
              <div><Label>Previsão</Label><Input type="date" value={form.previsao} onChange={(e) => setForm({ ...form, previsao: e.target.value })} /></div>
            </div>
            <div><Label>Defeito relatado</Label><Input value={form.defeito} onChange={(e) => setForm({ ...form, defeito: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor serviços (R$)</Label><Input type="number" step="0.01" value={form.valor_servicos} onChange={(e) => setForm({ ...form, valor_servicos: e.target.value })} /></div>
              <div><Label>Valor peças (R$)</Label><Input type="number" step="0.01" value={form.valor_pecas} onChange={(e) => setForm({ ...form, valor_pecas: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={create.isPending || !form.descricao}>{create.isPending ? "Salvando..." : "Abrir OS"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// VENDA CONSIGNADA (erp_consignacoes)
// ============================================================================

export function ConsignacaoPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: consignacoes = [], isLoading } = useConsignacoes(lojaId ?? undefined);
  const { data: clientes = [] } = useClientes();
  const { data: produtos = [] } = useProdutos({ lojaId: lojaId ?? undefined });
  const create = useCreateConsignacao();
  const updateStatus = useUpdateConsignacaoStatus();

  const [modalAberto, setModalAberto] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [dataAcerto, setDataAcerto] = useState("");
  const [itens, setItens] = useState<{ produto_id: string; quantidade: number; valor_unitario: number }[]>([]);
  const [novoProduto, setNovoProduto] = useState("");
  const [novaQtd, setNovaQtd] = useState("1");
  const [novoValor, setNovoValor] = useState("");

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Venda Consignada" />;

  const nomeProduto = (id: string) => produtos.find((p: any) => p.id === id)?.nome ?? id.slice(0, 8);

  const handleCriar = async () => {
    if (!lojaId || !clienteId || itens.length === 0) return;
    await create.mutateAsync({ loja_id: lojaId, cliente_id: clienteId, data_acerto_prevista: dataAcerto || null, itens });
    setModalAberto(false); setClienteId(""); setDataAcerto(""); setItens([]);
  };

  return (
    <div className="space-y-6">
      <Cabecalho icon={Truck} titulo="Vendas Consignadas" subtitulo={`${consignacoes.length} consignação(ões)`} onNovo={() => setModalAberto(true)} labelNovo="Nova Consignação" />
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : consignacoes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma consignação registrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nº</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Acerto previsto</th>
                  <th className="text-center p-3">Itens</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {consignacoes.map((c: any) => (
                  <tr key={c.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono">#{c.numero}</td>
                    <td className="p-3 text-sm">{c.cliente?.nome_razao ?? "—"}</td>
                    <td className="p-3 text-sm">{c.data_acerto_prevista ? date(c.data_acerto_prevista) : "—"}</td>
                    <td className="p-3 text-center">{(c.itens ?? []).length}</td>
                    <td className="p-3 text-right tabular-nums">{brl(c.total)}</td>
                    <td className="p-3 text-center"><Badge variant={c.status === "acertada" ? "default" : c.status === "cancelada" ? "destructive" : "outline"}>{c.status}</Badge></td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {c.status === "aberta" && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: c.id, status: "acertada" })}><Check className="h-4 w-4 mr-1" /> Acertar</Button>
                          <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: c.id, status: "cancelada" })}><Ban className="h-4 w-4 mr-1" /> Cancelar</Button>
                        </>
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Consignação</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <SelectCliente value={clienteId} onChange={setClienteId} clientes={clientes} obrigatorio />
            <div><Label>Data prevista do acerto</Label><Input type="date" value={dataAcerto} onChange={(e) => setDataAcerto(e.target.value)} /></div>
            <div className="border rounded-md p-3 space-y-2">
              <Label>Produtos consignados *</Label>
              <div className="flex gap-2">
                <ComboboxBusca
                  className="flex-1"
                  itens={produtos.map((p: any) => ({ id: p.id, rotulo: p.nome, detalhe: p.sku ?? undefined }))}
                  value={novoProduto}
                  onChange={setNovoProduto}
                  placeholder="Buscar produto…"
                />
                <Input type="number" min="1" className="w-16" value={novaQtd} onChange={(e) => setNovaQtd(e.target.value)} />
                <Input type="number" step="0.01" placeholder="R$" className="w-24" value={novoValor} onChange={(e) => setNovoValor(e.target.value)} />
                <Button type="button" variant="outline" disabled={!novoProduto || !novoValor}
                  onClick={() => { setItens((prev) => [...prev, { produto_id: novoProduto, quantidade: parseFloat(novaQtd) || 1, valor_unitario: parseFloat(novoValor) }]); setNovoProduto(""); setNovaQtd("1"); setNovoValor(""); }}>
                  Add
                </Button>
              </div>
              {itens.length > 0 && (
                <ul className="space-y-1">
                  {itens.map((i, idx) => (
                    <li key={idx} className="flex items-center justify-between text-sm bg-muted rounded px-2 py-1">
                      <span>{i.quantidade}x {nomeProduto(i.produto_id)} — {brl(i.valor_unitario)}</span>
                      <button type="button" onClick={() => setItens((prev) => prev.filter((_, x) => x !== idx))}>
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={create.isPending || !clienteId || itens.length === 0}>{create.isPending ? "Salvando..." : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// LOCAÇÃO (erp_locacoes)
// ============================================================================

export function LocacaoPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: locacoes = [], isLoading } = useLocacoes(lojaId ?? undefined);
  const { data: clientes = [] } = useClientes();
  const create = useCreateLocacao();
  const updateStatus = useUpdateLocacaoStatus();

  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ cliente_id: "", descricao_item: "", data_inicio: "", data_fim: "", valor: "", caucao: "" });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Locação" />;

  const handleCriar = async () => {
    if (!lojaId || !form.cliente_id || !form.descricao_item || !form.data_inicio || !form.valor) return;
    await create.mutateAsync({
      loja_id: lojaId, cliente_id: form.cliente_id, descricao_item: form.descricao_item,
      data_inicio: form.data_inicio, data_fim_prevista: form.data_fim || null,
      valor_periodo: parseFloat(form.valor), caucao: form.caucao ? parseFloat(form.caucao) : null,
    });
    setModalAberto(false);
    setForm({ cliente_id: "", descricao_item: "", data_inicio: "", data_fim: "", valor: "", caucao: "" });
  };

  return (
    <div className="space-y-6">
      <Cabecalho icon={Store} titulo="Locações" subtitulo={`${locacoes.length} locação(ões)`} onNovo={() => setModalAberto(true)} labelNovo="Nova Locação" />
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : locacoes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma locação registrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nº</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Item</th>
                  <th className="text-left p-3">Período</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {locacoes.map((l: any) => (
                  <tr key={l.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono">#{l.numero}</td>
                    <td className="p-3 text-sm">{l.cliente?.nome_razao ?? "—"}</td>
                    <td className="p-3 text-sm">{l.descricao_item}</td>
                    <td className="p-3 text-sm">{date(l.data_inicio)}{l.data_fim_prevista ? ` → ${date(l.data_fim_prevista)}` : ""}</td>
                    <td className="p-3 text-right tabular-nums">{brl(l.valor_periodo)}</td>
                    <td className="p-3 text-center"><Badge variant={l.status === "devolvida" ? "default" : l.status === "cancelada" || l.status === "atrasada" ? "destructive" : "outline"}>{l.status}</Badge></td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {l.status === "ativa" && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: l.id, status: "devolvida" })}><Check className="h-4 w-4 mr-1" /> Devolver</Button>
                          <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: l.id, status: "cancelada" })}><Ban className="h-4 w-4 mr-1" /> Cancelar</Button>
                        </>
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
          <DialogHeader><DialogTitle>Nova Locação</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <SelectCliente value={form.cliente_id} onChange={(v) => setForm({ ...form, cliente_id: v })} clientes={clientes} obrigatorio />
            <div><Label>Item locado *</Label><Input value={form.descricao_item} onChange={(e) => setForm({ ...form, descricao_item: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início *</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
              <div><Label>Devolução prevista</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor do período (R$) *</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
              <div><Label>Caução (R$)</Label><Input type="number" step="0.01" value={form.caucao} onChange={(e) => setForm({ ...form, caucao: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={create.isPending || !form.cliente_id || !form.descricao_item || !form.data_inicio || !form.valor}>
              {create.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

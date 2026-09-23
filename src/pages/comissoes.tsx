// ============================================================
// Comissões — o que cada vendedor tem a receber, por período.
//
// A comissão nasce sozinha na venda finalizada com vendedor (trigger no
// banco) e é cancelada se a venda cair. Aqui só se confere e se marca
// como paga — nada é digitado à mão, para o número bater com a venda.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, Loader2, FileText, Target, Plus, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboboxBusca } from "@/components/ui/combobox-busca";
import { supabase } from "@/lib/supabase";
import { useFuncionarios, useMetas, useCriarMeta, useExcluirMeta, useLancarComissoesEmContas, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";

type Status = "todas" | "pendente" | "paga" | "cancelada";

export function ComissoesPage() {
  const { lojaId } = useAutoSelectLoja();
  const qc = useQueryClient();
  const { data: funcionarios = [] } = useFuncionarios(lojaId ?? undefined);

  const hoje = new Date();
  const [ini, setIni] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10));
  const [fim, setFim] = useState(hoje.toISOString().slice(0, 10));
  const [funcionarioId, setFuncionarioId] = useState("");
  const [status, setStatus] = useState<Status>("todas");
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  // Trocar de filial no topo não remonta a página. Sem limpar aqui, as
  // comissões marcadas em Petrolina continuavam na seleção depois de mudar
  // para Juazeiro, e "Pagar selecionadas" pagava o que nem estava na tela.
  useEffect(() => { setMarcadas(new Set()); }, [lojaId]);
  const [pagando, setPagando] = useState(false);
  // Lançar comissão apurada em Contas a Pagar. Até agora o valor morria aqui
  // e alguém redigitava no financeiro — e redigitação é onde o número muda.
  const lancarEmContas = useLancarComissoesEmContas();

  // Metas do período. Comissão sem meta é só percentual; com meta o vendedor
  // sabe onde está no mês, que é o que o sistema anterior mostrava.
  const { data: metas = [] } = useMetas({ lojaId: lojaId ?? undefined, de: ini, ate: fim });
  const criarMeta = useCriarMeta();
  const excluirMeta = useExcluirMeta();
  const [novaMeta, setNovaMeta] = useState({ funcionarioId: "", tipo: "valor", valor: "" });
  const [vencimento, setVencimento] = useState(
    new Date(hoje.getFullYear(), hoje.getMonth() + 1, 5).toISOString().slice(0, 10));

  const { data: comissoes = [], isLoading } = useQuery<any[]>({
    queryKey: ["erp_comissoes", lojaId, ini, fim, funcionarioId, status],
    enabled: !!lojaId,
    queryFn: async () => {
      let q = supabase
        .from("erp_comissoes")
        .select("*, funcionario:erp_funcionarios(id, cargo, pessoa:erp_pessoas(nome_razao)), venda:erp_vendas(numero_pedido, data_venda)")
        .eq("loja_id", lojaId)
        .gte("data_referencia", ini)
        .lte("data_referencia", fim)
        .order("data_referencia", { ascending: false });
      if (funcionarioId) q = q.eq("funcionario_id", funcionarioId);
      if (status !== "todas") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const nomeDe = (c: any) => c.funcionario?.pessoa?.nome_razao ?? c.funcionario?.cargo ?? "—";

  // totais por vendedor, só do que está na tela
  const porVendedor = useMemo(() => {
    const m = new Map<string, { nome: string; pendente: number; paga: number }>();
    for (const c of comissoes) {
      const k = c.funcionario_id;
      const r = m.get(k) ?? { nome: nomeDe(c), pendente: 0, paga: 0 };
      if (c.status === "pendente") r.pendente += Number(c.valor_comissao);
      if (c.status === "paga") r.paga += Number(c.valor_comissao);
      m.set(k, r);
    }
    return Array.from(m.values()).sort((a, b) => b.pendente - a.pendente);
  }, [comissoes]);
  const totalPendente = porVendedor.reduce((n, r) => n + r.pendente, 0);
  const totalPaga = porVendedor.reduce((n, r) => n + r.paga, 0);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Comissões" />;

  const pendentesVisiveis = comissoes.filter((c) => c.status === "pendente");
  const alternar = (id: string) =>
    setMarcadas((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  /**
   * Lança as comissões selecionadas em Contas a Pagar.
   *
   * Só as que ainda não foram lançadas entram: o banco recusa o resto, e
   * mandar a seleção inteira faria o lote todo falhar por causa de uma linha.
   */
  const lancar = async () => {
    const ids = Array.from(marcadas).filter((id) => {
      const c = comissoes.find((x: any) => x.id === id);
      return c && !c.conta_id && c.status !== "cancelada";
    });
    if (ids.length === 0) {
      toast.error("Nenhuma comissão da seleção pode ser lançada — já lançadas ou canceladas.");
      return;
    }
    if (!confirm(`Lançar ${ids.length} comissão(ões) em Contas a Pagar, com vencimento em ${date(vencimento)}?`)) return;
    try {
      const r = await lancarEmContas.mutateAsync({ comissoes: ids, vencimento });
      const contas = (r?.contas ?? []).length;
      toast.success(`${contas} conta(s) a pagar criada(s), somando ${brl(Number(r?.total ?? 0))}.`);
      setMarcadas(new Set());
    } catch (e: any) {
      toast.error(`Não foi possível lançar: ${e.message ?? e}`);
    }
  };

  const pagar = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`Marcar ${ids.length} comissão(ões) como paga(s) hoje?`)) return;
    setPagando(true);
    const { error } = await supabase.from("erp_comissoes")
      .update({ status: "paga", data_pagamento: new Date().toISOString().slice(0, 10) })
      .in("id", ids).eq("status", "pendente");
    setPagando(false);
    if (error) { toast.error(`Não foi possível pagar: ${error.message}`); return; }
    toast.success(`${ids.length} comissão(ões) marcada(s) como paga(s).`);
    setMarcadas(new Set());
    void qc.invalidateQueries({ queryKey: ["erp_comissoes"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Banknote className="h-6 w-6" /> Comissões
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Geradas automaticamente a cada venda com vendedor. O % vem do funcionário; produto ou serviço com % próprio sobrepõe.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5"><Label>De</Label><Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Até</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Vendedor</Label>
            <ComboboxBusca
              itens={funcionarios.map((f: any) => ({ id: f.id, rotulo: f.pessoa?.nome_razao ?? f.cargo ?? "—", detalhe: f.cargo ?? undefined }))}
              value={funcionarioId} onChange={setFuncionarioId} vazio="Todos" />
          </div>
          <div className="space-y-1.5">
            <Label>Situação</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              <option value="todas">Todas</option>
              <option value="pendente">Pendentes</option>
              <option value="paga">Pagas</option>
              <option value="cancelada">Canceladas</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">A pagar no período</p><p className="text-2xl font-semibold text-amber-600">{brl(totalPendente)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Pagas no período</p><p className="text-2xl font-semibold text-green-600">{brl(totalPaga)}</p></CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground mb-1">Por vendedor (a pagar)</p>
          {porVendedor.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <ul className="text-sm space-y-0.5">
              {porVendedor.slice(0, 4).map((r) => (
                <li key={r.nome} className="flex justify-between gap-2"><span className="truncate">{r.nome}</span><span className="tabular-nums">{brl(r.pendente)}</span></li>
              ))}
            </ul>
          )}
        </CardContent></Card>
      </div>

      {/* Metas do período */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> Metas no período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* O realizado vem do banco, das vendas finalizadas com vendedor.
              Somar no front daria número diferente do relatório. */}
          {metas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma meta que alcance este período. Crie abaixo — o acompanhamento
              aparece assim que houver venda do funcionário no intervalo.
            </p>
          ) : (
            <ul className="space-y-2">
              {metas.map((m: any) => {
                const nome = funcionarios.find((f: any) => f.id === m.funcionario_id)?.pessoa?.nome_razao ?? "—";
                const pct = Math.min(200, Number(m.percentual ?? 0));
                const bateu = Number(m.realizado) >= Number(m.meta);
                return (
                  <li key={m.meta_id} className="rounded-md border p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {date(m.periodo_inicio)} a {date(m.periodo_fim)} · {m.tipo === "valor" ? "faturamento" : "itens"}
                      </span>
                      <span className="tabular-nums">
                        {m.tipo === "valor" ? brl(Number(m.realizado)) : Number(m.realizado)}
                        {" de "}
                        {m.tipo === "valor" ? brl(Number(m.meta)) : Number(m.meta)}
                      </span>
                      <span className={`text-sm font-semibold ${bateu ? "text-green-600" : "text-amber-600"}`}>
                        {Number(m.percentual ?? 0).toFixed(1)}%
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 px-2"
                        onClick={() => {
                          if (confirm(`Excluir a meta de ${nome}?`)) void excluirMeta.mutateAsync(m.meta_id);
                        }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${bateu ? "bg-green-600" : "bg-amber-500"}`}
                        style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Criar meta usa o mesmo período dos filtros acima: a meta é do
              intervalo que se está olhando, e repetir as datas aqui seria
              mais um lugar para elas discordarem. */}
          <div className="grid gap-2 border-t pt-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Funcionário</Label>
              <ComboboxBusca
                itens={funcionarios.map((f: any) => ({ id: f.id, rotulo: f.pessoa?.nome_razao ?? f.cargo ?? "—", detalhe: f.cargo ?? undefined }))}
                value={novaMeta.funcionarioId}
                onChange={(v) => setNovaMeta({ ...novaMeta, funcionarioId: v })}
                vazio="Escolha" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={novaMeta.tipo} onChange={(e) => setNovaMeta({ ...novaMeta, tipo: e.target.value })}>
                <option value="valor">Faturamento (R$)</option>
                <option value="quantidade">Itens vendidos</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Meta de {date(ini)} a {date(fim)}</Label>
              <div className="flex gap-2">
                <Input type="number" min="0" step="0.01" value={novaMeta.valor}
                  onChange={(e) => setNovaMeta({ ...novaMeta, valor: e.target.value })} />
                <Button size="sm" disabled={!novaMeta.funcionarioId || !novaMeta.valor || criarMeta.isPending}
                  onClick={async () => {
                    try {
                      await criarMeta.mutateAsync({
                        lojaId: lojaId as string,
                        funcionarioId: novaMeta.funcionarioId,
                        periodoInicio: ini,
                        periodoFim: fim,
                        tipo: novaMeta.tipo,
                        valor: Number(novaMeta.valor),
                      });
                      setNovaMeta({ funcionarioId: "", tipo: "valor", valor: "" });
                      toast.success("Meta criada.");
                    } catch (e: any) {
                      // o índice único recusa meta repetida do mesmo tipo e período
                      toast.error(`Não foi possível criar: ${e.message ?? e}`);
                    }
                  }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">{comissoes.length} comissão(ões)</CardTitle>
          <div className="flex gap-2">
            <Input type="date" className="h-8 w-36" value={vencimento}
              onChange={(e) => setVencimento(e.target.value)} title="Vencimento da conta a pagar" />
            <Button size="sm" variant="outline" disabled={marcadas.size === 0 || lancarEmContas.isPending}
              onClick={() => void lancar()} title="Gera a conta a pagar com o total por funcionário">
              {lancarEmContas.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Lançar em Contas a Pagar
            </Button>
            <Button size="sm" variant="outline" disabled={marcadas.size === 0 || pagando} onClick={() => void pagar(Array.from(marcadas))}>
              {pagando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Pagar selecionadas ({marcadas.size})
            </Button>
            <Button size="sm" disabled={pendentesVisiveis.length === 0 || pagando} onClick={() => void pagar(pendentesVisiveis.map((c) => c.id))}>
              Pagar todas pendentes ({pendentesVisiveis.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : comissoes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma comissão no período. Ela aparece quando uma venda é finalizada com vendedor e o funcionário (ou o produto/serviço) tem % de comissão.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 w-8"></th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Venda</th>
                  <th className="text-left p-3">Vendedor</th>
                  <th className="text-right p-3">Valor venda</th>
                  <th className="text-right p-3">%</th>
                  <th className="text-right p-3">Comissão</th>
                  <th className="text-center p-3">Situação</th>
                  <th className="text-center p-3">Conta</th>
                </tr>
              </thead>
              <tbody>
                {comissoes.map((c: any) => (
                  <tr key={c.id} className="border-b hover:bg-accent">
                    <td className="p-3">
                      {c.status === "pendente" && (
                        <input type="checkbox" checked={marcadas.has(c.id)} onChange={() => alternar(c.id)} aria-label="Selecionar" />
                      )}
                    </td>
                    <td className="p-3">{date(c.data_referencia)}</td>
                    <td className="p-3 font-mono text-xs">{c.venda?.numero_pedido ?? "—"}</td>
                    <td className="p-3">{nomeDe(c)}</td>
                    <td className="p-3 text-right tabular-nums">{brl(c.valor_venda)}</td>
                    <td className="p-3 text-right tabular-nums">{Number(c.percentual_comissao).toFixed(2)}%</td>
                    <td className="p-3 text-right tabular-nums font-medium">{brl(c.valor_comissao)}</td>
                    <td className="p-3 text-center">
                      <Badge variant={c.status === "paga" ? "default" : c.status === "cancelada" ? "destructive" : "outline"}>
                        {c.status}{c.status === "paga" && c.data_pagamento ? ` · ${date(c.data_pagamento)}` : ""}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      {c.conta_id
                        ? <Badge variant="secondary" className="text-[10px]">lançada</Badge>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

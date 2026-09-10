// ============================================================
// Comissões — o que cada vendedor tem a receber, por período.
//
// A comissão nasce sozinha na venda finalizada com vendedor (trigger no
// banco) e é cancelada se a venda cair. Aqui só se confere e se marca
// como paga — nada é digitado à mão, para o número bater com a venda.
// ============================================================

import { useMemo, useState } from "react";
import { Banknote, CheckCircle2, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboboxBusca } from "@/components/ui/combobox-busca";
import { supabase } from "@/lib/supabase";
import { useFuncionarios, isSupabaseConfigured } from "@/lib/supabase-queries";
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
  const [pagando, setPagando] = useState(false);

  const { data: comissoes = [], isLoading } = useQuery<any[]>({
    queryKey: ["erp_comissoes", lojaId, ini, fim, funcionarioId, status],
    enabled: !!lojaId,
    queryFn: async () => {
      let q = supabase
        .from("erp_comissoes")
        .select("*, funcionario:erp_funcionarios(id, cargo, pessoa:erp_pessoas(nome_razao)), venda:erp_vendas(numero, data_venda)")
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">{comissoes.length} comissão(ões)</CardTitle>
          <div className="flex gap-2">
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
                    <td className="p-3 font-mono text-xs">{c.venda?.numero ?? "—"}</td>
                    <td className="p-3">{nomeDe(c)}</td>
                    <td className="p-3 text-right tabular-nums">{brl(c.valor_venda)}</td>
                    <td className="p-3 text-right tabular-nums">{Number(c.percentual_comissao).toFixed(2)}%</td>
                    <td className="p-3 text-right tabular-nums font-medium">{brl(c.valor_comissao)}</td>
                    <td className="p-3 text-center">
                      <Badge variant={c.status === "paga" ? "default" : c.status === "cancelada" ? "destructive" : "outline"}>
                        {c.status}{c.status === "paga" && c.data_pagamento ? ` · ${date(c.data_pagamento)}` : ""}
                      </Badge>
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

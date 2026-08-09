import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Pie, PieChart, Cell } from "recharts";
import { Store, TrendingUp, Receipt, PackageX, AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useVendas } from "@/lib/store/sales-store";
import { useLojas } from "@/lib/store/stores-store";
import { useProdutos, getEstoqueLoja } from "@/lib/store/products-store";
import { brl, num, pct } from "@/lib/format";

const CORES = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--muted-foreground))"];

type Periodo = "7" | "30" | "90" | "365" | "all";
const PERIODO_LABEL: Record<Periodo, string> = { "7": "Últimos 7 dias", "30": "Últimos 30 dias", "90": "Últimos 90 dias", "365": "Último ano", all: "Todo o período" };

function Kpi({ label, value, hint, icon: Icon, tone = "default" }: any) {
  const toneClass = tone === "destructive" ? "bg-destructive/10 text-destructive" : tone === "warning" ? "bg-warning/15 text-warning-foreground" : "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function VisaoGeralPage() {
  const lojas = useLojas();
  const vendas = useVendas();
  const produtos = useProdutos();
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [selecionadas, setSelecionadas] = useState<string[]>(() => lojas.map((l) => l.id));

  const lojasAtivas = selecionadas.length === 0 ? lojas.map((l) => l.id) : selecionadas;

  const desde = useMemo(() => {
    if (periodo === "all") return 0;
    const d = new Date();
    d.setDate(d.getDate() - Number(periodo));
    return d.getTime();
  }, [periodo]);

  const vendasFiltradas = vendas.filter((v) => lojasAtivas.includes(v.lojaId) && new Date(v.data).getTime() >= desde);

  const kpis = useMemo(() => {
    const total = vendasFiltradas.reduce((s, v) => s + v.total, 0);
    const custo = vendasFiltradas.reduce((s, v) => s + v.itens.reduce((a, i) => a + i.precoCusto * i.quantidade, 0), 0);
    const lucro = total - custo;
    const margem = total > 0 ? lucro / total : 0;
    const ticket = vendasFiltradas.length ? total / vendasFiltradas.length : 0;
    return { total, lucro, margem, ticket, qtd: vendasFiltradas.length };
  }, [vendasFiltradas]);

  const porLoja = useMemo(() => {
    return lojasAtivas.map((lojaId) => {
      const loja = lojas.find((l) => l.id === lojaId);
      const vs = vendasFiltradas.filter((v) => v.lojaId === lojaId);
      const receita = vs.reduce((s, v) => s + v.total, 0);
      const custo = vs.reduce((s, v) => s + v.itens.reduce((a, i) => a + i.precoCusto * i.quantidade, 0), 0);
      const lucro = receita - custo;
      const margem = receita > 0 ? lucro / receita : 0;
      return { id: lojaId, nome: loja?.apelido ?? lojaId, vendas: vs.length, receita, lucro, margem, ticket: vs.length ? receita / vs.length : 0 };
    }).sort((a, b) => b.receita - a.receita);
  }, [vendasFiltradas, lojasAtivas, lojas]);

  const porDia = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const v of vendasFiltradas) {
      const key = new Date(v.data).toLocaleDateString("pt-BR");
      const row = map.get(key) ?? {};
      row[v.lojaId] = (row[v.lojaId] ?? 0) + v.total;
      map.set(key, row);
    }
    return [...map.entries()].map(([dia, valores]) => ({ dia, ...valores })).slice(-30);
  }, [vendasFiltradas]);

  const porPagamento = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of vendasFiltradas) map.set(v.formaPagamento, (map.get(v.formaPagamento) ?? 0) + v.total);
    return [...map.entries()].map(([nome, total]) => ({ nome, total }));
  }, [vendasFiltradas]);

  const topProdutos = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; total: number; custo: number }>();
    for (const v of vendasFiltradas) {
      for (const i of v.itens) {
        const cur = map.get(i.produtoId) ?? { nome: i.nome, qtd: 0, total: 0, custo: 0 };
        cur.qtd += i.quantidade;
        cur.total += i.precoUnit * i.quantidade;
        cur.custo += i.precoCusto * i.quantidade;
        map.set(i.produtoId, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  }, [vendasFiltradas]);

  const estoquePorLoja = useMemo(() => {
    return lojasAtivas.map((lojaId) => {
      const loja = lojas.find((l) => l.id === lojaId);
      let unidades = 0, baixo = 0, esgotado = 0, valor = 0;
      for (const p of produtos) {
        const q = getEstoqueLoja(p.id, lojaId);
        unidades += q;
        valor += q * p.precoCusto;
        if (q === 0) esgotado++;
        else if (q <= p.estoqueMinimo) baixo++;
      }
      return { id: lojaId, nome: loja?.apelido ?? lojaId, unidades, baixo, esgotado, valor };
    });
  }, [produtos, lojasAtivas, lojas]);

  const valorEstoque = estoquePorLoja.reduce((s, e) => s + e.valor, 0);
  const totalBaixo = estoquePorLoja.reduce((s, e) => s + e.baixo, 0);
  const totalEsgotado = estoquePorLoja.reduce((s, e) => s + e.esgotado, 0);

  const toggleLoja = (id: string) => {
    setSelecionadas((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const vazio = vendasFiltradas.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Visão Geral · Todas as Lojas" description="Consolidado multi-loja com filtros por período e por unidade." />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Período</span>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIODO_LABEL) as Periodo[]).map((p) => (
                  <SelectItem key={p} value={p}>{PERIODO_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lojas</span>
            <div className="flex flex-wrap gap-2">
              {lojas.map((l) => {
                const on = selecionadas.includes(l.id);
                return (
                  <label key={l.id} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition ${on ? "border-primary bg-primary/10" : "border-border bg-card text-muted-foreground"}`}>
                    <Checkbox checked={on} onCheckedChange={() => toggleLoja(l.id)} />
                    <span>{l.apelido}</span>
                  </label>
                );
              })}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelecionadas(selecionadas.length === lojas.length ? [] : lojas.map((l) => l.id))}>
              {selecionadas.length === lojas.length ? "Limpar" : "Todas"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Faturamento" value={brl(kpis.total)} hint={`${num(kpis.qtd)} vendas · ticket ${brl(kpis.ticket)}`} icon={TrendingUp} />
        <Kpi label="Lucro bruto" value={brl(kpis.lucro)} hint={`Margem ${pct(kpis.margem)}`} icon={Receipt} />
        <Kpi label="Estoque baixo" value={num(totalBaixo)} hint={`${num(totalEsgotado)} esgotados`} icon={PackageX} tone="destructive" />
        <Kpi label="Valor em estoque" value={brl(valorEstoque)} hint="custo total" icon={AlertTriangle} tone="warning" />
      </div>

      {vazio ? (
        <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">Nenhuma venda no período/lojas selecionadas.</CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Vendas por dia · por loja</CardTitle></CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porDia} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$ ${v}`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => brl(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {lojasAtivas.map((id, i) => {
                      const loja = lojas.find((l) => l.id === id);
                      return <Bar key={id} dataKey={id} name={loja?.apelido ?? id} stackId="a" fill={CORES[i % CORES.length]} />;
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Formas de pagamento</CardTitle></CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={porPagamento} dataKey="total" nameKey="nome" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {porPagamento.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => brl(v)} />
                    <Legend wrapperStyle={{ fontSize: 12, textTransform: "capitalize" }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Comparativo por loja</CardTitle>
              <Badge variant="outline">{porLoja.length} unidade(s)</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loja</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Ticket médio</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                    <TableHead className="text-right">Participação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porLoja.map((l) => {
                    const share = kpis.total > 0 ? l.receita / kpis.total : 0;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.nome}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(l.vendas)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(l.receita)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(l.ticket)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(l.lucro)}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(l.margem)}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(share)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Top produtos · consolidado</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProdutos.map((p) => {
                    const lucro = p.total - p.custo;
                    const margem = p.total > 0 ? lucro / p.total : 0;
                    return (
                      <TableRow key={p.nome}>
                        <TableCell className="font-medium">{p.nome}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(p.qtd)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(p.total)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{brl(lucro)}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(margem)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
// ============================================================
// Página: Visão geral — a tela única de acompanhamento.
//
// Existiam duas telas que respondiam quase a mesma pergunta: o Dashboard
// ("hoje, nesta loja") e a Visão Geral ("no período, comparando lojas").
// Quem queria saber como a loja ia precisava olhar as duas e conciliar de
// cabeça — e "Estoque baixo" aparecia nas duas, com contas diferentes.
//
// Aqui é uma tela só, com período e lojas escolhidos no topo: o mesmo
// filtro vale para tudo que está abaixo, dos KPIs ao comparativo.
//
// As vendas vêm de useRelatorioVendas, não de useVendas: aquele para em
// 200 linhas e a Visão Geral avisava, em letra miúda, que o faturamento
// podia estar truncado. Número de faturamento com asterisco não serve.
// ============================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowUpRight, PackageX, Receipt, Store, TrendingUp, Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { FiltrosRelatorio, periodoPadrao, type Periodo } from "@/components/relatorio/filtros-relatorio";
import {
  useLojas, useProdutosComEstoque, useRelatorioVendas, useContasVencidas,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { brl, num, pct } from "@/lib/format";

const CORES = [
  "hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--muted-foreground))",
];

const NOME_FORMA: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", cartao_credito: "Cartão crédito",
  cartao_debito: "Cartão débito", crediario: "Crediário", boleto: "Boleto",
};

function Kpi({ label, value, hint, icon: Icon, tone = "default", para }: any) {
  const cor = tone === "destructive" ? "bg-destructive/10 text-destructive"
    : tone === "warning" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
    : "bg-primary/10 text-primary";
  const corpo = (
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cor}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CardContent>
  );
  // KPI que aponta para uma tela vira atalho: o número sozinho não resolve
  return para
    ? <Card className="transition hover:border-primary"><Link to={para}>{corpo}</Link></Card>
    : <Card>{corpo}</Card>;
}

export function DashboardPage() {
  const [periodo, setPeriodo] = useState<Periodo>(periodoPadrao(30));
  const [selecionadas, setSelecionadas] = useState<string[]>([]);

  const { data: lojas = [] } = useLojas();
  const { data: produtos = [] } = useProdutosComEstoque();
  const { data: contasVencidas = [] } = useContasVencidas();
  const { data: vendas = [], isLoading } = useRelatorioVendas({ de: periodo.de, ate: periodo.ate });

  // nenhuma marcada = todas: abrir a tela já mostrando a rede inteira
  const lojasAtivas = selecionadas.length === 0 ? lojas.map((l: any) => l.id) : selecionadas;

  const vendasFiltradas = useMemo(
    () => (vendas as any[]).filter((v) => lojasAtivas.includes(v.loja_id) && v.status === "finalizada"),
    [vendas, lojasAtivas],
  );

  const kpis = useMemo(() => {
    const total = vendasFiltradas.reduce((s, v) => s + Number(v.total || 0), 0);
    const custo = vendasFiltradas.reduce((s, v) => s + Number(v.custo_total || 0), 0);
    const lucro = total - custo;
    return {
      total, lucro,
      margem: total > 0 ? lucro / total : 0,
      ticket: vendasFiltradas.length ? total / vendasFiltradas.length : 0,
      qtd: vendasFiltradas.length,
    };
  }, [vendasFiltradas]);

  const estoquePorLoja = useMemo(() => {
    return lojasAtivas.map((lojaId: string) => {
      const loja = lojas.find((l: any) => l.id === lojaId);
      let unidades = 0, baixo = 0, esgotado = 0, valor = 0;
      for (const p of produtos as any[]) {
        const q = p.estoque_por_loja?.[lojaId] ?? 0;
        unidades += q;
        valor += q * Number(p.preco_custo || 0);
        if (q === 0) esgotado++;
        else if (q <= p.estoque_minimo) baixo++;
      }
      return { id: lojaId, nome: loja?.apelido ?? lojaId, unidades, baixo, esgotado, valor };
    });
  }, [produtos, lojasAtivas, lojas]);

  const valorEstoque = estoquePorLoja.reduce((s, e) => s + e.valor, 0);
  const totalBaixo = estoquePorLoja.reduce((s, e) => s + e.baixo, 0);
  const totalEsgotado = estoquePorLoja.reduce((s, e) => s + e.esgotado, 0);

  const vencidasDasLojas = useMemo(
    () => (contasVencidas as any[]).filter((c) => !c.loja_id || lojasAtivas.includes(c.loja_id)),
    [contasVencidas, lojasAtivas],
  );
  const valorVencido = vencidasDasLojas.reduce((s, c) => s + Number(c.valor || 0), 0);

  const porDia = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const v of vendasFiltradas) {
      const dia = String(v.data_venda).slice(0, 10);
      const linha = m.get(dia) ?? {};
      linha[v.loja_id] = (linha[v.loja_id] ?? 0) + Number(v.total || 0);
      m.set(dia, linha);
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dia, valores]) => ({
        dia: dia.slice(8, 10) + "/" + dia.slice(5, 7),
        ...valores,
      }))
      .slice(-60);
  }, [vendasFiltradas]);

  const porPagamento = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of vendasFiltradas) {
      const f = v.forma_pagamento ?? "outros";
      m.set(f, (m.get(f) ?? 0) + Number(v.total || 0));
    }
    return [...m.entries()].map(([f, total]) => ({ nome: NOME_FORMA[f] ?? f, total }));
  }, [vendasFiltradas]);

  const topProdutos = useMemo(() => {
    const m = new Map<string, { nome: string; quantidade: number; total: number }>();
    for (const v of vendasFiltradas) {
      for (const i of (v.itens ?? []) as any[]) {
        const chave = i.produto_id ?? i.nome;
        const a = m.get(chave) ?? { nome: i.nome, quantidade: 0, total: 0 };
        a.quantidade += Number(i.quantidade || 0);
        a.total += Number(i.subtotal || 0);
        m.set(chave, a);
      }
    }
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  }, [vendasFiltradas]);

  const porLoja = useMemo(() => {
    return lojasAtivas.map((lojaId: string) => {
      const loja = lojas.find((l: any) => l.id === lojaId);
      const vs = vendasFiltradas.filter((v) => v.loja_id === lojaId);
      const receita = vs.reduce((s, v) => s + Number(v.total || 0), 0);
      const custo = vs.reduce((s, v) => s + Number(v.custo_total || 0), 0);
      const lucro = receita - custo;
      return {
        id: lojaId, nome: loja?.apelido ?? lojaId, vendas: vs.length, receita, lucro,
        margem: receita > 0 ? lucro / receita : 0,
        ticket: vs.length ? receita / vs.length : 0,
      };
    }).sort((a, b) => b.receita - a.receita);
  }, [vendasFiltradas, lojasAtivas, lojas]);

  const alternarLoja = (id: string) =>
    setSelecionadas((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Visão geral" />;

  const semVenda = !isLoading && vendasFiltradas.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O período e as lojas escolhidos aqui valem para tudo nesta tela.
        </p>
      </div>

      <FiltrosRelatorio
        periodo={periodo}
        aoMudarPeriodo={setPeriodo}
        aoLimpar={() => { setPeriodo(periodoPadrao(30)); setSelecionadas([]); }}
      >
        {lojas.length > 1 && (
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Store className="h-3.5 w-3.5" /> Lojas
            </p>
            <div className="flex flex-wrap gap-2">
              {lojas.map((l: any) => {
                const on = lojasAtivas.includes(l.id);
                return (
                  <label key={l.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition ${
                      on ? "border-primary bg-primary/10" : "border-border bg-card text-muted-foreground"}`}>
                    <Checkbox checked={on} onCheckedChange={() => alternarLoja(l.id)} />
                    <span>{l.apelido ?? l.nome}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </FiltrosRelatorio>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Faturamento" icon={TrendingUp}
          value={isLoading ? "…" : brl(kpis.total)}
          hint={`${num(kpis.qtd)} venda(s) · ticket ${brl(kpis.ticket)}`} />
        <Kpi label="Lucro bruto" icon={Receipt}
          value={isLoading ? "…" : brl(kpis.lucro)}
          hint={`Margem ${pct(kpis.margem)}`}
          tone={kpis.lucro < 0 ? "destructive" : "default"} />
        <Kpi label="Estoque baixo" icon={PackageX} para="/produtos-estoque-lotes"
          value={num(totalBaixo)} hint={`${num(totalEsgotado)} esgotado(s)`}
          tone={totalBaixo > 0 ? "destructive" : "default"} />
        <Kpi label="Contas vencidas" icon={AlertTriangle} para="/financeiro"
          value={num(vencidasDasLojas.length)} hint={brl(valorVencido)}
          tone={vencidasDasLojas.length > 0 ? "destructive" : "default"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Valor em estoque" icon={Wallet} value={brl(valorEstoque)} hint="a preço de custo" tone="warning" />
      </div>

      {semVenda ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            Nenhuma venda no período e nas lojas escolhidas.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-base">Vendas por dia</CardTitle></CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porDia} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$ ${v}`} />
                    <Tooltip formatter={(v: number) => brl(v)}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    {lojasAtivas.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
                    {lojasAtivas.map((id: string, i: number) => (
                      <Bar key={id} dataKey={id} stackId="a" fill={CORES[i % CORES.length]}
                        name={(lojas.find((l: any) => l.id === id) as any)?.apelido ?? id} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Formas de pagamento</CardTitle></CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={porPagamento} dataKey="total" nameKey="nome" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {porPagamento.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => brl(v)}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Produtos mais vendidos</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/relatorios">Relatórios <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {topProdutos.map((p, i) => (
                    <div key={p.nome} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-xs font-medium tabular-nums">{i + 1}</div>
                      <div className="min-w-0 flex-1 truncate font-medium">{p.nome}</div>
                      <div className="w-20 text-right tabular-nums text-muted-foreground">{num(p.quantidade)} un.</div>
                      <div className="w-24 text-right font-medium tabular-nums">{brl(p.total)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
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
                      <TableHead className="text-right">Ticket</TableHead>
                      <TableHead className="text-right">Margem</TableHead>
                      <TableHead className="text-right">Parte</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {porLoja.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.nome}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(l.vendas)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(l.receita)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(l.ticket)}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(l.margem)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {pct(kpis.total > 0 ? l.receita / kpis.total : 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

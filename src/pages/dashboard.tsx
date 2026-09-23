// ============================================================
// Página: Visão geral — a tela única de acompanhamento.
//
// Existiam duas telas que respondiam quase a mesma pergunta: o Dashboard
// ("hoje, nesta loja") e a Visão Geral ("no período, comparando lojas").
// Quem queria saber como a loja ia precisava olhar as duas e conciliar de
// cabeça — e "Estoque baixo" aparecia nas duas, com contas diferentes.
//
// Aqui é uma tela só, com o período escolhido na página e a filial escolhida
// no seletor do topo — como em todas as telas de movimento. Cada filial tem
// os próprios dados; a tela tinha caixas de seleção de loja próprias, que
// discordavam do topo e deixavam o número da tela sem dono claro.
//
// As vendas vêm de useRelatorioVendas, não de useVendas: aquele para em
// 200 linhas e a Visão Geral avisava, em letra miúda, que o faturamento
// podia estar truncado. Número de faturamento com asterisco não serve.
// ============================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowUpRight, PackageX, Receipt, TrendingUp, Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { FiltrosRelatorio, periodoPadrao, type Periodo } from "@/components/relatorio/filtros-relatorio";
import {
  useProdutosComEstoque, useRelatorioVendas, useContasVencidas,
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

  // A filial é a do seletor do topo. Consulta já filtrada no banco, não
  // filtrada depois na tela: buscar as duas lojas para jogar uma fora é
  // trazer o dobro de venda para mostrar metade.
  const { lojaId, lojas } = useAutoSelectLoja();
  const loja = lojaId ?? undefined;
  const { data: produtos = [] } = useProdutosComEstoque(loja);
  const { data: contasVencidas = [] } = useContasVencidas(loja);
  const { data: vendas = [], isLoading } = useRelatorioVendas({ lojaId: loja, de: periodo.de, ate: periodo.ate });
  const nomeLoja = (lojas as any[]).find((l) => l.id === lojaId)?.apelido ?? "filial";

  const lojasAtivas = useMemo(() => (lojaId ? [lojaId] : []), [lojaId]);

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


  // O que repor primeiro: esgotados antes, depois os mais abaixo do mínimo.
  // Substitui o "comparativo por loja", que com uma filial por vez teria
  // sempre uma linha só, com 100% de participação.
  const paraRepor = useMemo(() => {
    if (!lojaId) return [];
    return (produtos as any[])
      .map((p) => ({ p, q: Number(p.estoque_por_loja?.[lojaId] ?? 0), min: Number(p.estoque_minimo ?? 0) }))
      .filter((x) => x.q === 0 || (x.min > 0 && x.q <= x.min))
      .sort((a, b) => (a.q === 0 ? -1 : 0) - (b.q === 0 ? -1 : 0) || (a.q - a.min) - (b.q - b.min))
      .slice(0, 8);
  }, [produtos, lojaId]);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Visão geral" />;

  const semVenda = !isLoading && vendasFiltradas.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral · {nomeLoja}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Números só desta filial. Para ver a outra, troque a loja no topo.
        </p>
      </div>

      <FiltrosRelatorio
        periodo={periodo}
        aoMudarPeriodo={setPeriodo}
        aoLimpar={() => setPeriodo(periodoPadrao(30))}
      >
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
            Nenhuma venda desta filial no período.
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
                  <Link to="/financeiro?aba=relatorios">Relatórios <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link>
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
                <CardTitle className="text-base">Repor em {nomeLoja}</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/produtos-estoque-lotes">Estoque <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {paraRepor.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Nada esgotado nem abaixo do mínimo nesta filial.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead className="text-right">Mínimo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paraRepor.map(({ p, q, min }) => (
                        <TableRow key={p.id}>
                          <TableCell className="max-w-[16rem] truncate font-medium">{p.nome}</TableCell>
                          <TableCell className={`text-right tabular-nums ${q === 0 ? "font-semibold text-red-600" : "text-amber-600"}`}>
                            {q === 0 ? "esgotado" : num(q)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{num(min)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

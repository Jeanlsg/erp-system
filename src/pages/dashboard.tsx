import { useMemo } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Receipt, AlertTriangle, PackageX, ScanBarcode, Package, ArrowUpRight, Calendar } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { brl, num } from "@/lib/format";
import { useLojaAtualStore } from "@/lib/store/loja-atual";
import { useDashboardStats, useVendasPorDia, useTopProdutos } from "@/lib/supabase-queries";

const DIA_LABEL: Record<number, string> = { 0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };

function KpiCard({ label, value, delta, icon: Icon, tone = "default" }: any) {
  const toneClass = tone === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
            {delta && <p className="mt-1 text-xs text-muted-foreground">{delta}</p>}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const lojaId = useLojaAtualStore((s) => s.currentLojaId);
  const { data: stats } = useDashboardStats(lojaId ?? undefined);
  const { data: vendasPorDia = [] } = useVendasPorDia(lojaId ?? "", 7);
  const { data: topProdutos = [] } = useTopProdutos(lojaId ?? "", 5, 7);

  const grafico7d = useMemo(() => {
    const arr: { day: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const total = vendasPorDia.find((v) => v.dia === key)?.total ?? 0;
      arr.push({ day: DIA_LABEL[d.getDay()] ?? "?", total });
    }
    return arr;
  }, [vendasPorDia]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral da operação · hoje, {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/produtos"><Package className="mr-2 h-4 w-4" /> Produtos</Link>
          </Button>
          <Button asChild>
            <Link to="/pdv"><ScanBarcode className="mr-2 h-4 w-4" /> Abrir PDV</Link>
          </Button>
        </div>
      </header>

      {!lojaId ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Configure as variáveis do Supabase no <code>.env</code> e selecione uma loja no header.
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Vendas hoje" value={brl(stats?.vendasHoje ?? 0)} delta={`${num(stats?.ticketsHoje ?? 0)} tickets`} icon={TrendingUp} />
            <KpiCard label="Ticket médio" value={brl(stats?.ticketMedio ?? 0)} delta={`${num(stats?.ticketsHoje ?? 0)} vendas hoje`} icon={Receipt} />
            <KpiCard label="Estoque baixo" value={num(stats?.produtosEstoqueBaixo ?? 0)} delta="produtos abaixo do mínimo" icon={PackageX} tone={(stats?.produtosEstoqueBaixo ?? 0) > 0 ? "destructive" : "default"} />
            <KpiCard label="Contas vencidas" value={num(stats?.contasVencidas ?? 0)} delta={brl(stats?.valorContasVencidas ?? 0)} icon={AlertTriangle} tone={(stats?.contasVencidas ?? 0) > 0 ? "destructive" : "default"} />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Vendas nos últimos 7 dias</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {grafico7d.every((d) => d.total === 0) ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    <Calendar className="mr-2 h-4 w-4" />
                    Sem vendas registradas nos últimos 7 dias.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={grafico7d} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$ ${v}`} />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => brl(v)} />
                      <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#g1)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Alertas</CardTitle>
                <Badge variant="outline" className="font-normal">
                  {(stats?.produtosEstoqueBaixo ?? 0) + (stats?.contasVencidas ?? 0)}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {(stats?.produtosEstoqueBaixo ?? 0) === 0 && (stats?.contasVencidas ?? 0) === 0 ? (
                  <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
                    Tudo certo por aqui · nenhum alerta no momento.
                  </div>
                ) : (
                  <>
                    {(stats?.produtosEstoqueBaixo ?? 0) > 0 && (
                      <Link to="/produtos" className="flex items-start gap-3 rounded-md border bg-card p-3 hover:bg-accent">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                          <PackageX className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{stats?.produtosEstoqueBaixo} produtos</p>
                          <p className="text-xs text-muted-foreground">Abaixo do estoque mínimo</p>
                        </div>
                      </Link>
                    )}
                    {(stats?.contasVencidas ?? 0) > 0 && (
                      <Link to="/financeiro" className="flex items-start gap-3 rounded-md border bg-card p-3 hover:bg-accent">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{stats?.contasVencidas} contas vencidas</p>
                          <p className="text-xs text-muted-foreground">{brl(stats?.valorContasVencidas ?? 0)}</p>
                        </div>
                      </Link>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </section>

          <section>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Top produtos</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/relatorios">Ver relatórios <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {topProdutos.length === 0 ? (
                  <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                    Sem vendas registradas para gerar ranking.
                  </div>
                ) : (
                  <div className="divide-y">
                    {topProdutos.map((p, i) => (
                      <div key={p.nome} className="flex items-center gap-4 px-6 py-3 text-sm">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-xs font-medium tabular-nums">{i + 1}</div>
                        <div className="flex-1 truncate font-medium">{p.nome}</div>
                        <div className="w-24 text-right tabular-nums text-muted-foreground">{num(p.quantidade)} un.</div>
                        <div className="w-28 text-right tabular-nums font-medium">{brl(p.total)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
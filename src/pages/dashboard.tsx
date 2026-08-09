import { useMemo } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Receipt, AlertTriangle, PackageX, ScanBarcode, Package, ArrowUpRight, Calendar } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { brl, num } from "@/lib/format";
import { useVendas } from "@/lib/store/sales-store";
import { useProdutos, useEstoquePorLoja, getEstoqueLoja } from "@/lib/store/products-store";
import { useCurrentLojaId } from "@/lib/store/stores-store";

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
  const lojaId = useCurrentLojaId();
  const vendas = useVendas();
  const produtos = useProdutos();
  useEstoquePorLoja();

  const hoje = new Date().toISOString().slice(0, 10);
  const vendasLoja = vendas.filter((v) => v.lojaId === lojaId);
  const vendasHoje = vendasLoja.find((v) => v.data.slice(0, 10) === hoje);
  const totalHoje = vendasHoje?.total ?? 0;
  const ticketsHoje = vendasHoje ? 1 : 0;
  const ticketMedio = ticketsHoje > 0 ? totalHoje / ticketsHoje : 0;

  const estoqueBaixo = produtos.filter((p) => {
    const q = getEstoqueLoja(p.id, lojaId);
    return q <= p.estoqueMinimo;
  });

  const grafico7d = useMemo(() => {
    const arr: { day: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const total = vendasLoja.filter((v) => v.data.slice(0, 10) === key).reduce((s, v) => s + v.total, 0);
      arr.push({ day: DIA_LABEL[d.getDay()] ?? "?", total });
    }
    return arr;
  }, [vendasLoja]);

  const topProdutos = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; total: number }>();
    for (const v of vendasLoja) {
      for (const i of v.itens) {
        const cur = map.get(i.produtoId) ?? { nome: i.nome, qtd: 0, total: 0 };
        cur.qtd += i.quantidade;
        cur.total += i.precoUnit * i.quantidade;
        map.set(i.produtoId, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [vendasLoja]);

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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Vendas hoje" value={brl(totalHoje)} delta={totalHoje > 0 ? `${ticketsHoje} tickets` : "Sem vendas hoje"} icon={TrendingUp} />
        <KpiCard label="Ticket médio" value={brl(ticketMedio)} delta={ticketsHoje > 0 ? `${ticketsHoje} vendas hoje` : "Aguardando 1ª venda"} icon={Receipt} />
        <KpiCard label="Estoque baixo" value={num(estoqueBaixo.length)} delta="produtos abaixo do mínimo" icon={PackageX} tone={estoqueBaixo.length > 0 ? "destructive" : "default"} />
        <KpiCard label="Lotes críticos" value="0" delta="Sem alertas de validade" icon={AlertTriangle} />
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
            <Badge variant="outline" className="font-normal">{estoqueBaixo.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {estoqueBaixo.length === 0 ? (
              <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
                Tudo certo por aqui · nenhum alerta no momento.
              </div>
            ) : (
              estoqueBaixo.slice(0, 5).map((p) => {
                const q = getEstoqueLoja(p.id, lojaId);
                return (
                  <div key={p.id} className="flex items-start gap-3 rounded-md border bg-card p-3">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                      <PackageX className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">{q} un. (mínimo {p.estoqueMinimo})</p>
                    </div>
                  </div>
                );
              })
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
                    <div className="w-24 text-right tabular-nums text-muted-foreground">{num(p.qtd)} un.</div>
                    <div className="w-28 text-right tabular-nums font-medium">{brl(p.total)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wallet, Plus, Download, Loader2, Calendar, BarChart3, ShoppingCart,
  FileText, DollarSign, Receipt, Banknote, ClipboardList,
  TrendingUp, TrendingDown, Search,
} from "lucide-react";
import { brl, num, pct, date, dateTime } from "@/lib/format";
import {
  useFluxoCaixaKpis, useFormasRecebimento, useTopProdutosVendidos,
  useTaxasCartao, useSangriasPorPeriodo, useEntradasExtrasPorPeriodo,
  useVendasPorPeriodo, useContas, useNotasFiscais, useVendas,
  useCreateConta, isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { chart } from "@/lib/chart";

type AbaAtiva = "fluxo" | "vendas" | "graficos" | "formas" | "taxas" | "pagas" | "apagar" | "recebidas" | "areceber" | "nf";

export function FinanceiroPage() {
  const { lojaId } = useAutoSelectLoja();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const [aba, setAba] = useState<AbaAtiva>((searchParams.get("aba") as AbaAtiva) ?? "fluxo");

  // Filtro Período (default = mês atual)
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [dataInicio, setDataInicio] = useState(primeiroDia.toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState(hoje.toISOString().slice(0, 10));

  const kpis = useFluxoCaixaKpis(lojaId ?? undefined, dataInicio, dataFim);
  const formas = useFormasRecebimento(lojaId ?? undefined, dataInicio, dataFim);
  const topProdutos = useTopProdutosVendidos(lojaId ?? undefined, dataInicio, dataFim, 10);
  const taxas = useTaxasCartao(lojaId ?? undefined, dataInicio, dataFim);
  const sangrias = useSangriasPorPeriodo(lojaId ?? undefined, dataInicio, dataFim);
  const entradasExtras = useEntradasExtrasPorPeriodo(lojaId ?? undefined, dataInicio, dataFim);
  const vendasPorDia = useVendasPorPeriodo(lojaId ?? undefined, dataInicio, dataFim);

  // Hooks para as abas de Contas
  const { data: contasPagas = [] } = useContas({ lojaId: lojaId ?? undefined, tipo: "pagar", status: "pago" });
  const { data: contasAPagar = [] } = useContas({ lojaId: lojaId ?? undefined, tipo: "pagar", status: "pendente" });
  const { data: contasRecebidas = [] } = useContas({ lojaId: lojaId ?? undefined, tipo: "receber", status: "pago" });
  const { data: contasAReceber = [] } = useContas({ lojaId: lojaId ?? undefined, tipo: "receber", status: "pendente" });

  // Aba Vendas
  const { data: vendas = [] } = useVendas({ lojaId: lojaId ?? undefined, dataInicio, dataFim });

  // Aba NF
  const { data: notas = [] } = useNotasFiscais({ lojaId: lojaId ?? undefined });

  // Modal Incluir Conta
  const createConta = useCreateConta();
  const [modalConta, setModalConta] = useState<{ tipo: "pagar" | "receber" } | null>(null);
  const [formConta, setFormConta] = useState({ descricao: "", valor: "", data_vencimento: "", categoria: "" });

  // Modal Conta Bancária (placeholder)
  const [modalContaBancaria, setModalContaBancaria] = useState(false);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Relatórios Financeiros" />;
  if (!lojaId) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalPagas = contasPagas.reduce((s, c) => s + Number(c.valor), 0);
  const totalAPagar = contasAPagar.reduce((s, c) => s + Number(c.valor), 0);
  const totalRecebidas = contasRecebidas.reduce((s, c) => s + Number(c.valor), 0);
  const totalAReceber = contasAReceber.reduce((s, c) => s + Number(c.valor), 0);

  const totalTaxasCartao = (taxas.data ?? []).reduce((s, x: any) => s + Number(x.custo_taxa ?? 0), 0);

  // KPIs de NF
  const notasNoPeriodo = notas.length;
  const notasOk = notas.filter((n: any) => n.status === "autorizada").length;
  const notasCanceladas = notas.filter((n: any) => n.status === "cancelada").length;
  const notasDenegadas = notas.filter((n: any) => n.status === "denegada" || n.status === "rejeitada").length;
  const nfes = notas.filter((n: any) => n.tipo === "nfe").length;
  const nfces = notas.filter((n: any) => n.tipo === "nfce").length;
  const cfes = notas.filter((n: any) => n.tipo === "cfe").length;

  const margemLucro = kpis.data?.vendas_finalizadas ? (kpis.data.lucro_total / kpis.data.vendas_finalizadas) * 100 : 0;

  const handleCriarConta = async () => {
    if (!modalConta || !formConta.descricao || !formConta.valor || !formConta.data_vencimento) return;
    await createConta.mutateAsync({
      loja_id: lojaId,
      tipo: modalConta.tipo,
      descricao: formConta.descricao,
      valor: parseFloat(formConta.valor),
      data_vencimento: formConta.data_vencimento,
      categoria: formConta.categoria || null,
      status: "pendente",
    });
    setModalConta(null);
    setFormConta({ descricao: "", valor: "", data_vencimento: "", categoria: "" });
  };

  // ====== Componentes auxiliares ======
  const KpiCard = ({ titulo, valor, subtitulo, icone: Icon, cor = "text-foreground" }: any) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase text-muted-foreground">{titulo}</p>
            <p className={`text-2xl font-bold mt-1 ${cor}`}>{valor}</p>
            {subtitulo && <p className="text-xs text-muted-foreground mt-1">{subtitulo}</p>}
          </div>
          {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
        </div>
      </CardContent>
    </Card>
  );

  const BotaoAcao = ({ titulo, icone: Icon, onClick, badge }: any) => (
    <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-1" onClick={onClick}>
      {Icon && <Icon className="h-5 w-5" />}
      <span className="text-xs">{titulo}</span>
      {badge && <Badge variant="secondary" className="text-[10px]">{badge}</Badge>}
    </Button>
  );

  const TabelaSubTotal = ({ titulo, total, cor = "text-foreground" }: any) => (
    <table className="w-full">
      <thead className="border-b text-xs text-muted-foreground">
        <tr><th className="text-left p-3">Sub Total</th><th className="text-right p-3">Valor</th></tr>
      </thead>
      <tbody>
        <tr><td className="p-3 font-medium">{titulo}</td><td className={`p-3 text-right tabular-nums font-semibold ${cor}`}>{brl(total)}</td></tr>
      </tbody>
    </table>
  );

  // ===== Render =====
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6" /> Relatórios Financeiros
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Fluxo de caixa e movimentações</p>
        </div>
      </div>

      {/* FILTRO PERÍODO */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Selecione um período:</span>
            </div>
            <div>
              <Label className="text-xs">Data Inicial</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-44" />
            </div>
            <div>
              <Label className="text-xs">Data Final</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-44" />
            </div>
            <Button onClick={() => qc.invalidateQueries()}>
              <Search className="mr-2 h-4 w-4" /> Consultar
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Download className="mr-2 h-4 w-4" /> Imprimir
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* BOTÕES DE AÇÃO RÁPIDA (12 botões em grid 4x3) */}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
        <BotaoAcao titulo="Incluir Contas P/R" icone={Plus} onClick={() => setModalConta({ tipo: "pagar" })} />
        <BotaoAcao titulo="Sangrias de Caixa" icone={TrendingDown} onClick={() => setAba("pagas")} />
        <BotaoAcao titulo="Entradas Extra Caixa" icone={TrendingUp} onClick={() => setAba("pagas")} />
        <BotaoAcao titulo="Extrato de Serviços" icone={ClipboardList} onClick={() => alert("Extrato de Serviços — módulo administrativo")} />
        <BotaoAcao titulo="Fechamento Caixa" icone={Receipt} onClick={() => alert("Relatório de fechamento de caixa")} />
        <BotaoAcao titulo="Conta Bancária" icone={Banknote} onClick={() => setModalContaBancaria(true)} />
        <BotaoAcao titulo="Ações de NF" icone={FileText} onClick={() => setAba("nf")} />
        <BotaoAcao titulo="Vendas Excluídas" icone={Trash2} onClick={() => alert("Vendas excluídas")} />
        <BotaoAcao titulo="Contas Excluídas" icone={Trash2} onClick={() => alert("Contas excluídas")} />
        <BotaoAcao titulo="Relatório Gerencial" icone={BarChart3} onClick={() => alert("Relatório gerencial consolidado")} />
        <BotaoAcao titulo="Entregas Delivery" icone={ShoppingCart} onClick={() => alert("Entregas delivery")} />
        <BotaoAcao titulo="Entradas Canceladas" icone={X} onClick={() => alert("Entradas canceladas")} />
      </div>

      {/* ABAS */}
      <Tabs value={aba} onValueChange={(v) => setAba(v as AbaAtiva)}>
        <TabsList className="grid grid-cols-5 lg:grid-cols-10 w-full">
          <TabsTrigger value="fluxo">Fluxo</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="graficos">Gráficos</TabsTrigger>
          <TabsTrigger value="formas">Formas</TabsTrigger>
          <TabsTrigger value="taxas">Taxas</TabsTrigger>
          <TabsTrigger value="pagas">Pagas</TabsTrigger>
          <TabsTrigger value="apagar">À Pagar</TabsTrigger>
          <TabsTrigger value="recebidas">Recebidas</TabsTrigger>
          <TabsTrigger value="areceber">À Receber</TabsTrigger>
          <TabsTrigger value="nf">NF</TabsTrigger>
        </TabsList>

        {/* ===== ABA FLUXO DE CAIXA ===== */}
        <TabsContent value="fluxo" className="space-y-6">
          {/* 8 KPIs em grid 4x2 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard titulo="Vendas Encontradas" valor={num(kpis.data?.vendas_count ?? 0)} subtitulo="Total no período" icone={ShoppingCart} />
            <KpiCard titulo="Vendas Finalizadas" valor={brl(kpis.data?.vendas_finalizadas)} subtitulo="Pagas + A receber" icone={TrendingUp} cor="text-green-600" />
            <KpiCard titulo="Vendas Não Finalizadas" valor={brl(kpis.data?.vendas_nao_finalizadas)} subtitulo="Pré-venda, OS, etc." icone={FileText} />
            <KpiCard titulo="Vendas Canceladas" valor={brl(kpis.data?.vendas_canceladas)} subtitulo="Canceladas" icone={X} cor="text-red-600" />
            <KpiCard titulo="Itens Vendidos" valor={num(kpis.data?.itens_vendidos)} subtitulo="Quantidade total" icone={Package} />
            <KpiCard titulo="Descontos" valor={brl(kpis.data?.descontos)} subtitulo="Total concedido" icone={TrendingDown} cor="text-orange-600" />
            <KpiCard titulo="Custo Total" valor={brl(kpis.data?.custo_total)} subtitulo="CMV na data da venda" icone={Banknote} />
            <KpiCard titulo="Lucros" valor={`${brl(kpis.data?.lucro_total)} (${pct(margemLucro)})`} subtitulo="Lucro sobre vendas" icone={DollarSign} cor="text-green-600" />
          </div>

          {/* Formas de Recebimento */}
          <Card>
            <CardHeader><CardTitle>Formas de Recebimento</CardTitle></CardHeader>
            <CardContent className="p-0">
              {formas.isLoading ? (
                <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
              ) : (formas.data ?? []).length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhuma venda no período</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr><th className="text-left p-3">Tipo de Recebimento</th><th className="text-right p-3">Qtd</th><th className="text-right p-3">Valores Recebidos</th></tr>
                  </thead>
                  <tbody>
                    {formas.data?.map((f) => (
                      <tr key={f.forma} className="border-b hover:bg-accent">
                        <td className="p-3"><Badge variant="outline">{f.forma.toUpperCase()}</Badge></td>
                        <td className="p-3 text-right">{num(f.count)}</td>
                        <td className="p-3 text-right tabular-nums font-semibold">{brl(f.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Entradas Extra Caixa + Sangrias */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Entradas Extra Caixa</CardTitle></CardHeader>
              <CardContent className="p-0">
                {(entradasExtras.data ?? []).length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Nenhuma entrada extra no período</div>
                ) : (
                  <table className="w-full">
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr><th className="text-left p-2">Data/Hora</th><th className="text-left p-2">Motivo</th><th className="text-left p-2">Forma</th><th className="text-right p-2">Valor</th></tr>
                    </thead>
                    <tbody>
                      {entradasExtras.data?.slice(0, 10).map((e: any) => (
                        <tr key={e.id} className="border-b hover:bg-accent text-sm">
                          <td className="p-2 text-xs">{dateTime(e.data_hora)}</td>
                          <td className="p-2">{e.motivo}</td>
                          <td className="p-2"><Badge variant="outline">{e.forma_pagamento}</Badge></td>
                          <td className="p-2 text-right tabular-nums">{brl(e.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Sangrias</CardTitle></CardHeader>
              <CardContent className="p-0">
                {(sangrias.data ?? []).length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Nenhuma sangria no período</div>
                ) : (
                  <table className="w-full">
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr><th className="text-left p-2">Data/Hora</th><th className="text-left p-2">Motivo</th><th className="text-right p-2">Valor</th></tr>
                    </thead>
                    <tbody>
                      {sangrias.data?.slice(0, 10).map((s: any) => (
                        <tr key={s.id} className="border-b hover:bg-accent text-sm">
                          <td className="p-2 text-xs">{dateTime(s.data_hora)}</td>
                          <td className="p-2">{s.motivo}</td>
                          <td className="p-2 text-right tabular-nums text-red-600 font-semibold">{brl(s.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top 10 Produtos */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Top 10 Produtos Mais Vendidos</CardTitle>
                <Button variant="outline" size="sm" onClick={() => window.print()}><Download className="mr-2 h-3 w-3" /> Imprimir</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {topProdutos.isLoading ? (
                <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
              ) : (topProdutos.data ?? []).length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhuma venda no período</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="text-center p-2 w-12">#</th>
                      <th className="text-left p-2">IMG</th>
                      <th className="text-left p-2">Código</th>
                      <th className="text-left p-2">Descrição</th>
                      <th className="text-center p-2">Qtd</th>
                      <th className="text-right p-2">Vlr Unit</th>
                      <th className="text-right p-2">Total</th>
                      <th className="text-right p-2">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProdutos.data?.map((p) => (
                      <tr key={p.produto_id ?? p.nome} className="border-b hover:bg-accent">
                        <td className="p-2 text-center font-semibold">{p.posicao}</td>
                        <td className="p-2">
                          {p.imagem_url ? (
                            <img src={p.imagem_url} alt="" className="h-10 w-10 object-cover rounded" />
                          ) : (
                            <div className="h-10 w-10 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">📦</div>
                          )}
                        </td>
                        <td className="p-2 font-mono text-xs">{p.sku ?? "—"}</td>
                        <td className="p-2 font-medium">{p.nome}</td>
                        <td className="p-2 text-center tabular-nums">{num(p.quantidade)}</td>
                        <td className="p-2 text-right tabular-nums">{brl(p.preco_unitario)}</td>
                        <td className="p-2 text-right tabular-nums font-semibold">{brl(p.receita_total)}</td>
                        <td className="p-2 text-right tabular-nums">{brl(p.custo_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ABA VENDAS ===== */}
        <TabsContent value="vendas">
          <Card>
            <CardHeader><CardTitle>Vendas Realizadas no Período</CardTitle></CardHeader>
            <CardContent className="p-0">
              {vendas.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhuma venda no período</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Nº</th>
                      <th className="text-left p-3">Data</th>
                      <th className="text-left p-3">Cliente</th>
                      <th className="text-right p-3">Total</th>
                      <th className="text-right p-3">Custo</th>
                      <th className="text-right p-3">Lucro</th>
                      <th className="text-center p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendas.slice(0, 100).map((v: any) => (
                      <tr key={v.id} className="border-b hover:bg-accent">
                        <td className="p-3 font-mono text-xs">#{v.numero_pedido ?? v.id.slice(0, 8)}</td>
                        <td className="p-3 text-sm">{v.data_venda ? date(v.data_venda) : "—"}</td>
                        <td className="p-3 text-sm">{v.cliente?.nome_razao ?? "Consumidor"}</td>
                        <td className="p-3 text-right tabular-nums font-semibold">{brl(v.total)}</td>
                        <td className="p-3 text-right tabular-nums text-xs">{brl(v.custo_total)}</td>
                        <td className="p-3 text-right tabular-nums text-xs text-green-600">{brl(v.lucro_total)}</td>
                        <td className="p-3 text-center"><Badge variant="outline">{v.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ABA GRÁFICOS ===== */}
        <TabsContent value="graficos">
          <Card>
            <CardHeader><CardTitle>Vendas por Dia (Receita)</CardTitle></CardHeader>
            <CardContent>
              {vendasPorDia.isLoading ? (
                <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
              ) : (
                <GraficoVendas data={vendasPorDia.data ?? []} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ABA FORMAS ===== */}
        <TabsContent value="formas">
          <Card>
            <CardHeader><CardTitle>Formas de Recebimento — Detalhado</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr><th className="text-left p-3">Tipo</th><th className="text-center p-3">Qtd</th><th className="text-right p-3">Total Recebido</th><th className="text-right p-3">% do Total</th></tr>
                </thead>
                <tbody>
                  {formas.data?.map((f) => {
                    const total = formas.data?.reduce((s, x) => s + x.total, 0) ?? 1;
                    return (
                      <tr key={f.forma} className="border-b hover:bg-accent">
                        <td className="p-3"><Badge variant="outline">{f.forma.toUpperCase()}</Badge></td>
                        <td className="p-3 text-center">{num(f.count)}</td>
                        <td className="p-3 text-right tabular-nums font-semibold">{brl(f.total)}</td>
                        <td className="p-3 text-right tabular-nums">{pct((f.total / total) * 100)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ABA TAXAS ===== */}
        <TabsContent value="taxas">
          <Card>
            <CardHeader><CardTitle>Taxas de Cartões no Período</CardTitle></CardHeader>
            <CardContent className="p-0">
              {taxas.data?.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhuma bandeira cadastrada</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Bandeira</th>
                      <th className="text-center p-3">Tipo</th>
                      <th className="text-right p-3">Taxa %</th>
                      <th className="text-right p-3">Total Vendido</th>
                      <th className="text-right p-3">Custo da Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxas.data?.map((t, idx) => (
                      <tr key={idx} className="border-b hover:bg-accent">
                        <td className="p-3 font-medium">{t.bandeira}</td>
                        <td className="p-3 text-center"><Badge variant="outline">{t.tipo}</Badge></td>
                        <td className="p-3 text-right tabular-nums">{pct(t.taxa, 2)}</td>
                        <td className="p-3 text-right tabular-nums">{brl(t.total_vendido)}</td>
                        <td className="p-3 text-right tabular-nums font-semibold text-red-600">{brl(t.custo_taxa)}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted font-bold">
                      <td colSpan={4} className="p-3 text-right">Total de Taxas:</td>
                      <td className="p-3 text-right tabular-nums text-red-600">{brl(totalTaxasCartao)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ABA CONTAS PAGAS ===== */}
        <TabsContent value="pagas">
          <Card>
            <CardHeader><CardTitle>Contas Pagas no Período</CardTitle></CardHeader>
            <CardContent className="p-0">
              <TabelaSubTotal titulo="Sub Total — Contas Pagas" total={totalPagas} cor="text-green-600" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ABA À PAGAR ===== */}
        <TabsContent value="apagar">
          <Card>
            <CardHeader><CardTitle>Contas à Pagar (Pendentes)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <TabelaSubTotal titulo="Sub Total — À Pagar" total={totalAPagar} cor="text-red-600" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ABA CONTAS RECEBIDAS ===== */}
        <TabsContent value="recebidas">
          <Card>
            <CardHeader><CardTitle>Contas Recebidas no Período</CardTitle></CardHeader>
            <CardContent className="p-0">
              <TabelaSubTotal titulo="Sub Total — Contas Recebidas" total={totalRecebidas} cor="text-green-600" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ABA À RECEBER ===== */}
        <TabsContent value="areceber">
          <Card>
            <CardHeader><CardTitle>Contas à Receber (Pendentes)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <TabelaSubTotal titulo="Sub Total — À Receber" total={totalAReceber} cor="text-green-600" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ABA NOTAS FISCAIS ===== */}
        <TabsContent value="nf">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard titulo="Notas no Período" valor={num(notasNoPeriodo)} icone={FileText} />
            <KpiCard titulo="Nota Ok" valor={num(notasOk)} icone={FileText} cor="text-green-600" />
            <KpiCard titulo="Nota Cancelada" valor={num(notasCanceladas)} icone={FileText} cor="text-red-600" />
            <KpiCard titulo="Nota Denegada" valor={num(notasDenegadas)} icone={FileText} cor="text-red-600" />
            <KpiCard titulo="NF-e" valor={num(nfes)} icone={Receipt} />
            <KpiCard titulo="NFC-e" valor={num(nfces)} icone={Receipt} />
            <KpiCard titulo="CF-e" valor={num(cfes)} icone={Receipt} />
          </div>
          <Card className="mt-4">
            <CardHeader><CardTitle>Notas Fiscais</CardTitle></CardHeader>
            <CardContent className="p-0">
              {notas.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhuma NF emitida</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Tipo</th>
                      <th className="text-left p-3">Número</th>
                      <th className="text-left p-3">Data</th>
                      <th className="text-right p-3">Valor</th>
                      <th className="text-center p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notas.slice(0, 50).map((n: any) => (
                      <tr key={n.id} className="border-b hover:bg-accent">
                        <td className="p-3"><Badge variant="outline">{n.tipo?.toUpperCase()}</Badge></td>
                        <td className="p-3 font-mono text-xs">{n.numero ?? "—"}</td>
                        <td className="p-3 text-sm">{n.data_emissao ? date(n.data_emissao) : "—"}</td>
                        <td className="p-3 text-right tabular-nums">{brl(n.valor_total ?? 0)}</td>
                        <td className="p-3 text-center"><Badge variant="outline">{n.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: Incluir Conta */}
      <Dialog open={!!modalConta} onOpenChange={(o) => !o && setModalConta(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conta a {modalConta?.tipo === "pagar" ? "Pagar" : "Receber"}</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Descrição *</Label><Input value={formConta.descricao} onChange={(e) => setFormConta({ ...formConta, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor *</Label><Input type="number" step="0.01" value={formConta.valor} onChange={(e) => setFormConta({ ...formConta, valor: e.target.value })} /></div>
              <div><Label>Vencimento *</Label><Input type="date" value={formConta.data_vencimento} onChange={(e) => setFormConta({ ...formConta, data_vencimento: e.target.value })} /></div>
            </div>
            <div><Label>Categoria</Label><Input value={formConta.categoria} onChange={(e) => setFormConta({ ...formConta, categoria: e.target.value })} placeholder="Ex: Fornecedor, Aluguel" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalConta(null)}>Cancelar</Button>
            <Button onClick={handleCriarConta} disabled={createConta.isPending}>{createConta.isPending ? "Salvando..." : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Conta Bancária (placeholder funcional) */}
      <Dialog open={modalContaBancaria} onOpenChange={setModalContaBancaria}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conta Bancária</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Para gerenciar contas bancárias, acesse a página <strong>Minhas Chaves → Contas Bancárias</strong> no menu de configurações.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalContaBancaria(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// COMPONENTE: Gráfico de Vendas (Chart.js)
// ============================================
function GraficoVendas({ data }: { data: { dia: string; total: number; count: number }[] }) {
  const config = useMemo(() => {
    if (data.length === 0) return null;
    return {
      type: "bar" as const,
      data: {
        labels: data.map((d) => d.dia.slice(5)),
        datasets: [
          {
            label: "Receita (R$)",
            data: data.map((d) => d.total),
            backgroundColor: "rgba(34, 197, 94, 0.7)",
            borderColor: "rgb(34, 197, 94)",
            borderWidth: 1,
            yAxisID: "y",
          },
          {
            label: "Qtd Vendas",
            data: data.map((d) => d.count),
            backgroundColor: "rgba(59, 130, 246, 0.7)",
            borderColor: "rgb(59, 130, 246)",
            borderWidth: 1,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index" as const, intersect: false },
        plugins: { legend: { position: "top" as const } },
        scales: {
          y: { type: "linear" as const, position: "left" as const, title: { display: true, text: "Receita (R$)" } },
          y1: { type: "linear" as const, position: "right" as const, title: { display: true, text: "Qtd" }, grid: { drawOnChartArea: false } },
        },
      },
    };
  }, [data]);

  if (!config) return <p className="text-center text-muted-foreground py-12">Sem dados para exibir gráfico</p>;
  return <div className="h-80">{chart(config)}</div>;
}

// Ícones auxiliares
function Trash2(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>; }
function X(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>; }
function Package(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>; }
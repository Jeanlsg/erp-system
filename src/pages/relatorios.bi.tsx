// ============================================================
// Página: Análise gerencial
//
// Tudo aqui sai do que a fase 1 passou a registrar de verdade — kardex com
// custo médio, plano de contas e contas geradas pela venda. Antes destas
// tabelas, qualquer relatório seria estimativa apresentada como número.
//
// Três perguntas, nesta ordem: o que dá lucro, o que precisa ser comprado,
// e onde o dinheiro está parado.
// ============================================================

import { useState } from "react";
import { AlertTriangle, PackageSearch, Loader2, TrendingUp, Wallet } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {
  useLojas, useCurvaAbc, useSugestaoCompra, useEstoqueParado, useDreMensal,
} from "@/lib/supabase-queries";
import { isSupabaseConfigured } from "@/lib/supabase";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";

const CLASSE_COR: Record<string, string> = {
  A: "border-emerald-400 text-emerald-700",
  B: "border-amber-400 text-amber-700",
  C: "border-muted-foreground/40 text-muted-foreground",
};

export function RelatoriosBiPage() {
  const { data: lojas = [] } = useLojas();
  const [loja, setLoja] = useState("todas");
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
  const [aba, setAba] = useState("abc");

  const lojaId = loja === "todas" ? undefined : loja;
  const { data: abc = [], isLoading: carregandoAbc } = useCurvaAbc({ lojaId, desde: desde || undefined, ate: ate || undefined });
  const { data: sugestoes = [] } = useSugestaoCompra(lojaId);
  const { data: parados = [] } = useEstoqueParado(lojaId);
  const { data: dre = [] } = useDreMensal(lojaId);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured />;

  const receitaTotal = abc.reduce((s: number, p: any) => s + Number(p.receita || 0), 0);
  const margemTotal = abc.reduce((s: number, p: any) => s + Number(p.margem || 0), 0);
  const classeA = abc.filter((p: any) => p.classe === "A");
  const capitalParado = parados.reduce((s: number, p: any) => s + Number(p.capital_parado || 0), 0);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Análise gerencial</h1>
        <p className="text-muted-foreground">
          Sobre venda registrada e custo médio real — não sobre preço de tabela.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Label className="text-xs">Loja</Label>
          <Select value={loja} onValueChange={setLoja}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as lojas</SelectItem>
              {lojas.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Receita no período</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{brl(receitaTotal)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Margem bruta</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{brl(margemTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {receitaTotal > 0 ? `${((margemTotal / receitaTotal) * 100).toFixed(1)}% da receita` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Produtos classe A</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{classeA.length}</div>
            <p className="text-xs text-muted-foreground">
              de {abc.length} — sustentam 80% da receita
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Capital parado</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{brl(capitalParado)}</div>
            <p className="text-xs text-muted-foreground">{parados.length} produto(s) sem venda há 90 dias</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="abc"><TrendingUp className="mr-2 h-4 w-4" />Curva ABC</TabsTrigger>
          <TabsTrigger value="compra"><PackageSearch className="mr-2 h-4 w-4" />Sugestão de compra</TabsTrigger>
          <TabsTrigger value="parado"><AlertTriangle className="mr-2 h-4 w-4" />Estoque parado</TabsTrigger>
          <TabsTrigger value="dre"><Wallet className="mr-2 h-4 w-4" />DRE</TabsTrigger>
        </TabsList>

        <TabsContent value="abc">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Curva ABC por receita</CardTitle>
              <CardDescription>
                A classe sai do acumulado: A são os itens que somam os primeiros 80% da receita,
                B até 95%, C o restante. É o que separa o que sustenta a loja do que só ocupa prateleira.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {carregandoAbc ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> calculando…
                </div>
              ) : abc.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma venda finalizada no período.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Margem</TableHead>
                      <TableHead className="text-right">% receita</TableHead>
                      <TableHead className="text-right">Acumulado</TableHead>
                      <TableHead>Classe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {abc.map((p: any) => (
                      <TableRow key={p.produto_id}>
                        <TableCell>
                          <div className="font-medium">{p.produto_nome}</div>
                          <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                        </TableCell>
                        <TableCell className="text-right">{Number(p.quantidade)}</TableCell>
                        <TableCell className="text-right">{brl(p.receita)}</TableCell>
                        <TableCell className="text-right">
                          {brl(p.margem)}
                          <span className="ml-1 text-xs text-muted-foreground">({Number(p.margem_pct).toFixed(0)}%)</span>
                        </TableCell>
                        <TableCell className="text-right">{Number(p.participacao).toFixed(1)}%</TableCell>
                        <TableCell className="text-right text-muted-foreground">{Number(p.acumulado).toFixed(1)}%</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={CLASSE_COR[p.classe]}>{p.classe}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compra">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">O que repor agora</CardTitle>
              <CardDescription>
                Comprar quando o estoque zera chega tarde: entre pedir e receber, a loja fica sem
                vender. O ponto de pedido é consumo diário × prazo do fornecedor + o mínimo de segurança.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {sugestoes.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum produto abaixo do ponto de pedido.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                      <TableHead className="text-right">Ponto de pedido</TableHead>
                      <TableHead className="text-right">Cobertura</TableHead>
                      <TableHead className="text-right">Comprar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sugestoes.map((s: any) => (
                      <TableRow key={`${s.loja_id}-${s.produto_id}`}>
                        <TableCell>
                          <div className="font-medium">{s.produto_nome}</div>
                          <div className="font-mono text-xs text-muted-foreground">{s.sku}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.loja_nome}</TableCell>
                        <TableCell className="text-right">{s.estoque_atual}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{s.ponto_pedido}</TableCell>
                        <TableCell className="text-right">
                          {s.dias_de_cobertura === null
                            ? <span className="text-muted-foreground">parado</span>
                            : `${Number(s.dias_de_cobertura).toFixed(0)} dias`}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{s.sugestao_compra}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parado">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dinheiro imobilizado</CardTitle>
              <CardDescription>
                Produtos com saldo e sem nenhuma venda nos últimos 90 dias, avaliados pelo custo
                médio do kardex.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {parados.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Todo o estoque teve saída nos últimos 90 dias.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Custo médio</TableHead>
                      <TableHead className="text-right">Capital parado</TableHead>
                      <TableHead>Última venda</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parados.map((p: any) => (
                      <TableRow key={`${p.loja_id}-${p.produto_id}`}>
                        <TableCell>
                          <div className="font-medium">{p.produto_nome}</div>
                          <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.loja_nome}</TableCell>
                        <TableCell className="text-right">{p.quantidade}</TableCell>
                        <TableCell className="text-right">{brl(p.custo_medio)}</TableCell>
                        <TableCell className="text-right font-semibold">{brl(p.capital_parado)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.ultima_venda ? date(p.ultima_venda) : "nunca vendido"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dre">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resultado por competência</CardTitle>
              <CardDescription>
                Sobre o plano de contas da fase 1: receita e despesa entram pelo lançamento,
                não pelo caixa.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {dre.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Sem lançamentos suficientes para montar o DRE.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competência</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Despesa</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dre.map((d: any, i: number) => {
                      const receita = Number(d.receita ?? d.total_receita ?? 0);
                      const despesa = Number(d.despesa ?? d.total_despesa ?? 0);
                      const resultado = Number(d.resultado ?? receita - despesa);
                      return (
                        <TableRow key={`${d.competencia}-${d.loja_id ?? i}`}>
                          <TableCell>{String(d.competencia ?? "").slice(0, 7)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{d.loja_nome ?? "—"}</TableCell>
                          <TableCell className="text-right">{brl(receita)}</TableCell>
                          <TableCell className="text-right">{brl(despesa)}</TableCell>
                          <TableCell className={`text-right font-semibold ${resultado < 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {brl(resultado)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

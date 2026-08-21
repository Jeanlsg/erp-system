// ============================================================
// Página: Crediário próprio
//
// As tabelas existiam vazias desde o começo — casca sem regra atrás. O que
// entrou aqui é a regra: limite de crédito, cálculo da parcela e o vínculo
// com o financeiro.
//
// O ponto que mais importa: cada parcela é TAMBÉM uma conta a receber. Baixar
// no crediário baixa no financeiro. Sem esse vínculo, os dois números da mesma
// dívida divergem no primeiro mês.
// ============================================================

import { Fragment, useState } from "react";
import {
  AlertTriangle, CheckCircle2, CreditCard, HandCoins, Loader2, UserCheck,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

import {
  useCrediarioContratos, useCrediarioClientes, useAbrirCrediario,
  useBaixarParcelaCrediario, useVendas,
} from "@/lib/supabase-queries";
import { ComboboxBusca } from "@/components/ui/combobox-busca";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { isSupabaseConfigured } from "@/lib/supabase";
import { brl, date } from "@/lib/format";
import { toast } from "sonner";

const STATUS_CONTRATO: Record<string, { rotulo: string; classe: string }> = {
  ativo:        { rotulo: "Ativo",        classe: "border-emerald-400 text-emerald-700" },
  quitado:      { rotulo: "Quitado",      classe: "border-muted-foreground/40 text-muted-foreground" },
  inadimplente: { rotulo: "Inadimplente", classe: "border-red-400 text-red-700" },
  cancelado:    { rotulo: "Cancelado",    classe: "border-muted-foreground/40 text-muted-foreground" },
};

export function CrediarioProprioPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: contratos = [], isLoading } = useCrediarioContratos(lojaId ?? undefined);
  const { data: clientes = [] } = useCrediarioClientes();
  const { data: vendas = [] } = useVendas({ lojaId: lojaId ?? undefined });

  const abrir = useAbrirCrediario();
  const baixar = useBaixarParcelaCrediario();

  const [aba, setAba] = useState("contratos");
  const [modalNovo, setModalNovo] = useState(false);
  const [vendaId, setVendaId] = useState("");
  const [parcelas, setParcelas] = useState("6");
  const [juros, setJuros] = useState("2.5");
  const [tipoJuros, setTipoJuros] = useState<"simples" | "composto">("composto");
  const [entrada, setEntrada] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Crediário Próprio" />;

  // Só venda finalizada, com cliente e ainda sem contrato pode virar crediário.
  const comContrato = new Set(contratos.map((c: any) => c.venda_id));
  const elegiveis = vendas.filter(
    (v: any) => v.status === "finalizada" && v.cliente_id && !comContrato.has(v.id),
  );

  const emAtraso = clientes.reduce((s: number, c: any) => s + Number(c.em_atraso || 0), 0);
  const emAberto = clientes.reduce((s: number, c: any) => s + Number(c.em_aberto || 0), 0);
  const inadimplentes = clientes.filter((c: any) => Number(c.em_atraso || 0) > 0).length;

  // Prévia do custo do crédito antes de fechar o contrato — é o número que o
  // cliente pergunta e que o vendedor precisa saber dizer.
  const previa = (() => {
    const venda = vendas.find((v: any) => v.id === vendaId);
    const n = Number(parcelas) || 0;
    const i = (Number(juros) || 0) / 100;
    const financiado = Number(venda?.total ?? 0) - (Number(entrada) || 0);
    if (!venda || n < 1 || financiado <= 0) return null;
    const p = i <= 0
      ? financiado / n
      : tipoJuros === "simples"
        ? (financiado * (1 + i * n)) / n
        : (financiado * i) / (1 - Math.pow(1 + i, -n));
    return { parcela: p, total: p * n, custo: p * n - financiado, financiado };
  })();

  async function handleAbrir() {
    try {
      const r: any = await abrir.mutateAsync({
        vendaId,
        parcelas: Number(parcelas),
        jurosMensal: Number(juros),
        tipoJuros,
        entrada: Number(entrada) || 0,
      });
      toast.success(`Contrato ${r.contrato} aberto`, {
        description: `${r.parcelas}× de ${brl(r.valor_parcela)} · custo do crédito ${brl(r.custo_do_credito)}`,
      });
      setModalNovo(false);
      setVendaId("");
      setEntrada("");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleBaixar(item: any) {
    try {
      const r: any = await baixar.mutateAsync({ itemId: item.id, forma: "dinheiro" });
      toast.success(
        r.quitado ? "Parcela baixada — contrato quitado" : "Parcela baixada",
        { description: `${r.parcelas_restantes} parcela(s) em aberto` },
      );
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CreditCard className="h-6 w-6" /> Crediário próprio
          </h1>
          <p className="text-muted-foreground">
            Cada parcela é também uma conta a receber — baixar aqui baixa no financeiro.
          </p>
        </div>
        <Button onClick={() => setModalNovo(true)} disabled={elegiveis.length === 0}>
          <HandCoins className="mr-2 h-4 w-4" /> Novo contrato
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Em aberto</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{brl(emAberto)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Em atraso</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold ${emAtraso > 0 ? "text-red-600" : ""}`}>{brl(emAtraso)}</div>
            <p className="text-xs text-muted-foreground">{inadimplentes} cliente(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Contratos ativos</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {contratos.filter((c: any) => c.status === "ativo").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Vendas elegíveis</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{elegiveis.length}</div>
            <p className="text-xs text-muted-foreground">finalizadas, com cliente, sem contrato</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
          <TabsTrigger value="clientes"><UserCheck className="mr-2 h-4 w-4" />Clientes e limites</TabsTrigger>
        </TabsList>

        <TabsContent value="contratos">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contratos</CardTitle>
              <CardDescription>Clique num contrato para ver e baixar as parcelas.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> carregando…
                </div>
              ) : contratos.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum contrato aberto. As tabelas existiam vazias desde o início do sistema.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Parcelas</TableHead>
                      <TableHead className="text-right">Juros</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contratos.map((c: any) => {
                      const itens = (c.parcelas ?? []).slice().sort(
                        (a: any, b: any) => a.numero_parcela - b.numero_parcela,
                      );
                      const pagas = itens.filter((i: any) => i.status === "pago").length;
                      const st = STATUS_CONTRATO[c.status] ?? { rotulo: c.status, classe: "" };
                      return (
                        // Fragment com key: o elemento externo do map é ele, não as linhas
                        <Fragment key={c.id}>
                          <TableRow className="cursor-pointer"
                            onClick={() => setExpandido(expandido === c.id ? null : c.id)}>
                            <TableCell className="font-mono text-sm">{c.numero_contrato}</TableCell>
                            <TableCell>
                              <div className="font-medium">{c.cliente?.nome_razao ?? "—"}</div>
                              <div className="font-mono text-xs text-muted-foreground">{c.cliente?.cpf_cnpj}</div>
                            </TableCell>
                            <TableCell className="text-right font-medium">{brl(c.valor_total)}</TableCell>
                            <TableCell className="text-right">
                              {pagas}/{c.numero_parcelas}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {Number(c.juros_mensal).toFixed(2)}% a.m.
                              <span className="ml-1 text-xs">({c.tipo_juros})</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={st.classe}>{st.rotulo}</Badge>
                            </TableCell>
                          </TableRow>
                          {expandido === c.id && (
                            <TableRow>
                              <TableCell colSpan={6} className="bg-muted/40 p-0">
                                <div className="p-4">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-20">Parcela</TableHead>
                                        <TableHead>Vencimento</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                        <TableHead>Situação</TableHead>
                                        <TableHead className="text-right">Ação</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {itens.map((i: any) => {
                                        const vencida = i.status === "vencido";
                                        return (
                                          <TableRow key={i.id}>
                                            <TableCell>{i.numero_parcela}/{c.numero_parcelas}</TableCell>
                                            <TableCell className={vencida ? "text-red-600" : ""}>
                                              {date(i.data_vencimento)}
                                            </TableCell>
                                            <TableCell className="text-right">{brl(i.valor)}</TableCell>
                                            <TableCell>
                                              {i.status === "pago" ? (
                                                <span className="flex items-center gap-1 text-emerald-700">
                                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                                  {date(i.data_pagamento)}
                                                </span>
                                              ) : vencida ? (
                                                <span className="flex items-center gap-1 text-red-600">
                                                  <AlertTriangle className="h-3.5 w-3.5" /> vencida
                                                </span>
                                              ) : (
                                                <span className="text-muted-foreground">em aberto</span>
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              {i.status !== "pago" && (
                                                <Button size="sm" variant="outline"
                                                  disabled={baixar.isPending}
                                                  onClick={() => handleBaixar(i)}>
                                                  Receber
                                                </Button>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clientes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clientes com crediário</CardTitle>
              <CardDescription>
                Limite em branco significa sem limite definido, não limite zero — cadastre em Clientes.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {clientes.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum cliente com crediário.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Em aberto</TableHead>
                      <TableHead className="text-right">Em atraso</TableHead>
                      <TableHead className="text-right">Limite</TableHead>
                      <TableHead className="text-right">Disponível</TableHead>
                      <TableHead>Próximo vencimento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientes.map((c: any) => (
                      <TableRow key={c.pessoa_id}>
                        <TableCell>
                          <div className="font-medium">{c.nome_razao}</div>
                          <div className="font-mono text-xs text-muted-foreground">{c.cpf_cnpj}</div>
                          {c.bloqueado && (
                            <Badge variant="outline" className="mt-1 border-red-400 text-red-700">bloqueado</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{brl(c.em_aberto)}</TableCell>
                        <TableCell className={`text-right ${Number(c.em_atraso) > 0 ? "font-semibold text-red-600" : ""}`}>
                          {brl(c.em_atraso)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {Number(c.limite_credito) > 0 ? brl(c.limite_credito) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.limite_disponivel === null ? "—" : brl(c.limite_disponivel)}
                        </TableCell>
                        <TableCell>{c.proximo_vencimento ? date(c.proximo_vencimento) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={modalNovo} onOpenChange={setModalNovo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo contrato de crediário</DialogTitle>
            <DialogDescription>
              A conta a receber gerada pela venda é cancelada e substituída pelas parcelas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Venda</Label>
              <ComboboxBusca
                className="mt-1"
                itens={elegiveis.map((v: any) => ({
                  id: v.id,
                  rotulo: `Venda #${v.numero_pedido} · ${brl(v.total)}`,
                  detalhe: date(v.data_venda),
                }))}
                value={vendaId}
                onChange={setVendaId}
                placeholder="Buscar pela venda (número ou valor)…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Parcelas</Label>
                <Input type="number" min={1} max={12} value={parcelas}
                  onChange={(e) => setParcelas(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Juros ao mês (%)</Label>
                <Input type="number" step="0.01" min={0} value={juros}
                  onChange={(e) => setJuros(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Tipo de juros</Label>
                <Select value={tipoJuros} onValueChange={(v) => setTipoJuros(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="composto">Price (parcela fixa)</SelectItem>
                    <SelectItem value="simples">Juros simples</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Entrada (opcional)</Label>
                <Input type="number" step="0.01" min={0} value={entrada}
                  onChange={(e) => setEntrada(e.target.value)} placeholder="0,00" />
              </div>
            </div>

            {previa && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Financiado</span>
                  <span>{brl(previa.financiado)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>{parcelas}× de</span>
                  <span>{brl(previa.parcela)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total a receber</span>
                  <span>{brl(previa.total)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Custo do crédito</span>
                  <span>{brl(previa.custo)}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalNovo(false)}>Cancelar</Button>
            <Button onClick={handleAbrir} disabled={!vendaId || abrir.isPending}>
              {abrir.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Abrir contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

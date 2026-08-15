import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DollarSign, Plus, Loader2, Lock, Unlock, RefreshCw, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  useCaixas, useCreateSangria, useCreateEntradaExtra, useSangrias, useEntradasExtras,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { supabase } from "@/lib/supabase";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { useAuth } from "@/lib/store/auth-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export function CaixaPage() {
  const { user } = useAuth();
  const { lojaId, lojas } = useAutoSelectLoja();
  const [lojaFiltro, setLojaFiltro] = useState<string>("todas");

  // Buscar caixas - se lojaFiltro="todas", não filtra
  const lojaParaFiltro = lojaFiltro === "todas" ? undefined : lojaFiltro;
  const { data: caixas = [], isLoading, isError: caixasError, refetch } = useCaixas(lojaParaFiltro);

  const { data: sangrias = [] } = useSangrias();
  const { data: entradas = [] } = useEntradasExtras();
  const createSangria = useCreateSangria();
  const createEntrada = useCreateEntradaExtra();

  // Buscar vendas do dia para estatísticas
  const { data: vendasHoje, isError: vendasHojeError } = useQuery({
    queryKey: ["erp_vendas-hoje-caixa", lojaParaFiltro],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return { total: 0, tickets: 0 };
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      let q = supabase
        .from("erp_vendas")
        .select("total")
        .eq("status", "finalizada")
        .gte("data_venda", hoje.toISOString());
      if (lojaParaFiltro) q = q.eq("loja_id", lojaParaFiltro);
      const { data, error } = await q;
      if (error) throw error;
      const total = (data ?? []).reduce((s, v) => s + Number(v.total), 0);
      return { total, tickets: data?.length ?? 0 };
    },
  });

  const [sangriaModal, setSangriaModal] = useState(false);
  const [entradaModal, setEntradaModal] = useState(false);
  const [valorSangria, setValorSangria] = useState("");
  const [motivoSangria, setMotivoSangria] = useState("");
  const [valorEntrada, setValorEntrada] = useState("");
  const [motivoEntrada, setMotivoEntrada] = useState("");
  const [formaEntrada, setFormaEntrada] = useState("dinheiro");

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Caixa" />;

  // Encontrar caixa aberto do PRÓPRIO usuário (na loja atual, se houver)
  const caixaAberto = caixas.find(
    (c: any) =>
      c.status === "aberto" &&
      c.data_fechamento == null &&
      c.usuario_id === user?.id &&
      (!lojaId || c.loja_id === lojaId)
  );
  const caixasAbertos = caixas.filter((c: any) => c.status === "aberto" && c.data_fechamento == null);

  // Calcular totais
  const totalSangriasGeral = caixas.reduce((s, c: any) => s + Number(c.total_sangrias || 0), 0);
  const totalEntradasGeral = caixas.reduce((s, c: any) => s + Number(c.total_entradas_extras || 0), 0);

  const handleSangria = async () => {
    if (!caixaAberto || !valorSangria || !motivoSangria) return;
    try {
      await createSangria.mutateAsync({
        caixa_id: caixaAberto.id,
        usuario_id: user?.id,
        motivo: motivoSangria,
        valor: parseFloat(valorSangria),
      });
      setSangriaModal(false);
      setValorSangria("");
      setMotivoSangria("");
      toast.success("Sangria registrada.");
    } catch (err: any) {
      toast.error(`Erro ao registrar sangria: ${err.message}`);
    }
  };

  const handleEntrada = async () => {
    if (!caixaAberto || !valorEntrada || !motivoEntrada) return;
    try {
      await createEntrada.mutateAsync({
        caixa_id: caixaAberto.id,
        usuario_id: user?.id,
        motivo: motivoEntrada,
        forma_pagamento: formaEntrada,
        valor: parseFloat(valorEntrada),
      });
      setEntradaModal(false);
      setValorEntrada("");
      setMotivoEntrada("");
      toast.success("Entrada extra registrada.");
    } catch (err: any) {
      toast.error(`Erro ao registrar entrada: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6" /> Caixa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {caixaAberto
              ? `Caixa #${caixaAberto.numero_caixa ?? "—"} aberto`
              : "Nenhum caixa aberto"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro de Loja */}
          <Select value={lojaFiltro} onValueChange={setLojaFiltro}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as lojas</SelectItem>
              {lojas.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.apelido || l.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>

          <Button
            variant="outline"
            disabled={!caixaAberto}
            title={!caixaAberto ? "Você não tem caixa aberto — sangria só no seu próprio caixa" : undefined}
            onClick={() => setSangriaModal(true)}
          >
            Sangria
          </Button>
          <Button
            disabled={!caixaAberto}
            title={!caixaAberto ? "Você não tem caixa aberto — entrada só no seu próprio caixa" : undefined}
            onClick={() => setEntradaModal(true)}
          >
            <Plus className="mr-2 h-4 w-4" /> Entrada Extra
          </Button>
        </div>
      </div>

      {/* Aviso: existem caixas abertos mas nenhum é do usuário atual */}
      {!caixaAberto && caixasAbertos.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Há {caixasAbertos.length} caixa(s) aberto(s) de outros operadores. Para registrar
          sangria ou entrada extra, abra o seu próprio caixa no PDV.
        </p>
      )}

      {/* Cards de Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Status</p>
            <p className="text-2xl font-semibold mt-1">
              {caixaAberto ? (
                <span className="text-green-600 flex items-center gap-2"><Unlock className="h-5 w-5" /> Aberto</span>
              ) : (
                <span className="text-red-600 flex items-center gap-2"><Lock className="h-5 w-5" /> Fechado</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {caixasAbertos.length > 0 ? `${caixasAbertos.length} caixa(s) aberto(s)` : "Sem caixa ativo"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Vendas Hoje</p>
            {vendasHojeError ? (
              <p className="text-sm font-medium text-destructive mt-2">Erro ao carregar</p>
            ) : (
              <>
                <p className="text-2xl font-semibold text-green-600">
                  {brl(vendasHoje?.total ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {vendasHoje?.tickets ?? 0} venda(s) finalizada(s)
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Sangrias (Total)</p>
            {caixasError ? (
              <p className="text-sm font-medium text-destructive mt-2">Erro ao carregar</p>
            ) : (
              <>
                <p className="text-2xl font-semibold text-red-600">
                  {brl(totalSangriasGeral)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {sangrias.length} registro(s) hoje
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Entradas Extras</p>
            {caixasError ? (
              <p className="text-sm font-medium text-destructive mt-2">Erro ao carregar</p>
            ) : (
              <>
                <p className="text-2xl font-semibold text-green-600">
                  {brl(totalEntradasGeral)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {entradas.length} registro(s) hoje
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Caixa Atual */}
      {caixaAberto && (
        <Card className="border-green-500/50 bg-green-50/30 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Unlock className="h-5 w-5" />
              Caixa Atual - #{caixaAberto.numero_caixa}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Abertura</p>
                <p className="text-sm font-medium">
                  {caixaAberto.data_abertura
                    ? new Date(caixaAberto.data_abertura).toLocaleString("pt-BR")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Valor Inicial</p>
                <p className="text-lg font-semibold">{brl(caixaAberto.valor_inicial ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Vendas</p>
                <p className="text-lg font-semibold text-green-600">
                  {brl(caixaAberto.total_vendas ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Saldo Atual</p>
                <p className="text-lg font-semibold text-primary">
                  {brl(
                    (caixaAberto.valor_inicial ?? 0) +
                    (caixaAberto.total_vendas ?? 0) -
                    (caixaAberto.total_sangrias ?? 0) +
                    (caixaAberto.total_entradas_extras ?? 0) -
                    (caixaAberto.valor_troco ?? 0)
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Caixas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Histórico de Caixas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Carregando caixas...
            </div>
          ) : caixas.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground font-medium">Nenhum caixa registrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                {lojaFiltro !== "todas"
                  ? "Tente selecionar 'Todas as lojas' no filtro acima"
                  : "Abra um caixa na página PDV para começar"}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => (window.location.href = "/pdv")}
              >
                Ir para PDV
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Caixa</th>
                    <th className="text-left p-3">Loja</th>
                    <th className="text-left p-3">Abertura</th>
                    <th className="text-left p-3">Fechamento</th>
                    <th className="text-right p-3">Inicial</th>
                    <th className="text-right p-3">Vendas</th>
                    <th className="text-right p-3">Final</th>
                    <th className="text-center p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {caixas.slice(0, 50).map((c: any) => (
                    <tr key={c.id} className="border-b hover:bg-accent transition-colors">
                      <td className="p-3 font-mono font-medium">#{c.numero_caixa ?? "—"}</td>
                      <td className="p-3 text-sm">
                        {c.loja?.apelido || c.loja?.nome || (lojas.find((l) => l.id === c.loja_id)?.apelido) || "—"}
                      </td>
                      <td className="p-3 text-sm">
                        {c.data_abertura
                          ? new Date(c.data_abertura).toLocaleString("pt-BR")
                          : "—"}
                      </td>
                      <td className="p-3 text-sm">
                        {c.data_fechamento
                          ? new Date(c.data_fechamento).toLocaleString("pt-BR")
                          : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {brl(c.valor_inicial ?? 0)}
                      </td>
                      <td className="p-3 text-right tabular-nums text-green-600">
                        {brl(c.total_vendas ?? 0)}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {c.valor_final ? brl(c.valor_final) : "—"}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={c.status === "aberto" ? "default" : "outline"}
                          className={c.status === "aberto" ? "bg-green-600" : ""}
                        >
                          {c.status === "aberto" ? (
                            <><Unlock className="h-3 w-3 mr-1" /> Aberto</>
                          ) : (
                            <><Lock className="h-3 w-3 mr-1" /> Fechado</>
                          )}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modais */}
      <Dialog open={sangriaModal} onOpenChange={setSangriaModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Sangria</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Valor</Label>
              <Input
                type="number"
                step="0.01"
                value={valorSangria}
                onChange={(e) => setValorSangria(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input
                value={motivoSangria}
                onChange={(e) => setMotivoSangria(e.target.value)}
                placeholder="Ex: Repasse ao gerente"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSangriaModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSangria} disabled={!valorSangria || !motivoSangria || createSangria.isPending}>
              {createSangria.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={entradaModal} onOpenChange={setEntradaModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entrada Extra</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Valor</Label>
              <Input
                type="number"
                step="0.01"
                value={valorEntrada}
                onChange={(e) => setValorEntrada(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input
                value={motivoEntrada}
                onChange={(e) => setMotivoEntrada(e.target.value)}
                placeholder="Ex: Suprimento"
              />
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={formaEntrada}
                onChange={(e) => setFormaEntrada(e.target.value)}
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="cartao_credito">Cartão Crédito</option>
                <option value="cartao_debito">Cartão Débito</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntradaModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEntrada} disabled={!valorEntrada || !motivoEntrada || createEntrada.isPending}>
              {createEntrada.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
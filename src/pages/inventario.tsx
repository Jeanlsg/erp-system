import { useState } from "react";
import { ClipboardList, Loader2, Play, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useEstoqueNegativo,
  useInventarios, useInventarioItens, useAbrirInventario,
  useSalvarContagem, useAplicarInventario, useLojas,
} from "@/lib/supabase-queries";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { isSupabaseConfigured } from "@/lib/supabase";

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  aberto: { label: "Em contagem", variant: "default" },
  finalizado: { label: "Finalizado", variant: "secondary" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

export function InventarioPage() {
  const [lojaFiltro, setLojaFiltro] = useState<string>("todas");
  const [selecionado, setSelecionado] = useState<string | undefined>();
  const [modalAbrir, setModalAbrir] = useState(false);
  const [novaLoja, setNovaLoja] = useState("");
  const [novaObs, setNovaObs] = useState("");
  const [confirmarAplicar, setConfirmarAplicar] = useState(false);

  const { data: lojas = [] } = useLojas();
  const { data: inventarios = [], isLoading } = useInventarios(
    lojaFiltro === "todas" ? undefined : lojaFiltro
  );
  const { data: itens = [], isLoading: carregandoItens } = useInventarioItens(selecionado);
  const { data: negativos = [] } = useEstoqueNegativo(
    lojaFiltro === "todas" ? undefined : lojaFiltro
  );

  const abrir = useAbrirInventario();
  const salvarContagem = useSalvarContagem();
  const aplicar = useAplicarInventario();

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured />;

  const inventarioAtual = inventarios.find((i: any) => i.id === selecionado);
  const divergencias = itens.filter(
    (i: any) => i.quantidade_contada !== null && i.quantidade_contada !== i.quantidade_sistema
  );
  const naoContados = itens.filter((i: any) => i.quantidade_contada === null);

  const handleAbrir = async () => {
    if (!novaLoja) {
      toast.error("Selecione a loja do inventário");
      return;
    }
    try {
      const id = await abrir.mutateAsync({ lojaId: novaLoja, observacoes: novaObs || undefined });
      toast.success("Inventário aberto com a fotografia do saldo atual.");
      setModalAbrir(false);
      setNovaObs("");
      setSelecionado(id);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao abrir inventário");
    }
  };

  const handleContagem = async (itemId: string, valor: string) => {
    const n = valor === "" ? null : Number(valor);
    if (n !== null && (Number.isNaN(n) || n < 0)) {
      toast.error("Quantidade contada inválida");
      return;
    }
    try {
      await salvarContagem.mutateAsync({ itemId, quantidadeContada: n });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao salvar contagem");
    }
  };

  const handleAplicar = async () => {
    if (!selecionado) return;
    try {
      const r = await aplicar.mutateAsync(selecionado);
      toast.success(
        `Inventário aplicado: ${r?.itens_ajustados ?? 0} produto(s) ajustado(s). Os ajustes viraram movimento no kardex.`
      );
      setConfirmarAplicar(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao aplicar inventário");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventário / Balanço</h1>
          <p className="text-muted-foreground">
            Conte o estoque físico e aplique as divergências. Cada ajuste vira um movimento
            rastreável no kardex, em vez de sobrescrever o saldo em silêncio.
          </p>
        </div>
        <Button onClick={() => setModalAbrir(true)}>
          <Play className="mr-2 h-4 w-4" /> Abrir inventário
        </Button>
      </div>

      {/* Saldo negativo é sintoma, não erro de digitação: a venda offline
          registrou a saída de mercadoria que o sistema achava não existir.
          A correção certa é contar, e é justamente esta tela. */}
      {negativos.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              {negativos.length} produto(s) com saldo negativo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="text-muted-foreground">
              Vendas registradas sem conexão baixaram estoque que o sistema não tinha. Conte
              estes produtos para reconciliar.
            </p>
            <ul className="mt-2 space-y-0.5">
              {negativos.slice(0, 8).map((n: any) => (
                <li key={`${n.loja_id}-${n.produto_id}`} className="flex justify-between gap-4">
                  <span className="truncate">{n.produto_nome} <span className="text-muted-foreground">({n.loja_nome})</span></span>
                  <span className="font-medium text-red-600">{n.quantidade}</span>
                </li>
              ))}
            </ul>
            {negativos.length > 8 && (
              <p className="text-xs text-muted-foreground">e mais {negativos.length - 8}…</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Inventários</CardTitle>
            <Select value={lojaFiltro} onValueChange={setLojaFiltro}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as lojas</SelectItem>
                {lojas.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : inventarios.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum inventário registrado. Abra o primeiro para começar a contagem.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr className="text-left">
                    <th className="p-3 font-medium">Abertura</th>
                    <th className="p-3 font-medium">Loja</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Encerramento</th>
                    <th className="p-3 font-medium">Observações</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {inventarios.map((inv: any) => (
                    <tr
                      key={inv.id}
                      className={`border-b last:border-0 hover:bg-muted/30 ${selecionado === inv.id ? "bg-muted/50" : ""}`}
                    >
                      <td className="whitespace-nowrap p-3">{new Date(inv.data_inicio).toLocaleString("pt-BR")}</td>
                      <td className="p-3">{inv.loja?.nome ?? "—"}</td>
                      <td className="p-3">
                        <Badge variant={STATUS[inv.status]?.variant ?? "outline"}>
                          {STATUS[inv.status]?.label ?? inv.status}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap p-3 text-muted-foreground">
                        {inv.data_fim ? new Date(inv.data_fim).toLocaleString("pt-BR") : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">{inv.observacoes ?? "—"}</td>
                      <td className="p-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelecionado(inv.id)}>
                          <ClipboardList className="mr-2 h-4 w-4" /> Contagem
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selecionado && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  Contagem — {inventarioAtual?.loja?.nome ?? ""}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {itens.length} produto(s) · {divergencias.length} divergência(s) · {naoContados.length} sem contagem
                </p>
              </div>
              {inventarioAtual?.status === "aberto" && (
                <Button
                  onClick={() => setConfirmarAplicar(true)}
                  disabled={aplicar.isPending || divergencias.length === 0}
                  title={divergencias.length === 0 ? "Nenhuma divergência para aplicar" : undefined}
                >
                  {aplicar.isPending
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Aplicar ajustes
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {carregandoItens ? (
              <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando itens...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr className="text-left">
                      <th className="p-3 font-medium">Produto</th>
                      <th className="p-3 text-right font-medium">Sistema</th>
                      <th className="p-3 text-right font-medium">Contado</th>
                      <th className="p-3 text-right font-medium">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item: any) => {
                      const contado = item.quantidade_contada;
                      const dif = contado === null ? null : contado - item.quantidade_sistema;
                      return (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="p-3">
                            <div className="font-medium">{item.produto?.nome ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">{item.produto?.sku ?? ""}</div>
                          </td>
                          <td className="p-3 text-right tabular-nums">{item.quantidade_sistema}</td>
                          <td className="p-3 text-right">
                            <Input
                              type="number"
                              min={0}
                              className="ml-auto w-28 text-right"
                              defaultValue={contado ?? ""}
                              disabled={inventarioAtual?.status !== "aberto"}
                              onBlur={(e) => {
                                const novo = e.target.value === "" ? null : Number(e.target.value);
                                if (novo !== contado) handleContagem(item.id, e.target.value);
                              }}
                            />
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {dif === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : dif === 0 ? (
                              <span className="text-emerald-600">0</span>
                            ) : (
                              <span className={dif > 0 ? "text-blue-600" : "text-red-600"}>
                                {dif > 0 ? `+${dif}` : dif}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={modalAbrir} onOpenChange={setModalAbrir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir inventário</DialogTitle>
            <DialogDescription>
              O sistema registra o saldo atual de cada produto da loja como ponto de partida da contagem.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Loja</Label>
              <Select value={novaLoja} onValueChange={setNovaLoja}>
                <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                <SelectContent>
                  {lojas.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea
                value={novaObs}
                onChange={(e) => setNovaObs(e.target.value)}
                placeholder="Ex.: balanço trimestral"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAbrir(false)}>Cancelar</Button>
            <Button onClick={handleAbrir} disabled={abrir.isPending}>
              {abrir.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Abrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmarAplicar} onOpenChange={setConfirmarAplicar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" /> Aplicar ajustes de inventário
            </DialogTitle>
            <DialogDescription>
              {divergencias.length} produto(s) terão o saldo corrigido para a quantidade contada, e cada
              correção vira um movimento de inventário no kardex. O inventário será encerrado.
              {naoContados.length > 0 && ` ${naoContados.length} produto(s) sem contagem ficam inalterados.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarAplicar(false)}>Cancelar</Button>
            <Button onClick={handleAplicar} disabled={aplicar.isPending}>
              {aplicar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

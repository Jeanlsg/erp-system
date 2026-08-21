// ============================================================
// Página: Devoluções — parciais ou totais
//
// O caso típico: uma creatina veio vencida, mas o whey da mesma venda
// fica. A devolução é POR ITEM e POR QUANTIDADE, e cada item decide se
// volta ao estoque: produto vencido/avariado NÃO volta à prateleira —
// fica registrado como perda na devolução.
//
// Quem faz o serviço é o banco (erp.registrar_devolucao), numa transação:
// estoque via kardex, financeiro (abate a conta pendente ou gera o
// reembolso) e estorno proporcional de pontos.
// ============================================================

import { useState } from "react";
import { AlertTriangle, Loader2, PackageX, RotateCcw, Undo2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ComboboxBusca } from "@/components/ui/combobox-busca";

import {
  useVendas, useItensDevolviveis, useDevolucoes, useRegistrarDevolucao,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date, dateTime } from "@/lib/format";
import { toast } from "sonner";

export function DevolucoesPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: vendas = [] } = useVendas({ lojaId: lojaId ?? undefined });
  const { data: devolucoes = [] } = useDevolucoes(lojaId ?? undefined);
  const registrar = useRegistrarDevolucao();

  const [vendaId, setVendaId] = useState("");
  const { data: itens = [], isLoading: carregandoItens } = useItensDevolviveis(vendaId || undefined);

  // seleção: venda_item_id → { quantidade, retorna }
  const [selecao, setSelecao] = useState<Record<string, { qtd: number; retorna: boolean }>>({});
  const [motivo, setMotivo] = useState("");

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Devoluções" />;

  const vendasElegiveis = vendas.filter((v: any) => ["finalizada", "devolvida"].includes(v.status));

  const escolhidos = itens.filter((i: any) => (selecao[i.id]?.qtd ?? 0) > 0);
  const valorDevolucao = escolhidos.reduce(
    (s: number, i: any) => s + (Number(i.subtotal) / Number(i.quantidade)) * (selecao[i.id]?.qtd ?? 0), 0);

  const mudarQtd = (item: any, valor: string) => {
    const n = Math.max(0, Math.min(Number(valor) || 0, item.devolvivel));
    setSelecao((s) => ({ ...s, [item.id]: { qtd: n, retorna: s[item.id]?.retorna ?? true } }));
  };

  async function handleRegistrar() {
    try {
      const r: any = await registrar.mutateAsync({
        vendaId,
        itens: escolhidos.map((i: any) => ({
          venda_item_id: i.id,
          quantidade: selecao[i.id].qtd,
          retorna_estoque: selecao[i.id].retorna,
        })),
        motivo: motivo.trim() || undefined,
      });
      toast.success(
        r.total_da_venda ? "Devolução total registrada" : "Devolução parcial registrada",
        { description: `${brl(r.valor_devolvido)} devolvidos · ${r.itens_ao_estoque} item(ns) de volta ao estoque` },
      );
      setSelecao({});
      setMotivo("");
      if (r.total_da_venda) setVendaId("");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <RotateCcw className="h-6 w-6" /> Devoluções
        </h1>
        <p className="text-muted-foreground">
          Parcial ou total, por item e quantidade. Produto vencido ou avariado não volta ao
          estoque — desmarque “retorna ao estoque” e ele fica registrado como perda.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar devolução</CardTitle>
          <CardDescription>
            Escolha a venda, marque o que volta e quanto. Estoque (kardex), financeiro e
            pontos são ajustados juntos, na mesma operação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xl">
            <Label className="text-xs">Venda</Label>
            <ComboboxBusca
              className="mt-1"
              itens={vendasElegiveis.map((v: any) => ({
                id: v.id,
                rotulo: `#${v.numero_pedido} · ${brl(v.total)}${v.cliente?.nome_razao ? ` · ${v.cliente.nome_razao}` : ""}${v.status === "devolvida" ? " · JÁ DEVOLVIDA" : ""}`,
                detalhe: date(v.data_venda),
              }))}
              value={vendaId}
              onChange={(v) => { setVendaId(v); setSelecao({}); }}
              placeholder="Buscar por número, valor ou cliente…"
            />
          </div>

          {vendaId && (carregandoItens ? (
            <div className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> carregando itens…
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Vendido</TableHead>
                    <TableHead className="text-right">Já devolvido</TableHead>
                    <TableHead className="w-28 text-right">Devolver</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((i: any) => {
                    const sel = selecao[i.id];
                    const esgotado = i.devolvivel <= 0;
                    return (
                      <TableRow key={i.id} className={esgotado ? "opacity-50" : ""}>
                        <TableCell>
                          <span className="font-medium">{i.nome}</span>
                          {i.kit_id && <Badge variant="outline" className="ml-2">kit</Badge>}
                        </TableCell>
                        <TableCell className="text-right">{Number(i.quantidade)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{i.devolvido}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number" min={0} max={i.devolvivel} disabled={esgotado}
                            value={sel?.qtd ?? 0}
                            onChange={(e) => mudarQtd(i, e.target.value)}
                            className="h-8 w-20 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          {(sel?.qtd ?? 0) > 0 && (
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={sel?.retorna ?? true}
                                onChange={(e) => setSelecao((s) => ({
                                  ...s, [i.id]: { qtd: s[i.id]?.qtd ?? 0, retorna: e.target.checked },
                                }))}
                              />
                              {sel?.retorna ?? true
                                ? <span>retorna ao estoque</span>
                                : <span className="flex items-center gap-1 text-red-600">
                                    <PackageX className="h-3.5 w-3.5" /> perda (vencido/avariado)
                                  </span>}
                            </label>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {(sel?.qtd ?? 0) > 0
                            ? brl((Number(i.subtotal) / Number(i.quantidade)) * sel!.qtd)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-64 flex-1">
                  <Label className="text-xs">Motivo</Label>
                  <Input value={motivo} onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ex.: creatina vencida na prateleira" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">valor a devolver</p>
                  <p className="text-xl font-semibold">{brl(valorDevolucao)}</p>
                </div>
                <Button onClick={handleRegistrar}
                  disabled={registrar.isPending || escolhidos.length === 0}>
                  {registrar.isPending
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Undo2 className="mr-2 h-4 w-4" />}
                  Registrar devolução
                </Button>
              </div>

              <p className="flex max-w-3xl items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs dark:bg-amber-950/20">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>
                  Venda ainda não paga: o valor é abatido da conta a receber. Venda já paga:
                  gera o reembolso no financeiro (saída de caixa em dinheiro). Se a venda tem
                  nota fiscal autorizada, emita também a <b>NF-e de devolução</b> em Notas
                  Fiscais para o fiscal ficar alinhado.
                </span>
              </p>
            </>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Devoluções registradas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {devolucoes.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma devolução.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Venda</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devolucoes.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap">{dateTime(d.created_at)}</TableCell>
                    <TableCell>
                      #{d.venda?.numero_pedido}
                      {d.venda?.cliente?.nome_razao && (
                        <span className="block text-xs text-muted-foreground">{d.venda.cliente.nome_razao}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(d.itens ?? []).map((i: any) =>
                        `${i.quantidade}x ${i.nome}${i.retornou_estoque ? "" : " (perda)"}`).join(", ")}
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-sm text-muted-foreground">{d.motivo ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{brl(d.valor_devolvido)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={d.total_da_venda ? "" : "border-amber-400 text-amber-700"}>
                        {d.total_da_venda ? "total" : "parcial"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

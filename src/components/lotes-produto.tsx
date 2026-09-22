// ============================================================
// Lotes de um produto — onde a validade vira data de verdade.
//
// A validade do estoque é uma DATA ("vence em 30/11"), não um prazo
// solto: é ela que manda na baixa FEFO (sai primeiro o que vence
// primeiro) e nos alertas de vencimento. Quem prefere pensar em prazo
// ("vale 18 meses") digita os dias e a data é calculada — o que fica
// guardado é sempre a data final.
// ============================================================

import { useMemo, useState } from "react";
import { CalendarClock, Loader2, Plus, Trash2, AlertTriangle, Check, PackageX, Scale } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidarProdutos } from "@/lib/supabase-queries";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { date as fmtData } from "@/lib/format";

/** Dias entre hoje e a data (negativo = já venceu). */
function diasAte(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(iso + "T00:00:00");
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

function somaDias(baseIso: string, dias: number): string {
  const d = new Date(baseIso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const hojeIso = () => new Date().toISOString().slice(0, 10);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** produto selecionado: id, nome, sku e se já controla lote */
  produto: { id: string; nome: string; sku?: string | null; controla_lote?: boolean } | null;
  lojas: any[];
  lojaIdInicial?: string | null;
}

export function LotesProdutoDialog({ open, onOpenChange, produto, lojas, lojaIdInicial }: Props) {
  const qc = useQueryClient();
  const [modoPrazo, setModoPrazo] = useState<"data" | "dias">("data");
  const [form, setForm] = useState({
    codigo: "", quantidade: "", fabricacao: "", validade: "", dias: "", loja_id: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const { data: lotes = [], isLoading } = useQuery<any[]>({
    queryKey: ["erp_lotes_produto", produto?.id],
    enabled: open && !!produto?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("erp_lotes")
        .select("*")
        .eq("produto_id", produto!.id)
        .order("data_validade", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Saldo por loja: o total dos lotes só faz sentido ao lado dele. Lote e
  // saldo são contagens separadas (cadastrar lote não movimenta estoque);
  // aqui a diferença fica visível e há um botão para igualar — pelo Kardex.
  const { data: saldos = [] } = useQuery<any[]>({
    queryKey: ["erp_estoque_produto", produto?.id],
    enabled: open && !!produto?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("erp_estoque").select("loja_id, quantidade").eq("produto_id", produto!.id);
      if (error) throw error;
      return data ?? [];
    },
  });
  const [ocupado, setOcupado] = useState<string | null>(null);

  const resumoPorLoja = useMemo(() => {
    const m = new Map<string, { lotes: number; saldo: number; vencidos: number }>();
    for (const l of lotes) {
      const r = m.get(l.loja_id) ?? { lotes: 0, saldo: 0, vencidos: 0 };
      r.lotes += Number(l.quantidade) || 0;
      if (diasAte(l.data_validade) < 0) r.vencidos += Number(l.quantidade) || 0;
      m.set(l.loja_id, r);
    }
    for (const s of saldos) {
      const r = m.get(s.loja_id) ?? { lotes: 0, saldo: 0, vencidos: 0 };
      r.saldo = Number(s.quantidade) || 0;
      m.set(s.loja_id, r);
    }
    return [...m.entries()].filter(([, r]) => r.lotes > 0 || r.saldo > 0);
  }, [lotes, saldos]);

  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ["erp_lotes_produto", produto?.id] });
    void qc.invalidateQueries({ queryKey: ["erp_estoque_produto", produto?.id] });
    void qc.invalidateQueries({ queryKey: ["erp_lotes"] });
    void qc.invalidateQueries({ queryKey: ["erp_lotes-vencendo"] });
    void qc.invalidateQueries({ queryKey: ["erp_estoque"] });
    void qc.invalidateQueries({ queryKey: ["erp_estoque_movimentacoes"] });
    invalidarProdutos(qc);
  };

  // Lote É estoque: o que entra no lote entra no saldo, o que sai do lote
  // sai do saldo — sempre pelas RPCs, para o Kardex contar a história.
  // Antes as duas contagens eram independentes e o balcão vivia com uma
  // "diferença" para consertar na mão.
  const moverSaldo = async (lojaId: string, delta: number, motivo: string, loteId?: string) => {
    if (!produto || delta === 0) return;
    if (delta > 0) {
      const { error } = await supabase.schema("erp").rpc("creditar_estoque_atomico", {
        p_loja_id: lojaId,
        p_itens: [{ produto_id: produto.id, quantidade: delta }],
        p_origem: "lote", p_documento_id: loteId ?? null,
      });
      if (error) throw new Error(error.message);
      return;
    }
    const saldo = Number(saldos.find((s: any) => s.loja_id === lojaId)?.quantidade ?? 0);
    const { error } = await supabase.schema("erp").rpc("ajustar_estoque_atomico", {
      p_loja_id: lojaId, p_produto_id: produto.id,
      p_nova_quantidade: Math.max(0, saldo + delta), p_observacao: motivo,
    });
    if (error) throw new Error(error.message);
  };

  const alterarQuantidade = async (lote: any, nova: string) => {
    const n = parseInt(nova, 10);
    if (!Number.isInteger(n) || n < 0) { toast.error("Quantidade inválida."); return; }
    const delta = n - Number(lote.quantidade);
    try {
      const { error } = await supabase.from("erp_lotes").update({ quantidade: n }).eq("id", lote.id);
      if (error) throw new Error(error.message);
      await moverSaldo(lote.loja_id, delta, `lote ${lote.codigo}: ${lote.quantidade} → ${n}`, lote.id);
      toast.success(`Lote ${lote.codigo}: ${lote.quantidade} → ${n}. Estoque ${delta > 0 ? "+" : ""}${delta}.`);
    } catch (e: any) {
      toast.error(`Erro ao alterar: ${e.message ?? e}`);
    }
    recarregar();
  };

  const igualarSaldo = async (lojaId: string, total: number, saldo: number) => {
    if (!produto) return;
    if (!confirm(`Ajustar o saldo de ${lojas.find((x: any) => x.id === lojaId)?.apelido ?? "loja"} de ${saldo} para ${total} (total dos lotes)? Fica registrado no Kardex como ajuste.`)) return;
    setOcupado(`igualar-${lojaId}`);
    try {
      const { error } = await supabase.schema("erp").rpc("ajustar_estoque_atomico", {
        p_loja_id: lojaId, p_produto_id: produto.id, p_nova_quantidade: total,
        p_observacao: "igualado ao total dos lotes",
      });
      if (error) throw error;
      toast.success(`Saldo ajustado: ${saldo} → ${total}.`);
      recarregar();
    } catch (e: any) {
      toast.error(`Não foi possível ajustar: ${e.message ?? e}`);
    } finally {
      setOcupado(null);
    }
  };

  const baixarVencido = async (l: any) => {
    if (!confirm(`Dar baixa por vencimento no lote ${l.codigo} (${l.quantidade} un)?\n\nTira do estoque, registra saída "vencimento" no Kardex e zera o lote. O lote continua listado, zerado, como rastro.`)) return;
    setOcupado(`baixa-${l.id}`);
    try {
      const { data, error } = await supabase.schema("erp").rpc("baixar_lote_vencido", { p_lote_id: l.id });
      if (error) throw error;
      const r = data as any;
      toast.success(`Baixa feita: ${r?.baixado ?? l.quantidade} un retiradas do estoque (${r?.saldo_anterior} → ${r?.saldo_posterior}).`);
      recarregar();
    } catch (e: any) {
      toast.error(`Não foi possível dar baixa: ${e.message ?? e}`);
    } finally {
      setOcupado(null);
    }
  };

  // Prazo em dias e data final são a mesma informação vista de dois lados:
  // qualquer um dos dois campos recalcula o outro na hora.
  const baseCalculo = form.fabricacao || hojeIso();
  const dataFinal = useMemo(() => {
    if (modoPrazo === "data") return form.validade;
    const n = parseInt(form.dias, 10);
    return Number.isFinite(n) && n > 0 ? somaDias(baseCalculo, n) : "";
  }, [modoPrazo, form.validade, form.dias, baseCalculo]);

  const limpar = () => {
    setForm({ codigo: "", quantidade: "", fabricacao: "", validade: "", dias: "", loja_id: lojaIdInicial ?? "" });
    setModoPrazo("data");
  };

  const salvar = async () => {
    if (!produto) return;
    const loja = form.loja_id || lojaIdInicial || (lojas.length === 1 ? lojas[0].id : "");
    if (!loja) { toast.error("Escolha a loja onde este lote está."); return; }
    if (!dataFinal) { toast.error("Informe a data de validade (ou o prazo em dias)."); return; }
    const qtd = parseInt(form.quantidade, 10);
    if (!Number.isFinite(qtd) || qtd <= 0) { toast.error("Informe a quantidade do lote."); return; }
    if (diasAte(dataFinal) < 0 && !confirm("Esta data já passou. Cadastrar mesmo assim?")) return;

    setSalvando(true);
    try {
      // Código é obrigatório no banco; sem um do fabricante, usa a validade
      // como identificação — é o que a etiqueta da prateleira mostra mesmo.
      const codigo = form.codigo.trim() || `VAL-${dataFinal.replace(/-/g, "")}`;
      const { data: novo, error } = await supabase.from("erp_lotes").insert({
        produto_id: produto.id,
        loja_id: loja,
        codigo,
        data_fabricacao: form.fabricacao || null,
        data_validade: dataFinal,
        quantidade: qtd,
      }).select("id").single();
      if (error) throw error;
      // o lote entra no estoque (Kardex: entrada, origem "lote")
      await moverSaldo(loja, qtd, `lote ${codigo}`, novo.id);

      // Sem controla_lote a venda ignora os lotes (o FEFO nem roda) e a
      // validade viraria enfeite. Liga junto com o primeiro lote.
      if (!produto.controla_lote) {
        const { error: e2 } = await supabase
          .from("erp_produtos").update({ controla_lote: true }).eq("id", produto.id);
        if (e2) throw e2;
        toast.success(`Lote salvo: ${qtd} un entraram no estoque. Controle de validade ligado — a venda passa a tirar do lote que vence primeiro.`);
      } else {
        toast.success(`Lote salvo: ${qtd} un entraram no estoque, vence em ${fmtData(dataFinal)}.`);
      }
      limpar();
      recarregar();
    } catch (e: any) {
      toast.error(`Não foi possível salvar: ${e.message ?? e}`);
    } finally {
      setSalvando(false);
    }
  };

  const alterarValidade = async (loteId: string, novaData: string) => {
    if (!novaData) return;
    const { error } = await supabase.from("erp_lotes")
      .update({ data_validade: novaData }).eq("id", loteId);
    if (error) { toast.error(`Erro ao alterar: ${error.message}`); return; }
    toast.success(`Validade alterada para ${fmtData(novaData)}.`);
    void qc.invalidateQueries({ queryKey: ["erp_lotes_produto", produto?.id] });
    void qc.invalidateQueries({ queryKey: ["erp_lotes-vencendo"] });
    invalidarProdutos(qc);
  };

  const excluir = async (l: any) => {
    const qtd = Number(l.quantidade) || 0;
    const aviso = qtd > 0
      ? `Excluir o lote ${l.codigo}? As ${qtd} un dele SAEM do estoque (ajuste no Kardex). Se venceu, prefira "Baixar vencido".`
      : `Excluir o lote ${l.codigo} (já zerado)?`;
    if (!confirm(aviso)) return;
    setExcluindo(l.id);
    try {
      if (qtd > 0) await moverSaldo(l.loja_id, -qtd, `lote ${l.codigo} excluído`, l.id);
      const { error } = await supabase.from("erp_lotes").delete().eq("id", l.id);
      if (error) throw new Error(error.message);
      toast.success(qtd > 0 ? `Lote excluído; estoque −${qtd}.` : "Lote excluído.");
    } catch (e: any) {
      toast.error(`Erro ao excluir: ${e.message ?? e}`);
    } finally {
      setExcluindo(null);
    }
    recarregar();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) limpar(); }}>
      {/* O DialogContent base é grid: linhas cabeçalho / conteúdo / rodapé, e o
          meio rola. min-w-0 no filho é o que impede os inputs de data (largura
          intrínseca grande) de alargarem o conteúdo além do modal. */}
      <DialogContent className="max-w-2xl max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" /> Validade e lotes
          </DialogTitle>
          <DialogDescription>
            {produto ? <><b>{produto.nome}</b>{produto.sku ? ` · ${produto.sku}` : ""}</> : ""}
          </DialogDescription>
        </DialogHeader>

        {/* rola por dentro: com vários lotes o modal passava do viewport e a lista saía da tela */}
        <div className="min-w-0 min-h-0 overflow-y-auto overflow-x-hidden pr-1 space-y-4">
          {/* ---- novo lote ---- */}
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-sm font-medium">Novo lote</p>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Quantidade</Label>
                <Input type="number" min={1} inputMode="numeric" placeholder="0"
                  value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Código do lote <span className="text-muted-foreground">(opcional)</span></Label>
                <Input placeholder="Do fabricante" value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Loja</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  value={form.loja_id || lojaIdInicial || ""}
                  onChange={(e) => setForm({ ...form, loja_id: e.target.value })}
                >
                  <option value="">Selecione…</option>
                  {lojas.map((l: any) => (
                    <option key={l.id} value={l.id}>{l.apelido ?? l.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ---- validade: data final OU prazo em dias ---- */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label className="mr-1">Validade</Label>
                <Button type="button" size="sm" variant={modoPrazo === "data" ? "default" : "outline"}
                  onClick={() => setModoPrazo("data")}>
                  Data final
                </Button>
                <Button type="button" size="sm" variant={modoPrazo === "dias" ? "default" : "outline"}
                  onClick={() => setModoPrazo("dias")}>
                  Prazo em dias
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {modoPrazo === "data" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Vence em</Label>
                    <Input type="date" value={form.validade}
                      onChange={(e) => setForm({ ...form, validade: e.target.value })} />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Dias de validade</Label>
                    <Input type="number" min={1} placeholder="Ex.: 540" value={form.dias}
                      onChange={(e) => setForm({ ...form, dias: e.target.value })} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Fabricação <span className="text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input type="date" value={form.fabricacao}
                    onChange={(e) => setForm({ ...form, fabricacao: e.target.value })} />
                </div>
              </div>

              {dataFinal && (
                <p className="text-xs text-muted-foreground">
                  {modoPrazo === "dias" && (
                    <>Contado a partir {form.fabricacao ? "da fabricação" : "de hoje"} · </>
                  )}
                  Vence em <b>{fmtData(dataFinal)}</b>
                  {diasAte(dataFinal) >= 0
                    ? ` (em ${diasAte(dataFinal)} dia(s))`
                    : ` — já vencido há ${Math.abs(diasAte(dataFinal))} dia(s)`}
                </p>
              )}
            </div>

            {produto && !produto.controla_lote && (
              <p className="flex gap-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 flex-none" />
                Este produto ainda não controla validade. Ao salvar o primeiro lote o controle é
                ligado, e a venda passa a tirar do lote que vence primeiro.
              </p>
            )}

            <div className="flex justify-end">
              <Button onClick={() => void salvar()} disabled={salvando}>
                {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Salvar lote
              </Button>
            </div>
          </div>

          {/* ---- total por loja × saldo ---- */}
          {resumoPorLoja.length > 0 && (
            <div className="rounded-md border p-3 space-y-1.5 text-sm">
              <p className="font-medium flex items-center gap-2"><Scale className="h-4 w-4" /> Total nos lotes × saldo em estoque</p>
              {resumoPorLoja.map(([lojaId, r]) => (
                <div key={lojaId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-[7rem]">{lojas.find((x: any) => x.id === lojaId)?.apelido ?? "—"}</span>
                  <span className="tabular-nums">lotes: <b>{r.lotes}</b>{r.vencidos > 0 && <span className="text-destructive"> ({r.vencidos} vencido{r.vencidos > 1 ? "s" : ""})</span>}</span>
                  <span className="tabular-nums">saldo: <b>{r.saldo}</b></span>
                  {r.lotes !== r.saldo ? (
                    <>
                      <Badge variant="outline" className="border-orange-500 text-orange-600">diferença {r.lotes - r.saldo > 0 ? "+" : ""}{r.lotes - r.saldo}</Badge>
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={ocupado === `igualar-${lojaId}`}
                        onClick={() => void igualarSaldo(lojaId, r.lotes, r.saldo)}>
                        {ocupado === `igualar-${lojaId}` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Igualar saldo aos lotes"}
                      </Button>
                    </>
                  ) : <Badge variant="outline"><Check className="h-3 w-3 mr-1" />batem</Badge>}
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Lote novo entra no estoque; lote excluído ou baixado sai. Diferença aqui é de cadastros antigos — "Igualar" acerta pelo Kardex. A venda tira do lote que vence primeiro e nunca de lote vencido.
              </p>
            </div>
          )}

          {/* ---- lotes existentes ---- */}
          <div>
            <p className="text-sm font-medium mb-2">Lotes cadastrados</p>
            {isLoading ? (
              <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            ) : lotes.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum lote cadastrado para este produto.
              </p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left p-2">Lote</th>
                      <th className="text-left p-2">Loja</th>
                      <th className="text-right p-2">Qtd</th>
                      <th className="text-left p-2">Vence em</th>
                      <th className="text-center p-2">Situação</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotes.map((l: any) => {
                      const d = diasAte(l.data_validade);
                      return (
                        <tr key={l.id} className="border-b last:border-0">
                          <td className="p-2 font-mono text-xs">{l.codigo}</td>
                          <td className="p-2 text-xs">
                            {lojas.find((x: any) => x.id === l.loja_id)?.apelido ?? "—"}
                          </td>
                          <td className="p-2 text-right">
                            <Input type="number" min={0} step={1} defaultValue={l.quantidade}
                              className="h-8 w-20 text-right tabular-nums"
                              onBlur={(e) => {
                                if (e.target.value !== "" && Number(e.target.value) !== Number(l.quantidade)) {
                                  void alterarQuantidade(l, e.target.value);
                                }
                              }} />
                          </td>
                          <td className="p-2">
                            {/* editável no lugar: corrigir data errada é o ajuste mais comum */}
                            <Input type="date" defaultValue={l.data_validade} className="h-8 w-[9.5rem]"
                              onBlur={(e) => {
                                if (e.target.value && e.target.value !== l.data_validade) {
                                  void alterarValidade(l.id, e.target.value);
                                }
                              }} />
                          </td>
                          <td className="p-2 text-center">
                            {d < 0 ? (
                              <Badge variant="destructive">Vencido</Badge>
                            ) : d <= 30 ? (
                              <Badge variant="outline" className="border-orange-500 text-orange-600">
                                {d}d
                              </Badge>
                            ) : (
                              <Badge variant="outline"><Check className="h-3 w-3 mr-1" />{d}d</Badge>
                            )}
                          </td>
                          <td className="p-2 text-right whitespace-nowrap">
                            {d < 0 && Number(l.quantidade) > 0 && (
                              <Button size="sm" variant="outline" className="h-7 text-xs mr-1 border-destructive text-destructive"
                                onClick={() => void baixarVencido(l)} disabled={ocupado === `baixa-${l.id}`}
                                title="Tira do estoque, registra no Kardex e zera o lote">
                                {ocupado === `baixa-${l.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><PackageX className="h-3 w-3 mr-1" />Baixar vencido</>}
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                              onClick={() => void excluir(l)} disabled={excluindo === l.id}
                              title="Excluir lote">
                              {excluindo === l.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

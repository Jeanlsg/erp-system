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
import { CalendarClock, Loader2, Plus, Trash2, AlertTriangle, Check } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
      const { error } = await supabase.from("erp_lotes").insert({
        produto_id: produto.id,
        loja_id: loja,
        codigo,
        data_fabricacao: form.fabricacao || null,
        data_validade: dataFinal,
        quantidade: qtd,
      });
      if (error) throw error;

      // Sem controla_lote a venda ignora os lotes (o FEFO nem roda) e a
      // validade viraria enfeite. Liga junto com o primeiro lote.
      if (!produto.controla_lote) {
        const { error: e2 } = await supabase
          .from("erp_produtos").update({ controla_lote: true }).eq("id", produto.id);
        if (e2) throw e2;
        toast.success("Lote salvo. Controle de validade ligado neste produto — a venda passa a tirar do lote que vence primeiro.");
      } else {
        toast.success(`Lote salvo: vence em ${fmtData(dataFinal)}.`);
      }
      limpar();
      void qc.invalidateQueries({ queryKey: ["erp_lotes_produto", produto.id] });
      void qc.invalidateQueries({ queryKey: ["erp_lotes"] });
      void qc.invalidateQueries({ queryKey: ["erp_lotes-vencendo"] });
      void qc.invalidateQueries({ queryKey: ["erp_produtos_completo"] });
      void qc.invalidateQueries({ queryKey: ["erp_produtos"] });
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
    void qc.invalidateQueries({ queryKey: ["erp_produtos_completo"] });
  };

  const excluir = async (loteId: string) => {
    if (!confirm("Excluir este lote? O saldo do estoque não muda — só o rastro de validade.")) return;
    setExcluindo(loteId);
    const { error } = await supabase.from("erp_lotes").delete().eq("id", loteId);
    setExcluindo(null);
    if (error) { toast.error(`Erro ao excluir: ${error.message}`); return; }
    toast.success("Lote excluído.");
    void qc.invalidateQueries({ queryKey: ["erp_lotes_produto", produto?.id] });
    void qc.invalidateQueries({ queryKey: ["erp_lotes-vencendo"] });
    void qc.invalidateQueries({ queryKey: ["erp_produtos_completo"] });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) limpar(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" /> Validade e lotes
          </DialogTitle>
          <DialogDescription>
            {produto ? <><b>{produto.nome}</b>{produto.sku ? ` · ${produto.sku}` : ""}</> : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
                          <td className="p-2 text-right tabular-nums">{l.quantidade}</td>
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
                          <td className="p-2 text-right">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                              onClick={() => void excluir(l.id)} disabled={excluindo === l.id}
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

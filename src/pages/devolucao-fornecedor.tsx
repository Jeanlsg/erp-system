// ============================================================
// Página: Devolução para fornecedor
//
// Mercadoria que volta — veio errada, com defeito ou a mais. Não existia
// nada: `Devoluções` é devolução DE CLIENTE, sobre uma venda.
//
// A devolução nasce de uma origem. Quando a compra entrou por XML, os
// itens vêm da nota com os impostos que foram cobrados — e é assim que a
// lei manda devolver: com os valores da entrada, não recalculados. Sem
// nota no sistema, dá para montar pelo catálogo, e aí os impostos entram
// à mão.
//
// Confirmar tira a mercadoria do estoque pelo Kardex, com origem própria:
// no inventário é preciso distinguir o que foi vendido do que voltou ao
// fornecedor.
// ============================================================

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2, PackageX, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputMoeda } from "@/components/ui/input-moeda";
import { Label } from "@/components/ui/label";
import { ComboboxBusca } from "@/components/ui/combobox-busca";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import {
  useDevolucoesFornecedor, useNotasEntradaFornecedor, useCriarDevolucaoFornecedor,
  useConfirmarDevolucaoFornecedor, useFornecedores, useProdutos, useTransportadoras,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { brl, date, num } from "@/lib/format";

type ItemDevolucao = {
  produto_id: string | null;
  nfe_item_id?: string | null;
  nome: string;
  codigo_ean?: string | null;
  ncm?: string | null;
  unidade: string;
  cfop: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  icms_aliquota: number;
  icms_valor: number;
  ipi_valor: number;
  pis_valor: number;
  cofins_valor: number;
  /** quanto veio na nota de origem — o teto do que se pode devolver */
  maximo?: number;
};

const MODALIDADES = [
  { v: 0, t: "0 — por conta do emitente" },
  { v: 1, t: "1 — por conta do destinatário" },
  { v: 2, t: "2 — por conta de terceiros" },
  { v: 9, t: "9 — sem frete" },
];

const SITUACAO: Record<string, { cor: string; texto: string }> = {
  rascunho:   { cor: "", texto: "Rascunho" },
  confirmada: { cor: "bg-blue-600", texto: "Confirmada · estoque saiu" },
  faturada:   { cor: "bg-green-600", texto: "Faturada" },
  cancelada:  { cor: "bg-muted text-muted-foreground", texto: "Cancelada" },
};

export function DevolucaoFornecedorPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: devolucoes = [], isLoading } = useDevolucoesFornecedor(lojaId ?? undefined);
  const { data: fornecedores = [] } = useFornecedores();
  const { data: produtos = [] } = useProdutos({ lojaId: lojaId ?? undefined });
  const { data: transportadoras = [] } = useTransportadoras();
  const criar = useCriarDevolucaoFornecedor();
  const confirmar = useConfirmarDevolucaoFornecedor();

  const [montando, setMontando] = useState(false);
  const [fornecedorId, setFornecedorId] = useState("");
  const [notaId, setNotaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [itens, setItens] = useState<ItemDevolucao[]>([]);
  const [frete, setFrete] = useState("0");
  const [seguro, setSeguro] = useState("0");
  const [outras, setOutras] = useState("0");
  const [modalidade, setModalidade] = useState("9");
  const [transportadora, setTransportadora] = useState("");
  const [placa, setPlaca] = useState("");
  const [volumes, setVolumes] = useState("");
  const [especie, setEspecie] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [produtoAvulso, setProdutoAvulso] = useState("");

  const { data: notas = [] } = useNotasEntradaFornecedor(fornecedorId || undefined, lojaId ?? undefined);
  const nota = useMemo(() => (notas as any[]).find((n) => n.id === notaId), [notas, notaId]);
  const fornecedor = useMemo(
    () => (fornecedores as any[]).find((f) => f.id === fornecedorId), [fornecedores, fornecedorId]);

  // CFOP pela UF: mesmo estado 5202, fora dele 6202
  const cfopPadrao = useMemo(() => {
    const ufFornecedor = fornecedor?.uf;
    return !ufFornecedor ? "5202" : "5202";  // sem os dados da loja, assume interno
  }, [fornecedor]);

  const totalProdutos = itens.reduce((s, i) => s + i.valor_total, 0);
  const totalGeral = totalProdutos + Number(frete || 0) + Number(seguro || 0) + Number(outras || 0);

  /** Traz os itens da nota de entrada, com os impostos que vieram nela. */
  const puxarDaNota = () => {
    if (!nota) return;
    const novos: ItemDevolucao[] = (nota.itens ?? []).map((i: any) => ({
      produto_id: i.produto_id ?? null,
      nfe_item_id: i.id,
      nome: i.nome,
      codigo_ean: i.codigo_ean,
      ncm: i.ncm,
      unidade: i.unidade ?? "UN",
      cfop: cfopPadrao,
      quantidade: Number(i.quantidade ?? 0),
      valor_unitario: Number(i.valor_unitario ?? 0),
      valor_total: Number(i.valor_total ?? 0),
      icms_aliquota: Number(i.icms_aliquota ?? 0),
      icms_valor: Number(i.icms_valor ?? 0),
      ipi_valor: Number(i.ipi_valor ?? 0),
      pis_valor: Number(i.pis_valor ?? 0),
      cofins_valor: Number(i.cofins_valor ?? 0),
      maximo: Number(i.quantidade ?? 0),
    }));
    setItens(novos);
    toast.success(`${novos.length} item(ns) da nota ${nota.numero}. Ajuste a quantidade do que volta.`);
  };

  const adicionarAvulso = () => {
    const p = (produtos as any[]).find((x) => x.id === produtoAvulso);
    if (!p) return;
    setItens((cur) => [...cur, {
      produto_id: p.id, nome: p.nome, codigo_ean: p.codigo_barras, ncm: p.ncm,
      unidade: p.unidade ?? "UN", cfop: cfopPadrao,
      quantidade: 1, valor_unitario: Number(p.preco_custo ?? 0), valor_total: Number(p.preco_custo ?? 0),
      icms_aliquota: 0, icms_valor: 0, ipi_valor: 0, pis_valor: 0, cofins_valor: 0,
    }]);
    setProdutoAvulso("");
  };

  const mudarQuantidade = (idx: number, qtd: number) => {
    setItens((cur) => cur.map((i, k) => {
      if (k !== idx) return i;
      const q = Math.max(0, i.maximo ? Math.min(qtd, i.maximo) : qtd);
      const proporcao = i.quantidade > 0 ? q / i.quantidade : 0;
      // os impostos acompanham a proporção devolvida: devolver metade da
      // caixa devolve metade do ICMS que veio nela
      return {
        ...i, quantidade: q,
        valor_total: Math.round(q * i.valor_unitario * 100) / 100,
        icms_valor: Math.round(i.icms_valor * proporcao * 100) / 100,
        ipi_valor: Math.round(i.ipi_valor * proporcao * 100) / 100,
        pis_valor: Math.round(i.pis_valor * proporcao * 100) / 100,
        cofins_valor: Math.round(i.cofins_valor * proporcao * 100) / 100,
      };
    }));
  };

  const limpar = () => {
    setMontando(false); setFornecedorId(""); setNotaId(""); setMotivo(""); setItens([]);
    setFrete("0"); setSeguro("0"); setOutras("0"); setModalidade("9");
    setTransportadora(""); setPlaca(""); setVolumes(""); setEspecie(""); setObservacoes("");
  };

  const salvar = async () => {
    if (!lojaId) { toast.error("Escolha a loja."); return; }
    if (!fornecedorId) { toast.error("Escolha o fornecedor."); return; }
    if (!motivo.trim()) { toast.error("Informe o motivo da devolução — ele vai na nota."); return; }
    const validos = itens.filter((i) => i.quantidade > 0);
    if (!validos.length) { toast.error("Nenhum item com quantidade a devolver."); return; }
    try {
      await criar.mutateAsync({
        devolucao: {
          loja_id: lojaId, fornecedor_id: fornecedorId,
          nfe_entrada_id: notaId || null,
          numero_nota_origem: nota?.numero ?? null,
          chave_nota_origem: nota?.chave_acesso ?? null,
          motivo: motivo.trim(), observacoes: observacoes.trim() || null,
          modalidade_frete: Number(modalidade),
          transportadora_id: transportadora || null,
          placa_veiculo: placa.trim() || null,
          volumes_qtd: volumes ? Number(volumes) : null,
          volumes_especie: especie.trim() || null,
          valor_frete: Number(frete || 0), valor_seguro: Number(seguro || 0),
          outras_despesas: Number(outras || 0),
          valor_produtos: totalProdutos, valor_total: totalGeral,
          status: "rascunho",
        },
        itens: validos.map(({ maximo: _m, ...i }) => i),
      });
      toast.success("Devolução criada como rascunho. Confirme para a mercadoria sair do estoque.");
      limpar();
    } catch (e: any) {
      toast.error(`Não foi possível criar: ${e.message ?? e}`);
    }
  };

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Devolução para fornecedor" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Undo2 className="h-6 w-6" /> Devolução para fornecedor
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Mercadoria que volta ao fornecedor. Quando a compra entrou por XML, os itens vêm da
            nota com os impostos que foram cobrados — é assim que a devolução deve sair.
          </p>
        </div>
        {!montando && (
          <Button onClick={() => setMontando(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nova devolução
          </Button>
        )}
      </div>

      {montando && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Nova devolução</CardTitle>
            <Button variant="ghost" size="sm" onClick={limpar}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Cancelar
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Fornecedor *</Label>
                <ComboboxBusca
                  className="mt-1"
                  itens={(fornecedores as any[]).map((f) => ({
                    id: f.id, rotulo: f.nome_razao,
                    detalhe: [f.cpf_cnpj, f.uf].filter(Boolean).join(" · "),
                  }))}
                  value={fornecedorId}
                  onChange={(id) => { setFornecedorId(id); setNotaId(""); setItens([]); }}
                  vazio="Escolha o fornecedor"
                />
              </div>
              <div>
                <Label>Nota de entrada <span className="text-muted-foreground">(origem)</span></Label>
                <Select value={notaId} onValueChange={setNotaId} disabled={!fornecedorId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={notas.length ? "Escolha a nota" : "Nenhuma nota deste fornecedor"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(notas as any[]).map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        NF {n.numero} · {date(n.data_emissao)} · {brl(Number(n.valor_total ?? 0))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {notaId && (
                  <Button variant="outline" size="sm" className="mt-2" onClick={puxarDaNota}>
                    Trazer itens da nota
                  </Button>
                )}
              </div>
            </div>

            <div>
              <Label>Motivo da devolução *</Label>
              <Input className="mt-1" value={motivo} onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: produto com defeito, quantidade a maior, item trocado" />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Vai nas informações complementares da nota — é o que o fornecedor lê.
              </p>
            </div>

            {/* itens */}
            <div className="rounded-md border">
              <div className="flex flex-wrap items-end gap-2 border-b p-3">
                <div className="min-w-[16rem] flex-1">
                  <Label className="text-xs">Acrescentar produto do catálogo</Label>
                  <ComboboxBusca
                    className="mt-1"
                    itens={(produtos as any[]).map((p) => ({
                      id: p.id, rotulo: p.nome, detalhe: p.sku ?? undefined,
                    }))}
                    value={produtoAvulso}
                    onChange={setProdutoAvulso}
                    vazio="Produto"
                  />
                </div>
                <Button variant="outline" onClick={adicionarAvulso} disabled={!produtoAvulso}>
                  <Plus className="mr-1 h-4 w-4" /> Acrescentar
                </Button>
              </div>

              {itens.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum item. Traga os da nota de entrada ou acrescente do catálogo.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left">Produto</th>
                        <th className="p-2 text-left">CFOP</th>
                        <th className="p-2 text-right">Qtd</th>
                        <th className="p-2 text-right">Vlr. unit.</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-right">ICMS</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((i, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="p-2">
                            {i.nome}
                            {i.maximo != null && (
                              <span className="block text-[11px] text-muted-foreground">
                                veio {num(i.maximo)} na nota
                              </span>
                            )}
                          </td>
                          <td className="p-2 font-mono text-xs">{i.cfop}</td>
                          <td className="p-2 text-right">
                            <Input type="number" min="0" step="any" className="h-8 w-20 text-right"
                              value={i.quantidade}
                              onChange={(e) => mudarQuantidade(idx, Number(e.target.value))} />
                          </td>
                          <td className="p-2 text-right tabular-nums">{brl(i.valor_unitario)}</td>
                          <td className="p-2 text-right font-medium tabular-nums">{brl(i.valor_total)}</td>
                          <td className="p-2 text-right tabular-nums text-muted-foreground">
                            {brl(i.icms_valor)}
                          </td>
                          <td className="p-2 text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              onClick={() => setItens((c) => c.filter((_, k) => k !== idx))}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* transporte e valores */}
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label className="text-xs">Modalidade de frete</Label>
                <Select value={modalidade} onValueChange={setModalidade}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODALIDADES.map((m) => (
                      <SelectItem key={m.v} value={String(m.v)}>{m.t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Transportadora</Label>
                <Select value={transportadora} onValueChange={setTransportadora}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {(transportadoras as any[]).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nome_razao ?? t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Placa</Label><Input className="mt-1" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Volumes</Label><Input type="number" className="mt-1" value={volumes} onChange={(e) => setVolumes(e.target.value)} /></div>
                <div><Label className="text-xs">Espécie</Label><Input className="mt-1" value={especie} onChange={(e) => setEspecie(e.target.value)} placeholder="Caixa" /></div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div><Label className="text-xs">Frete</Label><InputMoeda value={frete} onChange={(v) => setFrete(String(v))} /></div>
              <div><Label className="text-xs">Seguro</Label><InputMoeda value={seguro} onChange={(v) => setSeguro(String(v))} /></div>
              <div><Label className="text-xs">Outras despesas</Label><InputMoeda value={outras} onChange={(v) => setOutras(String(v))} /></div>
              <div className="flex flex-col justify-end">
                <p className="text-xs text-muted-foreground">Total da devolução</p>
                <p className="text-xl font-semibold tabular-nums">{brl(totalGeral)}</p>
              </div>
            </div>

            <div>
              <Label className="text-xs">Informações adicionais</Label>
              <Input className="mt-1" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={limpar}>Cancelar</Button>
              <Button onClick={() => void salvar()} disabled={criar.isPending}>
                {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                Salvar rascunho
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Devoluções</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
          ) : devolucoes.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <PackageX className="mx-auto mb-2 h-8 w-8 opacity-50" />
              Nenhuma devolução registrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Data</th>
                    <th className="p-2 text-left">Fornecedor</th>
                    <th className="p-2 text-left">Nota de origem</th>
                    <th className="p-2 text-left">Motivo</th>
                    <th className="p-2 text-center">Itens</th>
                    <th className="p-2 text-right">Valor</th>
                    <th className="p-2 text-center">Situação</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(devolucoes as any[]).map((d) => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-accent">
                      <td className="p-2">{date(d.created_at)}</td>
                      <td className="p-2">{d.fornecedor?.nome_razao ?? "—"}</td>
                      <td className="p-2">{d.numero_nota_origem ? `NF ${d.numero_nota_origem}` : "—"}</td>
                      <td className="p-2 max-w-[18rem] truncate">{d.motivo}</td>
                      <td className="p-2 text-center tabular-nums">{(d.itens ?? []).length}</td>
                      <td className="p-2 text-right tabular-nums">{brl(Number(d.valor_total ?? 0))}</td>
                      <td className="p-2 text-center">
                        <Badge className={SITUACAO[d.status]?.cor} variant={d.status === "rascunho" ? "outline" : "default"}>
                          {SITUACAO[d.status]?.texto ?? d.status}
                        </Badge>
                      </td>
                      <td className="p-2 text-right">
                        {d.status === "rascunho" && (
                          <Button size="sm" disabled={confirmar.isPending}
                            onClick={async () => {
                              if (!confirm(`Confirmar a devolução?\n\nAs ${(d.itens ?? []).length} linha(s) saem do estoque agora. Isso não se desfaz sozinho.`)) return;
                              try {
                                await confirmar.mutateAsync(d.id);
                                toast.success("Devolução confirmada — a mercadoria saiu do estoque.");
                              } catch (e: any) {
                                toast.error(`Não foi possível confirmar: ${e.message ?? e}`);
                              }
                            }}>
                            Confirmar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

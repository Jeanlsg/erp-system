// ============================================================
// Página: Notas de Devolução a Fornecedor
//
// Mercadoria que volta — veio errada, com defeito ou a mais. `Devoluções` é
// devolução DE CLIENTE, sobre uma venda.
//
// A devolução nasce de uma origem. Quando a compra entrou por XML, os itens
// vêm da nota com os impostos que foram cobrados e o número de cada item
// nela — é assim que a lei manda devolver, e é o que a NF-e precisa para
// referenciar a compra por item (NT 2025.002, regra VC02-14). Sem nota no
// sistema, dá para montar pelo catálogo e digitar a chave e o nº do item.
//
// Pedido da loja (10/10/2026): CFOP da operação escolhido ("às vezes muda"),
// quantidade e valor do que volta, volumes/peso/transportadora, tela de
// tributação por item (CFOP, origem, situação tributária, base, alíquota e
// ICMS da operação) e o ESPELHO antes de subir para a Receita. Antes a tela
// não emitia nota nenhuma e o CFOP estava fixo em 5202.
//
// Fluxo: rascunho (editável) → espelho → Confirmar (baixa o estoque pelo
// Kardex) → Emitir NF-e (saída, finalidade devolução) → faturada.
// ============================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Eye, FileText, Loader2, PackageX, Pencil, Plus, Receipt, Settings2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputMoeda } from "@/components/ui/input-moeda";
import { Label } from "@/components/ui/label";
import { ComboboxBusca } from "@/components/ui/combobox-busca";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import {
  useDevolucoesFornecedor, useNotasEntradaFornecedor, useCriarDevolucaoFornecedor,
  useConfirmarDevolucaoFornecedor, useFornecedores, useProdutos, useTransportadoras,
  useAtualizarDevolucaoFornecedor, useExcluirDevolucaoFornecedor, useNotaDevolucaoFornecedor,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { brl, date, num } from "@/lib/format";
import { CFOPS, CSOSNS, ORIGENS_MERCADORIA } from "@/lib/tabelas-fiscais";
import {
  aplicarTributacao, cfopDevolucao, faltaParaEmitir, itemDaNotaEntrada, mudarQuantidadeOuValor, soDigitos,
  type ItemDevolucao,
} from "@/lib/devolucao-fornecedor";

const MODALIDADES = [
  { v: 0, t: "0 — por conta do emitente" },
  { v: 1, t: "1 — por conta do destinatário" },
  { v: 2, t: "2 — por conta de terceiros" },
  { v: 9, t: "9 — sem frete" },
];

const SITUACAO: Record<string, { cor: string; texto: string }> = {
  rascunho:   { cor: "", texto: "Rascunho" },
  confirmada: { cor: "bg-blue-600", texto: "Confirmada · estoque saiu" },
  faturada:   { cor: "bg-green-600", texto: "Faturada · NF-e emitida" },
  cancelada:  { cor: "bg-muted text-muted-foreground", texto: "Cancelada" },
};

const CFOPS_DEVOLUCAO = CFOPS.filter((c) => c.grupo === "Devolução a fornecedor" || c.grupo === "Outras");

/** Abre o PDF do DANFE (base64) numa aba nova. */
function abrirPdf(b64: string) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function DevolucaoFornecedorPage() {
  const { lojaId, lojas } = useAutoSelectLoja();
  const loja = (lojas as any[]).find((l) => l.id === lojaId) ?? null;
  const { data: devolucoes = [], isLoading } = useDevolucoesFornecedor(lojaId ?? undefined);
  const { data: fornecedores = [] } = useFornecedores();
  const { data: produtos = [] } = useProdutos({ lojaId: lojaId ?? undefined });
  const { data: transportadoras = [] } = useTransportadoras();
  const criar = useCriarDevolucaoFornecedor();
  const atualizar = useAtualizarDevolucaoFornecedor();
  const excluir = useExcluirDevolucaoFornecedor();
  const confirmar = useConfirmarDevolucaoFornecedor();
  const notaDev = useNotaDevolucaoFornecedor();

  const [montando, setMontando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fornecedorId, setFornecedorId] = useState("");
  const [notaId, setNotaId] = useState("");
  const [numeroOrigem, setNumeroOrigem] = useState("");
  const [chaveOrigem, setChaveOrigem] = useState("");
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
  const [pesoBruto, setPesoBruto] = useState("");
  const [pesoLiquido, setPesoLiquido] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [produtoAvulso, setProdutoAvulso] = useState("");
  const [tributando, setTributando] = useState<number | null>(null);
  const [trib, setTrib] = useState<Partial<ItemDevolucao>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  const { data: notas = [] } = useNotasEntradaFornecedor(fornecedorId || undefined, lojaId ?? undefined);
  const nota = useMemo(() => (notas as any[]).find((n) => n.id === notaId), [notas, notaId]);
  const fornecedor = useMemo(
    () => (fornecedores as any[]).find((f) => f.id === fornecedorId), [fornecedores, fornecedorId]);
  const ufFornecedor = fornecedor?.endereco?.uf ?? fornecedor?.uf ?? null;
  // CFOP pela UF: 5202 no mesmo estado, 6202 fora (o operador pode trocar por item)
  const cfopPadrao = cfopDevolucao(loja?.uf, ufFornecedor);

  const totalProdutos = itens.reduce((s, i) => s + i.valor_total, 0);
  const totalIcms = itens.reduce((s, i) => s + i.icms_valor, 0);
  const totalGeral = totalProdutos + Number(frete || 0) + Number(seguro || 0) + Number(outras || 0);
  const faltas = faltaParaEmitir({ chave_nota_origem: chaveOrigem, fornecedor, itens });

  const puxarDaNota = () => {
    if (!nota) return;
    const novos = (nota.itens ?? []).map((i: any) => itemDaNotaEntrada(i, cfopPadrao));
    setItens(novos);
    setNumeroOrigem(String(nota.numero ?? ""));
    setChaveOrigem(nota.chave_acesso ?? "");
    toast.success(`${novos.length} item(ns) da nota ${nota.numero}. Ajuste a quantidade do que volta.`);
  };

  const adicionarAvulso = () => {
    const p = (produtos as any[]).find((x) => x.id === produtoAvulso);
    if (!p) return;
    const custo = Number(p.preco_custo ?? 0);
    setItens((cur) => [...cur, {
      produto_id: p.id, nome: p.nome, codigo_ean: p.codigo_barras, ncm: p.ncm, unidade: p.unidade ?? "UN",
      cfop: cfopPadrao, quantidade: 1, valor_unitario: custo, valor_total: custo,
      icms_origem: String(p.origem_mercadoria ?? 0), icms_csosn: p.csosn ?? "102",
      icms_base: 0, icms_aliquota: 0, icms_valor: 0, ipi_valor: 0, pis_valor: 0, cofins_valor: 0,
      item_nota_origem: null,
    }]);
    setProdutoAvulso("");
  };

  const mudarItem = (idx: number, f: (i: ItemDevolucao) => ItemDevolucao) => setItens((c) => c.map((i, k) => (k === idx ? f(i) : i)));

  const limpar = () => {
    setMontando(false); setEditId(null); setFornecedorId(""); setNotaId(""); setNumeroOrigem(""); setChaveOrigem("");
    setMotivo(""); setItens([]); setFrete("0"); setSeguro("0"); setOutras("0"); setModalidade("9");
    setTransportadora(""); setPlaca(""); setVolumes(""); setEspecie(""); setPesoBruto(""); setPesoLiquido(""); setObservacoes("");
  };

  const editar = (d: any) => {
    setMontando(true); setEditId(d.id);
    setFornecedorId(d.fornecedor_id); setNotaId(d.nfe_entrada_id ?? "");
    setNumeroOrigem(d.numero_nota_origem ?? ""); setChaveOrigem(d.chave_nota_origem ?? "");
    setMotivo(d.motivo ?? ""); setObservacoes(d.observacoes ?? "");
    setFrete(String(d.valor_frete ?? 0)); setSeguro(String(d.valor_seguro ?? 0)); setOutras(String(d.outras_despesas ?? 0));
    setModalidade(String(d.modalidade_frete ?? 9)); setTransportadora(d.transportadora_id ?? "");
    setPlaca(d.placa_veiculo ?? ""); setVolumes(d.volumes_qtd != null ? String(d.volumes_qtd) : "");
    setEspecie(d.volumes_especie ?? ""); setPesoBruto(d.peso_bruto != null ? String(d.peso_bruto) : "");
    setPesoLiquido(d.peso_liquido != null ? String(d.peso_liquido) : "");
    setItens((d.itens ?? []).map((i: any) => ({
      produto_id: i.produto_id, nfe_item_id: i.nfe_item_id, nome: i.nome, codigo_ean: i.codigo_ean, ncm: i.ncm,
      unidade: i.unidade, cfop: i.cfop, quantidade: Number(i.quantidade), valor_unitario: Number(i.valor_unitario),
      valor_total: Number(i.valor_total), icms_origem: String(i.icms_origem ?? "0"), icms_csosn: i.icms_csosn ?? "102",
      icms_base: Number(i.icms_base ?? 0), icms_aliquota: Number(i.icms_aliquota ?? 0), icms_valor: Number(i.icms_valor ?? 0),
      ipi_valor: Number(i.ipi_valor ?? 0), pis_valor: Number(i.pis_valor ?? 0), cofins_valor: Number(i.cofins_valor ?? 0),
      item_nota_origem: i.item_nota_origem ?? null,
    })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const salvar = async (): Promise<string | null> => {
    if (!lojaId) { toast.error("Escolha a loja."); return null; }
    if (!fornecedorId) { toast.error("Escolha o fornecedor."); return null; }
    if (!motivo.trim()) { toast.error("Informe o motivo da devolução — ele vai na nota."); return null; }
    const validos = itens.filter((i) => i.quantidade > 0);
    if (!validos.length) { toast.error("Nenhum item com quantidade a devolver."); return null; }
    const devolucao = {
      loja_id: lojaId, fornecedor_id: fornecedorId,
      nfe_entrada_id: notaId || null,
      numero_nota_origem: numeroOrigem.trim() || null,
      chave_nota_origem: soDigitos(chaveOrigem) || null,
      motivo: motivo.trim(), observacoes: observacoes.trim() || null,
      modalidade_frete: Number(modalidade),
      transportadora_id: transportadora || null,
      placa_veiculo: placa.trim() || null,
      volumes_qtd: volumes ? Number(volumes) : null,
      volumes_especie: especie.trim() || null,
      peso_bruto: pesoBruto ? Number(pesoBruto.replace(",", ".")) : null,
      peso_liquido: pesoLiquido ? Number(pesoLiquido.replace(",", ".")) : null,
      valor_frete: Number(frete || 0), valor_seguro: Number(seguro || 0),
      outras_despesas: Number(outras || 0),
      valor_produtos: totalProdutos, valor_total: totalGeral,
    };
    const linhas = validos.map(({ maximo: _m, ...i }) => i);
    try {
      if (editId) {
        await atualizar.mutateAsync({ id: editId, devolucao, itens: linhas });
        toast.success("Rascunho salvo.");
        return editId;
      }
      const d = await criar.mutateAsync({ devolucao: { ...devolucao, status: "rascunho" }, itens: linhas });
      setEditId(d.id);
      toast.success("Devolução salva como rascunho. Veja o espelho e confirme para a mercadoria sair do estoque.");
      return d.id;
    } catch (e: any) {
      toast.error(`Não foi possível salvar: ${e.message ?? e}`);
      return null;
    }
  };

  const espelho = async (id: string) => {
    if (!lojaId) return;
    setOcupado(`espelho-${id}`);
    try {
      const r = await notaDev.mutateAsync({ devolucaoId: id, lojaId, espelho: true });
      if (r?.erro) throw new Error([r.erro, ...(r.faltas ?? [])].join(" — "));
      if (r?.danfe_pdf_base64) abrirPdf(r.danfe_pdf_base64);
      toast.success(`Espelho OK: a nota passou na validação (nº previsto ${r?.numero_previsto}, total ${brl(Number(r?.total ?? 0))}${r?.ambiente !== "producao" ? ", homologação" : ""}). Nada foi enviado.`, { duration: 10000 });
    } catch (e: any) {
      toast.error(`Espelho: ${e.message ?? e}`, { duration: 12000 });
    } finally { setOcupado(null); }
  };

  const emitir = async (d: any) => {
    if (!lojaId) return;
    setOcupado(`emitir-${d.id}`);
    try {
      const r = await notaDev.mutateAsync({ devolucaoId: d.id, lojaId, espelho: false });
      if (r?.autorizada) toast.success(`NF-e de devolução nº ${r.numero} autorizada${r.ambiente !== "producao" ? " (homologação — sem valor fiscal)" : ""}.`, { duration: 10000 });
      else toast.error(`SEFAZ recusou: ${r?.motivo ?? r?.erro ?? "sem motivo"} (cStat ${r?.cstat ?? "?"})`, { duration: 15000 });
    } catch (e: any) {
      toast.error(`Não foi possível emitir: ${e.message ?? e}`, { duration: 12000 });
    } finally { setOcupado(null); }
  };

  const abrirTributacao = (idx: number) => {
    const i = itens[idx];
    setTrib({ cfop: i.cfop, icms_origem: i.icms_origem, icms_csosn: i.icms_csosn, icms_base: i.icms_base || i.valor_total, icms_aliquota: i.icms_aliquota });
    setTributando(idx);
  };
  const itemTrib = tributando != null ? itens[tributando] : null;
  const previaTrib = itemTrib ? aplicarTributacao(itemTrib, trib) : null;

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Notas de Devolução a Fornecedor" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Undo2 className="h-6 w-6" /> Notas de Devolução a Fornecedor
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Mercadoria que volta ao fornecedor, com a NF-e de devolução. Quando a compra entrou por XML, os itens vêm
            da nota com os impostos e o número de cada item — é o que a nota precisa para referenciar a compra.
          </p>
        </div>
        {!montando && (
          <Button onClick={() => setMontando(true)}><Plus className="mr-1 h-4 w-4" /> Nova devolução</Button>
        )}
      </div>

      {montando && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">{editId ? "Editar devolução (rascunho)" : "Nova devolução"}</CardTitle>
            <Button variant="ghost" size="sm" onClick={limpar}><ArrowLeft className="mr-1 h-4 w-4" /> Fechar</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Fornecedor *</Label>
                <ComboboxBusca
                  className="mt-1"
                  itens={(fornecedores as any[]).map((f) => ({
                    id: f.id, rotulo: f.nome_razao,
                    detalhe: [f.cpf_cnpj, f.endereco?.uf ?? f.uf].filter(Boolean).join(" · "),
                  }))}
                  value={fornecedorId}
                  onChange={(id) => { setFornecedorId(id); setNotaId(""); if (!editId) setItens([]); }}
                  vazio="Escolha o fornecedor"
                />
                {fornecedor && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {ufFornecedor ? `UF ${ufFornecedor} → CFOP sugerido ${cfopPadrao}` : "Fornecedor sem UF no cadastro — confira o CFOP"}
                  </p>
                )}
              </div>
              <div>
                <Label>Nota de compra (entrada) importada</Label>
                <Select value={notaId} onValueChange={setNotaId} disabled={!fornecedorId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={notas.length ? "Escolha a nota" : "Nenhuma nota importada deste fornecedor"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(notas as any[]).map((n) => (
                      <SelectItem key={n.id} value={n.id}>NF {n.numero} · {date(n.data_emissao)} · {brl(Number(n.valor_total ?? 0))}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {notaId && (
                  <Button variant="outline" size="sm" className="mt-2" onClick={puxarDaNota}>Trazer itens da nota</Button>
                )}
              </div>
            </div>

            {/* A chave do DANFE de compra: vem da nota importada ou é digitada */}
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label className="text-xs">Nº da nota de compra</Label>
                <Input className="mt-1" value={numeroOrigem} onChange={(e) => setNumeroOrigem(e.target.value)} />
              </div>
              <div className="md:col-span-3">
                <Label className="text-xs">Chave de acesso do DANFE de compra (44 dígitos) *</Label>
                <Input className="mt-1 font-mono" value={chaveOrigem} onChange={(e) => setChaveOrigem(soDigitos(e.target.value).slice(0, 44))}
                  placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000" />
                <p className={`mt-1 text-[11px] ${soDigitos(chaveOrigem).length === 44 ? "text-green-600" : "text-muted-foreground"}`}>
                  {soDigitos(chaveOrigem).length}/44 dígitos
                </p>
              </div>
            </div>

            <div>
              <Label>Motivo da devolução *</Label>
              <Input className="mt-1" value={motivo} onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: produto com defeito, quantidade a maior, item trocado" />
              <p className="mt-1 text-[11px] text-muted-foreground">Vai nas informações complementares da nota.</p>
            </div>

            {/* itens */}
            <div className="rounded-md border">
              <div className="flex flex-wrap items-end gap-2 border-b p-3">
                <div className="min-w-[16rem] flex-1">
                  <Label className="text-xs">Buscar produto no estoque</Label>
                  <ComboboxBusca
                    className="mt-1"
                    itens={(produtos as any[]).map((p) => ({
                      id: p.id, rotulo: p.nome,
                      detalhe: [p.sku, p.estoque_atual != null ? `estoque ${p.estoque_atual}` : null].filter(Boolean).join(" · ") || undefined,
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
                  Nenhum item. Traga os da nota de compra ou acrescente do estoque.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="p-2 text-left">Produto</th>
                        <th className="p-2 text-left">CFOP</th>
                        <th className="p-2 text-right">Qtd</th>
                        <th className="p-2 text-right">Vlr. unit.</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-right">ICMS</th>
                        <th className="p-2 text-center" title="Número do item na nota de compra">Item NF</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((i, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="p-2">
                            {i.nome}
                            <span className="block text-[11px] text-muted-foreground">
                              CSOSN {i.icms_csosn} · origem {i.icms_origem}{i.maximo != null ? ` · veio ${num(i.maximo)} na nota` : ""}
                            </span>
                          </td>
                          <td className="p-2">
                            <select className="h-8 rounded-md border border-input bg-background px-1 font-mono text-xs"
                              value={i.cfop} onChange={(e) => mudarItem(idx, (x) => ({ ...x, cfop: e.target.value }))}>
                              {CFOPS_DEVOLUCAO.map((c) => <option key={c.valor} value={c.valor} title={c.rotulo}>{c.valor}</option>)}
                            </select>
                          </td>
                          <td className="p-2 text-right">
                            <Input type="number" min="0" step="any" className="h-8 w-20 text-right" value={i.quantidade}
                              onChange={(e) => mudarItem(idx, (x) => mudarQuantidadeOuValor(x, Number(e.target.value)))} />
                          </td>
                          <td className="p-2 text-right">
                            <InputMoeda className="h-8 w-28 text-right" value={i.valor_unitario}
                              onChange={(v) => mudarItem(idx, (x) => mudarQuantidadeOuValor(x, x.quantidade, v === "" ? 0 : v))} />
                          </td>
                          <td className="p-2 text-right font-medium tabular-nums">{brl(i.valor_total)}</td>
                          <td className="p-2 text-right tabular-nums text-muted-foreground">{brl(i.icms_valor)}</td>
                          <td className="p-2 text-center">
                            <Input type="number" min="1" className={`h-8 w-16 text-center ${i.item_nota_origem ? "" : "border-red-500"}`}
                              value={i.item_nota_origem ?? ""} title="Número do item na nota de compra"
                              onChange={(e) => mudarItem(idx, (x) => ({ ...x, item_nota_origem: e.target.value ? Number(e.target.value) : null }))} />
                          </td>
                          <td className="p-2 text-right whitespace-nowrap">
                            <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => abrirTributacao(idx)} title="Editar tributação">
                              <Settings2 className="mr-1 h-3.5 w-3.5" /> Tributação
                            </Button>
                            <Button variant="ghost" size="icon" className="ml-1 h-7 w-7 text-destructive"
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

            {/* transporte, volumes e valores */}
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label className="text-xs">Modalidade de frete</Label>
                <Select value={modalidade} onValueChange={setModalidade}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{MODALIDADES.map((m) => <SelectItem key={m.v} value={String(m.v)}>{m.t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Transportadora</Label>
                <Select value={transportadora} onValueChange={setTransportadora}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{(transportadoras as any[]).map((t) => <SelectItem key={t.id} value={t.id}>{t.nome_razao ?? t.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Placa</Label><Input className="mt-1" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Volumes</Label><Input type="number" className="mt-1" value={volumes} onChange={(e) => setVolumes(e.target.value)} /></div>
                <div><Label className="text-xs">Espécie</Label><Input className="mt-1" value={especie} onChange={(e) => setEspecie(e.target.value)} placeholder="Caixa" /></div>
              </div>
              <div><Label className="text-xs">Peso bruto (kg)</Label><Input inputMode="decimal" className="mt-1" value={pesoBruto} onChange={(e) => setPesoBruto(e.target.value)} /></div>
              <div><Label className="text-xs">Peso líquido (kg)</Label><Input inputMode="decimal" className="mt-1" value={pesoLiquido} onChange={(e) => setPesoLiquido(e.target.value)} /></div>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              <div><Label className="text-xs">Frete</Label><InputMoeda value={frete} onChange={(v) => setFrete(String(v))} /></div>
              <div><Label className="text-xs">Seguro</Label><InputMoeda value={seguro} onChange={(v) => setSeguro(String(v))} /></div>
              <div><Label className="text-xs">Outras despesas</Label><InputMoeda value={outras} onChange={(v) => setOutras(String(v))} /></div>
              <div className="flex flex-col justify-end"><p className="text-xs text-muted-foreground">ICMS destacado</p><p className="text-lg font-semibold tabular-nums">{brl(totalIcms)}</p></div>
              <div className="flex flex-col justify-end"><p className="text-xs text-muted-foreground">Total da devolução</p><p className="text-xl font-semibold tabular-nums">{brl(totalGeral)}</p></div>
            </div>

            <div>
              <Label className="text-xs">Informações adicionais</Label>
              <Input className="mt-1" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>

            {faltas.length > 0 && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs dark:bg-amber-950/20">
                Para emitir a NF-e ainda falta: {faltas.join("; ")}. Dá para salvar o rascunho assim mesmo.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={limpar}>Fechar</Button>
              <Button variant="outline" disabled={criar.isPending || atualizar.isPending || !!ocupado}
                onClick={async () => { const id = await salvar(); if (id) await espelho(id); }}>
                {ocupado?.startsWith("espelho") ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Eye className="mr-1 h-4 w-4" />}
                Salvar e ver espelho
              </Button>
              <Button onClick={() => void salvar()} disabled={criar.isPending || atualizar.isPending}>
                {criar.isPending || atualizar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                Salvar rascunho
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tributação do item — como a tela "Cadastro de tributos" do sistema anterior */}
      <Dialog open={tributando != null} onOpenChange={(o) => { if (!o) setTributando(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Tributação — {itemTrib?.nome}</DialogTitle></DialogHeader>
          {itemTrib && previaTrib && (
            <div className="space-y-3 text-sm">
              <div>
                <Label className="text-xs">CFOP da operação</Label>
                <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={trib.cfop} onChange={(e) => setTrib({ ...trib, cfop: e.target.value })}>
                  {CFOPS_DEVOLUCAO.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Regime fiscal</Label>
                  <Input className="mt-1" value="Simples Nacional (CRT 1)" disabled />
                </div>
                <div>
                  <Label className="text-xs">Origem do produto</Label>
                  <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={trib.icms_origem} onChange={(e) => setTrib({ ...trib, icms_origem: e.target.value })}>
                    {ORIGENS_MERCADORIA.map((o) => <option key={o.valor} value={String(o.valor)}>{o.rotulo}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Situação tributária (CSOSN)</Label>
                <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={trib.icms_csosn} onChange={(e) => setTrib({ ...trib, icms_csosn: e.target.value })}>
                  {CSOSNS.filter((c) => c.valor !== "101").map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Base de cálculo ICMS</Label>
                  <InputMoeda className="mt-1" value={trib.icms_base ?? 0} disabled={trib.icms_csosn !== "900"}
                    onChange={(v) => setTrib({ ...trib, icms_base: v === "" ? 0 : v })} />
                </div>
                <div>
                  <Label className="text-xs">Alíquota do ICMS (%)</Label>
                  <Input className="mt-1" inputMode="decimal" value={String(trib.icms_aliquota ?? 0)} disabled={trib.icms_csosn !== "900"}
                    onChange={(e) => setTrib({ ...trib, icms_aliquota: Number(e.target.value.replace(",", ".")) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">ICMS da operação</Label>
                  <Input className="mt-1 font-semibold" value={brl(previaTrib.icms_valor)} disabled />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Na devolução, o ICMS segue o que veio destacado na compra (CSOSN 900 com base e alíquota). Sem destaque, use 102.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTributando(null)}>Cancelar</Button>
            <Button onClick={() => {
              if (tributando == null || !previaTrib) return;
              mudarItem(tributando, () => previaTrib);
              setTributando(null);
              toast.success("Tributação salva no item.");
            }}>Gravar alteração</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Devoluções</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
          ) : devolucoes.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <PackageX className="mx-auto mb-2 h-8 w-8 opacity-50" /> Nenhuma devolução registrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left">Data</th>
                    <th className="p-2 text-left">Fornecedor</th>
                    <th className="p-2 text-left">Nota de compra</th>
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
                      <td className="max-w-[16rem] truncate p-2">{d.motivo}</td>
                      <td className="p-2 text-center tabular-nums">{(d.itens ?? []).length}</td>
                      <td className="p-2 text-right tabular-nums">{brl(Number(d.valor_total ?? 0))}</td>
                      <td className="p-2 text-center">
                        <Badge className={SITUACAO[d.status]?.cor} variant={d.status === "rascunho" ? "outline" : "default"}>
                          {SITUACAO[d.status]?.texto ?? d.status}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap p-2 text-right">
                        <div className="flex justify-end gap-1">
                          {d.status === "rascunho" && (
                            <>
                              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => editar(d)} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-destructive" title="Excluir rascunho" disabled={excluir.isPending}
                                onClick={async () => {
                                  if (!confirm("Excluir este rascunho de devolução?")) return;
                                  try { await excluir.mutateAsync(d.id); toast.success("Rascunho excluído."); } catch (e: any) { toast.error(e.message ?? String(e)); }
                                }}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </>
                          )}
                          {(d.status === "rascunho" || d.status === "confirmada") && (
                            <Button size="sm" variant="outline" className="h-7 px-2" disabled={!!ocupado} onClick={() => void espelho(d.id)} title="Espelho da nota">
                              {ocupado === `espelho-${d.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1 h-3.5 w-3.5" />} Espelho
                            </Button>
                          )}
                          {d.status === "rascunho" && (
                            <Button size="sm" className="h-7 px-2" disabled={confirmar.isPending}
                              onClick={async () => {
                                if (!confirm(`Confirmar a devolução?\n\nAs ${(d.itens ?? []).length} linha(s) saem do estoque agora. Isso não se desfaz sozinho.`)) return;
                                try { await confirmar.mutateAsync(d.id); toast.success("Devolução confirmada — a mercadoria saiu do estoque. Agora emita a NF-e."); }
                                catch (e: any) { toast.error(`Não foi possível confirmar: ${e.message ?? e}`); }
                              }}>Confirmar</Button>
                          )}
                          {d.status === "confirmada" && (
                            <Button size="sm" className="h-7 bg-green-600 px-2 hover:bg-green-700" disabled={!!ocupado} onClick={() => void emitir(d)}>
                              {ocupado === `emitir-${d.id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Receipt className="mr-1 h-3.5 w-3.5" />} Emitir NF-e
                            </Button>
                          )}
                          {d.status === "faturada" && (
                            <Button size="sm" variant="outline" className="h-7 px-2" asChild>
                              <Link to="/notas-fiscais"><FileText className="mr-1 h-3.5 w-3.5" /> Ver nota</Link>
                            </Button>
                          )}
                        </div>
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

// ============================================================
// Página: Notas de Devolução a Fornecedor — no MESMO desenho da tela do
// Excellent (sistema anterior da loja), conferida lá em 11/10/2026:
//
//   lista: período, busca, "Gerar Nota de Devolução p/ Fornecedor",
//   "Histórico de Notas Em Andamento", "Imprimir Relatório"; colunas Nota,
//   Data, Hora, Fornecedor, Valor, Status, Ambiente, Ver Nota, Enviar E-mail.
//
//   gerar: escolher o fornecedor (mostra se o cadastro está completo) →
//   Dados da Nota (nº da nota de entrada, natureza, finalidade, volumes,
//   frete, transportadora, placa, RNTC, pesos, rateio do frete, seguro,
//   endereço de entrega, informações adicionais) → nº do DANFE de entrada
//   (vários) → produtos (busca no estoque, Buscar NF Entrada, Importar XML),
//   cada um com quantidade, valor, desconto em % ou R$ e CFOP → Editar
//   (tributação) → Espelho de Nota (Prévia) → Gerar Nota de Devolução.
//
// "Gerar" faz tudo de uma vez: grava, valida no espelho, baixa o estoque
// (Kardex) e emite a NF-e. Se a SEFAZ recusar, a devolução fica em
// "andamento" e a emissão pode ser refeita pelo histórico.
//
// Fora do Excellent de propósito: "Aplicar alíquota IBPT" (o sistema não
// tem a tabela do IBPT, e a lei de transparência vale para venda ao
// consumidor final, não para nota ao fornecedor).
// ============================================================

import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Eye, FileText, History, Loader2, Mail, Pencil, Plus, Printer, Receipt, Search, Trash2, Undo2, Upload, X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { supabase } from "@/lib/supabase";
import {
  useDevolucoesFornecedor, useNotasEntradaFornecedor, useCriarDevolucaoFornecedor,
  useConfirmarDevolucaoFornecedor, useFornecedores, useProdutos, useTransportadoras,
  useAtualizarDevolucaoFornecedor, useExcluirDevolucaoFornecedor, useNotaDevolucaoFornecedor,
  useAmbienteSefaz, isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { brl, num } from "@/lib/format";
import { CSOSNS, ORIGENS_MERCADORIA } from "@/lib/tabelas-fiscais";
import { CFOPS_MAIS_USADOS_COMERCIO, CFOPS_SAIDA, rotuloCfop } from "@/lib/cfops-saida";
import { aplicarViaCep } from "@/lib/entrega-venda";
import {
  aplicarDesconto, aplicarTributacao, arredondarUnit, casarProduto, cfopDevolucao, faltaParaEmitir,
  faltasDoFornecedor, itemDaNotaEntrada, itemDoProduto, itemDoXml, lerXmlNfe, mudarQuantidadeOuValor,
  soDigitos, totais, type ItemDevolucao,
} from "@/lib/devolucao-fornecedor";

const MODALIDADES = [
  { v: "0", t: "0 - Por conta do Emitente" },
  { v: "1", t: "1 - Por conta do Destinatário" },
  { v: "2", t: "2 - Por conta de Terceiro" },
  { v: "9", t: "9 - Sem Frete" },
];
const NATUREZA_PADRAO = "DEVOLUCAO DE COMPRA PARA COMERCIALIZACAO";
const sel = "flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60";

/** Lista de CFOPs de saída: os mais usados no comércio no topo, como no Excellent. */
function OpcoesCfop({ extra }: { extra?: string[] }) {
  const topo = [...new Set([...(extra ?? []), ...CFOPS_MAIS_USADOS_COMERCIO])];
  return (
    <>
      <optgroup label="Mais utilizados no comércio">
        {topo.map((c) => <option key={`t${c}`} value={c}>{rotuloCfop(c)}</option>)}
      </optgroup>
      <optgroup label="Todos">
        {CFOPS_SAIDA.map(([c, d]) => <option key={c} value={c}>{c} - {d}</option>)}
      </optgroup>
    </>
  );
}

type Entrega = { cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string; codigo_municipio: string };
const ENTREGA_VAZIA: Entrega = { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", codigo_municipio: "" };

const formatarChave = (c: string) => soDigitos(c).replace(/(\d{4})(?=\d)/g, "$1 ");
const hojeMenos = (dias: number) => { const d = new Date(); d.setDate(d.getDate() - dias); return d.toLocaleDateString("sv-SE"); };

async function erroDaFuncao(error: any, padrao: string) {
  try { const ctx = await error?.context?.json?.(); if (ctx?.erro) return ctx.erro; } catch { /* corpo não-JSON */ }
  return error?.message ?? padrao;
}

/** Abre o DANFE da nota (arquivado, link ou gerado agora a partir do XML). */
async function abrirDanfe(nota: any) {
  if (nota?.danfe_path) {
    const { data, error } = await supabase.storage.from("fiscal").download(nota.danfe_path);
    if (error || !data) { toast.error("Falha ao baixar o DANFE"); return; }
    window.open(URL.createObjectURL(data), "_blank");
    return;
  }
  if (nota?.pdf_url?.startsWith("http")) { window.open(nota.pdf_url, "_blank"); return; }
  const { data, error } = await supabase.functions.invoke("erp-danfe", { body: { nota_id: nota.id } });
  if (error || !data?.ok) { toast.error(`DANFE indisponível: ${await erroDaFuncao(error, data?.erro ?? "falha ao gerar")}`); return; }
  if (data.pdf_base64) abrirPdf(data.pdf_base64);
  else if (data.danfe_path) {
    const { data: arq } = await supabase.storage.from("fiscal").download(data.danfe_path);
    if (arq) window.open(URL.createObjectURL(arq), "_blank");
  }
}

function abrirPdf(b64: string) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Situação para a coluna Status: junta a devolução e a nota. */
function situacao(d: any): { texto: string; cor: string } {
  if (d.status === "faturada" && d.nota?.status === "autorizada") return { texto: "Autorizada", cor: "bg-green-600 text-white" };
  if (d.status === "faturada") return { texto: d.nota?.status === "cancelada" ? "Cancelada" : "Emitida", cor: "bg-green-600 text-white" };
  if (d.status === "confirmada") return { texto: d.nota?.status === "rejeitada" ? "Recusada pela SEFAZ" : "Estoque baixado · falta a nota", cor: "bg-amber-500 text-white" };
  if (d.status === "cancelada") return { texto: "Cancelada", cor: "bg-muted text-muted-foreground" };
  return { texto: "Em andamento (rascunho)", cor: "border" };
}

export function DevolucaoFornecedorPage() {
  const { lojaId, lojas } = useAutoSelectLoja();
  const loja = (lojas as any[]).find((l) => l.id === lojaId) ?? null;
  const { data: devolucoes = [], isLoading } = useDevolucoesFornecedor(lojaId ?? undefined);
  const { data: fornecedores = [] } = useFornecedores();
  const { data: produtos = [] } = useProdutos({ lojaId: lojaId ?? undefined });
  const { data: transportadoras = [] } = useTransportadoras();
  const { data: ambiente } = useAmbienteSefaz(lojaId ?? undefined);
  const criar = useCriarDevolucaoFornecedor();
  const atualizar = useAtualizarDevolucaoFornecedor();
  const excluir = useExcluirDevolucaoFornecedor();
  const confirmar = useConfirmarDevolucaoFornecedor();
  const notaDev = useNotaDevolucaoFornecedor();

  // ---------- lista ----------
  const [de, setDe] = useState(hojeMenos(30));
  const [ate, setAte] = useState(new Date().toLocaleDateString("sv-SE"));
  const [periodo, setPeriodo] = useState({ de: hojeMenos(30), ate: new Date().toLocaleDateString("sv-SE") });
  const [busca, setBusca] = useState("");
  const [soAndamento, setSoAndamento] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<any | null>(null);
  const [emailDe, setEmailDe] = useState<any | null>(null);
  const [emailDestino, setEmailDestino] = useState("");

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (devolucoes as any[]).filter((d) => {
      const dia = String(d.created_at).slice(0, 10);
      if (soAndamento) { if (!(d.status === "rascunho" || d.status === "confirmada")) return false; }
      else if (dia < periodo.de || dia > periodo.ate) return false;
      if (!t) return true;
      return [d.fornecedor?.nome_razao, d.fornecedor?.cpf_cnpj, d.nota?.numero, d.numero_nota_origem]
        .some((x) => String(x ?? "").toLowerCase().includes(t));
    });
  }, [devolucoes, busca, soAndamento, periodo]);
  const emAndamento = (devolucoes as any[]).filter((d) => d.status === "rascunho" || d.status === "confirmada").length;

  // ---------- escolher o fornecedor ----------
  const [escolhendo, setEscolhendo] = useState(false);
  const [buscaForn, setBuscaForn] = useState("");
  const fornecedoresAchados = useMemo(() => {
    const t = buscaForn.trim().toLowerCase();
    const dig = soDigitos(buscaForn);
    return (fornecedores as any[]).filter((f) => !t
      || String(f.nome_razao ?? "").toLowerCase().includes(t)
      || (dig && soDigitos(f.cpf_cnpj).includes(dig))).slice(0, 50);
  }, [fornecedores, buscaForn]);

  // ---------- formulário ----------
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fornecedorId, setFornecedorId] = useState("");
  const [numeroEntrada, setNumeroEntrada] = useState("");
  const [natureza, setNatureza] = useState(NATUREZA_PADRAO);
  const [finalidade, setFinalidade] = useState("4");
  const [especie, setEspecie] = useState("");
  const [volumes, setVolumes] = useState("");
  const [modalidade, setModalidade] = useState("9");
  const [transportadora, setTransportadora] = useState("");
  const [placa, setPlaca] = useState("");
  const [rntc, setRntc] = useState("");
  const [pesoBruto, setPesoBruto] = useState("");
  const [pesoLiquido, setPesoLiquido] = useState("");
  const [rateio, setRateio] = useState<"igual" | "por_produto">("igual");
  const [frete, setFrete] = useState("");
  const [outras, setOutras] = useState("");
  const [seguro, setSeguro] = useState("");
  const [alterarEntrega, setAlterarEntrega] = useState(false);
  const [entrega, setEntrega] = useState<Entrega>(ENTREGA_VAZIA);
  const [info, setInfo] = useState("");
  const [chaves, setChaves] = useState<string[]>([""]);
  const [casas, setCasas] = useState(2);
  const [itens, setItens] = useState<ItemDevolucao[]>([]);
  const [linha, setLinha] = useState<ItemDevolucao | null>(null);
  const [termoProduto, setTermoProduto] = useState("");
  const [buscandoProduto, setBuscandoProduto] = useState(false);
  const [buscandoNota, setBuscandoNota] = useState(false);
  const [numeroNotaBusca, setNumeroNotaBusca] = useState("");
  const [editando, setEditando] = useState<number | null>(null);
  const [rascunhoItem, setRascunhoItem] = useState<ItemDevolucao | null>(null);
  const [abaTrib, setAbaTrib] = useState<"icms" | "ipi">("icms");
  const [confirmandoGerar, setConfirmandoGerar] = useState(false);
  const arquivoXml = useRef<HTMLInputElement>(null);

  const fornecedor = useMemo(() => (fornecedores as any[]).find((f) => f.id === fornecedorId), [fornecedores, fornecedorId]);
  const ufFornecedor = fornecedor?.endereco?.uf ?? fornecedor?.uf ?? null;
  const cfopPadrao = cfopDevolucao(loja?.uf, ufFornecedor);
  const { data: notasEntrada = [] } = useNotasEntradaFornecedor(fornecedorId || undefined, lojaId ?? undefined);
  const chavesValidas = chaves.map(soDigitos).filter((c) => c.length === 44);
  const cab = { valor_frete: Number(frete.replace(",", ".")) || 0, valor_seguro: Number(seguro.replace(",", ".")) || 0, outras_despesas: Number(outras.replace(",", ".")) || 0, rateio_frete: rateio };
  const soma = totais(itens, cab);
  const faltas = faltaParaEmitir({ finalidade: Number(finalidade), chaves: chavesValidas, fornecedor, itens });
  const faltasForn = faltasDoFornecedor(fornecedor);

  const produtosAchados = useMemo(() => {
    const t = termoProduto.trim().toLowerCase();
    if (!t) return (produtos as any[]).slice(0, 60);
    return (produtos as any[]).filter((p) => String(p.nome ?? "").toLowerCase().includes(t)
      || String(p.codigo_barras ?? "").includes(t) || String(p.sku ?? "").toLowerCase().includes(t)).slice(0, 60);
  }, [produtos, termoProduto]);

  const limparFormulario = () => {
    setEditId(null); setNumeroEntrada(""); setNatureza(NATUREZA_PADRAO); setFinalidade("4"); setEspecie(""); setVolumes("");
    setModalidade("9"); setTransportadora(""); setPlaca(""); setRntc(""); setPesoBruto(""); setPesoLiquido("");
    setRateio("igual"); setFrete(""); setOutras(""); setSeguro(""); setAlterarEntrega(false); setEntrega(ENTREGA_VAZIA);
    setInfo(""); setChaves([""]); setCasas(2); setItens([]); setLinha(null); setTermoProduto("");
  };

  const escolherFornecedor = (f: any) => {
    limparFormulario();
    setFornecedorId(f.id);
    setEscolhendo(false);
    setAberto(true);
  };

  const editar = (d: any) => {
    limparFormulario();
    setEditId(d.id); setFornecedorId(d.fornecedor_id);
    setNumeroEntrada(d.numero_nota_origem ?? ""); setNatureza(d.natureza_operacao ?? NATUREZA_PADRAO);
    setFinalidade(String(d.finalidade ?? 4)); setEspecie(d.volumes_especie ?? "");
    setVolumes(d.volumes_qtd != null ? String(d.volumes_qtd) : ""); setModalidade(String(d.modalidade_frete ?? 9));
    setTransportadora(d.transportadora_id ?? ""); setPlaca(d.placa_veiculo ?? ""); setRntc(d.rntc ?? "");
    setPesoBruto(d.peso_bruto != null ? String(d.peso_bruto) : ""); setPesoLiquido(d.peso_liquido != null ? String(d.peso_liquido) : "");
    setRateio(d.rateio_frete === "por_produto" ? "por_produto" : "igual");
    setFrete(Number(d.valor_frete) ? String(d.valor_frete) : ""); setOutras(Number(d.outras_despesas) ? String(d.outras_despesas) : "");
    setSeguro(Number(d.valor_seguro) ? String(d.valor_seguro) : "");
    setAlterarEntrega(!!d.entrega?.logradouro); setEntrega({ ...ENTREGA_VAZIA, ...(d.entrega ?? {}) });
    setInfo(d.observacoes ?? "");
    const cs: string[] = (d.chaves_origem?.length ? d.chaves_origem : [d.chave_nota_origem]).filter(Boolean);
    setChaves(cs.length ? cs : [""]); setCasas(Number(d.casas_decimais ?? 2));
    setItens((d.itens ?? []).map((i: any) => ({
      produto_id: i.produto_id, nfe_item_id: i.nfe_item_id, nome: i.nome, codigo_ean: i.codigo_ean, ncm: i.ncm,
      unidade: i.unidade, cfop: i.cfop, quantidade: Number(i.quantidade), valor_unitario: Number(i.valor_unitario),
      valor_total: Number(i.valor_total), desconto_percentual: Number(i.desconto_percentual ?? 0), valor_desconto: Number(i.valor_desconto ?? 0),
      valor_frete: Number(i.valor_frete ?? 0), outras_despesas: Number(i.outras_despesas ?? 0),
      icms_origem: String(i.icms_origem ?? "0"), icms_csosn: i.icms_csosn ?? "102",
      icms_base: Number(i.icms_base ?? 0), icms_aliquota: Number(i.icms_aliquota ?? 0), icms_valor: Number(i.icms_valor ?? 0),
      ipi_valor: Number(i.ipi_valor ?? 0), pis_valor: Number(i.pis_valor ?? 0), cofins_valor: Number(i.cofins_valor ?? 0),
      ipi_devolvido_percentual: Number(i.ipi_devolvido_percentual ?? 0), ipi_devolvido_valor: Number(i.ipi_devolvido_valor ?? 0),
      chave_nota_origem: i.chave_nota_origem ?? d.chave_nota_origem ?? null, item_nota_origem: i.item_nota_origem ?? null,
    })));
    setAberto(true);
  };

  // ---------- produtos ----------
  const escolherProduto = (p: any) => {
    setLinha(itemDoProduto(p, cfopPadrao, chavesValidas[0] ?? null));
    setBuscandoProduto(false);
  };
  const adicionarLinha = () => {
    if (!linha) return;
    if (!(linha.quantidade > 0)) { toast.error("Informe a quantidade."); return; }
    setItens((c) => [...c, linha]);
    setLinha(null); setTermoProduto("");
  };

  const acrescentarChave = (chave: string, numero?: string) => {
    setChaves((cs) => {
      const lista = cs.map(soDigitos);
      if (lista.includes(chave)) return cs;
      const vazio = lista.findIndex((c) => !c);
      if (vazio >= 0) { const n = [...cs]; n[vazio] = chave; return n; }
      return [...cs, chave];
    });
    if (numero && !numeroEntrada) setNumeroEntrada(numero);
  };

  const escolherNotaEntrada = (n: any) => {
    const chave = soDigitos(n.chave_acesso);
    const novos = (n.itens ?? []).map((i: any) => itemDaNotaEntrada(i, cfopPadrao, chave || null));
    setItens((c) => [...c, ...novos]);
    if (chave) acrescentarChave(chave, String(n.numero ?? ""));
    setBuscandoNota(false);
    toast.success(`${novos.length} produto(s) da nota ${n.numero}. Ajuste a quantidade do que volta em "Editar".`);
  };

  const importarXml = async (arquivo: File) => {
    try {
      const nota = lerXmlNfe(await arquivo.text());
      const doc = soDigitos(fornecedor?.cpf_cnpj);
      // mesma empresa (raiz do CNPJ): a compra pode ter saído de outra filial do fornecedor
      if (doc && soDigitos(nota.emitente_cnpj).padStart(14, "0").slice(0, 8) !== doc.padStart(14, "0").slice(0, 8)) {
        toast.error(`Este XML é de ${nota.emitente_nome || nota.emitente_cnpj}, não do fornecedor escolhido.`);
        return;
      }
      const novos = nota.itens.map((x) => itemDoXml(x, nota.chave, cfopPadrao, casarProduto(x, produtos as any[])));
      setItens((c) => [...c, ...novos]);
      acrescentarChave(nota.chave, nota.numero);
      const semCadastro = novos.filter((i) => !i.produto_id).map((i) => i.nome);
      toast.success(`XML da nota ${nota.numero}: ${novos.length} produto(s). Ajuste a quantidade do que volta em "Editar".`, {
        description: semCadastro.length ? `Sem cadastro no estoque (a nota sai, o estoque não baixa): ${semCadastro.join(", ")}` : undefined,
        duration: 10000,
      });
    } catch (e: any) {
      toast.error(`Não foi possível ler o XML: ${e.message ?? e}`);
    }
  };

  const mudarItem = (idx: number, f: (i: ItemDevolucao) => ItemDevolucao) => setItens((c) => c.map((i, k) => (k === idx ? f(i) : i)));

  const buscarCepEntrega = async () => {
    const d = soDigitos(entrega.cep);
    if (d.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`).then((x) => x.json());
      const n = aplicarViaCep({ ...entrega, referencia: "" }, r);
      setEntrega({ cep: n.cep, logradouro: n.logradouro, numero: n.numero, complemento: n.complemento, bairro: n.bairro, cidade: n.cidade, uf: n.uf, codigo_municipio: n.codigo_municipio });
    } catch { /* sem a busca, o endereço é digitado à mão */ }
  };

  // ---------- gravar / espelho / gerar ----------
  const salvar = async (): Promise<string | null> => {
    if (!lojaId) { toast.error("Escolha a loja no topo."); return null; }
    if (!fornecedorId) { toast.error("Escolha o fornecedor."); return null; }
    const validos = itens.filter((i) => i.quantidade > 0);
    if (!validos.length) { toast.error("Acrescente ao menos um produto."); return null; }
    const devolucao = {
      loja_id: lojaId, fornecedor_id: fornecedorId,
      numero_nota_origem: numeroEntrada.trim() || null,
      chave_nota_origem: chavesValidas[0] ?? null,
      chaves_origem: chavesValidas,
      natureza_operacao: natureza.trim() || NATUREZA_PADRAO,
      finalidade: Number(finalidade),
      motivo: info.trim().slice(0, 200) || "Devolução de mercadoria",
      observacoes: info.trim() || null,
      modalidade_frete: Number(modalidade),
      transportadora_id: transportadora || null,
      placa_veiculo: placa.trim() || null, rntc: rntc.trim() || null,
      volumes_qtd: volumes ? Number(volumes) : null, volumes_especie: especie.trim() || null,
      peso_bruto: pesoBruto ? Number(pesoBruto.replace(",", ".")) : null,
      peso_liquido: pesoLiquido ? Number(pesoLiquido.replace(",", ".")) : null,
      rateio_frete: rateio, valor_frete: soma.frete, valor_seguro: soma.seguro, outras_despesas: soma.outras,
      casas_decimais: casas,
      entrega: alterarEntrega && entrega.logradouro ? entrega : null,
      valor_produtos: soma.produtos, valor_total: soma.total,
    };
    const linhas = validos.map(({ maximo: _m, ...i }) => ({
      ...i, valor_frete: rateio === "por_produto" ? i.valor_frete : 0, outras_despesas: rateio === "por_produto" ? i.outras_despesas : 0,
    }));
    try {
      if (editId) { await atualizar.mutateAsync({ id: editId, devolucao, itens: linhas }); return editId; }
      const d = await criar.mutateAsync({ devolucao: { ...devolucao, status: "rascunho" }, itens: linhas });
      setEditId(d.id);
      return d.id;
    } catch (e: any) {
      toast.error(`Não foi possível gravar: ${e.message ?? e}`);
      return null;
    }
  };

  /** Espelho (prévia): valida a nota sem enviar nem gastar número. */
  const espelho = async (id: string, mostrar = true): Promise<boolean> => {
    if (!lojaId) return false;
    setOcupado(`espelho-${id}`);
    try {
      const r = await notaDev.mutateAsync({ devolucaoId: id, lojaId, espelho: true });
      if (r?.erro) throw new Error([r.erro, ...(r.faltas ?? [])].join(" — "));
      if (mostrar) {
        if (r?.danfe_pdf_base64) abrirPdf(r.danfe_pdf_base64);
        toast.success(`Espelho OK: a nota passou na validação (total ${brl(Number(r?.total ?? 0))}). Nada foi enviado.`, { duration: 8000 });
      }
      return true;
    } catch (e: any) {
      toast.error(`Espelho: ${e.message ?? e}`, { duration: 15000 });
      return false;
    } finally { setOcupado(null); }
  };

  const emitir = async (id: string) => {
    if (!lojaId) return false;
    setOcupado(`emitir-${id}`);
    try {
      const r = await notaDev.mutateAsync({ devolucaoId: id, lojaId, espelho: false });
      if (r?.autorizada) {
        toast.success(`NF-e de devolução nº ${r.numero} autorizada${r.ambiente !== "producao" ? " (homologação — sem valor fiscal)" : ""}.`, { duration: 10000 });
        return true;
      }
      toast.error(`SEFAZ recusou: ${r?.motivo ?? r?.erro ?? "sem motivo"} (cStat ${r?.cstat ?? "?"}). A devolução ficou em "Histórico de Notas Em Andamento".`, { duration: 15000 });
      return false;
    } catch (e: any) {
      toast.error(`Não foi possível emitir: ${e.message ?? e}`, { duration: 12000 });
      return false;
    } finally { setOcupado(null); }
  };

  const gerar = async () => {
    setConfirmandoGerar(false);
    const id = await salvar();
    if (!id) return;
    if (!(await espelho(id, false))) return;
    setOcupado(`emitir-${id}`);
    try { await confirmar.mutateAsync(id); }
    catch (e: any) { setOcupado(null); toast.error(`Não foi possível baixar o estoque: ${e.message ?? e}`); return; }
    if (await emitir(id)) { setAberto(false); limparFormulario(); }
    else { setAberto(false); limparFormulario(); setSoAndamento(true); }
  };

  const enviarEmail = async () => {
    const d = emailDe;
    setEmailDe(null);
    if (!d?.nota?.id) return;
    setOcupado(`email-${d.id}`);
    try {
      const { data, error } = await supabase.functions.invoke("erp-enviar-nota", {
        body: { nota_id: d.nota.id, canal: "email", destino: emailDestino.trim() || undefined },
      });
      if (error || !data?.ok) { toast.error(`Nota não enviada: ${await erroDaFuncao(error, data?.erro ?? "falha no envio")}`); return; }
      toast.success(`Nota enviada para ${data.destino}`, { description: data.com_danfe ? "XML + DANFE anexados" : "Só o XML" });
    } finally { setOcupado(null); }
  };

  const imprimirRelatorio = () => {
    const w = window.open("", "_blank");
    if (!w) { toast.error("O navegador bloqueou a janela de impressão."); return; }
    const linhas = lista.map((d) => `<tr><td>${d.nota?.numero ?? "—"}</td><td>${new Date(d.created_at).toLocaleString("pt-BR")}</td>
      <td>${d.fornecedor?.nome_razao ?? "—"}</td><td style="text-align:right">${brl(Number(d.valor_total ?? 0))}</td><td>${situacao(d).texto}</td>
      <td>${d.nota?.ambiente === "producao" ? "Produção" : d.nota ? "Homologação" : "—"}</td></tr>`).join("");
    const total = lista.reduce((s, d) => s + Number(d.valor_total ?? 0), 0);
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Notas de devolução a fornecedor</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ccc;padding:5px;text-align:left}th{background:#eee}</style>
      <h2>Notas de devolução a fornecedor — ${loja?.apelido ?? ""}</h2>
      <p>${soAndamento ? "Em andamento" : `Período: ${periodo.de.split("-").reverse().join("/")} a ${periodo.ate.split("-").reverse().join("/")}`} · ${lista.length} nota(s) · total ${brl(total)}</p>
      <table><thead><tr><th>Nota</th><th>Data</th><th>Fornecedor</th><th style="text-align:right">Valor</th><th>Status</th><th>Ambiente</th></tr></thead><tbody>${linhas}</tbody></table>
      <script>window.onload=()=>window.print()</script>`);
    w.document.close();
  };

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Notas de Devolução a Fornecedor" />;

  const itemEdit = editando != null ? rascunhoItem : null;
  const porProduto = rateio === "por_produto";
  const gravando = criar.isPending || atualizar.isPending || !!ocupado;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Undo2 className="h-6 w-6" /> Notas de Devolução a Fornecedor
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Mercadoria que volta ao fornecedor, com a NF-e de devolução.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div><Label className="text-xs">Selecione um período</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input type="date" className="w-40" value={de} onChange={(e) => setDe(e.target.value)} />
              <Input type="date" className="w-40" value={ate} onChange={(e) => setAte(e.target.value)} />
              <Button variant="secondary" onClick={() => { setPeriodo({ de, ate }); setSoAndamento(false); }}>Consultar</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Busca avançada" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Button onClick={() => { setBuscaForn(""); setEscolhendo(true); }}>
              <Plus className="mr-1 h-4 w-4" /> Gerar Nota de Devolução p/ Fornecedor
            </Button>
            <Button variant={soAndamento ? "default" : "outline"} className={soAndamento ? "" : "border-amber-400 text-amber-700 dark:text-amber-400"}
              onClick={() => setSoAndamento((s) => !s)}>
              <History className="mr-1 h-4 w-4" /> Histórico de Notas Em Andamento{emAndamento ? ` (${emAndamento})` : ""}
            </Button>
            <Button variant="ghost" onClick={imprimirRelatorio}><Printer className="mr-1 h-4 w-4" /> Imprimir Relatório</Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs">
                <tr>
                  <th className="p-2 text-left">Nota</th><th className="p-2 text-left">Data</th><th className="p-2 text-left">Hora</th>
                  <th className="p-2 text-left">Fornecedor</th><th className="p-2 text-right">Valor da Nota</th><th className="p-2 text-center">Status</th>
                  <th className="p-2 text-center">Ambiente</th><th className="p-2 text-center">Ver Nota</th><th className="p-2 text-center">Enviar E-mail</th>
                  <th className="p-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={10} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
                ) : lista.length === 0 ? (
                  <tr><td colSpan={10} className="p-6 text-sm text-muted-foreground">
                    {soAndamento ? "Nenhuma nota de devolução em andamento." : "Não foram encontradas notas de devolução neste período."}
                  </td></tr>
                ) : lista.map((d) => {
                  const s = situacao(d);
                  const quando = new Date(d.nota?.data_emissao ?? d.created_at);
                  return (
                    <tr key={d.id} className="border-t hover:bg-accent/50">
                      <td className="p-2 font-medium tabular-nums">{d.nota?.numero ?? "—"}</td>
                      <td className="p-2 tabular-nums">{quando.toLocaleDateString("pt-BR")}</td>
                      <td className="p-2 tabular-nums">{quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="p-2">{d.fornecedor?.nome_razao ?? "—"}</td>
                      <td className="p-2 text-right tabular-nums">{brl(Number(d.valor_total ?? 0))}</td>
                      <td className="p-2 text-center"><Badge className={s.cor} variant="outline">{s.texto}</Badge></td>
                      <td className="p-2 text-center text-xs">{d.nota ? (d.nota.ambiente === "producao" ? "Produção" : "Homologação") : "—"}</td>
                      <td className="p-2 text-center">
                        {d.nota?.status === "autorizada" || d.nota?.status === "cancelada" ? (
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => void abrirDanfe(d.nota)} title="Ver o DANFE">
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-2 text-center">
                        {d.nota?.status === "autorizada" ? (
                          <Button size="sm" variant="outline" className="h-7 px-2" disabled={ocupado === `email-${d.id}`} title="Enviar XML e DANFE por e-mail"
                            onClick={() => { setEmailDestino(d.fornecedor?.email ?? ""); setEmailDe(d); }}>
                            {ocupado === `email-${d.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                          </Button>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="whitespace-nowrap p-2 text-right">
                        <div className="flex justify-end gap-1">
                          {d.status === "rascunho" && (
                            <>
                              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => editar(d)} title="Continuar"><Pencil className="mr-1 h-3.5 w-3.5" /> Continuar</Button>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-destructive" title="Excluir" onClick={() => setExcluindo(d)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </>
                          )}
                          {d.status === "confirmada" && (
                            <Button size="sm" className="h-7 bg-green-600 px-2 hover:bg-green-700" disabled={!!ocupado} onClick={() => void emitir(d.id)}
                              title={d.nota?.mensagem_retorno ?? "O estoque já saiu; falta a nota"}>
                              {ocupado === `emitir-${d.id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Receipt className="mr-1 h-3.5 w-3.5" />} Emitir NF-e
                            </Button>
                          )}
                          {d.status === "faturada" && (
                            <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
                              <Link to="/notas-fiscais?aba=devolucoes" title="Cancelar ou carta de correção ficam em Notas vendas › Devoluções">Notas</Link>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Selecione o Fornecedor ---------- */}
      <Dialog open={escolhendo} onOpenChange={setEscolhendo}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Selecione o Fornecedor</DialogTitle></DialogHeader>
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input autoFocus className="pl-8" placeholder="Busca por Nome, CPF/CNPJ" value={buscaForn} onChange={(e) => setBuscaForn(e.target.value)} />
          </div>
          <div className="max-h-[55vh] overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs">
                <tr><th className="p-2 text-left">Nome</th><th className="p-2 text-left">CPF/CNPJ</th><th className="p-2 text-left">Telefone/Celular</th><th className="p-2 text-center">Tipo</th><th className="p-2 text-center">Cadastro</th></tr>
              </thead>
              <tbody>
                {fornecedoresAchados.length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum fornecedor encontrado. Cadastre em Gestão Empresarial › Fornecedores.</td></tr>
                ) : fornecedoresAchados.map((f) => {
                  const falta = faltasDoFornecedor(f);
                  return (
                    <tr key={f.id} className="cursor-pointer border-t hover:bg-accent" onClick={() => escolherFornecedor(f)}>
                      <td className="p-2">{f.nome_razao}</td>
                      <td className="p-2 tabular-nums">{f.cpf_cnpj ?? "—"}</td>
                      <td className="p-2 tabular-nums">{f.telefone || f.celular || "—"}</td>
                      <td className="p-2 text-center text-xs font-medium text-blue-700 dark:text-blue-400">Fornecedor</td>
                      <td className="p-2 text-center text-xs font-semibold" title={falta.length ? `Falta: ${falta.join(", ")}` : undefined}>
                        {falta.length ? <span className="text-red-600">Incompleto</span> : <span className="text-green-600">Completo</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DialogFooter><Button variant="secondary" onClick={() => setEscolhendo(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Gerar Nota Fiscal de Devolução para Fornecedor ---------- */}
      <Dialog open={aberto} onOpenChange={(o) => { if (!o && !gravando) setAberto(false); }}>
        <DialogContent className="max-w-6xl">
          <DialogHeader><DialogTitle>Gerar Nota Fiscal de Devolução para Fornecedor</DialogTitle></DialogHeader>

          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-medium">Dados do Fornecedor</h3>
              <div className="mt-1 space-y-0.5 pl-2 text-[13px]">
                <p>CPF / CNPJ: {fornecedor?.cpf_cnpj ?? "—"}</p>
                <p>Fornecedor: {fornecedor?.nome_razao ?? "—"}</p>
                <p>Endereço: {[fornecedor?.endereco?.logradouro, fornecedor?.endereco?.numero, fornecedor?.endereco?.bairro,
                  [fornecedor?.endereco?.cidade, fornecedor?.endereco?.uf ?? fornecedor?.uf].filter(Boolean).join(" - "),
                  fornecedor?.endereco?.cep ? `Cep: ${fornecedor.endereco.cep}` : null].filter(Boolean).join(", ") || "—"}</p>
              </div>
              {faltasForn.length > 0 && (
                <p className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  Cadastro incompleto para a nota: falta {faltasForn.join(", ")}. Complete em{" "}
                  <Link to="/gestao/fornecedores" className="font-semibold underline">Gestão Empresarial › Fornecedores</Link>.
                </p>
              )}
            </div>

            <div>
              <h3 className="font-medium">Dados da Nota</h3>
              <div className="mt-2 grid gap-3 md:grid-cols-4">
                <div><Label className="text-xs">Número Nota de Entrada:</Label><Input className="mt-1" value={numeroEntrada} onChange={(e) => setNumeroEntrada(e.target.value)} /></div>
                <div><Label className="text-xs">Natureza da Operação:</Label><Input className="mt-1" value={natureza} maxLength={60} onChange={(e) => setNatureza(e.target.value)} /></div>
                <div><Label className="text-xs">Finalidade da nota:</Label>
                  <select className={`mt-1 ${sel}`} value={finalidade} onChange={(e) => setFinalidade(e.target.value)}>
                    <option value="4">NOTA DE DEVOLUÇÃO</option><option value="1">NOTA NORMAL</option>
                  </select>
                </div>
                <div><Label className="text-xs">Descrição do(s) Volumes:</Label><Input className="mt-1" value={especie} onChange={(e) => setEspecie(e.target.value)} />
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Ex. Caixa, Pacote, Sacola…</p></div>

                <div><Label className="text-xs">Qtd de Volumes:</Label><Input className="mt-1" inputMode="numeric" value={volumes} onChange={(e) => setVolumes(soDigitos(e.target.value))} /></div>
                <div><Label className="text-xs">Modalidade de Frete</Label>
                  <select className={`mt-1 ${sel}`} value={modalidade} onChange={(e) => setModalidade(e.target.value)}>
                    {MODALIDADES.map((m) => <option key={m.v} value={m.v}>{m.t}</option>)}
                  </select>
                </div>
                <div><Label className="text-xs">Transportadora:</Label>
                  <select className={`mt-1 ${sel}`} value={transportadora} onChange={(e) => setTransportadora(e.target.value)}>
                    <option value="">-- Transportadora --</option>
                    {(transportadoras as any[]).map((t) => <option key={t.id} value={t.id}>{t.nome_razao ?? t.nome}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Placa:</Label><Input className="mt-1" value={placa} maxLength={8} onChange={(e) => setPlaca(e.target.value.toUpperCase())} /></div>
                  <div><Label className="text-xs">RNTC:</Label><Input className="mt-1" value={rntc} maxLength={20} onChange={(e) => setRntc(e.target.value)} /></div>
                </div>

                <div><Label className="text-xs">Peso Bruto:</Label><Input className="mt-1" inputMode="decimal" value={pesoBruto} onChange={(e) => setPesoBruto(e.target.value)} /></div>
                <div><Label className="text-xs">Peso Líquido:</Label><Input className="mt-1" inputMode="decimal" value={pesoLiquido} onChange={(e) => setPesoLiquido(e.target.value)} /></div>
                <div className="md:col-span-2"><Label className="text-xs">Aplicar Frete e Outras Despesas</Label>
                  <select className={`mt-1 ${sel}`} value={rateio} onChange={(e) => setRateio(e.target.value as any)}>
                    <option value="igual">No Valor Final da Nota - Rateado igualmente entre os produtos</option>
                    <option value="por_produto">Por Produto</option>
                  </select>
                </div>

                <div><Label className="text-xs">Valor Frete:</Label>
                  <Input className="mt-1" inputMode="decimal" disabled={porProduto} value={porProduto ? String(soma.frete) : frete} onChange={(e) => setFrete(e.target.value)} /></div>
                <div><Label className="text-xs">Outras Despesas:</Label>
                  <Input className="mt-1" inputMode="decimal" disabled={porProduto} value={porProduto ? String(soma.outras) : outras} onChange={(e) => setOutras(e.target.value)} /></div>
                <div><Label className="text-xs">Seguro:</Label><Input className="mt-1" inputMode="decimal" value={seguro} onChange={(e) => setSeguro(e.target.value)} /></div>
              </div>

              <label className="mt-3 flex items-center gap-2 font-medium">
                <input type="checkbox" checked={alterarEntrega} onChange={(e) => setAlterarEntrega(e.target.checked)} /> Deseja alterar o endereço de entrega?
              </label>
              {alterarEntrega && (
                <div className="mt-2 grid gap-2 rounded-md border p-3 md:grid-cols-6">
                  <div><Label className="text-xs">CEP</Label><Input className="mt-1" value={entrega.cep} onChange={(e) => setEntrega({ ...entrega, cep: e.target.value })} onBlur={buscarCepEntrega} /></div>
                  <div className="md:col-span-3"><Label className="text-xs">Rua</Label><Input className="mt-1" value={entrega.logradouro} onChange={(e) => setEntrega({ ...entrega, logradouro: e.target.value })} /></div>
                  <div><Label className="text-xs">Número</Label><Input className="mt-1" value={entrega.numero} onChange={(e) => setEntrega({ ...entrega, numero: e.target.value })} /></div>
                  <div><Label className="text-xs">Complemento</Label><Input className="mt-1" value={entrega.complemento} onChange={(e) => setEntrega({ ...entrega, complemento: e.target.value })} /></div>
                  <div className="md:col-span-2"><Label className="text-xs">Bairro</Label><Input className="mt-1" value={entrega.bairro} onChange={(e) => setEntrega({ ...entrega, bairro: e.target.value })} /></div>
                  <div className="md:col-span-2"><Label className="text-xs">Cidade</Label><Input className="mt-1" value={entrega.cidade} onChange={(e) => setEntrega({ ...entrega, cidade: e.target.value })} /></div>
                  <div><Label className="text-xs">UF</Label><Input className="mt-1" maxLength={2} value={entrega.uf} onChange={(e) => setEntrega({ ...entrega, uf: e.target.value.toUpperCase() })} /></div>
                  <div><Label className="text-xs">Cód. IBGE</Label><Input className="mt-1" value={entrega.codigo_municipio} onChange={(e) => setEntrega({ ...entrega, codigo_municipio: soDigitos(e.target.value) })} /></div>
                  <p className="text-[11px] text-muted-foreground md:col-span-6">Digite o CEP e saia do campo: o resto se preenche sozinho.</p>
                </div>
              )}

              <div className="mt-3"><Label className="text-xs">Informações Adicionais:</Label>
                <Textarea className="mt-1" rows={3} value={info} onChange={(e) => setInfo(e.target.value)} placeholder="Motivo da devolução e o que mais deve sair na nota" /></div>
            </div>

            {finalidade === "4" && (
              <div>
                <Label className="text-xs">Número do DANFE da Nota de Entrada:</Label>
                <datalist id="chaves-entrada">
                  {(notasEntrada as any[]).filter((n) => n.chave_acesso).map((n) => <option key={n.id} value={n.chave_acesso}>NF {n.numero}</option>)}
                </datalist>
                <div className="mt-1 space-y-2">
                  {chaves.map((c, k) => {
                    const d = soDigitos(c);
                    return (
                      <div key={k} className="flex items-center gap-2">
                        <Input list="chaves-entrada" className={`font-mono ${d && d.length !== 44 ? "border-red-500" : ""}`} value={formatarChave(c)}
                          placeholder="44 dígitos da chave de acesso"
                          onChange={(e) => {
                            const novo = soDigitos(e.target.value).slice(0, 44);
                            const antiga = soDigitos(c);
                            setChaves((cs) => cs.map((x, i) => (i === k ? novo : x)));
                            // itens que apontavam para a chave antiga acompanham a troca
                            if (antiga) setItens((its) => its.map((i) => (soDigitos(i.chave_nota_origem) === antiga ? { ...i, chave_nota_origem: novo } : i)));
                            else if (novo.length === 44) setItens((its) => its.map((i) => (i.chave_nota_origem ? i : { ...i, chave_nota_origem: novo })));
                          }} />
                        <span className={`w-12 text-[11px] ${d.length === 44 ? "text-green-600" : "text-muted-foreground"}`}>{d.length}/44</span>
                        {chaves.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Tirar este DANFE"
                            onClick={() => setChaves((cs) => cs.filter((_, i) => i !== k))}><X className="h-4 w-4" /></Button>
                        )}
                      </div>
                    );
                  })}
                  <Button size="sm" variant="secondary" onClick={() => setChaves((cs) => [...cs, ""])}>Adicionar Outro DANFE</Button>
                </div>
              </div>
            )}

            {/* produtos */}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">Produtos da nota:</Label>
                <div className="mt-1 flex">
                  <Input className="w-56 rounded-r-none" placeholder="Buscar produto pelo nome" value={termoProduto}
                    onChange={(e) => setTermoProduto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setBuscandoProduto(true); } }} />
                  <Button variant="outline" className="rounded-l-none" onClick={() => setBuscandoProduto(true)} title="Buscar"><Search className="h-4 w-4" /></Button>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Apertar enter ou clique na lupa para efetuar a busca</p>
              </div>
              <div><Label className="text-xs">Qtd. casas decimais Vlr. Unitário:</Label>
                <select className={`mt-1 w-28 ${sel}`} value={casas} onChange={(e) => setCasas(Number(e.target.value))}>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="ml-auto flex gap-2 pb-4">
                <Button variant="secondary" onClick={() => { setNumeroNotaBusca(""); setBuscandoNota(true); }}>Buscar NF Entrada</Button>
                <Button variant="secondary" onClick={() => arquivoXml.current?.click()}><Upload className="mr-1 h-4 w-4" /> Importar XML</Button>
                <input ref={arquivoXml} type="file" accept=".xml,text/xml,application/xml" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void importarXml(f); e.target.value = ""; }} />
              </div>
            </div>

            {/* linha em edição (antes de ir para a lista) */}
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr><th className="p-2 text-left">Produto</th><th className="p-2 text-left">Cód. barras</th><th className="p-2">Qtd</th><th className="p-2">Vlr. unit.</th>
                    <th className="p-2">Vlr. total</th><th className="p-2">Desconto (%)</th><th className="p-2">Desconto (R$)</th>
                    {porProduto && <><th className="p-2">Frete</th><th className="p-2">Outras</th></>}<th className="p-2">CFOP</th><th className="p-2"></th></tr>
                </thead>
                <tbody>
                  {linha && (
                    <tr className="border-t">
                      <td className="p-2">{linha.nome}</td>
                      <td className="p-2 tabular-nums">{linha.codigo_ean ?? "—"}</td>
                      <td className="p-2"><Input className="h-8 w-24 text-right" type="number" step="any" min="0" value={linha.quantidade}
                        onChange={(e) => setLinha(mudarQuantidadeOuValor(linha, Number(e.target.value)))} /></td>
                      <td className="p-2"><Input className="h-8 w-28 text-right" type="number" step="any" min="0" value={linha.valor_unitario}
                        onChange={(e) => setLinha(mudarQuantidadeOuValor(linha, linha.quantidade, Number(e.target.value)))}
                        onBlur={() => setLinha(mudarQuantidadeOuValor(linha, linha.quantidade, arredondarUnit(linha.valor_unitario, casas)))} /></td>
                      <td className="p-2 text-right tabular-nums">{brl(linha.valor_total)}</td>
                      <td className="p-2"><Input className="h-8 w-20 text-right" type="number" step="any" min="0" value={linha.desconto_percentual}
                        onChange={(e) => setLinha(aplicarDesconto(linha, { percentual: Number(e.target.value) }))} /></td>
                      <td className="p-2"><Input className="h-8 w-24 text-right" type="number" step="any" min="0" value={linha.valor_desconto}
                        onChange={(e) => setLinha(aplicarDesconto(linha, { valor: Number(e.target.value) }))} /></td>
                      {porProduto && <>
                        <td className="p-2"><Input className="h-8 w-20 text-right" type="number" step="any" min="0" value={linha.valor_frete}
                          onChange={(e) => setLinha({ ...linha, valor_frete: Number(e.target.value) || 0 })} /></td>
                        <td className="p-2"><Input className="h-8 w-20 text-right" type="number" step="any" min="0" value={linha.outras_despesas}
                          onChange={(e) => setLinha({ ...linha, outras_despesas: Number(e.target.value) || 0 })} /></td>
                      </>}
                      <td className="p-2"><select className="h-8 w-28 rounded-md border bg-background px-1 font-mono" value={linha.cfop}
                        onChange={(e) => setLinha({ ...linha, cfop: e.target.value })}><OpcoesCfop extra={[cfopPadrao]} /></select></td>
                      <td className="whitespace-nowrap p-2">
                        <Button size="icon" variant="destructive" className="h-8 w-8" title="Descartar" onClick={() => setLinha(null)}><X className="h-4 w-4" /></Button>
                        <Button size="icon" className="ml-1 h-8 w-8" title="Adicionar à lista" onClick={adicionarLinha}><Plus className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="mb-2 font-medium">Lista de produtos adicionados</h3>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="p-2 text-left">Produto</th><th className="p-2 text-left">Cód. barras</th><th className="p-2 text-right">Qtd</th>
                      <th className="p-2 text-right">Vlr. unit</th><th className="p-2 text-right">Vlr. total</th><th className="p-2 text-right">Desconto</th>
                      <th className="p-2">
                        <div className="text-center">CFOP</div>
                        <select className="mt-1 h-7 w-28 rounded-md border bg-background px-1 font-normal" value="" title="Trocar o CFOP de todos"
                          onChange={(e) => { const v = e.target.value; if (v) setItens((c) => c.map((i) => ({ ...i, cfop: v }))); }}>
                          <option value="">Selecione</option><OpcoesCfop extra={[cfopPadrao]} />
                        </select>
                      </th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.length === 0 ? (
                      <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Busque o produto no estoque, use "Buscar NF Entrada" ou "Importar XML".</td></tr>
                    ) : itens.map((i, idx) => {
                      const semNota = finalidade === "4" && !chavesValidas.includes(soDigitos(i.chave_nota_origem));
                      return (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{i.nome}
                            <span className="block text-[10px] text-muted-foreground">
                              CSOSN {i.icms_csosn}{i.icms_valor ? ` · ICMS ${brl(i.icms_valor)}` : ""}{i.ipi_devolvido_valor ? ` · IPI devolvido ${brl(i.ipi_devolvido_valor)}` : ""}
                              {chavesValidas.length > 1 && i.chave_nota_origem ? ` · NF ${Number(soDigitos(i.chave_nota_origem).slice(25, 34))}` : ""}
                              {i.item_nota_origem ? ` · item ${i.item_nota_origem}` : ""}{!i.produto_id ? " · sem cadastro no estoque" : ""}
                            </span>
                            {semNota && <span className="block text-[10px] font-semibold text-red-600">Escolha a nota de entrada deste produto em "Editar"</span>}
                          </td>
                          <td className="p-2 tabular-nums">{i.codigo_ean ?? "—"}</td>
                          <td className="p-2 text-right tabular-nums">{num(i.quantidade)}</td>
                          <td className="p-2 text-right tabular-nums">{brl(i.valor_unitario)}</td>
                          <td className="p-2 text-right tabular-nums">{brl(i.valor_total)}</td>
                          <td className="p-2 text-right tabular-nums">{brl(i.valor_desconto)}</td>
                          <td className="p-2 text-center font-mono">{i.cfop}</td>
                          <td className="whitespace-nowrap p-2 text-right">
                            <Button size="icon" variant="destructive" className="h-7 w-7" title="Tirar da lista" onClick={() => setItens((c) => c.filter((_, k) => k !== idx))}><X className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" className="ml-1 h-7 w-7" title="Editar (quantidade, valor e tributos)"
                              onClick={() => { setRascunhoItem({ ...i }); setAbaTrib("icms"); setEditando(idx); }}><Pencil className="h-3.5 w-3.5" /></Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {itens.length > 0 && (
                    <tfoot className="border-t bg-muted/30 font-medium">
                      <tr><td colSpan={4} className="p-2 text-right">Total:</td><td className="p-2 text-right tabular-nums">{brl(soma.produtos)}</td>
                        <td className="p-2 text-right tabular-nums">{brl(soma.desconto)}</td><td colSpan={2}></td></tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <div className="mt-2 flex flex-wrap justify-end gap-x-6 gap-y-1 text-xs text-muted-foreground">
                {soma.frete > 0 && <span>Frete {brl(soma.frete)}</span>}
                {soma.seguro > 0 && <span>Seguro {brl(soma.seguro)}</span>}
                {soma.outras > 0 && <span>Outras {brl(soma.outras)}</span>}
                {soma.ipiDevolvido > 0 && <span>IPI devolvido {brl(soma.ipiDevolvido)}</span>}
                {soma.icms > 0 && <span>ICMS {brl(soma.icms)}</span>}
                <span className="text-sm font-semibold text-foreground">Total da nota {brl(soma.total)}</span>
              </div>
            </div>

            {faltas.length > 0 && itens.length > 0 && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs dark:bg-amber-950/20">
                Para gerar a nota ainda falta: {faltas.join("; ")}.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="secondary" disabled={gravando} onClick={() => setAberto(false)}>Fechar</Button>
            <Button className="bg-amber-400 text-black hover:bg-amber-500" disabled={gravando || !itens.length}
              onClick={async () => { const id = await salvar(); if (id) await espelho(id); }}>
              {ocupado?.startsWith("espelho") ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Eye className="mr-1 h-4 w-4" />} Espelho de Nota (Prévia)
            </Button>
            <Button disabled={gravando || !itens.length} onClick={() => {
              if (faltas.length) { toast.error(`Ainda falta: ${faltas.join("; ")}`, { duration: 10000 }); return; }
              setConfirmandoGerar(true);
            }}>
              {ocupado?.startsWith("emitir") ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Receipt className="mr-1 h-4 w-4" />} Gerar Nota de Devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Selecione o produto desejado ---------- */}
      <Dialog open={buscandoProduto} onOpenChange={setBuscandoProduto}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Selecione o produto desejado</DialogTitle></DialogHeader>
          <Input autoFocus placeholder="Nome, código de barras ou código" value={termoProduto} onChange={(e) => setTermoProduto(e.target.value)} />
          <div className="max-h-[55vh] overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs"><tr><th className="p-2 text-left">Produto</th><th className="p-2 text-right">Vr unitário</th><th className="p-2 text-right">Estoque</th><th className="p-2 text-left">Código de barras</th></tr></thead>
              <tbody>
                {produtosAchados.length === 0 ? (
                  <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
                ) : produtosAchados.map((p: any) => (
                  <tr key={p.id} className="cursor-pointer border-t hover:bg-accent" onClick={() => escolherProduto(p)}>
                    <td className="p-2">{p.nome}</td>
                    <td className="p-2 text-right tabular-nums">{brl(Number(p.preco_custo ?? 0))}</td>
                    <td className={`p-2 text-right tabular-nums ${Number(p.estoque_atual ?? 0) <= 0 ? "text-red-600" : ""}`}>{num(Number(p.estoque_atual ?? 0))}</td>
                    <td className="p-2 tabular-nums">{p.codigo_barras ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter><Button variant="secondary" onClick={() => setBuscandoProduto(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Lista de NF Entrada ---------- */}
      <Dialog open={buscandoNota} onOpenChange={setBuscandoNota}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Lista de NF Entrada</DialogTitle></DialogHeader>
          <div className="flex items-center gap-2">
            <Label>Nº Nota:</Label>
            <Input className="w-48" value={numeroNotaBusca} onChange={(e) => setNumeroNotaBusca(soDigitos(e.target.value))} />
          </div>
          <p className="text-xs text-muted-foreground">* Serão apresentadas apenas as notas de entrada do fornecedor selecionado nessa nota de devolução.</p>
          <div className="max-h-[50vh] overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs"><tr><th className="p-2">Nº Nota</th><th className="p-2 text-right">Qtd. Itens</th><th className="p-2 text-right">Vlr. Total</th><th className="p-2">Data Entrada</th></tr></thead>
              <tbody>
                {(notasEntrada as any[]).filter((n) => !numeroNotaBusca || String(n.numero ?? "").includes(numeroNotaBusca)).map((n) => (
                  <tr key={n.id} className="cursor-pointer border-t hover:bg-accent" onClick={() => escolherNotaEntrada(n)}>
                    <td className="p-2 text-center tabular-nums">{n.numero}</td>
                    <td className="p-2 text-right tabular-nums">{num((n.itens ?? []).length)}</td>
                    <td className="p-2 text-right tabular-nums">{brl(Number(n.valor_total ?? 0))}</td>
                    <td className="p-2 text-center tabular-nums">{n.data_entrada || n.data_emissao ? new Date(n.data_entrada ?? n.data_emissao).toLocaleString("pt-BR") : "—"}</td>
                  </tr>
                ))}
                {(notasEntrada as any[]).length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">
                    Nenhuma nota de entrada deste fornecedor no sistema. Use "Importar XML" com o arquivo que o fornecedor mandou, ou digite o número do DANFE e busque os produtos no estoque.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <DialogFooter><Button variant="secondary" onClick={() => setBuscandoNota(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Editar item: quantidade, valor e Cadastro de tributos ---------- */}
      <Dialog open={editando != null} onOpenChange={(o) => { if (!o) setEditando(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Cadastro de tributos — {itemEdit?.nome}</DialogTitle></DialogHeader>
          {itemEdit && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-4 gap-2">
                <div><Label className="text-xs">Qtd</Label><Input className="mt-1" type="number" step="any" min="0" value={itemEdit.quantidade}
                  onChange={(e) => setRascunhoItem(mudarQuantidadeOuValor(itemEdit, Number(e.target.value)))} />
                  {itemEdit.maximo != null && <p className="mt-0.5 text-[10px] text-muted-foreground">veio {num(itemEdit.maximo)} na nota</p>}</div>
                <div><Label className="text-xs">Vlr. unit.</Label><Input className="mt-1" type="number" step="any" min="0" value={itemEdit.valor_unitario}
                  onChange={(e) => setRascunhoItem(mudarQuantidadeOuValor(itemEdit, itemEdit.quantidade, Number(e.target.value)))} /></div>
                <div><Label className="text-xs">Desconto (%)</Label><Input className="mt-1" type="number" step="any" min="0" value={itemEdit.desconto_percentual}
                  onChange={(e) => setRascunhoItem(aplicarDesconto(itemEdit, { percentual: Number(e.target.value) }))} /></div>
                <div><Label className="text-xs">Desconto (R$)</Label><Input className="mt-1" type="number" step="any" min="0" value={itemEdit.valor_desconto}
                  onChange={(e) => setRascunhoItem(aplicarDesconto(itemEdit, { valor: Number(e.target.value) }))} /></div>
                {porProduto && <>
                  <div><Label className="text-xs">Frete</Label><Input className="mt-1" type="number" step="any" min="0" value={itemEdit.valor_frete}
                    onChange={(e) => setRascunhoItem({ ...itemEdit, valor_frete: Number(e.target.value) || 0 })} /></div>
                  <div><Label className="text-xs">Outras despesas</Label><Input className="mt-1" type="number" step="any" min="0" value={itemEdit.outras_despesas}
                    onChange={(e) => setRascunhoItem({ ...itemEdit, outras_despesas: Number(e.target.value) || 0 })} /></div>
                </>}
              </div>

              <div><Label className="text-xs">CFOP:</Label>
                <select className={`mt-1 ${sel}`} value={itemEdit.cfop} onChange={(e) => setRascunhoItem({ ...itemEdit, cfop: e.target.value })}>
                  <OpcoesCfop extra={[cfopPadrao]} />
                </select>
              </div>

              {finalidade === "4" && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2"><Label className="text-xs">Nota de entrada deste produto</Label>
                    <select className={`mt-1 ${sel}`} value={soDigitos(itemEdit.chave_nota_origem)}
                      onChange={(e) => setRascunhoItem({ ...itemEdit, chave_nota_origem: e.target.value || null })}>
                      <option value="">Selecione</option>
                      {chavesValidas.map((c) => <option key={c} value={c}>NF {Number(c.slice(25, 34))} · {formatarChave(c).slice(0, 29)}…</option>)}
                    </select>
                    {!chavesValidas.length && <p className="mt-0.5 text-[10px] text-red-600">Digite antes o número do DANFE da nota de entrada.</p>}
                  </div>
                  <div><Label className="text-xs">Nº do item na nota (opcional)</Label>
                    <Input className="mt-1" inputMode="numeric" value={itemEdit.item_nota_origem ?? ""}
                      onChange={(e) => setRascunhoItem({ ...itemEdit, item_nota_origem: e.target.value ? Number(soDigitos(e.target.value)) : null })} /></div>
                </div>
              )}

              <div className="rounded-md border">
                <div className="flex gap-1 border-b bg-[#1e3a8a] px-2 py-1 text-xs text-white">NF-e</div>
                <div className="flex gap-1 border-b p-2">
                  <Button size="sm" variant={abaTrib === "icms" ? "default" : "ghost"} className="h-7" onClick={() => setAbaTrib("icms")}>ICMS</Button>
                  <Button size="sm" variant={abaTrib === "ipi" ? "default" : "ghost"} className="h-7" onClick={() => setAbaTrib("ipi")}>IPI Devolvido</Button>
                </div>
                {abaTrib === "icms" ? (
                  <div className="grid gap-3 p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs">Regime Fiscal</Label><Input className="mt-1" value="O da loja (Configurações SEFAZ)" disabled title="O regime vem da configuração da filial: Simples usa CSOSN, regime normal usa CST" /></div>
                      <div><Label className="text-xs">Origem do Produto *</Label>
                        <select className={`mt-1 ${sel}`} value={itemEdit.icms_origem} onChange={(e) => setRascunhoItem({ ...itemEdit, icms_origem: e.target.value })}>
                          {ORIGENS_MERCADORIA.map((o) => <option key={o.valor} value={String(o.valor)}>{o.rotulo}</option>)}
                        </select>
                      </div>
                    </div>
                    <div><Label className="text-xs">Situação Tributária *</Label>
                      <select className={`mt-1 ${sel}`} value={itemEdit.icms_csosn}
                        onChange={(e) => setRascunhoItem(aplicarTributacao(itemEdit, { icms_csosn: e.target.value, icms_base: itemEdit.icms_base || itemEdit.valor_total }))}>
                        {CSOSNS.filter((c) => c.valor !== "101").map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label className="text-xs">Base de cálculo</Label><Input className="mt-1" type="number" step="any" disabled={itemEdit.icms_csosn !== "900"} value={itemEdit.icms_base}
                        onChange={(e) => setRascunhoItem(aplicarTributacao(itemEdit, { icms_base: Number(e.target.value) }))} /></div>
                      <div><Label className="text-xs">Alíquota (%)</Label><Input className="mt-1" type="number" step="any" disabled={itemEdit.icms_csosn !== "900"} value={itemEdit.icms_aliquota}
                        onChange={(e) => setRascunhoItem(aplicarTributacao(itemEdit, { icms_aliquota: Number(e.target.value) }))} /></div>
                      <div><Label className="text-xs">ICMS da operação</Label><Input className="mt-1 font-semibold" value={brl(itemEdit.icms_valor)} disabled /></div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Na devolução, o ICMS segue o que veio destacado na compra (900 com base e alíquota). Sem destaque, use 102.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 p-3">
                    <div><Label className="text-xs">Percentual da mercadoria devolvida (%)</Label><Input className="mt-1" type="number" step="any" min="0" max="100"
                      value={itemEdit.ipi_devolvido_percentual} onChange={(e) => setRascunhoItem(aplicarTributacao(itemEdit, { ipi_devolvido_percentual: Number(e.target.value) }))} /></div>
                    <div><Label className="text-xs">Valor do IPI devolvido (R$)</Label><Input className="mt-1" type="number" step="any" min="0"
                      value={itemEdit.ipi_devolvido_valor} onChange={(e) => setRascunhoItem(aplicarTributacao(itemEdit, { ipi_devolvido_valor: Number(e.target.value) }))} /></div>
                    <p className="col-span-2 text-[11px] text-muted-foreground">
                      O IPI que veio destacado na nota de compra volta junto e soma no total da nota.{itemEdit.ipi_valor ? ` IPI deste item na compra (proporcional): ${brl(itemEdit.ipi_valor)}.` : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <span className="mr-auto text-[11px] text-muted-foreground">* Campos de preenchimento obrigatório</span>
            <Button variant="outline" onClick={() => itemEdit && setRascunhoItem(aplicarTributacao(itemEdit, { icms_csosn: "102", ipi_devolvido_percentual: 0, ipi_devolvido_valor: 0 }))}>Remover Tributos</Button>
            <Button onClick={() => {
              if (editando != null && rascunhoItem) mudarItem(editando, () => rascunhoItem);
              setEditando(null);
            }}>Gravar Alteração</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- confirmações (sem o confirm() do navegador) ---------- */}
      <Dialog open={confirmandoGerar} onOpenChange={setConfirmandoGerar}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Gerar a nota de devolução?</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <p>{itens.filter((i) => i.produto_id).length} produto(s) saem do estoque de {loja?.apelido ?? "esta filial"} e a NF-e de {brl(soma.total)} vai para a SEFAZ.</p>
            <p className={ambiente?.ambiente === "producao" ? "font-semibold text-red-600" : "text-amber-700 dark:text-amber-400"}>
              {ambiente?.ambiente === "producao" ? "Ambiente de PRODUÇÃO: a nota vale de verdade." : "Ambiente de homologação (teste): a nota sai sem valor fiscal."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmandoGerar(false)}>Voltar</Button>
            <Button onClick={() => void gerar()}>Gerar Nota de Devolução</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!excluindo} onOpenChange={(o) => { if (!o) setExcluindo(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Excluir esta devolução em andamento?</DialogTitle></DialogHeader>
          <p className="text-sm">{excluindo?.fornecedor?.nome_razao} · {brl(Number(excluindo?.valor_total ?? 0))}. Nada saiu do estoque ainda.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)}>Voltar</Button>
            <Button variant="destructive" disabled={excluir.isPending} onClick={async () => {
              try { await excluir.mutateAsync(excluindo.id); toast.success("Devolução excluída."); } catch (e: any) { toast.error(e.message ?? String(e)); }
              setExcluindo(null);
            }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!emailDe} onOpenChange={(o) => { if (!o) setEmailDe(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Enviar a nota por e-mail</DialogTitle></DialogHeader>
          <div><Label className="text-xs">E-mail do fornecedor</Label><Input className="mt-1" type="email" value={emailDestino} onChange={(e) => setEmailDestino(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">Vão o XML e o DANFE da NF-e de devolução nº {emailDe?.nota?.numero}.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDe(null)}>Voltar</Button>
            <Button disabled={!emailDestino.includes("@")} onClick={() => void enviarEmail()}><Mail className="mr-1 h-4 w-4" /> Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

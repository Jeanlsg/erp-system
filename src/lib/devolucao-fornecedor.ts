// ============================================================
// Devolução a fornecedor — regras puras do item e do que falta para emitir.
//
// Pedido da loja (10/10/2026, vídeos 2 e 3) e, em 11/10, "faça igual ao
// Excellent": CFOP da operação escolhido ("às vezes muda"), quantidade,
// valor e desconto (% ou R$) do que volta, tela de tributação por item
// (CFOP, origem, situação tributária, base, alíquota, ICMS da operação e IPI
// devolvido), VÁRIAS notas de entrada ("Adicionar outro DANFE"), importar o
// XML da compra e o espelho antes de subir para a Receita.
//
// Cada item diz de qual nota de entrada veio e em que linha dela: a NF-e de
// devolução referencia a origem por item (DFeReferenciado — refNFe no
// cabeçalho está proibido desde 05/10/2026, NT 2025.002 regra VC02-14). O
// leiaute diz que o nItem é opcional, mas a SEFAZ recusa sem ele (rejeição
// 1048, vista no teste de 11/10). Vem sozinho do XML e da nota importada;
// com o produto buscado no estoque, é a linha do produto no DANFE.
// ============================================================

import { calcularIcms, cfopParaUf } from "@/lib/tabelas-fiscais";

export interface ItemDevolucao {
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
  desconto_percentual: number;
  valor_desconto: number;
  /** frete e outras despesas do item quando o rateio é "por produto" */
  valor_frete: number;
  outras_despesas: number;
  icms_origem: string;
  icms_csosn: string;
  icms_base: number;
  icms_aliquota: number;
  icms_valor: number;
  ipi_valor: number;
  pis_valor: number;
  cofins_valor: number;
  ipi_devolvido_percentual: number;
  ipi_devolvido_valor: number;
  /** chave (44 dígitos) da nota de entrada de onde o item veio */
  chave_nota_origem: string | null;
  /** nItem: a linha do produto na nota de entrada (a SEFAZ exige — rejeição 1048) */
  item_nota_origem: number | null;
  /** quanto veio na nota de origem — o teto do que se pode devolver */
  maximo?: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
export const soDigitos = (s: string | null | undefined) => String(s ?? "").replace(/\D/g, "");

/** CFOP de devolução pela UF: 5xxx no mesmo estado, 6xxx fora. Com ST, 5411/6411. */
export function cfopDevolucao(ufLoja: string | null | undefined, ufFornecedor: string | null | undefined, comST = false): string {
  const mesma = !ufLoja || !ufFornecedor || ufLoja.toUpperCase() === ufFornecedor.toUpperCase();
  return cfopParaUf(comST ? "5411" : "5202", mesma);
}

const ITEM_VAZIO = {
  desconto_percentual: 0, valor_desconto: 0, valor_frete: 0, outras_despesas: 0,
  icms_base: 0, icms_aliquota: 0, icms_valor: 0, ipi_valor: 0, pis_valor: 0, cofins_valor: 0,
  ipi_devolvido_percentual: 0, ipi_devolvido_valor: 0, item_nota_origem: null,
};

/** Produto buscado no estoque → item (valor = custo, tributação do cadastro). */
export function itemDoProduto(p: any, cfop: string, chave: string | null): ItemDevolucao {
  const custo = r2(Number(p.preco_custo ?? 0));
  return {
    ...ITEM_VAZIO,
    produto_id: p.id, nome: p.nome, codigo_ean: p.codigo_barras ?? null, ncm: p.ncm ?? null,
    unidade: p.unidade ?? "UN", cfop, quantidade: 1, valor_unitario: custo, valor_total: custo,
    icms_origem: String(p.origem_mercadoria ?? 0), icms_csosn: p.csosn ?? "102",
    chave_nota_origem: chave,
  };
}

/** Item da nota de entrada (importada no ERP) → item da devolução, com os impostos que vieram nela. */
export function itemDaNotaEntrada(i: any, cfop: string, chave: string | null = null): ItemDevolucao {
  const q = Number(i.quantidade ?? 0);
  const total = Number(i.valor_total ?? 0);
  const aliq = Number(i.icms_aliquota ?? 0);
  const icms = Number(i.icms_valor ?? 0);
  const ipi = Number(i.ipi_valor ?? 0);
  return {
    ...ITEM_VAZIO,
    produto_id: i.produto_id ?? null, nfe_item_id: i.id ?? null,
    nome: i.nome, codigo_ean: i.codigo_ean ?? null, ncm: i.ncm ?? null, unidade: i.unidade ?? "UN",
    cfop: Number(i.icms_st_valor ?? 0) > 0 ? cfopParaUf("5411", cfop.startsWith("5")) : cfop,
    quantidade: q, valor_unitario: Number(i.valor_unitario ?? 0), valor_total: total,
    icms_origem: String(i.icms_origem ?? "0"), icms_csosn: icms > 0 ? "900" : String(i.icms_csosn ?? "102"),
    // base da entrada: se veio ICMS, base = valor / alíquota; senão o valor do item
    icms_base: icms > 0 && aliq > 0 ? r2((icms * 100) / aliq) : (icms > 0 ? total : 0),
    icms_aliquota: aliq, icms_valor: icms,
    ipi_valor: ipi, pis_valor: Number(i.pis_valor ?? 0), cofins_valor: Number(i.cofins_valor ?? 0),
    // o IPI que veio na compra volta junto (IPI devolvido)
    ipi_devolvido_percentual: ipi > 0 ? 100 : 0, ipi_devolvido_valor: ipi,
    chave_nota_origem: chave,
    item_nota_origem: i.numero_item != null ? Number(i.numero_item) : null,
    maximo: q,
  };
}

/**
 * Mudou quantidade ou valor: refaz o total e leva desconto e impostos na
 * mesma proporção (devolver metade da caixa devolve metade do ICMS e do IPI
 * que vieram nela). O desconto em % se mantém.
 */
export function mudarQuantidadeOuValor(i: ItemDevolucao, qtd: number, valorUnit = i.valor_unitario): ItemDevolucao {
  const q = Math.max(0, i.maximo ? Math.min(qtd, i.maximo) : qtd);
  const novoTotal = r2(q * valorUnit);
  const prop = i.valor_total > 0 ? novoTotal / i.valor_total : 0;
  const ipiDev = r2(i.ipi_devolvido_valor * prop);
  return {
    ...i, quantidade: q, valor_unitario: valorUnit, valor_total: novoTotal,
    valor_desconto: i.desconto_percentual > 0 ? r2((novoTotal * i.desconto_percentual) / 100) : Math.min(i.valor_desconto, novoTotal),
    icms_base: r2(i.icms_base * prop),
    icms_valor: i.icms_aliquota > 0 ? calcularIcms(r2(i.icms_base * prop), i.icms_aliquota) : r2(i.icms_valor * prop),
    ipi_valor: r2(i.ipi_valor * prop), pis_valor: r2(i.pis_valor * prop), cofins_valor: r2(i.cofins_valor * prop),
    ipi_devolvido_valor: ipiDev,
    ipi_devolvido_percentual: i.maximo && i.maximo > 0 && i.ipi_devolvido_valor > 0 ? r2((q / i.maximo) * 100) : i.ipi_devolvido_percentual,
  };
}

/** Desconto em % ou em R$ — um calcula o outro, como nas duas colunas do Excellent. */
export function aplicarDesconto(i: ItemDevolucao, d: { percentual?: number; valor?: number }): ItemDevolucao {
  if (d.percentual != null) {
    const p = Math.min(100, Math.max(0, d.percentual));
    return { ...i, desconto_percentual: p, valor_desconto: r2((i.valor_total * p) / 100) };
  }
  const v = Math.min(i.valor_total, Math.max(0, d.valor ?? 0));
  return { ...i, valor_desconto: r2(v), desconto_percentual: i.valor_total > 0 ? Math.round((v / i.valor_total) * 1e6) / 1e4 : 0 };
}

/** Tela de tributação: base e alíquota recalculam o ICMS da operação. */
export function aplicarTributacao(i: ItemDevolucao, t: Partial<ItemDevolucao>): ItemDevolucao {
  const n = { ...i, ...t };
  n.icms_valor = n.icms_csosn === "900" ? calcularIcms(Number(n.icms_base) || 0, Number(n.icms_aliquota) || 0) : 0;
  if (n.icms_csosn !== "900") { n.icms_base = 0; n.icms_aliquota = 0; }
  n.ipi_devolvido_valor = r2(Math.max(0, Number(n.ipi_devolvido_valor) || 0));
  n.ipi_devolvido_percentual = Math.min(100, Math.max(0, Number(n.ipi_devolvido_percentual) || 0));
  return n;
}

/** Valor unitário com as casas decimais escolhidas (2 a 10, como no Excellent). */
export const arredondarUnit = (v: number, casas: number) => {
  const f = 10 ** Math.min(10, Math.max(2, casas));
  return Math.round(v * f) / f;
};

export interface Cabecalho { valor_frete: number; valor_seguro: number; outras_despesas: number; rateio_frete: "igual" | "por_produto" }

/** Totais da nota: o que o espelho e a SEFAZ vão somar. */
export function totais(itens: ItemDevolucao[], c: Cabecalho) {
  const soma = (f: (i: ItemDevolucao) => number) => r2(itens.reduce((s, i) => s + (Number(f(i)) || 0), 0));
  const produtos = soma((i) => i.valor_total);
  const desconto = soma((i) => i.valor_desconto);
  const frete = c.rateio_frete === "por_produto" ? soma((i) => i.valor_frete) : r2(c.valor_frete);
  const outras = c.rateio_frete === "por_produto" ? soma((i) => i.outras_despesas) : r2(c.outras_despesas);
  const seguro = r2(c.valor_seguro);
  const ipiDevolvido = soma((i) => i.ipi_devolvido_valor);
  const icms = soma((i) => i.icms_valor);
  return { produtos, desconto, frete, seguro, outras, ipiDevolvido, icms, total: r2(produtos - desconto + frete + seguro + outras + ipiDevolvido) };
}

/** O que falta no cadastro do fornecedor para a nota (o "Incompleto" do Excellent). */
export function faltasDoFornecedor(f: any): string[] {
  if (!f) return ["fornecedor"];
  const out: string[] = [];
  const doc = soDigitos(f.cpf_cnpj);
  if (doc.length !== 14 && doc.length !== 11) out.push("CNPJ");
  const e = f.endereco ?? {};
  if (!e.logradouro) out.push("rua");
  if (!(e.cidade || e.municipio)) out.push("cidade");
  if (!(e.uf || f.uf)) out.push("UF");
  if (!(f.codigo_municipio_ibge || e.codigo_municipio || e.codigo_ibge)) out.push("código IBGE da cidade");
  return out;
}

/** O que impede a emissão da NF-e de devolução, ou lista vazia. */
export function faltaParaEmitir(d: {
  finalidade?: number;
  chaves: string[];
  fornecedor?: any;
  itens: Pick<ItemDevolucao, "nome" | "cfop" | "quantidade" | "chave_nota_origem" | "ncm" | "item_nota_origem">[];
}): string[] {
  const f: string[] = [];
  const doForn = faltasDoFornecedor(d.fornecedor);
  if (doForn.length) f.push(`cadastro do fornecedor: ${doForn.join(", ")}`);
  const doc = soDigitos(d.fornecedor?.cpf_cnpj).padStart(14, "0");
  const devolucao = (d.finalidade ?? 4) === 4;
  const chaves = d.chaves.map(soDigitos).filter(Boolean);
  if (devolucao) {
    if (!chaves.length) f.push("número do DANFE (chave de 44 dígitos) da nota de entrada");
    for (const c of chaves) {
      if (c.length !== 44) f.push(`DANFE ${c.slice(0, 8)}… sem os 44 dígitos`);
      // a chave traz o CNPJ do emitente da compra (posições 7–20). A SEFAZ
      // exige o CNPJ INTEIRO igual ao do destinatário da devolução — outra
      // filial do mesmo fornecedor também é recusada (1194, teste de 11/10)
      else if (doForn.indexOf("CNPJ") < 0 && c.slice(6, 20) !== doc) f.push(`DANFE ${c.slice(25, 34)} foi emitido por outro CNPJ: a devolução vai para quem emitiu a nota de compra`);
    }
  }
  if (!d.itens.length) f.push("produtos");
  for (const i of d.itens) {
    if (!(i.quantidade > 0)) f.push(`quantidade de "${i.nome}"`);
    if (!/^[567]\d{3}$/.test(i.cfop)) f.push(`CFOP de saída em "${i.nome}"`);
    if (soDigitos(i.ncm).length !== 8) f.push(`NCM de "${i.nome}"`);
    if (devolucao && !chaves.includes(soDigitos(i.chave_nota_origem))) f.push(`nota de entrada de "${i.nome}"`);
    else if (devolucao && !(Number(i.item_nota_origem) > 0)) f.push(`nº do item na nota de entrada de "${i.nome}" (a linha dele no DANFE)`);
  }
  return f;
}

// ---------------- XML da nota de entrada ----------------

export interface ItemXml {
  n_item: number; codigo: string; ean: string | null; nome: string; ncm: string; cfop: string; unidade: string;
  quantidade: number; valor_unitario: number; valor_total: number; valor_desconto: number;
  origem: string; csosn: string | null; cst: string | null; icms_base: number; icms_aliquota: number; icms_valor: number;
  icms_st_valor: number; ipi_valor: number;
}
export interface NotaXml { chave: string; numero: string; emitente_cnpj: string; emitente_nome: string; itens: ItemXml[] }

const tag = (xml: string, nome: string): string | null => {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`));
  return m ? m[1].trim() : null;
};
const num = (s: string | null) => (s == null ? 0 : Number(s) || 0);
const desescapar = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** Lê o XML de uma NF-e (nfeProc ou NFe) — chave, número, emitente e itens com impostos. */
export function lerXmlNfe(xml: string): NotaXml {
  const inf = xml.match(/<(?:\w+:)?infNFe[^>]*\bId="NFe(\d{44})"/);
  if (!inf) throw new Error("o arquivo não é o XML de uma NF-e");
  const emit = tag(xml, "emit") ?? "";
  const ide = tag(xml, "ide") ?? "";
  const itens: ItemXml[] = [];
  const reDet = /<(?:\w+:)?det\s+nItem="(\d+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?det>/g;
  let m: RegExpExecArray | null;
  while ((m = reDet.exec(xml))) {
    const det = m[2];
    const prod = tag(det, "prod") ?? "";
    const icms = tag(det, "ICMS") ?? "";
    const ipiTrib = tag(tag(det, "IPI") ?? "", "IPITrib") ?? "";
    const ean = tag(prod, "cEAN");
    itens.push({
      n_item: Number(m[1]),
      codigo: tag(prod, "cProd") ?? "",
      ean: ean && /^\d{8,14}$/.test(ean) ? ean : null,
      nome: desescapar(tag(prod, "xProd") ?? ""),
      ncm: tag(prod, "NCM") ?? "",
      cfop: tag(prod, "CFOP") ?? "",
      unidade: tag(prod, "uCom") ?? "UN",
      quantidade: num(tag(prod, "qCom")),
      valor_unitario: num(tag(prod, "vUnCom")),
      valor_total: num(tag(prod, "vProd")),
      valor_desconto: num(tag(prod, "vDesc")),
      origem: tag(icms, "orig") ?? "0",
      csosn: tag(icms, "CSOSN"),
      cst: tag(icms, "CST"),
      icms_base: num(tag(icms, "vBC")),
      icms_aliquota: num(tag(icms, "pICMS")),
      icms_valor: num(tag(icms, "vICMS")),
      icms_st_valor: num(tag(icms, "vICMSST")),
      ipi_valor: num(tag(ipiTrib, "vIPI")),
    });
  }
  if (!itens.length) throw new Error("o XML não tem produtos");
  return {
    chave: inf[1], numero: tag(ide, "nNF") ?? "",
    emitente_cnpj: tag(emit, "CNPJ") ?? tag(emit, "CPF") ?? "",
    emitente_nome: desescapar(tag(emit, "xNome") ?? ""),
    itens,
  };
}

/** Acha o produto do catálogo para um item do XML: código de barras, depois código, depois nome. */
export function casarProduto(x: Pick<ItemXml, "ean" | "codigo" | "nome">, produtos: any[]): any | null {
  const norm = (s: any) => String(s ?? "").trim().toUpperCase();
  return (x.ean && produtos.find((p) => soDigitos(p.codigo_barras) === x.ean))
    || (x.codigo && produtos.find((p) => norm(p.sku) === norm(x.codigo) || norm(p.codigo_fornecedor) === norm(x.codigo)))
    || produtos.find((p) => norm(p.nome) === norm(x.nome))
    || null;
}

/** Item do XML → item da devolução (com os impostos da compra e o nº do item). */
export function itemDoXml(x: ItemXml, chave: string, cfop: string, produto: any | null): ItemDevolucao {
  return itemDaNotaEntrada({
    produto_id: produto?.id ?? null, nome: produto?.nome ?? x.nome, codigo_ean: x.ean ?? produto?.codigo_barras ?? null,
    ncm: x.ncm || produto?.ncm, unidade: x.unidade, quantidade: x.quantidade, valor_unitario: x.valor_unitario,
    valor_total: x.valor_total, icms_origem: x.origem, icms_csosn: x.csosn ?? "102",
    icms_aliquota: x.icms_aliquota, icms_valor: x.icms_valor, icms_st_valor: x.icms_st_valor,
    ipi_valor: x.ipi_valor, numero_item: x.n_item,
  }, cfop, chave);
}

// ============================================================
// Devolução a fornecedor — regras puras do item e do que falta para emitir.
//
// Pedido da loja (10/10/2026, vídeos 2 e 3): CFOP da operação escolhido
// ("às vezes muda"), quantidade e valor do que volta, tela de tributação
// por item (CFOP, origem, situação tributária, base, alíquota e ICMS da
// operação) e o espelho antes de subir para a Receita.
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
  icms_origem: string;
  icms_csosn: string;
  icms_base: number;
  icms_aliquota: number;
  icms_valor: number;
  ipi_valor: number;
  pis_valor: number;
  cofins_valor: number;
  /** nItem do produto na nota de compra (referência por item da NF-e) */
  item_nota_origem: number | null;
  /** quanto veio na nota de origem — o teto do que se pode devolver */
  maximo?: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** CFOP de devolução pela UF: 5xxx no mesmo estado, 6xxx fora. Com ST, 5411/6411. */
export function cfopDevolucao(ufLoja: string | null | undefined, ufFornecedor: string | null | undefined, comST = false): string {
  const mesma = !ufLoja || !ufFornecedor || ufLoja.toUpperCase() === ufFornecedor.toUpperCase();
  return cfopParaUf(comST ? "5411" : "5202", mesma);
}

/** Item da nota de entrada → item da devolução, com os impostos que vieram nela. */
export function itemDaNotaEntrada(i: any, cfop: string): ItemDevolucao {
  const q = Number(i.quantidade ?? 0);
  const total = Number(i.valor_total ?? 0);
  const aliq = Number(i.icms_aliquota ?? 0);
  const icms = Number(i.icms_valor ?? 0);
  return {
    produto_id: i.produto_id ?? null, nfe_item_id: i.id ?? null,
    nome: i.nome, codigo_ean: i.codigo_ean ?? null, ncm: i.ncm ?? null, unidade: i.unidade ?? "UN",
    cfop: Number(i.icms_st_valor ?? 0) > 0 ? cfopParaUf("5411", cfop.startsWith("5")) : cfop,
    quantidade: q, valor_unitario: Number(i.valor_unitario ?? 0), valor_total: total,
    icms_origem: String(i.icms_origem ?? "0"), icms_csosn: icms > 0 ? "900" : String(i.icms_csosn ?? "102"),
    // base da entrada: se veio ICMS, base = valor / alíquota; senão o valor do item
    icms_base: icms > 0 && aliq > 0 ? r2((icms * 100) / aliq) : (icms > 0 ? total : 0),
    icms_aliquota: aliq, icms_valor: icms,
    ipi_valor: Number(i.ipi_valor ?? 0), pis_valor: Number(i.pis_valor ?? 0), cofins_valor: Number(i.cofins_valor ?? 0),
    item_nota_origem: i.numero_item != null ? Number(i.numero_item) : null,
    maximo: q,
  };
}

/**
 * Mudou quantidade ou valor: refaz o total e leva os impostos na mesma
 * proporção (devolver metade da caixa devolve metade do ICMS que veio nela).
 */
export function mudarQuantidadeOuValor(i: ItemDevolucao, qtd: number, valorUnit = i.valor_unitario): ItemDevolucao {
  const q = Math.max(0, i.maximo ? Math.min(qtd, i.maximo) : qtd);
  const novoTotal = r2(q * valorUnit);
  const prop = i.valor_total > 0 ? novoTotal / i.valor_total : 0;
  return {
    ...i, quantidade: q, valor_unitario: valorUnit, valor_total: novoTotal,
    icms_base: r2(i.icms_base * prop),
    icms_valor: i.icms_aliquota > 0 ? calcularIcms(r2(i.icms_base * prop), i.icms_aliquota) : r2(i.icms_valor * prop),
    ipi_valor: r2(i.ipi_valor * prop), pis_valor: r2(i.pis_valor * prop), cofins_valor: r2(i.cofins_valor * prop),
  };
}

/** Tela de tributação: base e alíquota recalculam o ICMS da operação. */
export function aplicarTributacao(i: ItemDevolucao, t: Partial<Pick<ItemDevolucao, "cfop" | "icms_origem" | "icms_csosn" | "icms_base" | "icms_aliquota">>): ItemDevolucao {
  const n = { ...i, ...t };
  n.icms_valor = n.icms_csosn === "900" ? calcularIcms(Number(n.icms_base) || 0, Number(n.icms_aliquota) || 0) : 0;
  if (n.icms_csosn !== "900") { n.icms_base = 0; n.icms_aliquota = 0; }
  return n;
}

export const soDigitos = (s: string | null | undefined) => String(s ?? "").replace(/\D/g, "");

/** O que impede a emissão da NF-e de devolução, ou lista vazia. */
export function faltaParaEmitir(d: {
  chave_nota_origem?: string | null;
  fornecedor?: { cpf_cnpj?: string | null; endereco?: any; uf?: string | null; inscricao_estadual?: string | null } | null;
  itens: Pick<ItemDevolucao, "nome" | "cfop" | "quantidade" | "item_nota_origem" | "ncm">[];
}): string[] {
  const f: string[] = [];
  if (soDigitos(d.chave_nota_origem).length !== 44) f.push("chave de acesso (44 dígitos) da nota de compra");
  const doc = soDigitos(d.fornecedor?.cpf_cnpj);
  if (doc.length !== 14 && doc.length !== 11) f.push("CNPJ do fornecedor");
  const end = d.fornecedor?.endereco ?? {};
  if (!end?.logradouro || !(end?.cidade || end?.municipio) || !(end?.uf || d.fornecedor?.uf)) f.push("endereço do fornecedor (rua, cidade, UF)");
  if (!d.itens.length) f.push("itens");
  for (const i of d.itens) {
    if (!(i.quantidade > 0)) f.push(`quantidade de "${i.nome}"`);
    if (!/^[56]\d{3}$/.test(i.cfop)) f.push(`CFOP de saída em "${i.nome}"`);
    if (!(Number(i.item_nota_origem) > 0)) f.push(`nº do item na nota de compra para "${i.nome}"`);
    if (soDigitos(i.ncm).length !== 8) f.push(`NCM de "${i.nome}"`);
  }
  return f;
}

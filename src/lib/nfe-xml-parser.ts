// ============================================================
// Parser de XML de NFe (Nota Fiscal Eletrônica)
// Suporta NFe 4.00 conforme layout da SEFAZ
// ============================================================

import { XMLParser } from "fast-xml-parser";
import type { NFeParsed, NFeItem, NFeEmitente, NFeDuplicata } from "@/types/nfe";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Nunca converter valores de tag para number: CNPJ/CEP/cEAN/cProd
  // precisam permanecer string (preservando zeros à esquerda)
  parseTagValue: false,
  parseAttributeValue: true,
  trimValues: true,
  isArray: (_name, jpath) => {
    // Itens sempre como array
    if (jpath === "nfeProc.NFe.infNFe.det" || jpath === "NFe.infNFe.det") return true;
    return false;
  },
});

/**
 * Faz o parse do XML da NFe e retorna dados estruturados
 */
export function parseNFeXML(xmlContent: string): NFeParsed {
  if (!xmlContent || !xmlContent.trim()) {
    throw new Error("XML vazio");
  }

  const json = parser.parse(xmlContent);

  // Suportar tanto <nfeProc> quanto <NFe> direto
  const infNFe = json.nfeProc?.NFe?.infNFe ?? json.NFe?.infNFe;

  if (!infNFe) {
    throw new Error("XML inválido: tag infNFe não encontrada");
  }

  // Identificação
  const ide = infNFe.ide;
  if (!ide) throw new Error("XML inválido: tag ide não encontrada");

  // Emitente (fornecedor)
  const emit = infNFe.emit;
  if (!emit) throw new Error("XML inválido: tag emit não encontrada");

  // Totais
  const total = infNFe.total?.ICMSTot;
  if (!total) throw new Error("XML inválido: tag ICMSTot não encontrada");

  // Destinatário (opcional para NFe de entrada, geralmente é o cliente)
  const dest = infNFe.dest;

  // Chave de acesso (remove prefixo "NFe" do atributo Id)
  const chaveAcesso = (infNFe["@_Id"] ?? "").replace(/^NFe/, "");

  // Montar emitente
  const emitente: NFeEmitente = {
    cnpj: onlyDigits(emit.CNPJ ?? ""),
    cpf: emit.CPF ? onlyDigits(emit.CPF) : undefined,
    nome: emit.xNome ?? "",
    fantasia: emit.xFant,
    ie: emit.IE,
    endereco: emit.enderEmit
      ? {
          logradouro: emit.enderEmit.xLgr,
          numero: emit.enderEmit.nro,
          bairro: emit.enderEmit.xBairro,
          cidade: emit.enderEmit.xMun,
          uf: emit.enderEmit.UF,
          cep: emit.enderEmit.CEP ? onlyDigits(emit.enderEmit.CEP) : undefined,
        }
      : undefined,
  };

  // Montar destinatário
  const destinatario = dest
    ? {
        cnpj: dest.CNPJ ? onlyDigits(dest.CNPJ) : undefined,
        cpf: dest.CPF ? onlyDigits(dest.CPF) : undefined,
        nome: dest.xNome,
      }
    : undefined;

  // Montar itens
  if (!infNFe.det) {
    throw new Error("XML sem itens: tag det não encontrada");
  }
  const detArray = Array.isArray(infNFe.det) ? infNFe.det : [infNFe.det];
  const itens: NFeItem[] = detArray.map((det: any) => {
    const prod = det.prod;
    const imposto = det.imposto;

    // ICMS - pode ser várias situações (00, 20, 60, etc)
    const icmsGroup = imposto?.ICMS;
    const icmsEntry = icmsGroup
      ? Object.values(icmsGroup).find((v) => typeof v === "object")
      : null;

    // IPI
    const ipi = imposto?.IPI;
    const ipiTrib = ipi?.IPITrib ?? ipi?.IPINT ?? {};

    // PIS
    const pis = imposto?.PIS;
    const pisEntry = pis
      ? Object.values(pis).find((v) => typeof v === "object")
      : null;

    // COFINS
    const cofins = imposto?.COFINS;
    const cofinsEntry = cofins
      ? Object.values(cofins).find((v) => typeof v === "object")
      : null;

    return {
      numero_item: Number(det["@_nItem"] ?? 0),
      codigo_produto: String(prod.cProd ?? ""),
      codigo_ean:
        prod.cEAN == null || String(prod.cEAN) === "SEM GTIN"
          ? undefined
          : String(prod.cEAN),
      nome: prod.xProd ?? "",
      ncm: prod.NCM,
      cfop: prod.CFOP,
      unidade: prod.uCom,
      quantidade: Number(prod.qCom ?? 0),
      valor_unitario: Number(prod.vUnCom ?? 0),
      valor_total: Number(prod.vProd ?? 0),
      valor_desconto: Number(prod.vDesc ?? 0),
      valor_frete: Number(prod.vFrete ?? 0),
      icms_origem: (icmsEntry as any)?.orig,
      icms_csosn: (icmsEntry as any)?.CSOSN ?? (icmsEntry as any)?.CST,
      icms_aliquota: Number((icmsEntry as any)?.pICMS ?? 0),
      icms_valor: Number((icmsEntry as any)?.vICMS ?? 0),
      ipi_aliquota: Number(ipiTrib.pIPI ?? 0),
      ipi_valor: Number(ipiTrib.vIPI ?? 0),
      pis_valor: Number((pisEntry as any)?.vPIS ?? 0),
      cofins_valor: Number((cofinsEntry as any)?.vCOFINS ?? 0),
    };
  });

  // Cobrança: as duplicatas trazem o parcelamento real da nota (número,
  // vencimento e valor). É o que permite gerar contas a pagar corretas em
  // vez de chutar um prazo padrão.
  const cobrDup = (infNFe as any)?.cobr?.dup;
  const duplicatas: NFeDuplicata[] = (
    cobrDup ? (Array.isArray(cobrDup) ? cobrDup : [cobrDup]) : []
  )
    .filter(Boolean)
    .map((d: any) => ({
      numero: String(d.nDup ?? ""),
      vencimento: String(d.dVenc ?? "").slice(0, 10),
      valor: Number(d.vDup ?? 0),
    }))
    .filter((d: NFeDuplicata) => d.valor > 0);

  return {
    chave_acesso: chaveAcesso,
    numero: Number(ide.nNF ?? 0),
    serie: Number(ide.serie ?? 1),
    tipo: "nfe",
    data_emissao: ide.dhEmi ?? ide.dEmi ?? new Date().toISOString(),
    emitente,
    destinatario,
    valor_produtos: Number(total.vProd ?? 0),
    valor_frete: Number(total.vFrete ?? 0),
    valor_seguro: Number(total.vSeg ?? 0),
    valor_desconto: Number(total.vDesc ?? 0),
    valor_icms: Number(total.vICMS ?? 0),
    valor_ipi: Number(total.vIPI ?? 0),
    valor_pis: Number(total.vPIS ?? 0),
    valor_cofins: Number(total.vCOFINS ?? 0),
    valor_total: Number(total.vNF ?? 0),
    itens,
    duplicatas,
    xml_original: xmlContent,
  };
}

/**
 * Remove caracteres não numéricos
 */
function onlyDigits(str: unknown): string {
  return String(str ?? "").replace(/\D/g, "");
}

/**
 * Valida estrutura básica do XML de NFe
 */
export function isValidNFeXML(xmlContent: string): boolean {
  if (!xmlContent) return false;
  return (
    xmlContent.includes("<NFe") &&
    xmlContent.includes("<infNFe") &&
    xmlContent.includes("<emit>") &&
    xmlContent.includes("<ide>")
  );
}

/**
 * Formata CNPJ: 00.000.000/0000-00
 */
export function formatCNPJ(cnpj: unknown): string {
  const digits = onlyDigits(cnpj);
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/**
 * Formata CEP: 00000-000
 */
export function formatCEP(cep: unknown): string {
  const digits = onlyDigits(cep);
  return digits.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}
// ============================================================
// Tabelas fiscais usadas no cadastro do produto e nos itens da nota.
//
// Pedido da loja (10/10/2026): cadastro de tributos com regime fiscal,
// origem do produto, situação tributária, base de cálculo, alíquota e ICMS
// da operação. Antes o produto tinha 4 CFOPs e 4 CSOSNs fixos e a nota saía
// sempre com origem 0.
//
// Só entram CSOSNs que o emissor sabe montar. 201/202/203 (com substituição
// tributária) exigem MVA e ICMS-ST calculados e ficam de fora até isso
// existir — oferecer e a SEFAZ recusar seria pior que não oferecer.
// ============================================================

export const ORIGENS_MERCADORIA: { valor: number; rotulo: string }[] = [
  { valor: 0, rotulo: "0 — Nacional" },
  { valor: 1, rotulo: "1 — Estrangeira, importação direta" },
  { valor: 2, rotulo: "2 — Estrangeira, adquirida no mercado interno" },
  { valor: 3, rotulo: "3 — Nacional, conteúdo de importação > 40% e ≤ 70%" },
  { valor: 4, rotulo: "4 — Nacional, processos produtivos básicos" },
  { valor: 5, rotulo: "5 — Nacional, conteúdo de importação ≤ 40%" },
  { valor: 6, rotulo: "6 — Estrangeira, importação direta, sem similar (CAMEX)" },
  { valor: 7, rotulo: "7 — Estrangeira, mercado interno, sem similar (CAMEX)" },
  { valor: 8, rotulo: "8 — Nacional, conteúdo de importação > 70%" },
];

export const CSOSNS: { valor: string; rotulo: string; destaca: boolean; credito: boolean }[] = [
  { valor: "101", rotulo: "101 — Tributada com permissão de crédito", destaca: false, credito: true },
  { valor: "102", rotulo: "102 — Tributada sem permissão de crédito", destaca: false, credito: false },
  { valor: "103", rotulo: "103 — Isenção do ICMS para faixa de receita", destaca: false, credito: false },
  { valor: "300", rotulo: "300 — Imune", destaca: false, credito: false },
  { valor: "400", rotulo: "400 — Não tributada pelo Simples", destaca: false, credito: false },
  { valor: "500", rotulo: "500 — ICMS cobrado antes por ST ou antecipação", destaca: false, credito: false },
  { valor: "900", rotulo: "900 — Outros (com destaque de ICMS)", destaca: true, credito: false },
];

/** Regime tributário da loja (CRT da NF-e). */
export const REGIMES: { valor: number; rotulo: string; usaCst: boolean }[] = [
  { valor: 1, rotulo: "1 — Simples Nacional", usaCst: false },
  { valor: 2, rotulo: "2 — Simples Nacional, excesso de sublimite", usaCst: true },
  { valor: 3, rotulo: "3 — Regime normal (Lucro Presumido/Real)", usaCst: true },
  { valor: 4, rotulo: "4 — MEI", usaCst: false },
];

/**
 * CST do ICMS (regime normal). Mesma regra do CSOSN: só entra o que o
 * emissor monta — 10/20/30/51/70 pedem redução de base, diferimento ou
 * ICMS-ST calculados.
 */
export const CSTS_ICMS: { valor: string; rotulo: string; destaca: boolean }[] = [
  { valor: "00", rotulo: "00 — Tributada integralmente", destaca: true },
  { valor: "40", rotulo: "40 — Isenta", destaca: false },
  { valor: "41", rotulo: "41 — Não tributada", destaca: false },
  { valor: "50", rotulo: "50 — Suspensão", destaca: false },
  { valor: "60", rotulo: "60 — ICMS cobrado anteriormente por ST", destaca: false },
  { valor: "90", rotulo: "90 — Outras", destaca: false },
];

/** CST de PIS e de COFINS (mesma tabela). Vazio no produto = 49 no Simples. */
export const CSTS_PIS_COFINS: { valor: string; rotulo: string; aliquota: boolean }[] = [
  { valor: "01", rotulo: "01 — Tributável, alíquota básica", aliquota: true },
  { valor: "02", rotulo: "02 — Tributável, alíquota diferenciada", aliquota: true },
  { valor: "04", rotulo: "04 — Monofásica, revenda a alíquota zero", aliquota: false },
  { valor: "05", rotulo: "05 — Substituição tributária", aliquota: false },
  { valor: "06", rotulo: "06 — Alíquota zero", aliquota: false },
  { valor: "07", rotulo: "07 — Isenta", aliquota: false },
  { valor: "08", rotulo: "08 — Sem incidência", aliquota: false },
  { valor: "09", rotulo: "09 — Suspensão", aliquota: false },
  { valor: "49", rotulo: "49 — Outras operações de saída", aliquota: false },
  { valor: "99", rotulo: "99 — Outras operações", aliquota: false },
];

export const CFOPS: { valor: string; rotulo: string; grupo: string }[] = [
  { valor: "5102", rotulo: "5102 — Venda de mercadoria (no estado)", grupo: "Venda" },
  { valor: "6102", rotulo: "6102 — Venda de mercadoria (fora do estado)", grupo: "Venda" },
  { valor: "6108", rotulo: "6108 — Venda a não contribuinte (fora do estado)", grupo: "Venda" },
  { valor: "5405", rotulo: "5405 — Venda com ST (substituído, no estado)", grupo: "Venda" },
  { valor: "6404", rotulo: "6404 — Venda com ST já retido (fora do estado)", grupo: "Venda" },
  { valor: "5202", rotulo: "5202 — Devolução de compra para comercialização (no estado)", grupo: "Devolução a fornecedor" },
  { valor: "6202", rotulo: "6202 — Devolução de compra para comercialização (fora do estado)", grupo: "Devolução a fornecedor" },
  { valor: "5411", rotulo: "5411 — Devolução de compra com ST (no estado)", grupo: "Devolução a fornecedor" },
  { valor: "6411", rotulo: "6411 — Devolução de compra com ST (fora do estado)", grupo: "Devolução a fornecedor" },
  { valor: "5413", rotulo: "5413 — Devolução de mercadoria destinada ao uso/consumo (no estado)", grupo: "Devolução a fornecedor" },
  { valor: "6413", rotulo: "6413 — Devolução de mercadoria destinada ao uso/consumo (fora do estado)", grupo: "Devolução a fornecedor" },
  { valor: "5152", rotulo: "5152 — Transferência entre filiais (no estado)", grupo: "Transferência" },
  { valor: "6152", rotulo: "6152 — Transferência entre filiais (fora do estado)", grupo: "Transferência" },
  { valor: "5949", rotulo: "5949 — Outra saída não especificada (no estado)", grupo: "Outras" },
  { valor: "6949", rotulo: "6949 — Outra saída não especificada (fora do estado)", grupo: "Outras" },
];

export const csosnInfo = (c: string | null | undefined) => CSOSNS.find((x) => x.valor === c) ?? null;

/** CFOP de devolução a fornecedor equivalente quando a operação muda de UF. */
export function cfopParaUf(cfop: string, mesmaUf: boolean): string {
  if (!/^[56]\d{3}$/.test(cfop)) return cfop;
  return (mesmaUf ? "5" : "6") + cfop.slice(1);
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** ICMS da operação: base × alíquota, em centavos. */
export function calcularIcms(base: number, aliquota: number): number {
  if (!(base > 0) || !(aliquota > 0)) return 0;
  return r2((base * aliquota) / 100);
}

/** Crédito do Simples (CSOSN 101): valor do item × alíquota de crédito. */
export function creditoSimples(valor: number, aliquota: number): number {
  return calcularIcms(valor, aliquota);
}

/** O que falta no produto para a nota sair, ou null. */
export function faltaNoTributoDoProduto(p: {
  csosn?: string | null; icms?: number | string | null; aliquota_credito_sn?: number | string | null;
  cst_icms?: string | null; cst_pis?: string | null; pis?: number | string | null;
  cst_cofins?: string | null; cofins?: number | string | null;
}): string | null {
  const c = csosnInfo(p.csosn ?? "102");
  if (!c) return `CSOSN ${p.csosn} não é suportado pelo emissor`;
  if (c.credito && !(Number(p.aliquota_credito_sn) > 0)) return "CSOSN 101 exige a alíquota de crédito do Simples";
  if (c.destaca && !(Number(p.icms) > 0)) return "CSOSN 900 com destaque exige a alíquota do ICMS";
  if (p.cst_icms) {
    const s = CSTS_ICMS.find((x) => x.valor === p.cst_icms);
    if (!s) return `CST ${p.cst_icms} do ICMS não é suportado pelo emissor`;
    if (s.destaca && !(Number(p.icms) > 0)) return "CST 00 exige a alíquota do ICMS";
  }
  for (const [nome, cst, aliq] of [["PIS", p.cst_pis, p.pis], ["COFINS", p.cst_cofins, p.cofins]] as const) {
    if (!cst) continue;
    const s = CSTS_PIS_COFINS.find((x) => x.valor === cst);
    if (!s) return `CST ${cst} de ${nome} não é suportado pelo emissor`;
    if (s.aliquota && !(Number(aliq) > 0)) return `${nome} com CST ${cst} exige a alíquota`;
  }
  return null;
}

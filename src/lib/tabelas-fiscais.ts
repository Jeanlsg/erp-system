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
export function faltaNoTributoDoProduto(p: { csosn?: string | null; icms?: number | string | null; aliquota_credito_sn?: number | string | null }): string | null {
  const c = csosnInfo(p.csosn ?? "102");
  if (!c) return `CSOSN ${p.csosn} não é suportado pelo emissor`;
  if (c.credito && !(Number(p.aliquota_credito_sn) > 0)) return "CSOSN 101 exige a alíquota de crédito do Simples";
  if (c.destaca && !(Number(p.icms) > 0)) return "CSOSN 900 com destaque exige a alíquota do ICMS";
  return null;
}

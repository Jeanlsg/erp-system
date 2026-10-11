// Formatação de números e moedas (pt-BR)

export function brl(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function num(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "0";
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function pct(value: number | null | undefined, digits = 1): string {
  if (value == null || isNaN(value)) return "0%";
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * "aaaa-mm-dd" (coluna date, sem hora) é o dia do calendário: new Date()
 * lê como meia-noite UTC e, no Brasil (UTC-3), mostrava o DIA ANTERIOR —
 * validade do certificado 08/05 aparecia 07/05, vencimento de conta um dia
 * antes (11/10/2026). Datas sem hora são lidas no fuso local.
 */
export function dataDoTexto(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}

export function date(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? dataDoTexto(value) : value;
  return d.toLocaleDateString("pt-BR");
}

export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("pt-BR");
}
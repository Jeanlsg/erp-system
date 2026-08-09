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

export function date(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("pt-BR");
}

export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("pt-BR");
}
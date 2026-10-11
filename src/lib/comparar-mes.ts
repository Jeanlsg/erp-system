// ============================================================
// Mês corrente contra o anterior, para os cartões da Página Inicial.
//
// O Excellent comparava o mês em andamento com o mês anterior INTEIRO: no
// dia 11 tudo aparecia ~60% abaixo, mesmo vendendo igual. Aqui a comparação é
// com os mesmos dias do mês anterior (1 a 11 contra 1 a 11); se o mês
// anterior é mais curto (31/03 → fevereiro), para no último dia dele.
// ============================================================

export type PeriodosDoMes = { de: string; ate: string; deAnterior: string; ateAnterior: string };

const dia = (d: Date) => d.toLocaleDateString("sv-SE");

export function periodosDoMes(hoje = new Date()): PeriodosDoMes {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const ultimoDoAnterior = new Date(ano, mes, 0).getDate();
  return {
    de: dia(new Date(ano, mes, 1)),
    ate: dia(hoje),
    deAnterior: dia(new Date(ano, mes - 1, 1)),
    ateAnterior: dia(new Date(ano, mes - 1, Math.min(hoje.getDate(), ultimoDoAnterior))),
  };
}

/** Variação em fração (0.12 = +12%); null quando não há base para comparar. */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return (atual - anterior) / Math.abs(anterior);
}

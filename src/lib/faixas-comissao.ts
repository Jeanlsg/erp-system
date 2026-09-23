/**
 * Faixas de comissão de serviço (migration 097).
 *
 * O total de serviços que o funcionário vendeu no mês define a faixa, e o
 * percentual dela vale para todos os serviços do mês. Quem calcula de verdade
 * é o banco (erp.pct_faixa_servico); aqui ficam a validação do que o
 * administrador digita e a prévia mostrada no editor, pela mesma regra.
 */

export type Faixa = { venda_minima: number; percentual: number };

/** Percentual da faixa atingida com este total; 0 abaixo da primeira. */
export function faixaAtingida(faixas: Faixa[], total: number): number {
  const alcancadas = faixas.filter((f) => f.venda_minima <= total);
  if (alcancadas.length === 0) return 0;
  return alcancadas.reduce((a, b) => (b.venda_minima > a.venda_minima ? b : a)).percentual;
}

/** A próxima faixa acima do total, e quanto falta para ela. */
export function proximaFaixa(faixas: Faixa[], total: number): (Faixa & { falta: number }) | null {
  const acima = faixas.filter((f) => f.venda_minima > total)
    .sort((a, b) => a.venda_minima - b.venda_minima);
  if (acima.length === 0) return null;
  return { ...acima[0], falta: Math.round((acima[0].venda_minima - total) * 100) / 100 };
}

/**
 * O que impede salvar. Lista vazia = pode salvar.
 *
 * Duas faixas com o mesmo "a partir de" deixariam o banco sem saber qual vale
 * (e ele recusa). Percentual que cai quando a venda sobe não é proibido —
 * pode ser de propósito —, mas quase sempre é erro de digitação, então vira
 * aviso separado.
 */
export function validarFaixas(faixas: Faixa[]): { erros: string[]; avisos: string[] } {
  const erros: string[] = [];
  const avisos: string[] = [];
  for (const f of faixas) {
    if (!Number.isFinite(f.venda_minima) || f.venda_minima < 0) erros.push("Valor de venda inválido numa faixa.");
    if (!Number.isFinite(f.percentual) || f.percentual < 0 || f.percentual > 100) erros.push("Percentual deve ficar entre 0 e 100.");
  }
  const valores = faixas.map((f) => f.venda_minima);
  if (new Set(valores).size !== valores.length) erros.push("Duas faixas começam no mesmo valor de venda.");

  const ordenadas = [...faixas].sort((a, b) => a.venda_minima - b.venda_minima);
  for (let i = 1; i < ordenadas.length; i++) {
    if (ordenadas[i].percentual < ordenadas[i - 1].percentual) {
      avisos.push("Uma faixa maior tem percentual menor que a anterior — confira se é isso mesmo.");
      break;
    }
  }
  if (ordenadas.length > 0 && ordenadas[0].venda_minima > 0) {
    avisos.push(`Abaixo de ${ordenadas[0].venda_minima.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em serviços no mês, a comissão de serviço é zero.`);
  }
  return { erros: [...new Set(erros)], avisos };
}

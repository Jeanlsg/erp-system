/**
 * Comissão dinâmica: faixas de comissão sobre vendas (migration 107) e de
 * serviço (097).
 *
 * O total que o funcionário vendeu no mês define a faixa, e o percentual dela
 * vale para tudo o que ele vendeu no mês. Quem calcula de verdade é o banco
 * (erp.pct_faixa_venda / erp.pct_faixa_servico); aqui ficam a validação do que
 * o administrador digita, a prévia do editor e a escada do relatório, pela
 * mesma regra.
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

export type DegrauFaixa = Faixa & {
  /** o total do mês já passou do "a partir de" */
  alcancada: boolean;
  /** é a faixa que vale agora */
  atual: boolean;
  /**
   * Comissão do mês nesta faixa: sobre o que já vendeu, se alcançada; sobre
   * o mínimo dela, se ainda não — o mínimo que ele leva ao chegar lá.
   */
  comissao: number;
};

/** Escada das faixas, da menor para a maior, com a comissão do mês em cada uma. */
export function escadaFaixas(faixas: Faixa[], total: number): DegrauFaixa[] {
  const alcancadas = faixas.filter((f) => f.venda_minima <= total);
  const minimaAtual = alcancadas.length ? Math.max(...alcancadas.map((f) => f.venda_minima)) : null;
  return [...faixas]
    .sort((a, b) => a.venda_minima - b.venda_minima)
    .map((f) => {
      const alcancada = f.venda_minima <= total;
      const base = alcancada ? total : f.venda_minima;
      return {
        ...f,
        alcancada,
        atual: f.venda_minima === minimaAtual,
        comissao: Math.round(base * f.percentual) / 100,
      };
    });
}

/** "5% a 10% · 3 faixas" — para a lista de funcionários. */
export function resumoFaixas(faixas: Faixa[]): string {
  if (faixas.length === 0) return "";
  const pcts = faixas.map((f) => f.percentual);
  const menor = Math.min(...pcts), maior = Math.max(...pcts);
  const fmt = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  const faixa = menor === maior ? fmt(menor) : `${fmt(menor)} a ${fmt(maior)}`;
  return `${faixa} · ${faixas.length} ${faixas.length === 1 ? "faixa" : "faixas"}`;
}

/**
 * O que impede salvar. Lista vazia = pode salvar.
 *
 * Duas faixas com o mesmo "a partir de" deixariam o banco sem saber qual vale
 * (e ele recusa). Percentual que cai quando a venda sobe não é proibido —
 * pode ser de propósito —, mas quase sempre é erro de digitação, então vira
 * aviso separado.
 *
 * @param unidade "em vendas", "em serviços" — entra no aviso de comissão zero
 */
export function validarFaixas(faixas: Faixa[], unidade = "em vendas"): { erros: string[]; avisos: string[] } {
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
  // ⚠️ dizia "em serviços" também nas faixas sobre vendas
  if (ordenadas.length > 0 && ordenadas[0].venda_minima > 0) {
    avisos.push(`Abaixo de ${ordenadas[0].venda_minima.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ${unidade} no mês, a comissão é zero.`);
  }
  return { erros: [...new Set(erros)], avisos };
}

/** As faixas digitadas são as mesmas que estão gravadas? (ordem não importa) */
export function mesmasFaixas(a: Faixa[], b: Faixa[]): boolean {
  const chave = (l: Faixa[]) => JSON.stringify([...l]
    .map((f) => [Number(f.venda_minima), Number(f.percentual)])
    .sort((x, y) => x[0] - y[0]));
  return chave(a) === chave(b);
}

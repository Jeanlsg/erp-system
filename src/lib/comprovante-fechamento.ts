// ============================================================
// Comprovante de fechamento de caixa — bobina térmica 80 mm.
//
// Sai sozinho quando o caixa fecha, como no sistema anterior da loja: o
// operador assina e entrega ao gerente. Conferência que depende de alguém
// lembrar de abrir um relatório depois não acontece no fim do expediente.
//
// Segue a mesma receita das etiquetas (window.open + @page + print): a
// impressora térmica é instalada como impressora comum do Windows, então
// quem pagina é o navegador. Largura útil 72 mm dentro dos 80 mm da
// bobina, com 4 mm de margem de cada lado.
// ============================================================

import { brl } from "@/lib/format";

export type LinhaComprovante = { rotulo: string; valor: number | string; destaque?: boolean };

export interface DadosComprovante {
  loja: string;
  caixaNome: string;
  aberturaEm: string | null;
  fechamentoEm: string | null;
  operadorAbertura: string;
  operadorFechamento: string;
  valorInicial: number;
  vendasDinheiro: number;
  entradas: number;
  sangrias: number;
  esperado: number;
  informado: number;
  /** o que foi declarado em cada forma */
  formas: { nome: string; valor: number }[];
  /** movimentos que compõem sangrias e entradas */
  movimentos?: { tipo: "sangria" | "entrada"; descricao: string; valor: number; forma?: string }[];
  observacoes?: string | null;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

const dataHora = (v: string | null) =>
  v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

function linha(rotulo: string, valor: string, classe = "") {
  return `<div class="l ${classe}"><span>${esc(rotulo)}</span><span>${esc(valor)}</span></div>`;
}

export function montarComprovante(d: DadosComprovante): string {
  const diferenca = d.informado - d.esperado;
  // O dinheiro contado é a única forma que se confere na gaveta; PIX e
  // cartão saem numa seção à parte, senão o comprovante mostraria "total
  // informado" ao lado de formas que somam bem mais e ninguém entende qual
  // número olhar.
  const outras = d.formas.filter((f) => !/dinheiro/i.test(f.nome) && f.valor > 0);
  const temMovimentos = (d.movimentos ?? []).length > 0;

  // Só dinheiro vivo entra na conta da gaveta; cartão e PIX aparecem à
  // parte porque se conferem no extrato, não na contagem.
  const corpo = `
  <div class="tit">FECHAMENTO DE CAIXA</div>
  <div class="sub">${esc(d.loja)}</div>
  <div class="hr"></div>

  ${linha("Caixa", d.caixaNome)}
  ${linha("Abertura", dataHora(d.aberturaEm))}
  ${linha("Abriu", d.operadorAbertura)}
  ${linha("Fechamento", dataHora(d.fechamentoEm))}
  ${linha("Fechou", d.operadorFechamento)}
  <div class="hr"></div>

  <div class="secao">DINHEIRO NA GAVETA</div>
  ${linha("Saldo inicial (troco)", brl(d.valorInicial))}
  ${linha("Vendas em dinheiro", "+ " + brl(d.vendasDinheiro))}
  ${linha("Entradas extras", "+ " + brl(d.entradas))}
  ${linha("Sangrias", "- " + brl(d.sangrias))}
  ${linha("ESPERADO", brl(d.esperado), "forte")}
  <div class="hr"></div>

  <div class="secao">CONTADO NA GAVETA</div>
  ${linha("Informado pelo operador", brl(d.informado), "forte")}
  ${linha("Diferença", (diferenca > 0 ? "+ " : "") + brl(diferenca),
          Math.abs(diferenca) < 0.01 ? "ok" : "alerta")}
  ${Math.abs(diferenca) >= 0.01
      ? `<div class="nota">${diferenca > 0 ? "Sobra" : "Falta"} de ${esc(brl(Math.abs(diferenca)))} na gaveta.</div>`
      : `<div class="nota">Gaveta confere.</div>`}

  ${outras.length ? `<div class="hr"></div>
  <div class="secao">NÃO PASSA PELA GAVETA</div>
  ${outras.map((f) => linha(f.nome, brl(f.valor))).join("")}
  ${linha("Soma", brl(outras.reduce((t, f) => t + f.valor, 0)), "forte")}
  <div class="nota">Confira no extrato e na maquininha.</div>` : ""}

  ${temMovimentos ? `<div class="hr"></div><div class="secao">MOVIMENTOS</div>
    ${(d.movimentos ?? []).map((m) =>
      linha(`${m.tipo === "sangria" ? "-" : "+"} ${m.descricao}${m.forma && m.forma !== "dinheiro" ? ` (${m.forma})` : ""}`,
            brl(m.valor))).join("")}` : ""}

  ${d.observacoes ? `<div class="hr"></div><div class="obs">Obs.: ${esc(d.observacoes)}</div>` : ""}

  <div class="hr"></div>
  <div class="assin">
    <div class="linha-assin"></div>
    <div class="nome-assin">${esc(d.operadorFechamento)}</div>
    <div class="nome-assin">Operador do caixa</div>
  </div>
  <div class="rodape">Emitido em ${esc(new Date().toLocaleString("pt-BR"))}</div>`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Fechamento de caixa</title>
<style>
  /* 80 mm de bobina, 72 mm úteis. altura automática: a térmica corta no fim */
  @page { size: 80mm auto; margin: 0; }
  body { width: 72mm; margin: 0 4mm; font-family: "Courier New", monospace;
         font-size: 9pt; line-height: 1.35; color: #000; }
  .tit { text-align: center; font-size: 11pt; font-weight: bold; margin-top: 4mm; }
  .sub { text-align: center; font-size: 9pt; margin-bottom: 1mm; }
  .hr { border-top: 1px dashed #000; margin: 1.5mm 0; }
  .secao { font-weight: bold; font-size: 8.5pt; margin: 1mm 0 0.5mm; }
  .l { display: flex; justify-content: space-between; gap: 2mm; }
  .l span:last-child { white-space: nowrap; }
  .forte { font-weight: bold; font-size: 10pt; }
  .alerta { font-weight: bold; }
  .ok { font-weight: bold; }
  .nota { font-size: 8pt; text-align: center; margin: 0.5mm 0; }
  .obs { font-size: 8pt; }
  .assin { margin-top: 6mm; text-align: center; }
  .linha-assin { border-top: 1px solid #000; margin: 0 6mm; }
  .nome-assin { font-size: 8pt; }
  .rodape { margin: 3mm 0 6mm; text-align: center; font-size: 7.5pt; }
</style></head><body>${corpo}
<script>window.onload = function () { window.print(); };</script>
</body></html>`;
}

/** Abre a janela de impressão com o comprovante já montado. */
export function imprimirComprovante(d: DadosComprovante) {
  const w = window.open("", "_blank", "width=420,height=760");
  if (!w) return false;   // bloqueador de pop-up
  w.document.write(montarComprovante(d));
  w.document.close();
  return true;
}

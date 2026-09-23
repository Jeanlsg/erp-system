// ============================================================
// Comprovante de fechamento de caixa — bobina térmica 80 mm.
//
// Sai sozinho quando o caixa fecha, como no sistema anterior da loja: o
// operador assina e entrega ao gerente. Conferência que depende de alguém
// lembrar de abrir um relatório depois não acontece no fim do expediente.
//
// O formato segue o comprovante do Excellent (Fechamento Caixa - 3931810),
// que a equipe já sabe ler: cabeçalho da loja, entradas separadas por
// origem e por forma, saídas, e os totais com a fórmula embaixo.
//
// UMA diferença proposital. Lá o "Saldo" compara o informado com o VALOR
// NO CAIXA, que inclui cartão e PIX. No comprovante real da X-Life isso
// imprimiu "Saldo: -R$ 5.684,00" num caixa que bateu exato: o operador
// contou R$ 76,95 e o esperado em espécie era R$ 76,95. Um caixa certo
// saindo com quase seis mil de rombo no papel ensina a ignorar o número.
// Aqui a diferença é contra o dinheiro em espécie; o valor no caixa
// aparece como informação.
//
// Mesma receita das etiquetas (window.open + @page + print): a térmica é
// instalada como impressora comum do Windows, e quem pagina é o navegador.
// ============================================================

import { brl } from "@/lib/format";
import type { DadosFechamento } from "@/lib/dados-fechamento";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

const data = (v: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
const hora = (v: string | null) =>
  v ? new Date(v).toLocaleTimeString("pt-BR", { hour12: false }) : "—";

const linha = (rotulo: string, valor: string, classe = "") =>
  `<div class="l ${classe}"><span>${esc(rotulo)}</span><span>${esc(valor)}</span></div>`;

const secao = (t: string) => `<div class="secao">${esc(t)}</div>`;
const formula = (t: string) => `<div class="formula">(${esc(t)})</div>`;
const totalDe = (v: number) => `<div class="tracos">------------------</div>${linha("Total:", brl(v), "forte")}`;

export function montarComprovante(d: DadosFechamento): string {
  const diferenca = d.informado - d.valorEmEspecie;
  const totalExtras = d.entradasExtras.reduce((t, e) => t + e.valor, 0);
  const totalVendas = d.vendasPorForma.reduce((t, v) => t + v.valor, 0);

  const corpo = `
  <div class="empresa">${esc(d.loja.nome)}</div>
  ${d.loja.endereco ? `<div class="empresa-sub">${esc(d.loja.endereco)}</div>` : ""}
  ${d.loja.cidadeUf ? `<div class="empresa-sub">${esc(d.loja.cidadeUf)}</div>` : ""}

  <div class="tit">FECHAMENTO DE CAIXA</div>

  ${linha("Abertura:", `${data(d.aberturaEm)}  ${hora(d.aberturaEm)}`)}
  ${linha("Fechamento:", `${data(d.fechamentoEm)}  ${hora(d.fechamentoEm)}`)}
  ${linha("Caixa:", d.caixaNome)}
  ${d.operadorFechamento !== d.operadorAbertura ? linha("Fechou:", d.operadorFechamento) : ""}
  ${linha("Saldo inicial:", brl(d.valorInicial), "forte")}

  ${d.entradasExtras.length ? `${secao("ENTRADAS — EXTRAS")}
    ${d.entradasExtras.map((e) => linha(e.forma + ":", brl(e.valor))).join("")}
    ${totalDe(totalExtras)}` : ""}

  ${secao("ENTRADAS — VENDAS")}
  ${d.vendasPorForma.length
      ? d.vendasPorForma.map((v) => linha(v.forma + ":", brl(v.valor))).join("")
      : `<div class="vazio">nenhuma venda neste turno</div>`}
  ${totalDe(totalVendas)}
  ${linha("Total:", brl(d.valorInicial + totalVendas + totalExtras), "forte")}
  ${formula("Saldo inicial + total de todas as entradas")}

  ${secao("VENDAS CANCELADAS")}
  ${linha(`Canceladas: ${String(d.vendasCanceladas.quantidade).padStart(4, "0")}`, brl(d.vendasCanceladas.valor))}

  ${secao("DEVOLUÇÃO")}
  ${linha(`Devoluções: ${String(d.devolucoes.quantidade).padStart(4, "0")}`, brl(d.devolucoes.valor))}

  ${secao("SAÍDAS")}
  ${linha(`Sangria: ${String(d.sangrias.quantidade).padStart(4, "0")}`, brl(d.sangrias.valor))}
  ${d.sangrias.valor !== d.sangrias.emDinheiro
      ? `${linha("  em dinheiro:", brl(d.sangrias.emDinheiro))}
         <div class="nota-peq">o que saiu por PIX ou transferência não muda a gaveta</div>` : ""}
  ${linha("Total desconto venda:", brl(d.descontoTotal))}

  <div class="hr"></div>
  ${linha("VALOR EM ESPÉCIE:", brl(d.valorEmEspecie), "forte")}
  ${formula("dinheiro + entrada extra + saldo inicial − sangria")}

  ${linha("Valor no caixa:", brl(d.valorNoCaixa))}
  ${formula("todas as formas, inclusive cartão e PIX")}

  ${linha("Informado no fechamento:", brl(d.informado), "forte")}
  ${linha("Diferença:", (diferenca > 0 ? "+ " : "") + brl(diferenca),
          Math.abs(diferenca) < 0.01 ? "" : "alerta")}
  ${formula("informado − valor em espécie")}
  <div class="nota">${Math.abs(diferenca) < 0.01
      ? "Gaveta confere."
      : `${diferenca > 0 ? "Sobra" : "Falta"} de ${esc(brl(Math.abs(diferenca)))} na gaveta.`}</div>

  ${linha("Taxa de entrega:", brl(d.taxaEntrega))}
  ${formula("não entra no cálculo do saldo")}

  ${d.observacoes ? `<div class="hr"></div><div class="obs">Obs.: ${esc(d.observacoes)}</div>` : ""}

  <div class="hr"></div>
  <div class="ident">IDENTIFICAÇÃO DE FECHAMENTO: ${esc(d.identificacao)}</div>

  <div class="assin">
    <div class="linha-assin"></div>
    <div class="nome-assin">${esc(d.operadorFechamento)}</div>
    <div class="nome-assin">Operador do caixa</div>
  </div>
  <div class="rodape">Emitido em ${esc(new Date().toLocaleString("pt-BR"))}</div>`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Fechamento de caixa ${esc(d.identificacao)}</title>
<style>
  /* 80 mm de bobina, 72 mm úteis. altura automática: a térmica corta no fim */
  @page { size: 80mm auto; margin: 0; }
  body { width: 72mm; margin: 0 4mm; font-family: "Courier New", monospace;
         font-size: 9pt; line-height: 1.3; color: #000; }
  .empresa { text-align: center; font-weight: bold; margin-top: 4mm; font-size: 9.5pt; }
  .empresa-sub { text-align: center; font-size: 8pt; }
  .tit { text-align: center; font-weight: bold; font-size: 10.5pt; margin: 2.5mm 0 1.5mm; }
  .secao { text-align: center; font-weight: bold; font-size: 8.5pt;
           margin: 2mm 0 0.8mm; letter-spacing: 0.3mm; }
  .l { display: flex; justify-content: space-between; gap: 2mm; }
  .l span:last-child { white-space: nowrap; }
  .forte { font-weight: bold; }
  .alerta { font-weight: bold; }
  .tracos { text-align: right; letter-spacing: -0.3mm; }
  .formula { text-align: right; font-size: 7pt; font-style: italic; margin-bottom: 0.8mm; }
  .nota { text-align: center; font-size: 8pt; margin: 0.8mm 0; }
  .nota-peq { text-align: right; font-size: 7pt; font-style: italic; }
  .vazio { text-align: center; font-size: 8pt; font-style: italic; }
  .hr { border-top: 1px dashed #000; margin: 1.5mm 0; }
  .obs { font-size: 8pt; }
  .ident { text-align: center; font-weight: bold; font-size: 8.5pt; margin: 1.5mm 0; }
  .assin { margin-top: 7mm; text-align: center; }
  .linha-assin { border-top: 1px solid #000; margin: 0 6mm; }
  .nome-assin { font-size: 8pt; }
  .rodape { margin: 3mm 0 7mm; text-align: center; font-size: 7.5pt; }
</style></head><body>${corpo}
<script>window.onload = function () { window.print(); };</script>
</body></html>`;
}

/** Abre a janela de impressão com o comprovante já montado. */
export function imprimirComprovante(d: DadosFechamento) {
  const w = window.open("", "_blank", "width=420,height=820");
  if (!w) return false;   // bloqueador de pop-up
  w.document.write(montarComprovante(d));
  w.document.close();
  return true;
}

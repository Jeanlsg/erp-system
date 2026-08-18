// ============================================================
// Impressão de etiquetas de gôndola/prateleira
//
// O EAN-13 é desenhado como SVG aqui mesmo — a codificação é uma tabela
// fixa de 10 dígitos × 3 conjuntos (L/G/R), não precisa de biblioteca.
// Código de barras que não lê no leitor é pior que não ter etiqueta,
// então códigos que não fecham o dígito verificador saem SEM barras,
// só com o texto — o erro fica visível em vez de virar bipe falhado.
// ============================================================

const L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
const R = L.map((p) => p.split("").map((b) => (b === "0" ? "1" : "0")).join(""));
// Paridade do primeiro dígito define quais conjuntos codificam os 6 seguintes
const PARIDADE = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

function digitoVerificador(d12: string): number {
  let soma = 0;
  for (let i = 0; i < 12; i++) soma += Number(d12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (soma % 10)) % 10;
}

/** Módulos (barras 0/1) de um EAN-13 válido, ou null se o código não fecha. */
function modulosEan13(codigo: string): string | null {
  const so = codigo.replace(/\D/g, "");
  let d13: string;
  if (so.length === 13) {
    if (digitoVerificador(so.slice(0, 12)) !== Number(so[12])) return null;
    d13 = so;
  } else if (so.length === 12) {
    d13 = so + digitoVerificador(so);
  } else {
    return null;
  }
  const par = PARIDADE[Number(d13[0])];
  let m = "101"; // guarda inicial
  for (let i = 1; i <= 6; i++) m += (par[i - 1] === "L" ? L : G)[Number(d13[i])];
  m += "01010"; // separador central
  for (let i = 7; i <= 12; i++) m += R[Number(d13[i])];
  return m + "101"; // guarda final
}

function svgEan13(codigo: string, largura = 37, altura = 18): string | null {
  const m = modulosEan13(codigo);
  if (!m) return null;
  const mod = largura / m.length;
  let barras = "";
  for (let i = 0; i < m.length; i++) {
    if (m[i] === "1") barras += `<rect x="${(i * mod).toFixed(3)}" y="0" width="${mod.toFixed(3)}" height="${altura}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}mm" height="${altura}mm" viewBox="0 0 ${largura} ${altura}" shape-rendering="crispEdges">${barras}</svg>`;
}

export interface ProdutoEtiqueta {
  nome: string;
  sku?: string | null;
  codigo_barras?: string | null;
  preco_venda: number | string;
}

const brl = (v: number | string) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const escapa = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Abre a janela de impressão com uma etiqueta por produto. */
export function imprimirEtiquetas(produtos: ProdutoEtiqueta[]): { total: number; semBarras: number } {
  let semBarras = 0;
  const etiquetas = produtos.map((p) => {
    const svg = p.codigo_barras ? svgEan13(p.codigo_barras) : null;
    if (!svg && p.codigo_barras) semBarras++;
    return `<div class="et">
      <div class="nome">${escapa(p.nome)}</div>
      <div class="preco">${brl(p.preco_venda)}</div>
      ${svg ?? ""}
      <div class="cod">${escapa(p.codigo_barras || p.sku || "")}</div>
    </div>`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas</title>
<style>
  @page { margin: 8mm; }
  body { font-family: Arial, sans-serif; display: flex; flex-wrap: wrap; gap: 3mm; margin: 0; }
  .et { width: 48mm; border: 0.2mm solid #999; padding: 2mm; text-align: center;
        page-break-inside: avoid; overflow: hidden; }
  .nome { font-size: 8pt; line-height: 1.15; height: 8.5mm; overflow: hidden; }
  .preco { font-size: 14pt; font-weight: bold; margin: 1mm 0; }
  .cod { font-size: 7pt; letter-spacing: 0.5mm; font-family: monospace; }
  svg { display: block; margin: 0 auto; }
</style></head><body>${etiquetas}
<script>window.onload = function () { window.print(); };</script>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (w) { w.document.write(html); w.document.close(); }
  return { total: produtos.length, semBarras };
}

// ============================================================
// Relatório mensal das notas para a contadora — regras puras.
//
// Pedido da loja (10/10/2026): "seleciona o período, o mês; ele puxa todas
// as notas que subiram para a Receita; imprimo o relatório e mando o XML
// para a contadora; preciso compactar todas as notas". Antes a tela de notas
// não tinha filtro de mês, parava em 200 notas e baixava um XML por vez.
//
// Entra no relatório o que tem valor fiscal: nota autorizada (e a cancelada,
// que a contadora também precisa ver). Rejeitada nunca "subiu"; nota de
// homologação não tem valor fiscal e só entra se pedido (para teste).
// ============================================================

export interface NotaRel {
  id: string;
  tipo: string;            // nfe | nfce
  numero: number | string;
  serie?: number | string | null;
  status: string;          // autorizada | cancelada | rejeitada | ...
  ambiente?: string | null;
  finalidade?: number | string | null;  // 1 normal, 4 devolução
  data_emissao?: string | null;
  valor_total?: number | string | null;
  chave_acesso?: string | null;
  xml_path?: string | null;
  consumidor_nome?: string | null;
  venda_id?: string | null;
}

/** "2026-10" → intervalo [início, fim) em ISO, no horário local da loja. */
export function intervaloDoMes(mes: string): { de: string; ate: string } {
  const [a, m] = mes.split("-").map(Number);
  return { de: new Date(a, m - 1, 1).toISOString(), ate: new Date(a, m, 1).toISOString() };
}

export function rotuloNota(n: Pick<NotaRel, "tipo" | "finalidade">): string {
  if (Number(n.finalidade) === 4) return "Devolução";
  return n.tipo === "nfce" ? "NFC-e" : "NF-e";
}

/** Notas que entram no relatório. */
export function notasDoRelatorio(notas: NotaRel[], incluirHomologacao = false): NotaRel[] {
  return notas.filter((n) =>
    (n.status === "autorizada" || n.status === "cancelada")
    && (incluirHomologacao || n.ambiente === "producao"));
}

export interface ResumoContadora {
  autorizadas: number;
  canceladas: number;
  valorAutorizado: number;
  porTipo: { rotulo: string; quantidade: number; valor: number }[];
}

export function resumoDasNotas(notas: NotaRel[]): ResumoContadora {
  const porTipo = new Map<string, { quantidade: number; valor: number }>();
  let autorizadas = 0, canceladas = 0, valorAutorizado = 0;
  for (const n of notas) {
    if (n.status === "cancelada") { canceladas++; continue; }
    autorizadas++;
    const v = Number(n.valor_total) || 0;
    valorAutorizado += v;
    const r = rotuloNota(n);
    const t = porTipo.get(r) ?? { quantidade: 0, valor: 0 };
    t.quantidade++; t.valor += v; porTipo.set(r, t);
  }
  return {
    autorizadas, canceladas,
    valorAutorizado: Math.round(valorAutorizado * 100) / 100,
    porTipo: [...porTipo.entries()].map(([rotulo, t]) => ({ rotulo, ...t, valor: Math.round(t.valor * 100) / 100 })),
  };
}

/**
 * Vendas finalizadas do mês sem nota autorizada — o que a contadora pergunta
 * primeiro ("vendeu e não emitiu?"). A nota conta se é da venda e está
 * autorizada no ambiente considerado.
 */
export function vendasSemNota(
  vendas: { id: string; total?: number | string | null; status?: string | null }[],
  notas: Pick<NotaRel, "venda_id" | "status" | "ambiente">[],
  incluirHomologacao = false,
): { quantidade: number; valor: number } {
  const comNota = new Set(notas
    .filter((n) => n.venda_id && n.status === "autorizada" && (incluirHomologacao || n.ambiente === "producao"))
    .map((n) => n.venda_id));
  const sem = vendas.filter((v) => v.status === "finalizada" && !comNota.has(v.id));
  return { quantidade: sem.length, valor: Math.round(sem.reduce((s, v) => s + (Number(v.total) || 0), 0) * 100) / 100 };
}

/** Caminho do XML dentro do ZIP: pastas por tipo, nome pela chave. */
export function caminhoNoZip(n: NotaRel): string {
  const pasta = n.status === "cancelada" ? "canceladas"
    : Number(n.finalidade) === 4 ? "devolucoes"
    : n.tipo === "nfce" ? "nfce" : "nfe";
  return `${pasta}/${n.chave_acesso || `${n.tipo}-${n.serie ?? 1}-${n.numero}`}.xml`;
}

export function nomeDoZip(mes: string, loja: string): string {
  const limpa = loja.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `notas-${mes}-${limpa || "loja"}.zip`;
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const moeda = (v: unknown) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function htmlRelatorioContadora(p: {
  mes: string; loja: string; cnpj?: string | null;
  notas: NotaRel[]; entradas: { numero?: unknown; emitente_nome?: unknown; data_emissao?: unknown; valor_total?: unknown; chave_acesso?: unknown }[];
  inutilizacoes: { modelo?: unknown; serie?: unknown; numero_inicial?: unknown; numero_final?: unknown; created_at?: unknown }[];
  homologacao: boolean;
}): string {
  const r = resumoDasNotas(p.notas);
  const [a, m] = p.mes.split("-");
  const linhas = p.notas.map((n) => `<tr><td>${esc(rotuloNota(n))}</td><td class="n">${esc(n.serie ?? "")}/${esc(n.numero)}</td>`
    + `<td>${n.data_emissao ? esc(new Date(n.data_emissao).toLocaleString("pt-BR")) : ""}</td><td>${esc(n.status)}</td>`
    + `<td class="n">${moeda(n.valor_total)}</td><td class="c">${esc(n.chave_acesso ?? "")}</td></tr>`).join("");
  const ent = p.entradas.map((e) => `<tr><td>${esc(e.numero)}</td><td>${esc(e.emitente_nome)}</td>`
    + `<td>${e.data_emissao ? esc(new Date(String(e.data_emissao)).toLocaleDateString("pt-BR")) : ""}</td><td class="n">${moeda(e.valor_total)}</td><td class="c">${esc(e.chave_acesso ?? "")}</td></tr>`).join("");
  const inu = p.inutilizacoes.map((i) => `<tr><td>${esc(i.modelo)}</td><td>${esc(i.serie)}</td><td>${esc(i.numero_inicial)} a ${esc(i.numero_final)}</td>`
    + `<td>${i.created_at ? esc(new Date(String(i.created_at)).toLocaleDateString("pt-BR")) : ""}</td></tr>`).join("");
  const tipos = r.porTipo.map((t) => `<div>${esc(t.rotulo)}: <b>${t.quantidade}</b> · ${moeda(t.valor)}</div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Notas ${m}/${a} — ${esc(p.loja)}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;font-size:11px;margin:16px;color:#111}h1{font-size:16px;margin:0}
h2{font-size:13px;margin:14px 0 4px;border-left:4px solid #c00;padding-left:6px}.sub{color:#555;margin:2px 0 8px}
.resumo{display:flex;gap:10px;flex-wrap:wrap}.resumo div{border:1px solid #ccc;padding:4px 8px}
table{width:100%;border-collapse:collapse}th{background:#111;color:#fff;text-align:left;padding:3px}
td{border-bottom:1px solid #ddd;padding:2px 3px}.n{text-align:right;white-space:nowrap}.c{font-family:monospace;font-size:9px}
.aviso{color:#a00;font-weight:bold}@page{margin:10mm}</style></head><body>
<h1>Relatório de notas fiscais — ${m}/${a}</h1>
<div class="sub">${esc(p.loja)}${p.cnpj ? ` · CNPJ ${esc(p.cnpj)}` : ""}${p.homologacao ? ' · <span class="aviso">INCLUI NOTAS DE HOMOLOGAÇÃO (sem valor fiscal)</span>' : ""}</div>
<div class="resumo"><div>Autorizadas: <b>${r.autorizadas}</b></div><div>Canceladas: <b>${r.canceladas}</b></div>
<div>Valor autorizado: <b>${moeda(r.valorAutorizado)}</b></div>${tipos}<div>Entradas: <b>${p.entradas.length}</b></div><div>Inutilizações: <b>${p.inutilizacoes.length}</b></div></div>
<h2>Notas emitidas</h2><table><thead><tr><th>Tipo</th><th class="n">Série/Nº</th><th>Emissão</th><th>Situação</th><th class="n">Valor</th><th>Chave</th></tr></thead>
<tbody>${linhas || '<tr><td colspan="6">Nenhuma nota no mês.</td></tr>'}</tbody></table>
<h2>Notas de entrada (compras)</h2><table><thead><tr><th>Nº</th><th>Fornecedor</th><th>Emissão</th><th class="n">Valor</th><th>Chave</th></tr></thead>
<tbody>${ent || '<tr><td colspan="5">Nenhuma nota de entrada no mês.</td></tr>'}</tbody></table>
<h2>Numerações inutilizadas</h2><table><thead><tr><th>Modelo</th><th>Série</th><th>Números</th><th>Data</th></tr></thead>
<tbody>${inu || '<tr><td colspan="4">Nenhuma inutilização no mês.</td></tr>'}</tbody></table>
<script>window.onload=function(){window.print()}</script></body></html>`;
}

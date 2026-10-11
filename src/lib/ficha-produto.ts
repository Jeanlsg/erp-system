// ============================================================
// Ficha do produto — regras puras (resumo da movimentação, histórico de
// preço e a impressão).
//
// Pedido da loja (10/10/2026): pesquisar o produto, clicar nele e, na mesma
// tela, mexer em custo, preço e estoque e ver toda a movimentação — o que
// saiu por venda, o dia que entrou reposição —, escolhendo o período e
// podendo imprimir. As peças existiam separadas (edição, ajuste, Kardex
// geral sem filtro de data) e a auditoria gravava cada mudança de preço sem
// nenhuma tela mostrar.
// ============================================================

export const ORIGENS_MOVIMENTO: Record<string, string> = {
  venda: "Venda",
  cancelamento_venda: "Cancelamento de venda",
  devolucao: "Devolução de cliente",
  devolucao_fornecedor: "Devolução a fornecedor",
  remessa: "Transferência entre filiais",
  transferencia: "Transferência entre filiais",
  nfe_entrada: "NF-e de entrada (compra)",
  compra: "Compra",
  reposicao: "Reposição",
  entrada: "Entrada",
  manual: "Ajuste manual",
  inventario: "Inventário",
  migracao: "Migração",
  lote_vencido: "Baixa de lote vencido",
};

export const TIPOS_MOVIMENTO: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
  inventario: "Inventário",
  saldo_inicial: "Saldo inicial",
};

export const rotuloOrigem = (o: string | null | undefined) =>
  (o && ORIGENS_MOVIMENTO[o]) || (o ? o.replace(/_/g, " ") : "—");

export interface Movimento {
  tipo: string;
  origem?: string | null;
  quantidade: number;
  saldo_anterior?: number | null;
  saldo_posterior?: number | null;
  custo_unitario?: number | null;
  created_at: string;
}

/**
 * Quanto entrou e quanto saiu no período. "Ajuste" e "inventário" não têm
 * sinal no registro (a quantidade é o tamanho do ajuste): o sentido vem da
 * diferença entre o saldo antes e depois.
 */
export function resumoMovimentos(movs: Movimento[]) {
  let entradas = 0, saidas = 0, vendidas = 0;
  for (const m of movs) {
    const q = Math.abs(Number(m.quantidade) || 0);
    let sinal: 1 | -1;
    if (m.tipo === "entrada" || m.tipo === "saldo_inicial") sinal = 1;
    else if (m.tipo === "saida") sinal = -1;
    else sinal = (Number(m.saldo_posterior) || 0) >= (Number(m.saldo_anterior) || 0) ? 1 : -1;
    if (sinal > 0) entradas += q; else saidas += q;
    if (m.tipo === "saida" && m.origem === "venda") vendidas += q;
  }
  return { entradas, saidas, vendidas, liquido: entradas - saidas };
}

/** Sinal de exibição de um movimento (+/−), pela mesma regra do resumo. */
export function sinalDoMovimento(m: Movimento): 1 | -1 {
  if (m.tipo === "entrada" || m.tipo === "saldo_inicial") return 1;
  if (m.tipo === "saida") return -1;
  return (Number(m.saldo_posterior) || 0) >= (Number(m.saldo_anterior) || 0) ? 1 : -1;
}

export interface LinhaAuditoria {
  created_at: string;
  usuario_id?: string | null;
  operacao?: string | null;
  dados_antes?: Record<string, any> | null;
  dados_depois?: Record<string, any> | null;
}

export interface AlteracaoPreco {
  data: string;
  usuario_id: string | null;
  campo: "preco_custo" | "preco_venda";
  antes: number | null;
  depois: number | null;
}

/** O que mudou em custo e preço de venda, do mais recente para o mais antigo. */
export function alteracoesDePreco(linhas: LinhaAuditoria[]): AlteracaoPreco[] {
  const out: AlteracaoPreco[] = [];
  for (const l of linhas) {
    for (const campo of ["preco_venda", "preco_custo"] as const) {
      const depois = l.dados_depois?.[campo];
      const antes = l.dados_antes?.[campo];
      const mudou = l.operacao === "INSERT"
        ? depois != null
        : depois !== undefined && Number(antes) !== Number(depois);
      if (mudou) {
        out.push({
          data: l.created_at, usuario_id: l.usuario_id ?? null, campo,
          antes: antes == null ? null : Number(antes),
          depois: depois == null ? null : Number(depois),
        });
      }
    }
  }
  return out.sort((a, b) => b.data.localeCompare(a.data));
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const moeda = (v: unknown) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** HTML da impressão da movimentação do produto no período. */
export function htmlFichaProduto(p: {
  produto: { nome: string; sku?: string | null; codigo_barras?: string | null };
  loja: string;
  de: string;
  ate: string;
  estoque: number;
  custo: number;
  preco: number;
  movimentos: (Movimento & { usuario?: string })[];
}): string {
  const r = resumoMovimentos(p.movimentos);
  const linhas = p.movimentos.map((m) => {
    const s = sinalDoMovimento(m);
    return `<tr><td>${esc(new Date(m.created_at).toLocaleString("pt-BR"))}</td><td>${esc(TIPOS_MOVIMENTO[m.tipo] ?? m.tipo)}</td>`
      + `<td>${esc(rotuloOrigem(m.origem))}</td><td class="n">${s > 0 ? "+" : "−"}${esc(Math.abs(m.quantidade))}</td>`
      + `<td class="n">${esc(m.saldo_anterior ?? "")} → ${esc(m.saldo_posterior ?? "")}</td>`
      + `<td class="n">${m.custo_unitario != null ? moeda(m.custo_unitario) : ""}</td><td>${esc(m.usuario ?? "")}</td></tr>`;
  }).join("");
  const d = (x: string) => new Date(x + "T12:00:00").toLocaleDateString("pt-BR");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Movimentação — ${esc(p.produto.nome)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;font-size:12px;margin:18px;color:#111}
  h1{font-size:16px;margin:0 0 2px} .sub{color:#555;margin-bottom:10px}
  .resumo{display:flex;gap:16px;margin:8px 0 12px;flex-wrap:wrap}
  .resumo div{border:1px solid #ccc;border-left:4px solid #c00;padding:4px 8px}
  table{width:100%;border-collapse:collapse} th{background:#111;color:#fff;text-align:left;padding:4px}
  td{border-bottom:1px solid #ddd;padding:3px 4px} .n{text-align:right;white-space:nowrap}
  @page{margin:12mm}
</style></head><body>
<h1>${esc(p.produto.nome)}</h1>
<div class="sub">${esc([p.produto.sku, p.produto.codigo_barras].filter(Boolean).join(" · "))} — ${esc(p.loja)} — período ${d(p.de)} a ${d(p.ate)}</div>
<div class="resumo"><div>Estoque atual: <b>${esc(p.estoque)}</b></div><div>Custo: <b>${moeda(p.custo)}</b></div>
<div>Preço de venda: <b>${moeda(p.preco)}</b></div><div>Entradas: <b>${r.entradas}</b></div><div>Saídas: <b>${r.saidas}</b> (vendidas: ${r.vendidas})</div></div>
<table><thead><tr><th>Data</th><th>Tipo</th><th>Origem</th><th class="n">Qtd</th><th class="n">Saldo</th><th class="n">Custo un.</th><th>Usuário</th></tr></thead>
<tbody>${linhas || '<tr><td colspan="7">Nenhuma movimentação no período.</td></tr>'}</tbody></table>
<script>window.onload=function(){window.print()}</script></body></html>`;
}

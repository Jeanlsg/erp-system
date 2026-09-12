// ============================================================
// Maquinaria comum das importações por planilha.
//
// Extraído de importar-produtos.tsx quando nasceram as importações
// de pessoas e de contas: as três precisam exatamente do mesmo
// tratamento de CSV brasileiro, e uma correção aqui (separador,
// acento, vírgula decimal) precisa valer para todas.
// ============================================================

/** "Preço Venda" → "preco venda": compara cabeçalho sem acento nem caixa. */
export const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Número no formato brasileiro. `1.234,56` → 1234.56 · `12,5` → 12.5
 * `12.5` fica 12.5 (planilha exportada em formato americano).
 *
 * Atenção conhecida: `1.234` sem centavos é lido como 1.234, não 1234 —
 * é ambiguidade real entre os dois formatos, sem como decidir pelo texto.
 * Por isso toda importação mostra o valor convertido na pré-visualização
 * antes de confirmar: é lá que o operador percebe um R$ 1,23 indevido.
 */
export function parseNumeroBR(v: string): number | null {
  const s = String(v ?? "").trim().replace(/^R\$\s*/i, "");
  if (!s) return null;
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Data em qualquer formato que uma planilha brasileira produz:
 * `31/12/2026`, `31-12-2026`, `2026-12-31`, `31/12/26`.
 * Devolve ISO `aaaa-mm-dd`, ou null se não for data.
 */
export function parseDataBR(v: string): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;

  // já vem ISO
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return validarData(+iso[1], +iso[2], +iso[3]);

  const br = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (!br) return null;
  let ano = +br[3];
  if (ano < 100) ano += ano < 70 ? 2000 : 1900; // 26 → 2026, 99 → 1999
  return validarData(ano, +br[2], +br[1]);
}

function validarData(ano: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  // rejeita 31/02: o Date rola para março e o dia deixa de bater
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Só os dígitos — para CPF/CNPJ e telefone, que vêm com pontuação variada. */
export const soDigitos = (v: string) => String(v ?? "").replace(/\D/g, "");

/**
 * CSV com aspas e separador `;` ou `,` detectado pelo cabeçalho — o Excel
 * brasileiro exporta com `;`. Remove BOM e aceita CRLF.
 */
export function parseCSV(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "");
  const primeira = limpo.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let campo = "", linha: string[] = [], aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo[i];
    if (aspas) {
      if (ch === '"') {
        if (limpo[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && limpo[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.some((c) => c.trim() !== "")) linhas.push(linha);
      linha = [];
    } else campo += ch;
  }
  linha.push(campo);
  if (linha.some((c) => c.trim() !== "")) linhas.push(linha);
  return linhas;
}

export interface LinhaImportacao {
  /** nº da linha na planilha, para o relatório de erro casar com o que o operador vê */
  linha: number;
  dados: Record<string, string>;
  erros: string[];
}

/**
 * Aplica o mapa de apelidos ao cabeçalho e devolve uma linha por registro,
 * já validada pela função que o chamador passar.
 *
 * `obrigatorio` é o campo que define se a planilha é do tipo esperado: se o
 * cabeçalho não o contém, não é essa planilha — melhor recusar inteira do que
 * importar 300 linhas vazias.
 */
export function interpretarPlanilha(
  linhas: string[][],
  aliases: Record<string, string>,
  obrigatorio: string,
  validar: (dados: Record<string, string>) => string[],
): { itens: LinhaImportacao[]; planilhaInvalida: boolean } {
  if (linhas.length < 2) return { itens: [], planilhaInvalida: true };
  const mapa = linhas[0].map((h) => aliases[semAcento(h)] ?? null);
  if (!mapa.includes(obrigatorio)) return { itens: [], planilhaInvalida: true };

  const itens: LinhaImportacao[] = [];
  for (let i = 1; i < linhas.length; i++) {
    const dados: Record<string, string> = {};
    linhas[i].forEach((c, j) => {
      const campo = mapa[j];
      if (campo && c.trim() !== "") dados[campo] = c.trim();
    });
    itens.push({ linha: i + 1, dados, erros: validar(dados) });
  }
  return { itens, planilhaInvalida: false };
}

/** Dispara o download de um CSV modelo, sem passar por servidor. */
export function baixarModeloCSV(conteudo: string, nomeArquivo: string) {
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(conteudo);
  a.download = nomeArquivo;
  a.click();
}

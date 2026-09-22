// ============================================================
// Exportação de relatório para planilha.
//
// Formato brasileiro de verdade: separador ";", decimal com vírgula e BOM
// no começo. Sem o BOM o Excel abre "Ação" como "AÃ§Ã£o"; sem o ";" ele
// joga a linha inteira numa coluna só.
// ============================================================

export type Coluna<T> = {
  chave: string;
  titulo: string;
  /** valor exibido na tela; se ausente, usa item[chave] */
  valor?: (item: T) => unknown;
  /** alinhamento e formatação na tela */
  tipo?: "texto" | "numero" | "dinheiro" | "data" | "percentual";
  /** soma esta coluna no rodapé */
  total?: boolean;
  /** não exporta (ex.: coluna de botões) */
  semExport?: boolean;
};

export function valorDa<T>(item: T, col: Coluna<T>): unknown {
  return col.valor ? col.valor(item) : (item as any)[col.chave];
}

/** Um campo de CSV: aspas duplicadas, e aspas ao redor quando precisa. */
function campo(v: unknown, tipo?: Coluna<any>["tipo"]): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    // número vai com vírgula decimal, sem separador de milhar: é o que o
    // Excel em pt-BR entende como número, e não como texto
    return (tipo === "dinheiro" || tipo === "percentual" || !Number.isInteger(v))
      ? v.toFixed(2).replace(".", ",")
      : String(v);
  }
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function gerarCSV<T>(itens: T[], colunas: Coluna<T>[]): string {
  const cols = colunas.filter((c) => !c.semExport);
  const linhas = [cols.map((c) => campo(c.titulo)).join(";")];
  for (const item of itens) {
    linhas.push(cols.map((c) => campo(valorDa(item, c), c.tipo)).join(";"));
  }
  return linhas.join("\r\n") + "\r\n";
}

export function baixarCSV(conteudo: string, nomeArquivo: string) {
  // BOM: sem ele o Excel não reconhece UTF-8 e os acentos viram lixo
  const blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo.endsWith(".csv") ? nomeArquivo : `${nomeArquivo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Nome com data, para não sobrescrever o download anterior. */
export function nomeArquivoRelatorio(base: string, de?: string, ate?: string): string {
  const periodo = de && ate ? `_${de}_a_${ate}` : `_${new Date().toISOString().slice(0, 10)}`;
  return `${base.toLowerCase().replace(/[^a-z0-9]+/g, "-")}${periodo}.csv`;
}

// ============================================================
// A tabela que todo relatório usa: ordenação por coluna, totais no rodapé,
// paginação e exportação para planilha.
//
// Antes cada relatório era um punhado de cards com números e nenhuma forma
// de ver o que compõe o número — "Receita Total R$ 40.000" sem as vendas
// que somam isso não permite conferir nada, nem achar o lançamento errado.
// ============================================================

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { brl, date as fmtData, dateTime as fmtDataHora, num, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { baixarCSV, gerarCSV, nomeArquivoRelatorio, valorDa, type Coluna } from "@/lib/exportar-csv";

interface Props<T> {
  titulo: string;
  itens: T[];
  colunas: Coluna<T>[];
  carregando?: boolean;
  /** texto quando não há linha nenhuma */
  vazio?: string;
  /** período, só para nomear o arquivo exportado */
  de?: string;
  ate?: string;
  /** clique na linha (abrir detalhe) */
  aoClicar?: (item: T) => void;
  porPagina?: number;
}

function formata(v: unknown, tipo: Coluna<any>["tipo"]): string {
  if (v === null || v === undefined || v === "") return "—";
  switch (tipo) {
    case "dinheiro": return brl(Number(v));
    case "numero": return num(Number(v));
    case "percentual": return pct(Number(v));
    case "data": return String(v).includes("T") ? fmtDataHora(String(v)) : fmtData(String(v));
    default: return String(v);
  }
}

export function TabelaRelatorio<T>({
  titulo, itens, colunas, carregando, vazio, de, ate, aoClicar, porPagina = 50,
}: Props<T>) {
  const [ordenarPor, setOrdenarPor] = useState<string | null>(null);
  const [desc, setDesc] = useState(true);
  const [pagina, setPagina] = useState(1);

  const ordenados = useMemo(() => {
    if (!ordenarPor) return itens;
    const col = colunas.find((c) => c.chave === ordenarPor);
    if (!col) return itens;
    return [...itens].sort((a, b) => {
      const va = valorDa(a, col), vb = valorDa(b, col);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const r = typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "pt-BR", { numeric: true });
      return desc ? -r : r;
    });
  }, [itens, colunas, ordenarPor, desc]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = ordenados.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);

  // Totais são de TODAS as linhas filtradas, não só da página — somar só a
  // página daria um número que muda ao virar de página.
  const totais = useMemo(() => {
    const t: Record<string, number> = {};
    for (const col of colunas.filter((c) => c.total)) {
      t[col.chave] = itens.reduce((s, i) => s + (Number(valorDa(i, col)) || 0), 0);
    }
    return t;
  }, [itens, colunas]);

  const alternarOrdem = (chave: string) => {
    if (ordenarPor === chave) setDesc(!desc);
    else { setOrdenarPor(chave); setDesc(true); }
    setPagina(1);
  };

  const exportar = () => {
    baixarCSV(gerarCSV(ordenados, colunas), nomeArquivoRelatorio(titulo, de, ate));
  };

  const alinhamento = (tipo: Coluna<T>["tipo"]) =>
    tipo === "dinheiro" || tipo === "numero" || tipo === "percentual" ? "text-right" : "text-left";

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <p className="text-sm font-medium">
            {titulo}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {carregando ? "carregando…" : `${num(itens.length)} linha(s)`}
            </span>
          </p>
          <Button variant="outline" size="sm" onClick={exportar} disabled={carregando || itens.length === 0}>
            <Download className="mr-1 h-3.5 w-3.5" /> Exportar planilha
          </Button>
        </div>

        {carregando ? (
          <div className="p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
        ) : itens.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            {vazio ?? "Nada encontrado com estes filtros."}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    {colunas.map((c) => (
                      <th key={c.chave} className={cn("p-2 whitespace-nowrap", alinhamento(c.tipo))}>
                        <button type="button" onClick={() => alternarOrdem(c.chave)}
                          className="inline-flex items-center gap-1 hover:text-foreground">
                          {c.titulo}
                          {ordenarPor === c.chave
                            ? (desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)
                            : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((item, i) => (
                    <tr key={i}
                      onClick={aoClicar ? () => aoClicar(item) : undefined}
                      className={cn("border-b last:border-0", aoClicar && "cursor-pointer hover:bg-accent")}>
                      {colunas.map((c) => (
                        <td key={c.chave} className={cn("p-2 whitespace-nowrap", alinhamento(c.tipo),
                          (c.tipo === "dinheiro" || c.tipo === "numero") && "tabular-nums")}>
                          {formata(valorDa(item, c), c.tipo)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {Object.keys(totais).length > 0 && (
                  <tfoot className="border-t-2 bg-muted/40 font-semibold">
                    <tr>
                      {colunas.map((c, idx) => (
                        <td key={c.chave} className={cn("p-2 whitespace-nowrap", alinhamento(c.tipo), "tabular-nums")}>
                          {c.chave in totais ? formata(totais[c.chave], c.tipo) : idx === 0 ? "Total" : ""}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {totalPaginas > 1 && (
              <div className="flex items-center justify-between border-t p-2 text-xs text-muted-foreground">
                <span>Página {paginaAtual} de {totalPaginas}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7"
                    disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)}>Anterior</Button>
                  <Button variant="outline" size="sm" className="h-7"
                    disabled={paginaAtual === totalPaginas} onClick={() => setPagina(paginaAtual + 1)}>Próxima</Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

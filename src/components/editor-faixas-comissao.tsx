// ============================================================
// Editor da comissão dinâmica ("vendeu a partir de R$ X no mês, ganha Y%").
// Usado para as faixas sobre vendas de produtos (107) e sobre serviços (097)
// na ficha do funcionário.
// ============================================================

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { faixaAtingida, validarFaixas, type Faixa } from "@/lib/faixas-comissao";

export type FaixaTexto = { venda_minima: string; percentual: string };

/** Faixas digitadas → números (linhas vazias saem). */
export function faixasEmNumeros(faixas: FaixaTexto[]): Faixa[] {
  return faixas
    .filter((f) => f.venda_minima !== "" || f.percentual !== "")
    .map((f) => ({
      venda_minima: Number(String(f.venda_minima).replace(",", ".")),
      percentual: Number(String(f.percentual).replace(",", ".")),
    }));
}

export function EditorFaixasComissao({ titulo, descricao, rotuloTotal, faixas, aoMudar }: {
  titulo: string;
  descricao: string;
  /** "em vendas", "em serviços" — usado no exemplo */
  rotuloTotal: string;
  faixas: FaixaTexto[];
  aoMudar: (f: FaixaTexto[]) => void;
}) {
  const numericas = faixasEmNumeros(faixas);
  const { erros, avisos } = validarFaixas(numericas, rotuloTotal);
  return (
    <div className="rounded-md border bg-background p-3">
      <Label>{titulo}</Label>
      <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>
      <div className="mt-2 space-y-2">
        {faixas.map((f, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Vendeu a partir de R$</span>
            <Input className="h-8 w-28" inputMode="decimal" value={f.venda_minima}
              onChange={(e) => aoMudar(faixas.map((x, k) => k === i ? { ...x, venda_minima: e.target.value } : x))} />
            <span className="text-muted-foreground">no mês, ganha</span>
            <Input className="h-8 w-20" inputMode="decimal" value={f.percentual}
              onChange={(e) => aoMudar(faixas.map((x, k) => k === i ? { ...x, percentual: e.target.value } : x))} />
            <span className="text-muted-foreground">%</span>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-destructive"
              onClick={() => aoMudar(faixas.filter((_, k) => k !== i))}>
              Remover
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm"
          onClick={() => aoMudar([...faixas, { venda_minima: "", percentual: "" }])}>
          Adicionar faixa
        </Button>
      </div>
      {erros.map((e) => <p key={e} className="mt-2 text-xs text-destructive">{e}</p>)}
      {avisos.map((a) => <p key={a} className="mt-2 text-xs text-amber-700 dark:text-amber-400">{a}</p>)}
      {numericas.length > 0 && erros.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Exemplo: com R$ 1.500 {rotuloTotal} no mês, a comissão é{" "}
          <b>{faixaAtingida(numericas, 1500)}%</b> sobre os R$ 1.500.
        </p>
      )}
    </div>
  );
}

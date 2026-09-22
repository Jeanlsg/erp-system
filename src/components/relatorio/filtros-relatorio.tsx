// ============================================================
// Barra de filtros dos relatórios.
//
// Cada tela tinha o seu: a Visão Geral com um select de 7/30/90 dias, o
// Financeiro com duas datas soltas, as Comissões com outras duas. Mesma
// pergunta ("qual período?"), três respostas diferentes na mesma tela do
// mesmo sistema.
//
// O período sempre tem atalhos (hoje, 7 dias, mês, mês passado) E as duas
// datas: o atalho resolve 90% dos casos e a data crua resolve o resto.
// ============================================================

import { Calendar, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type Periodo = { de: string; ate: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function periodoPadrao(dias = 30): Periodo {
  const ate = new Date();
  const de = new Date();
  de.setDate(de.getDate() - dias);
  return { de: iso(de), ate: iso(ate) };
}

const ATALHOS: { rotulo: string; calcula: () => Periodo }[] = [
  { rotulo: "Hoje", calcula: () => ({ de: iso(new Date()), ate: iso(new Date()) }) },
  { rotulo: "7 dias", calcula: () => periodoPadrao(7) },
  { rotulo: "30 dias", calcula: () => periodoPadrao(30) },
  {
    rotulo: "Este mês",
    calcula: () => {
      const h = new Date();
      return { de: iso(new Date(h.getFullYear(), h.getMonth(), 1)), ate: iso(h) };
    },
  },
  {
    rotulo: "Mês passado",
    calcula: () => {
      const h = new Date();
      return {
        de: iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)),
        ate: iso(new Date(h.getFullYear(), h.getMonth(), 0)),
      };
    },
  },
  {
    rotulo: "Este ano",
    calcula: () => {
      const h = new Date();
      return { de: iso(new Date(h.getFullYear(), 0, 1)), ate: iso(h) };
    },
  },
];

interface Props {
  periodo: Periodo;
  aoMudarPeriodo: (p: Periodo) => void;
  /** filtros próprios de cada relatório (vendedor, forma, status…) */
  children?: React.ReactNode;
  aoLimpar?: () => void;
}

export function FiltrosRelatorio({ periodo, aoMudarPeriodo, children, aoLimpar }: Props) {
  const ativo = (a: (typeof ATALHOS)[number]) => {
    const p = a.calcula();
    return p.de === periodo.de && p.ate === periodo.ate;
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" className="mt-1 w-[10.5rem]" value={periodo.de}
              onChange={(e) => aoMudarPeriodo({ ...periodo, de: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" className="mt-1 w-[10.5rem]" value={periodo.ate}
              onChange={(e) => aoMudarPeriodo({ ...periodo, ate: e.target.value })} />
          </div>
          {children}
          {aoLimpar && (
            <Button variant="ghost" size="sm" onClick={aoLimpar} title="Voltar aos filtros padrão">
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Calendar className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
          {ATALHOS.map((a) => (
            <Button key={a.rotulo} size="sm" variant={ativo(a) ? "default" : "outline"}
              className={cn("h-7 text-xs")} onClick={() => aoMudarPeriodo(a.calcula())}>
              {a.rotulo}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

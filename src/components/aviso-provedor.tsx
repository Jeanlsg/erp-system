// ============================================================
// Aviso de recurso que depende de contratação.
//
// Algumas telas existem no sistema mas não têm como funcionar sem um
// serviço contratado fora dele: boleto exige convênio bancário, SMS
// exige gateway, TEF exige contrato com a adquirente. Mostrar a tela
// vazia, como se estivesse funcionando e sem movimento, é pior do que
// não mostrar — o operador tenta, não acontece nada, e conclui que o
// sistema está quebrado.
//
// Aqui a tela diz o que falta, o que fazer para ativar e — quando
// existe — qual caminho já disponível resolve a mesma necessidade hoje.
// ============================================================

import { Link } from "react-router-dom";
import { PlugZap, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Alternativa { rotulo: string; rota: string }

interface Props {
  /** O que precisa ser contratado, em uma frase. */
  requisito: string;
  /** Passos para ativar, na ordem. */
  comoAtivar: string[];
  /** O que resolve a mesma necessidade hoje, se houver. */
  alternativas?: Alternativa[];
  /** Nota extra, como limite de plano gratuito. */
  observacao?: string;
}

export function AvisoProvedor({ requisito, comoAtivar, alternativas, observacao }: Props) {
  return (
    <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <PlugZap className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              Esta tela ainda não está ligada a um serviço
            </p>
            <p className="text-sm text-amber-900/90 dark:text-amber-200/90">{requisito}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Para ativar
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-amber-900/90 dark:text-amber-200/90">
            {comoAtivar.map((passo, i) => <li key={i}>{passo}</li>)}
          </ol>
        </div>

        {observacao && (
          <p className="text-xs text-amber-800/90 dark:text-amber-300/90">{observacao}</p>
        )}

        {alternativas && alternativas.length > 0 && (
          <div className="space-y-1.5 border-t border-amber-200 pt-3 dark:border-amber-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
              Enquanto isso, você pode usar
            </p>
            <div className="flex flex-wrap gap-2">
              {alternativas.map((a) => (
                <Button key={a.rota} asChild size="sm" variant="outline">
                  <Link to={a.rota}>{a.rotulo} <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

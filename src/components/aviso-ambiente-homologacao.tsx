// ============================================================
// Aviso: a loja está em HOMOLOGAÇÃO.
//
// Homologação é o ambiente de teste da SEFAZ. Duas consequências que, sem
// aviso, passam por "ainda não aconteceu nada":
//
//   · a busca de notas recebidas (DF-e) NUNCA traz nota, porque o Ambiente
//     Nacional não devolve documentos de homologação. A tela fica com zeros e
//     "Última consulta: nunca", que parece canal vazio e não é;
//   · a nota emitida NÃO tem valor fiscal, mesmo saindo autorizada.
//
// O componente só aparece quando a loja está de fato em homologação: depois da
// virada para produção ele desaparece sozinho, sem ninguém tocar no código.
// ============================================================

import { FlaskConical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useConfiguracoesSefaz } from "@/lib/supabase-queries";

interface Props {
  lojaId?: string | null;
  /** o que esta tela especificamente não consegue fazer em homologação */
  oQueNaoFunciona?: string;
}

export function AvisoAmbienteHomologacao({ lojaId, oQueNaoFunciona }: Props) {
  const { data: cfg, isSuccess } = useConfiguracoesSefaz(lojaId ?? undefined);

  // enquanto carrega, não afirma nada
  if (!isSuccess) return null;
  if (!cfg) {
    return (
      <Card className="border-destructive bg-destructive/5">
        <CardContent className="flex items-start gap-3 py-4 text-sm">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Esta loja não tem configuração SEFAZ.</p>
            <p className="text-muted-foreground">
              Sem ambiente, UF e certificado cadastrados, nada nesta tela conversa com a SEFAZ.
              Cadastre em <b>Gestão › Fiscal › Configurações SEFAZ</b>.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (cfg.ambiente !== "homologacao") return null;

  return (
    <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
      <CardContent className="flex items-start gap-3 py-4 text-sm">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="space-y-1">
          <p className="font-medium">
            Esta loja está em <b>homologação</b> — o ambiente de teste da SEFAZ.
          </p>
          <p className="text-muted-foreground">
            {oQueNaoFunciona ??
              "A busca de notas recebidas não traz resultado em homologação: o Ambiente Nacional " +
              "não devolve documentos deste ambiente. Os contadores em zero e o “Última consulta: " +
              "nunca” são esperados, não indicam falha."}
          </p>
          <p className="text-muted-foreground">
            Para valer de verdade: cadastre o CSC de produção e troque o ambiente para
            <b> produção</b> em <b>Gestão › Fiscal › Configurações SEFAZ</b>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

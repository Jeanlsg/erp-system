// ============================================================
// Tela de um relatório financeiro.
//
// Uma tela só, dirigida pelo catálogo (lib/relatorios/catalogo): cada
// relatório diz o que consultar e quais colunas mostrar, e daqui saem o
// filtro de período, a loja, a ordenação, os totais e a planilha.
//
// Antes eram pop-ups: três colunas, altura fixa, sem filtro próprio e
// presos ao período da tela de trás — conferir outro mês exigia fechar,
// mudar a data e abrir de novo.
// ============================================================

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileBarChart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { FiltrosRelatorio, periodoPadrao, type Periodo } from "@/components/relatorio/filtros-relatorio";
import { TabelaRelatorio } from "@/components/relatorio/tabela-relatorio";
import { DetalhesCaixaDialog } from "@/components/detalhes-caixa";
import { RELATORIOS } from "@/lib/relatorios/catalogo";
import { useVendedores, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";

const TODAS = "__todas__";

export function RelatorioDetalhePage() {
  const { tipo = "" } = useParams();
  const rel = RELATORIOS[tipo];

  const [periodo, setPeriodo] = useState<Periodo>(periodoPadrao(30));
  const [caixaDetalhe, setCaixaDetalhe] = useState<string | null>(null);
  const [vendedor, setVendedor] = useState<string>(TODAS);
  const { data: vendedores = [] } = useVendedores();

  // A filial é a do seletor do topo, como em toda tela de movimento.
  const { lojaId: lojaTopo } = useAutoSelectLoja();
  const lojaId = lojaTopo ?? undefined;
  const vendedorId = vendedor === TODAS ? undefined : vendedor;
  const aceitaVendedor = rel?.filtros?.includes("vendedor") ?? false;

  const { data: linhas = [], isLoading, error } = useQuery<any[]>({
    queryKey: ["relatorio", tipo, periodo.de, periodo.ate, lojaId, vendedorId],
    queryFn: () => rel.buscar({ de: periodo.de, ate: periodo.ate, lojaId, vendedorId }),
    enabled: !!rel,
  });

  const colunas = useMemo(() => rel?.colunas ?? [], [rel]);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Relatório" />;

  if (!rel) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <p className="font-medium">Relatório não encontrado.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            O endereço <code className="font-mono">{tipo}</code> não corresponde a nenhum relatório.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/financeiro"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao financeiro</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FileBarChart className="h-6 w-6" /> {rel.titulo}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{rel.descricao}</p>
          {rel.paraQue && (
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{rel.paraQue}</p>
          )}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/financeiro"><ArrowLeft className="mr-1 h-4 w-4" /> Financeiro</Link>
        </Button>
      </div>

      <FiltrosRelatorio
        periodo={periodo}
        aoMudarPeriodo={setPeriodo}
        aoLimpar={() => { setPeriodo(periodoPadrao(30)); setVendedor(TODAS); }}
      >
        {aceitaVendedor && (
          <div>
            <Label className="text-xs">Operador</Label>
            <Select value={vendedor} onValueChange={setVendedor}>
              <SelectTrigger className="mt-1 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todos</SelectItem>
                {(vendedores as any[]).map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.nome ?? v.cargo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </FiltrosRelatorio>

      {error ? (
        <Card className="border-destructive">
          <CardContent className="p-6 text-sm">
            <p className="font-medium text-destructive">A consulta falhou.</p>
            <p className="mt-1 text-muted-foreground">{(error as any).message}</p>
          </CardContent>
        </Card>
      ) : (
        <TabelaRelatorio
          titulo={rel.titulo}
          itens={linhas}
          colunas={colunas}
          carregando={isLoading}
          de={periodo.de}
          ate={periodo.ate}
          // no relatório de fechamentos, a linha abre o turno inteiro
          aoClicar={tipo === "fechamentos" ? (f: any) => setCaixaDetalhe(f.caixa_id) : undefined}
          vazio="Nada encontrado no período com estes filtros."
        />
      )}

      <DetalhesCaixaDialog caixaId={caixaDetalhe} onOpenChange={(v) => !v && setCaixaDetalhe(null)} />
    </div>
  );
}

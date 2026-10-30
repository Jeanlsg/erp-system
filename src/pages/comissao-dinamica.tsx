// ============================================================
// Comissão dinâmica — relatório do mês (pedido de 30/10/2026).
//
// Bateu X em vendas no mês, ganha Y% sobre todas as vendas do mês: as
// faixas de cada funcionário ficam na ficha dele (Funcionários). Até aqui só
// dava para ver a faixa de um vendedor por vez, filtrando a tela Comissões —
// e esse cartão estava quebrado desde a 118. Aqui o mês inteiro, todos os
// vendedores: quanto faturou, em que faixa está, quanto falta para subir e
// quanto isso vale.
//
// Os números vêm do banco (erp.relatorio_comissao_dinamica, 120), das
// mesmas funções que decidem a faixa. O total da faixa é de todas as
// filiais: a faixa é do vendedor, não da loja.
// ============================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboboxBusca } from "@/components/ui/combobox-busca";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { TabelaRelatorio } from "@/components/relatorio/tabela-relatorio";
import type { Coluna } from "@/lib/exportar-csv";
import { escadaFaixas } from "@/lib/faixas-comissao";
import { brl, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  isSupabaseConfigured, useRelatorioComissaoDinamica, type LinhaComissaoDinamica,
} from "@/lib/supabase-queries";

const fmtPct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export function ComissaoDinamicaPage() {
  const [mes, setMes] = useState(() => new Date().toLocaleDateString("sv-SE").slice(0, 7));
  const [vendedor, setVendedor] = useState("");
  const [soDinamica, setSoDinamica] = useState(false);
  const { data: linhas = [], isLoading, error } = useRelatorioComissaoDinamica(mes);

  const filtradas = useMemo(() => linhas.filter((l) => {
    if (vendedor && l.funcionario_id !== vendedor) return false;
    if (soDinamica && !l.dinamica) return false;
    return true;
  }), [linhas, vendedor, soDinamica]);
  const dinamicas = filtradas.filter((l) => l.dinamica);

  const faturamento = filtradas.reduce((s, l) => s + l.faturamento, 0);
  const comissao = filtradas.reduce((s, l) => s + l.comissao, 0);
  const aPagar = filtradas.reduce((s, l) => s + l.comissao_pendente, 0);

  // para o nome do arquivo exportado
  const [ano, m] = mes.split("-").map(Number);
  const de = `${mes}-01`;
  const ate = ano && m ? new Date(ano, m, 0).toLocaleDateString("sv-SE") : de;

  const colunas: Coluna<LinhaComissaoDinamica>[] = [
    { chave: "nome", titulo: "Vendedor" },
    { chave: "regra", titulo: "Regra", valor: (l) => (l.dinamica ? "Dinâmica" : `Fixa ${fmtPct(l.percentual_fixo)}`) },
    { chave: "vendas", titulo: "Vendas", tipo: "numero", total: true },
    { chave: "itens", titulo: "Itens", tipo: "numero", total: true },
    { chave: "faturamento", titulo: "Faturamento (produtos)", tipo: "dinheiro", total: true },
    { chave: "percentual", titulo: "Faixa atual", tipo: "percentual" },
    { chave: "proximo_percentual", titulo: "Próxima faixa", tipo: "percentual" },
    { chave: "falta", titulo: "Falta para subir", tipo: "dinheiro" },
    { chave: "comissao", titulo: "Comissão do mês", tipo: "dinheiro", total: true },
    { chave: "comissao_pendente", titulo: "A pagar", tipo: "dinheiro", total: true },
    { chave: "comissao_paga", titulo: "Paga", tipo: "dinheiro", total: true },
  ];

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Comissão dinâmica" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-6 w-6" /> Comissão dinâmica
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bateu X em vendas no mês, ganha Y% sobre todas as vendas do mês. As faixas de cada vendedor
          ficam na ficha dele, em <Link to="/gestao/funcionarios" className="underline underline-offset-2">Funcionários</Link>;
          as comissões venda a venda, em <Link to="/gestao/comissoes" className="underline underline-offset-2">Comissões</Link>.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-3 sm:items-end">
          <div className="space-y-1.5">
            <Label>Mês</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Vendedor</Label>
            <ComboboxBusca
              itens={linhas.map((l) => ({ id: l.funcionario_id, rotulo: l.nome, detalhe: l.cargo ?? undefined }))}
              value={vendedor} onChange={setVendedor} vazio="Todos" />
          </div>
          <label className="flex h-9 items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="h-4 w-4" checked={soDinamica} onChange={(e) => setSoDinamica(e.target.checked)} />
            Só quem tem comissão dinâmica
          </label>
        </CardContent>
      </Card>

      {error ? (
        <Card><CardContent className="p-6 text-sm text-destructive">
          Não foi possível carregar o relatório: {(error as any)?.message ?? String(error)}
        </CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Tile rotulo="Faturamento no mês" valor={brl(faturamento)} detalhe="produtos, vendas finalizadas" />
            <Tile rotulo="Comissão do mês" valor={brl(comissao)} detalhe="produtos e serviços, sem as canceladas" />
            <Tile rotulo="A pagar" valor={brl(aPagar)} detalhe="comissões pendentes" className="text-amber-600" />
            <Tile rotulo="Na comissão dinâmica" valor={num(dinamicas.length)}
              detalhe={dinamicas.length === 1 ? "vendedor com faixas" : "vendedores com faixas"} />
          </div>

          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : dinamicas.length === 0 ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">
              {linhas.some((l) => l.dinamica)
                ? "Nenhum vendedor com comissão dinâmica nestes filtros."
                : <>Ninguém tem comissão dinâmica ainda. Abra o funcionário em{" "}
                    <Link to="/gestao/funcionarios" className="underline underline-offset-2">Funcionários</Link>{" "}
                    e cadastre as faixas em "Comissão dinâmica" — por exemplo: a partir de R$ 0 ganha 3%,
                    a partir de R$ 10.000 ganha 5%, a partir de R$ 20.000 ganha 7%.</>}
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {dinamicas.map((l) => <CartaoVendedor key={l.funcionario_id} linha={l} />)}
            </div>
          )}

          <TabelaRelatorio
            titulo="Comissão dinâmica — todos os vendedores"
            itens={filtradas}
            colunas={colunas}
            carregando={isLoading}
            de={de}
            ate={ate}
            vazio="Ninguém vendeu nem tem faixa neste mês."
          />
        </>
      )}
    </div>
  );
}

function Tile({ rotulo, valor, detalhe, className }: { rotulo: string; valor: string; detalhe: string; className?: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs uppercase text-muted-foreground">{rotulo}</p>
      <p className={cn("text-2xl font-semibold tabular-nums", className)}>{valor}</p>
      <p className="text-xs text-muted-foreground">{detalhe}</p>
    </CardContent></Card>
  );
}

/** Um vendedor: faixa atual, quanto falta para a próxima e a escada inteira. */
function CartaoVendedor({ linha: l }: { linha: LinhaComissaoDinamica }) {
  const escada = escadaFaixas(l.faixas, l.faturamento);
  const atual = escada.find((d) => d.atual) ?? null;
  const proxima = escada.find((d) => !d.alcancada) ?? null;
  // a barra vai do começo da faixa atual (ou de zero) até o começo da próxima
  const inicio = atual?.venda_minima ?? 0;
  const progresso = proxima
    ? Math.max(0, Math.min(100, ((l.faturamento - inicio) / (proxima.venda_minima - inicio)) * 100))
    : 100;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium truncate">{l.nome}</p>
            <p className="text-xs text-muted-foreground">
              {l.cargo ?? "—"} · {num(l.vendas)} {l.vendas === 1 ? "venda" : "vendas"} · {num(l.itens)} {l.itens === 1 ? "item" : "itens"}
              {l.demitido_em ? " · demitido" : ""}
            </p>
          </div>
          <Badge variant={atual ? "default" : "outline"} className="tabular-nums">
            {atual ? `Faixa de ${fmtPct(atual.percentual)}` : "Abaixo da 1ª faixa"}
          </Badge>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Faturamento</p>
            <p className="text-xl font-semibold tabular-nums">{brl(l.faturamento)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-muted-foreground">Comissão do mês</p>
            <p className="text-xl font-semibold tabular-nums">{brl(l.comissao)}</p>
          </div>
        </div>

        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar" aria-valuenow={Math.round(progresso)} aria-valuemin={0} aria-valuemax={100}>
            <div className={cn("h-full", proxima ? "bg-primary" : "bg-green-600")} style={{ width: `${progresso}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {proxima ? (
              <>Faltam <b className="text-foreground">{brl(proxima.venda_minima - l.faturamento)}</b> para
                a faixa de <b className="text-foreground">{fmtPct(proxima.percentual)}</b>: ao chegar lá, a comissão
                sobre vendas do mês vai a pelo menos <b className="text-foreground">{brl(proxima.comissao)}</b>
                {atual ? <> (hoje {brl(atual.comissao)})</> : null}.</>
            ) : (
              <>Na faixa mais alta.</>
            )}
          </p>
        </div>

        <ul className="space-y-1 text-xs">
          {escada.map((d) => (
            <li key={d.venda_minima}
              className={cn("flex items-center justify-between gap-2 rounded px-2 py-1",
                d.atual ? "bg-primary/10 font-medium" : d.alcancada ? "text-muted-foreground" : "")}>
              <span>A partir de {brl(d.venda_minima)}</span>
              <span className="tabular-nums">{fmtPct(d.percentual)}{d.atual ? " · atual" : d.alcancada ? " · passou" : ""}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

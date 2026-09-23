// ============================================================
// Página: Relatórios
//
// Antes esta tela eram seis cards com números e nada mais: "Receita Total",
// "Vendas", "Ticket Médio" — sem período, sem filtro e sem como ver o que
// compõe cada número. A receita era de TODOS os tempos, e conferir um valor
// ou achar o lançamento errado era impossível por aqui.
//
// Agora: período obrigatório, filtros por loja/vendedor/forma/status,
// cada relatório abre linha a linha, ordena por qualquer coluna, soma no
// rodapé e exporta planilha.
//
// Os quatro relatórios respondem as perguntas do balcão: o que vendi, o
// que saiu da prateleira, o que passou pelo caixa e o que está a receber.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { FiltrosRelatorio, periodoPadrao, type Periodo } from "@/components/relatorio/filtros-relatorio";
import { TabelaRelatorio } from "@/components/relatorio/tabela-relatorio";
import { DetalhesCaixaDialog } from "@/components/detalhes-caixa";
import type { Coluna } from "@/lib/exportar-csv";
import {
  useRelatorioVendas, useRelatorioFechamentos, useContas, useVendedores, useLojas,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { brl, num } from "@/lib/format";

const TODOS = "__todos__";

/**
 * @param embutido quando renderizada como aba dentro de Relatórios
 *   Financeiros, o cabeçalho próprio sai — a tela já tem o dela.
 */
export function RelatoriosPage({ embutido = false }: { embutido?: boolean } = {}) {
  const { lojaId } = useAutoSelectLoja();
  const [aba, setAba] = useState("vendas");
  const [caixaDetalhe, setCaixaDetalhe] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>(periodoPadrao(30));
  // começa na loja do cabeçalho: é a que o operador está olhando
  const [loja, setLoja] = useState<string>(TODOS);
  useEffect(() => { if (lojaId && loja === TODOS) setLoja(lojaId); }, [lojaId]);
  const [vendedor, setVendedor] = useState<string>(TODOS);
  const [forma, setForma] = useState<string>(TODOS);
  const [status, setStatus] = useState<string>("finalizada");

  const { data: lojas = [] } = useLojas();
  const { data: vendedores = [] } = useVendedores();
  const lojaFiltro = loja === TODOS ? undefined : loja;

  const { data: vendas = [], isLoading: carregandoVendas } =
    useRelatorioVendas({ lojaId: lojaFiltro, de: periodo.de, ate: periodo.ate });
  const { data: fechamentos = [], isLoading: carregandoFech } =
    useRelatorioFechamentos({ lojaId: lojaFiltro, de: periodo.de, ate: periodo.ate });
  const { data: contas = [], isLoading: carregandoContas } =
    useContas({ lojaId: lojaFiltro });

  const nomeVendedor = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of vendedores as any[]) m.set(v.id, v.nome ?? v.cargo ?? "—");
    return m;
  }, [vendedores]);

  // ---------- vendas, já filtradas pelos filtros próprios ----------
  const vendasFiltradas = useMemo(() => {
    return (vendas as any[]).filter((v) => {
      if (status !== TODOS && v.status !== status) return false;
      if (vendedor !== TODOS && v.vendedor_id !== vendedor) return false;
      if (forma !== TODOS && v.forma_pagamento !== forma) return false;
      return true;
    });
  }, [vendas, status, vendedor, forma]);

  const colVendas: Coluna<any>[] = [
    { chave: "data_venda", titulo: "Data", tipo: "data" },
    { chave: "numero_pedido", titulo: "Pedido" },
    { chave: "cliente", titulo: "Cliente", valor: (v) => v.cliente?.nome_razao ?? v.consumidor_nome ?? "Consumidor final" },
    { chave: "vendedor", titulo: "Vendedor", valor: (v) => nomeVendedor.get(v.vendedor_id) ?? "—" },
    { chave: "loja", titulo: "Loja", valor: (v) => v.loja?.apelido ?? v.loja?.nome ?? "—" },
    { chave: "forma_pagamento", titulo: "Pagamento", valor: (v) => String(v.forma_pagamento ?? "").replace("_", " ") },
    { chave: "status", titulo: "Situação" },
    { chave: "itens", titulo: "Itens", tipo: "numero", valor: (v) => (v.itens ?? []).reduce((s: number, i: any) => s + Number(i.quantidade || 0), 0), total: true },
    { chave: "subtotal", titulo: "Bruto", tipo: "dinheiro", total: true },
    { chave: "desconto", titulo: "Desconto", tipo: "dinheiro", total: true },
    { chave: "total", titulo: "Líquido", tipo: "dinheiro", total: true },
    { chave: "custo_total", titulo: "Custo", tipo: "dinheiro", total: true },
    { chave: "lucro_total", titulo: "Lucro", tipo: "dinheiro", total: true },
  ];

  // ---------- produtos vendidos: soma os itens das vendas filtradas ----------
  const produtosVendidos = useMemo(() => {
    const m = new Map<string, any>();
    for (const v of vendasFiltradas) {
      for (const i of (v.itens ?? []) as any[]) {
        const chave = i.produto_id ?? i.nome;
        const atual = m.get(chave) ?? { nome: i.nome, quantidade: 0, receita: 0, vendas: 0 };
        atual.quantidade += Number(i.quantidade || 0);
        atual.receita += Number(i.subtotal || 0);
        atual.vendas += 1;
        m.set(chave, atual);
      }
    }
    return [...m.values()].sort((a, b) => b.receita - a.receita);
  }, [vendasFiltradas]);

  const colProdutos: Coluna<any>[] = [
    { chave: "nome", titulo: "Produto" },
    { chave: "quantidade", titulo: "Qtd. vendida", tipo: "numero", total: true },
    { chave: "vendas", titulo: "Nº de vendas", tipo: "numero", total: true },
    { chave: "receita", titulo: "Receita", tipo: "dinheiro", total: true },
    { chave: "ticket", titulo: "Preço médio", tipo: "dinheiro", valor: (p) => (p.quantidade ? p.receita / p.quantidade : 0) },
  ];

  // ---------- fechamentos de caixa ----------
  const fechamentosFiltrados = useMemo(() => {
    if (vendedor === TODOS) return fechamentos as any[];
    // o fechamento guarda o usuário; o filtro é por vendedor (funcionário)
    const usuarioDoVendedor = (vendedores as any[]).find((v) => v.id === vendedor)?.usuario_id;
    return (fechamentos as any[]).filter((f) => f.usuario_id === usuarioDoVendedor);
  }, [fechamentos, vendedor, vendedores]);

  const colFechamentos: Coluna<any>[] = [
    { chave: "data_fechamento", titulo: "Fechamento", tipo: "data" },
    // o nome do caixa cadastrado; o número é a reserva para turno antigo
    { chave: "caixa", titulo: "Caixa", valor: (f) =>
        f.caixa?.ponto?.nome ?? (f.caixa?.numero_caixa != null ? `Caixa ${f.caixa.numero_caixa}` : "—") },
    { chave: "operador", titulo: "Operador", valor: (f) => {
        const v = (vendedores as any[]).find((x) => x.usuario_id === f.usuario_id);
        return v?.nome ?? "—";
      } },
    { chave: "valor_inicial", titulo: "Troco inicial", tipo: "dinheiro", total: true },
    { chave: "valor_vendas", titulo: "Vendas", tipo: "dinheiro", total: true },
    { chave: "valor_sangrias", titulo: "Sangrias", tipo: "dinheiro", total: true },
    { chave: "valor_entradas", titulo: "Entradas", tipo: "dinheiro", total: true },
    { chave: "valor_dinheiro", titulo: "Dinheiro", tipo: "dinheiro", total: true },
    { chave: "valor_pix", titulo: "PIX", tipo: "dinheiro", total: true },
    { chave: "valor_cartao_credito", titulo: "Crédito", tipo: "dinheiro", total: true },
    { chave: "valor_cartao_debito", titulo: "Débito", tipo: "dinheiro", total: true },
    { chave: "valor_final", titulo: "Informado", tipo: "dinheiro", total: true },
    { chave: "diferenca", titulo: "Diferença", tipo: "dinheiro", total: true },
  ];

  // ---------- contas do período ----------
  const contasFiltradas = useMemo(() => {
    return (contas as any[]).filter((c) => {
      const d = String(c.data_vencimento ?? "").slice(0, 10);
      return d >= periodo.de && d <= periodo.ate;
    });
  }, [contas, periodo]);

  const colContas: Coluna<any>[] = [
    { chave: "data_vencimento", titulo: "Vencimento", tipo: "data" },
    { chave: "tipo", titulo: "Tipo" },
    { chave: "descricao", titulo: "Descrição" },
    { chave: "pessoa", titulo: "Pessoa", valor: (c) => c.pessoa?.nome_razao ?? "—" },
    { chave: "categoria", titulo: "Categoria" },
    { chave: "forma_pagamento", titulo: "Forma" },
    { chave: "status", titulo: "Situação" },
    { chave: "valor", titulo: "Valor", tipo: "dinheiro", total: true },
  ];

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Relatórios" />;

  const receita = vendasFiltradas.reduce((s, v) => s + Number(v.total || 0), 0);
  const lucro = vendasFiltradas.reduce((s, v) => s + Number(v.lucro_total || 0), 0);
  const ticket = vendasFiltradas.length ? receita / vendasFiltradas.length : 0;

  const limpar = () => {
    setPeriodo(periodoPadrao(30));
    setLoja(TODOS); setVendedor(TODOS); setForma(TODOS); setStatus("finalizada");
  };

  return (
    <div className="space-y-4">
      {!embutido && (
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BarChart3 className="h-6 w-6" /> Relatórios
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todo número aqui abre linha a linha, ordena por qualquer coluna e vira planilha.
          </p>
        </div>
      )}

      <FiltrosRelatorio periodo={periodo} aoMudarPeriodo={setPeriodo} aoLimpar={limpar}>
        <div>
          <Label className="text-xs">Loja</Label>
          <Select value={loja} onValueChange={setLoja}>
            <SelectTrigger className="mt-1 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas as lojas</SelectItem>
              {lojas.map((l: any) => (
                <SelectItem key={l.id} value={l.id}>{l.apelido || l.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Vendedor</Label>
          <Select value={vendedor} onValueChange={setVendedor}>
            <SelectTrigger className="mt-1 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {(vendedores as any[]).map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.nome ?? v.cargo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Pagamento</Label>
          <Select value={forma} onValueChange={setForma}>
            <SelectTrigger className="mt-1 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas</SelectItem>
              <SelectItem value="dinheiro">Dinheiro</SelectItem>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
              <SelectItem value="cartao_debito">Cartão débito</SelectItem>
              <SelectItem value="crediario">Crediário</SelectItem>
              <SelectItem value="boleto">Boleto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Situação da venda</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="mt-1 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="finalizada">Finalizadas</SelectItem>
              <SelectItem value={TODOS}>Todas</SelectItem>
              <SelectItem value="cancelada">Canceladas</SelectItem>
              <SelectItem value="devolvida">Devolvidas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FiltrosRelatorio>

      {/* Os números do topo respeitam os MESMOS filtros da tabela abaixo —
          senão o card e a lista se contradizem na mesma tela. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { rotulo: "Receita no período", valor: brl(receita), cor: "text-green-600" },
          { rotulo: "Vendas", valor: num(vendasFiltradas.length), cor: "" },
          { rotulo: "Ticket médio", valor: brl(ticket), cor: "" },
          { rotulo: "Lucro", valor: brl(lucro), cor: lucro >= 0 ? "text-green-600" : "text-red-600" },
        ].map((k) => (
          <Card key={k.rotulo}>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">{k.rotulo}</p>
              {carregandoVendas
                ? <Loader2 className="mt-2 h-5 w-5 animate-spin" />
                : <p className={`mt-1 text-2xl font-semibold ${k.cor}`}>{k.valor}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={aba} onValueChange={setAba} className="space-y-3">
        <TabsList>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="produtos">Produtos vendidos</TabsTrigger>
          <TabsTrigger value="caixa">Fechamentos de caixa</TabsTrigger>
          <TabsTrigger value="contas">Contas</TabsTrigger>
        </TabsList>

        <TabsContent value="vendas">
          <TabelaRelatorio titulo="Vendas" itens={vendasFiltradas} colunas={colVendas}
            carregando={carregandoVendas} de={periodo.de} ate={periodo.ate}
            vazio="Nenhuma venda no período com estes filtros." />
        </TabsContent>

        <TabsContent value="produtos">
          <TabelaRelatorio titulo="Produtos vendidos" itens={produtosVendidos} colunas={colProdutos}
            carregando={carregandoVendas} de={periodo.de} ate={periodo.ate}
            vazio="Nenhum produto vendido no período." />
        </TabsContent>

        <TabsContent value="caixa">
          {/* clicar na linha abre o turno inteiro, com as vendas e os
              movimentos, e reimprime o comprovante */}
          <TabelaRelatorio titulo="Fechamentos de caixa" itens={fechamentosFiltrados} colunas={colFechamentos}
            carregando={carregandoFech} de={periodo.de} ate={periodo.ate}
            aoClicar={(f: any) => setCaixaDetalhe(f.caixa_id)}
            vazio="Nenhum caixa fechado no período." />
        </TabsContent>

        <TabsContent value="contas">
          <TabelaRelatorio titulo="Contas" itens={contasFiltradas} colunas={colContas}
            carregando={carregandoContas} de={periodo.de} ate={periodo.ate}
            vazio="Nenhuma conta vencendo no período." />
        </TabsContent>
      </Tabs>

      <DetalhesCaixaDialog caixaId={caixaDetalhe} onOpenChange={(v) => !v && setCaixaDetalhe(null)} />
    </div>
  );
}

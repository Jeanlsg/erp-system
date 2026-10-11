// ============================================================
// Página: Página Inicial — no MESMO desenho da página inicial do Excellent
// Sistemas (o sistema anterior da loja), conferido lá em 11/10/2026:
//
//   saudação + "Ocultar informações"
//   Clientes · Ticket Médio · Produtos · Funcionários | Quantidade de itens | Ocorrências
//   Quantidade de vendas | Vendas realizadas | Custos em vendas | Lucro total em vendas
//   Favoritos | Configuração · Links úteis | Alerta de estoque mínimo · Certificado
//
// O que era propaganda do próprio Excellent (Lançamentos, Franquias, os
// telefones do suporte deles) não entrou. Os gráficos que o ERP já tinha
// ficam no fim, em "Análise do período", com o período escolhido na tela.
//
// Tudo é da filial do seletor do topo. As vendas vêm de useRelatorioVendas,
// não de useVendas: aquele para em 200 linhas.
// ============================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertCircle, AlertTriangle, ArrowDown, ArrowUp, ArrowUpRight, BookOpen, Calculator,
  CircleDollarSign, Eye, EyeOff, HandCoins, Package, PackageX, Plus, Receipt, ShieldCheck,
  ShoppingBasket, Star, TrendingUp, UserRound, Users, Wallet, Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { FiltrosRelatorio, periodoPadrao, type Periodo } from "@/components/relatorio/filtros-relatorio";
import { sections, type NavItem } from "@/components/app-sidebar";
import {
  useProdutosComEstoque, useRelatorioVendas, useContasVencidas, useResumoInicio,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAuth } from "@/lib/store/auth-store";
import { periodosDoMes, variacao } from "@/lib/comparar-mes";
import { brl, num, pct } from "@/lib/format";

const CORES = [
  "hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--muted-foreground))",
];

const NOME_FORMA: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", cartao_credito: "Cartão crédito",
  cartao_debito: "Cartão débito", crediario: "Crediário", boleto: "Boleto",
};

// ---- preferências deste navegador (só conveniência: sem elas a tela funciona) ----
const CHAVE_OCULTAR = "erp:inicio:ocultar";
const CHAVE_FAVORITOS = "erp:inicio:favoritos";
// os mesmos do Excellent da loja, no que existe aqui
const FAVORITOS_PADRAO = ["/financeiro", "/produtos-estoque-lotes", "/pdv", "/notas-fiscais"];

function lerPreferencia<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch { return padrao; }
}
function gravarPreferencia(chave: string, valor: unknown) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento: vale só nesta visita */ }
}

/** Páginas do menu (folhas), para escolher favoritos e saber a permissão de cada atalho. */
const PAGINAS_DO_MENU: NavItem[] = (() => {
  const vistas = new Set<string>();
  const lista: NavItem[] = [];
  for (const s of sections) for (const i of s.items) for (const f of i.children ?? [i]) {
    if (!f.url || f.external || vistas.has(f.url)) continue;
    vistas.add(f.url);
    lista.push(f);
  }
  return lista;
})();
const paginaDoMenu = (url: string) => PAGINAS_DO_MENU.find((p) => p.url === url);

function saudacao(agora = new Date()) {
  const h = agora.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/** Ícone redondo e colorido, como nos cartões do Excellent. */
function Bolinha({ icon: Icon, cor }: { icon: any; cor: string }) {
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cor}`}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

function Valor({ oculto, children, className = "" }: { oculto: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={`tabular-nums ${oculto ? "select-none blur-sm" : ""} ${className}`} aria-hidden={oculto || undefined}>
      {children}
    </span>
  );
}

export function DashboardPage() {
  const { user, can } = useAuth();
  const veFinanceiro = can("financeiro.ver");
  const [oculto, setOculto] = useState<boolean>(() => lerPreferencia(CHAVE_OCULTAR, false));
  const alternarOculto = () => { setOculto((o) => { gravarPreferencia(CHAVE_OCULTAR, !o); return !o; }); };

  const { lojaId, lojas } = useAutoSelectLoja();
  const loja = lojaId ?? undefined;
  const lojaAtual = (lojas as any[]).find((l) => l.id === lojaId);
  const nomeLoja = lojaAtual?.apelido ?? "filial";

  // ---- mês corrente x mesmos dias do mês anterior ----
  const mes = useMemo(() => periodosDoMes(), []);
  const { data: vendasMes = [], isLoading: carregandoMes } = useRelatorioVendas({ lojaId: loja, de: mes.de, ate: mes.ate });
  const { data: vendasAnt = [] } = useRelatorioVendas({ lojaId: loja, de: mes.deAnterior, ate: mes.ateAnterior });
  const resumoDoMes = (lista: any[]) => {
    const fin = lista.filter((v) => v.loja_id === lojaId && v.status === "finalizada");
    const total = fin.reduce((s, v) => s + Number(v.total || 0), 0);
    const custo = fin.reduce((s, v) => s + Number(v.custo_total || 0), 0);
    const itens = fin.reduce((s, v) => s + ((v.itens ?? []) as any[]).reduce((a, i) => a + Number(i.quantidade || 0), 0), 0);
    return { qtd: fin.length, total, custo, lucro: total - custo, itens, ticket: fin.length ? total / fin.length : 0 };
  };
  const atual = useMemo(() => resumoDoMes(vendasMes as any[]), [vendasMes, lojaId]); // eslint-disable-line react-hooks/exhaustive-deps
  const antes = useMemo(() => resumoDoMes(vendasAnt as any[]), [vendasAnt, lojaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: resumo } = useResumoInicio(loja);
  const { data: produtos = [] } = useProdutosComEstoque(loja);

  // ---- favoritos ----
  const [favoritos, setFavoritos] = useState<string[]>(() => lerPreferencia(CHAVE_FAVORITOS, FAVORITOS_PADRAO));
  const [editandoFavoritos, setEditandoFavoritos] = useState(false);
  const alternarFavorito = (url: string) => setFavoritos((f) => {
    const novo = f.includes(url) ? f.filter((u) => u !== url) : [...f, url];
    gravarPreferencia(CHAVE_FAVORITOS, novo);
    return novo;
  });
  const podeAbrir = (url: string) => { const p = paginaDoMenu(url); return !!p && (!p.perm || can(p.perm)); };
  const paginasPermitidas = PAGINAS_DO_MENU.filter((p) => !p.perm || can(p.perm));

  // ---- alerta de estoque mínimo: esgotados antes, depois os mais abaixo do mínimo ----
  const paraRepor = useMemo(() => {
    if (!lojaId) return [];
    return (produtos as any[])
      .map((p) => ({ p, q: Number(p.estoque_por_loja?.[lojaId] ?? 0), min: Number(p.estoque_minimo ?? 0) }))
      .filter((x) => x.q === 0 || (x.min > 0 && x.q <= x.min))
      .sort((a, b) => (a.q === 0 ? -1 : 0) - (b.q === 0 ? -1 : 0) || (a.q - a.min) - (b.q - b.min));
  }, [produtos, lojaId]);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Página Inicial" />;

  const nomeNaSaudacao = (lojaAtual?.nome || user?.nome || "").toString().toUpperCase();
  const dias = resumo?.certificadoDias ?? null;

  const cartoesDoMes = [
    { titulo: "Quantidade de vendas", valor: atual.qtd, anterior: antes.qtd, formato: num,
      cor: "text-emerald-600", fundo: "bg-emerald-500/15 text-emerald-600", icone: CircleDollarSign, para: "/vendas", link: "Ver mais vendas" },
    { titulo: "Vendas realizadas", valor: atual.total, anterior: antes.total, formato: brl,
      cor: "text-sky-600", fundo: "bg-sky-500/15 text-sky-600", icone: HandCoins, para: "/vendas", link: "Ver mais vendas" },
    { titulo: "Custos em vendas", valor: atual.custo, anterior: antes.custo, formato: brl,
      cor: "text-amber-500", fundo: "bg-amber-500/15 text-amber-600", icone: Wallet, para: "/financeiro?aba=vendas", link: "Ver mais" },
    { titulo: "Lucro total em vendas", valor: atual.lucro, anterior: antes.lucro, formato: brl,
      cor: "text-indigo-700 dark:text-indigo-400", fundo: "bg-indigo-500/15 text-indigo-600", icone: Receipt, para: "/financeiro?aba=gerencial", link: "Ver mais" },
  ];

  return (
    <div className="space-y-4">
      {/* ---- saudação ---- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{saudacao()}{nomeNaSaudacao ? `, ${nomeNaSaudacao}` : ""}!</h1>
          <p className="text-sm text-muted-foreground">Veja como está sua loja hoje · {nomeLoja}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={alternarOculto}
          className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400">
          {oculto ? <Eye className="mr-1.5 h-4 w-4" /> : <EyeOff className="mr-1.5 h-4 w-4" />}
          {oculto ? "Mostrar informações" : "Ocultar informações"}
        </Button>
      </div>

      {/* ---- linha 1: cadastro | itens vendidos | ocorrências ---- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="md:col-span-2">
          <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Link to="/gestao/clientes" className="flex items-center gap-4">
              <Bolinha icon={UserRound} cor="bg-emerald-500/15 text-emerald-600" />
              <div><p className="text-2xl font-bold"><Valor oculto={oculto}>{num(resumo?.clientes ?? 0)}</Valor></p><p className="text-sm text-muted-foreground">Clientes</p></div>
            </Link>
            {veFinanceiro && (
              <div className="flex items-center gap-4">
                <Bolinha icon={CircleDollarSign} cor="bg-emerald-500/15 text-emerald-600" />
                <div><p className="text-2xl font-bold"><Valor oculto={oculto}>{brl(atual.ticket)}</Valor></p><p className="text-sm text-muted-foreground">Ticket Médio</p></div>
              </div>
            )}
            <Link to="/produtos-estoque-lotes" className="flex items-center gap-4">
              <Bolinha icon={Package} cor="bg-sky-500/15 text-sky-600" />
              <div><p className="text-2xl font-bold"><Valor oculto={oculto}>{num(resumo?.produtos ?? 0)}</Valor></p><p className="text-sm text-muted-foreground">Produtos</p></div>
            </Link>
            {can("usuario.ver") && (
              <Link to="/gestao/funcionarios" className="flex items-center gap-4">
                <Bolinha icon={Users} cor="bg-amber-500/15 text-amber-600" />
                <div><p className="text-2xl font-bold"><Valor oculto={oculto}>{num(resumo?.funcionarios ?? 0)}</Valor></p><p className="text-sm text-muted-foreground">Funcionários</p></div>
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="font-medium">Quantidade de itens</p>
            <div className="mt-4 flex items-center gap-4">
              <Bolinha icon={ShoppingBasket} cor="bg-violet-500/15 text-violet-600" />
              <div><p className="text-2xl font-bold"><Valor oculto={oculto}>{carregandoMes ? "…" : num(atual.itens)}</Valor></p><p className="text-sm text-muted-foreground">Vendidos no mês</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="font-medium">Ocorrências</p>
            <div className="mt-4 flex items-center gap-4">
              <Bolinha icon={AlertCircle} cor="bg-red-500/15 text-red-600" />
              <div>
                <p className="text-2xl font-bold"><Valor oculto={oculto}>{num(resumo?.ocorrencias ?? 0)}</Valor></p>
                <Link to="/gestao/ocorrencias" className="text-sm text-red-600 hover:underline">Ver Ocorrências</Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- linha 2: o mês em números, comparado com o mês anterior ---- */}
      {veFinanceiro && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cartoesDoMes.map((c) => {
            const v = variacao(c.valor, c.anterior);
            return (
              <Card key={c.titulo}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{c.titulo}</p>
                    {v !== null && !oculto && (
                      <span className={`flex items-center text-xs font-medium ${v < 0 ? "text-red-600" : "text-emerald-600"}`}
                        title={`Comparado com os mesmos dias do mês anterior (${mes.deAnterior.slice(8)} a ${mes.ateAnterior.slice(8)})`}>
                        {v < 0 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                        {pct(Math.abs(v))}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div>
                      <p className={`text-xl font-bold ${c.cor}`}><Valor oculto={oculto}>{carregandoMes ? "…" : c.formato(c.valor)}</Valor></p>
                      <Link to={c.para} className="text-xs text-muted-foreground underline hover:text-foreground">{c.link}</Link>
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-md ${c.fundo}`}><c.icone className="h-5 w-5" /></div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ---- linha 3: favoritos | configuração e links | alertas ---- */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Favoritos</CardTitle>
              <p className="text-xs text-muted-foreground">Seus atalhos neste computador</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Escolher favoritos"
              onClick={() => setEditandoFavoritos((e) => !e)}>
              <Wrench className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {editandoFavoritos ? (
              <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                {paginasPermitidas.map((p) => (
                  <label key={p.url} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent">
                    <input type="checkbox" checked={favoritos.includes(p.url)} onChange={() => alternarFavorito(p.url)} />
                    {p.title}
                  </label>
                ))}
              </div>
            ) : favoritos.filter(podeAbrir).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Toque na chave para escolher seus atalhos.</p>
            ) : (
              favoritos.filter(podeAbrir).map((url) => (
                <Link key={url} to={url} className="flex items-center gap-2 rounded-md bg-muted px-3 py-2.5 text-sm hover:bg-accent">
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  {paginaDoMenu(url)?.title}
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:col-span-2 md:grid-cols-2 lg:grid-cols-2 content-start">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Configuração</CardTitle>
              <p className="text-xs text-muted-foreground">Sistema</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {[
                { t: "Dados Empresariais", u: "/gestao/dados-empresariais" },
                { t: "Adm Usuários", u: "/gestao/usuarios" },
                { t: "Config do Sistema", u: "/config/sistema" },
                { t: "Agenda", u: "/gestao/agenda-compromissos" },
                { t: "Certificado Digital", u: "/gestao/nfe-certificado" },
                { t: "Lojas", u: "/lojas" },
              ].filter((l) => podeAbrir(l.u)).map((l) => (
                <Link key={l.u} to={l.u} className="hover:text-primary hover:underline">{l.t}</Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Links úteis</CardTitle>
              <p className="text-xs text-muted-foreground">atalhos</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <Link to="/tutoriais" className="hover:text-primary hover:underline">Suporte / Vídeos</Link>
              <Link to="/ajuda" className="hover:text-primary hover:underline">Ajuda</Link>
              <Link to="/treinamento/tutoriais" className="hover:text-primary hover:underline">Treinamento</Link>
              <a href="https://fast.com/pt/" target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">Testar velocidade</a>
            </CardContent>
          </Card>

          {/* no lugar dos banners do Excellent: os mesmos destinos, aqui dentro */}
          <Link to="/tutoriais" className="block">
            <Card className="h-full bg-gradient-to-br from-teal-500/15 to-transparent transition hover:border-primary">
              <CardContent className="flex items-center gap-4 p-5">
                <Bolinha icon={BookOpen} cor="bg-teal-500/20 text-teal-700 dark:text-teal-300" />
                <div>
                  <p className="font-semibold">Tutoriais</p>
                  <p className="text-xs text-muted-foreground">Passo a passo de cada tela para tirar dúvidas.</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          {podeAbrir("/gestao/painel-contador") && (
            <Link to="/gestao/painel-contador" className="block">
              <Card className="h-full bg-gradient-to-br from-blue-500/15 to-transparent transition hover:border-primary">
                <CardContent className="flex items-center gap-4 p-5">
                  <Bolinha icon={Calculator} cor="bg-blue-500/20 text-blue-700 dark:text-blue-300" />
                  <div>
                    <p className="font-semibold">Acessar meu Contador</p>
                    <p className="text-xs text-muted-foreground">Notas e contas do mês prontas para a contadora.</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">Alerta</CardTitle>
                <p className="text-xs text-muted-foreground">Estoque Mínimo</p>
              </div>
              <Link to="/produtos-estoque-lotes" className="flex items-center text-xs text-muted-foreground hover:text-foreground">
                <Plus className="h-3 w-3" /> Ver mais
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {paraRepor.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Nada esgotado nem abaixo do mínimo.</p>
              ) : paraRepor.slice(0, 5).map(({ p, q, min }) => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <span className="w-16 shrink-0 rounded bg-red-500/15 px-1 text-center text-xs text-red-600" title="Saldo">{num(q)} | und</span>
                  <span className="w-16 shrink-0 rounded bg-emerald-500/15 px-1 text-center text-xs text-emerald-700 dark:text-emerald-400" title="Mínimo">{num(min)} | und</span>
                  <span className="truncate">{p.nome}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Validade Certificado Digital</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {dias === null ? (
                <p className="text-muted-foreground">Nenhum certificado cadastrado nesta filial.</p>
              ) : (
                <p className={dias < 0 ? "font-semibold text-red-600" : dias <= 30 ? "font-semibold text-amber-600" : ""}>
                  <ShieldCheck className="mr-1 inline h-4 w-4" />
                  {dias < 0 ? `Certificado vencido há ${num(-dias)} dia(s)` : `Certificado com validade: ${num(dias)} dia(s)`}
                </p>
              )}
              {podeAbrir("/gestao/nfe-certificado") && (
                <Link to="/gestao/nfe-certificado" className="mt-1 inline-block font-medium hover:underline">
                  {dias === null ? "Clique aqui para cadastrar" : "Clique aqui para renovar"}
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---- do ERP: a análise que já existia, com período livre ---- */}
      {veFinanceiro && <AnalisePeriodo lojaId={lojaId} nomeLoja={nomeLoja} oculto={oculto} />}
    </div>
  );
}

function Kpi({ label, value, hint, icon: Icon, tone = "default", para }: any) {
  const cor = tone === "destructive" ? "bg-destructive/10 text-destructive"
    : tone === "warning" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
    : "bg-primary/10 text-primary";
  const corpo = (
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cor}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CardContent>
  );
  return para
    ? <Card className="transition hover:border-primary"><Link to={para}>{corpo}</Link></Card>
    : <Card>{corpo}</Card>;
}

/** Gráficos e listas que o painel já tinha, agora abaixo do desenho do Excellent. */
function AnalisePeriodo({ lojaId, nomeLoja, oculto }: { lojaId: string | null; nomeLoja: string; oculto: boolean }) {
  const [periodo, setPeriodo] = useState<Periodo>(periodoPadrao(30));
  const loja = lojaId ?? undefined;
  const { data: produtos = [] } = useProdutosComEstoque(loja);
  const { data: contasVencidas = [] } = useContasVencidas(loja);
  const { data: vendas = [], isLoading } = useRelatorioVendas({ lojaId: loja, de: periodo.de, ate: periodo.ate });

  const vendasFiltradas = useMemo(
    () => (vendas as any[]).filter((v) => v.loja_id === lojaId && v.status === "finalizada"),
    [vendas, lojaId],
  );

  const kpis = useMemo(() => {
    const total = vendasFiltradas.reduce((s, v) => s + Number(v.total || 0), 0);
    const custo = vendasFiltradas.reduce((s, v) => s + Number(v.custo_total || 0), 0);
    const lucro = total - custo;
    return { total, lucro, margem: total > 0 ? lucro / total : 0, ticket: vendasFiltradas.length ? total / vendasFiltradas.length : 0, qtd: vendasFiltradas.length };
  }, [vendasFiltradas]);

  const estoque = useMemo(() => {
    let baixo = 0, esgotado = 0, valor = 0;
    if (lojaId) for (const p of produtos as any[]) {
      const q = p.estoque_por_loja?.[lojaId] ?? 0;
      valor += q * Number(p.preco_custo || 0);
      if (q === 0) esgotado++;
      else if (q <= p.estoque_minimo) baixo++;
    }
    return { baixo, esgotado, valor };
  }, [produtos, lojaId]);

  const vencidas = useMemo(
    () => (contasVencidas as any[]).filter((c) => !c.loja_id || c.loja_id === lojaId),
    [contasVencidas, lojaId],
  );
  const valorVencido = vencidas.reduce((s, c) => s + Number(c.valor || 0), 0);

  const porDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of vendasFiltradas) {
      const dia = String(v.data_venda).slice(0, 10);
      m.set(dia, (m.get(dia) ?? 0) + Number(v.total || 0));
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dia, total]) => ({ dia: dia.slice(8, 10) + "/" + dia.slice(5, 7), total })).slice(-60);
  }, [vendasFiltradas]);

  const porPagamento = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of vendasFiltradas) {
      const f = v.forma_pagamento ?? "outros";
      m.set(f, (m.get(f) ?? 0) + Number(v.total || 0));
    }
    return [...m.entries()].map(([f, total]) => ({ nome: NOME_FORMA[f] ?? f, total }));
  }, [vendasFiltradas]);

  const topProdutos = useMemo(() => {
    const m = new Map<string, { nome: string; quantidade: number; total: number }>();
    for (const v of vendasFiltradas) for (const i of (v.itens ?? []) as any[]) {
      const chave = i.produto_id ?? i.nome;
      const a = m.get(chave) ?? { nome: i.nome, quantidade: 0, total: 0 };
      a.quantidade += Number(i.quantidade || 0);
      a.total += Number(i.subtotal || 0);
      m.set(chave, a);
    }
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  }, [vendasFiltradas]);

  const semVenda = !isLoading && vendasFiltradas.length === 0;
  const dinheiro = (n: number) => (oculto ? "R$ •••" : brl(n));
  const estiloTooltip = { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <h2 className="text-base font-semibold">Análise do período · {nomeLoja}</h2>
        <p className="text-sm text-muted-foreground">Escolha o período para ver as vendas por dia, as formas de pagamento e os mais vendidos.</p>
      </div>
      <FiltrosRelatorio periodo={periodo} aoMudarPeriodo={setPeriodo} aoLimpar={() => setPeriodo(periodoPadrao(30))} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Faturamento" icon={TrendingUp} value={isLoading ? "…" : dinheiro(kpis.total)}
          hint={`${num(kpis.qtd)} venda(s) · ticket ${dinheiro(kpis.ticket)}`} />
        <Kpi label="Lucro bruto" icon={Receipt} value={isLoading ? "…" : dinheiro(kpis.lucro)}
          hint={`Margem ${oculto ? "••" : pct(kpis.margem)}`} tone={kpis.lucro < 0 ? "destructive" : "default"} />
        <Kpi label="Estoque baixo" icon={PackageX} para="/produtos-estoque-lotes"
          value={num(estoque.baixo)} hint={`${num(estoque.esgotado)} esgotado(s)`} tone={estoque.baixo > 0 ? "destructive" : "default"} />
        <Kpi label="Contas vencidas" icon={AlertTriangle} para="/financeiro?aba=apagar"
          value={num(vencidas.length)} hint={dinheiro(valorVencido)} tone={vencidas.length > 0 ? "destructive" : "default"} />
        <Kpi label="Valor em estoque" icon={Wallet} value={dinheiro(estoque.valor)} hint="a preço de custo" tone="warning" />
      </div>

      {semVenda ? (
        <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">Nenhuma venda desta filial no período.</CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-base">Vendas por dia</CardTitle></CardHeader>
              <CardContent className={`h-80 ${oculto ? "blur-sm" : ""}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porDia} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$ ${v}`} />
                    <Tooltip formatter={(v: number) => brl(v)} contentStyle={estiloTooltip} />
                    <Bar dataKey="total" name="Vendas" fill={CORES[0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Formas de pagamento</CardTitle></CardHeader>
              <CardContent className={`h-80 ${oculto ? "blur-sm" : ""}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={porPagamento} dataKey="total" nameKey="nome" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {porPagamento.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => brl(v)} contentStyle={estiloTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Produtos mais vendidos</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/financeiro?aba=relatorios">Relatórios <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow><TableHead className="w-10">#</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Qtd.</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {topProdutos.map((p, i) => (
                    <TableRow key={p.nome}>
                      <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="max-w-[18rem] truncate font-medium">{p.nome}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(p.quantidade)} un.</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{dinheiro(p.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

import { useMemo, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home, Calculator, Wallet, Receipt, Truck, Bike, MessageSquare, ShoppingCart, Barcode, CreditCard, Wrench, FileText, Users, Building2, Package, Calendar, LineChart, Briefcase, Mail, Settings, Cog, Store, Key, HelpCircle, PanelLeftClose, PanelLeftOpen, LayoutDashboard, RotateCcw, PackagePlus, ShoppingBag, ArrowLeftRight, ScrollText, Banknote, AlertTriangle, Shield, Search, Smartphone, Star, Lock, Network, Send, FolderTree, ScanBarcode, ChevronRight, Minus, Flag, ChevronDown, ExternalLink, BookOpen, TrendingUp,
} from "lucide-react";

import { useAuth, roleLabels, type Permission } from "@/lib/store/auth-store";
import { useSidebarCollapsed, toggleSidebar, useSectionCollapsed, toggleSection } from "@/lib/store/sidebar-store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFeatureFlags } from "@/lib/supabase-queries";
import { cn } from "@/lib/utils";

export type NavItem = {
  title: string;
  /** vazio quando o item é só um grupo expansível */
  url: string;
  icon: typeof Home;
  exact?: boolean;
  perm?: Permission;
  /** Página ainda sem rota implementada — exibida com a tag "Em breve". */
  soon?: boolean;
  badge?: string;
  /** Subgrupo expansível — o segundo nível do menu, como no Excellent. */
  children?: NavItem[];
  /** Link externo: abre em nova aba, não passa por flag nem por rota. */
  external?: boolean;
  /** Outras rotas que acendem este item (telas abertas por abas dentro dele). */
  tambem?: string[];
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

/**
 * Endereços que abrem a MESMA tela de outro endereço.
 *
 * O sistema tem apelidos de rota por compatibilidade com os endereços do
 * Excellent, de onde a equipe veio. Só o endereço que está no menu tem
 * permissão declarada, então o apelido abria a tela para qualquer usuário
 * logado: /gestao/administrar-usuarios dava a gestão de usuários, e
 * /funcionarios dava os salários. Aqui cada apelido aponta para o
 * endereço que manda.
 *
 * O teste apelidos-rota.test.ts lê o App.tsx e falha quando um apelido
 * novo fica de fora — é o que impede o furo de voltar.
 */
export const ROTAS_APELIDO: Record<string, string> = {
  "/gestao/gerar-crediario-proprio": "/crediario-proprio",
  "/gestao/gerar-promissoria": "/promissoria",
  "/gestao/gerar-boleto": "/gerador-boletos",
  "/gestao/relatorios-financeiros": "/financeiro",
  "/financeiro/relatorios": "/financeiro",
  "/fornecedores": "/gestao/fornecedores",
  "/funcionarios": "/gestao/funcionarios",
  "/gestao/pasta-principal": "/gestao/arquivos-pastas",
  "/gestao/administrar-usuarios": "/gestao/usuarios",
  "/gestao/usuario-permissoes": "/gestao/usuarios",
  "/gestao/minhas-chaves": "/config/minhas-chaves",
  "/config/downloads": "/gestao/downloads",
  "/gestao/faturamento": "/faturamento",
  "/pedidos": "/vendas",
  "/lotes": "/produtos-estoque-lotes",
  "/gestao/lotes": "/produtos-estoque-lotes",
  "/produtos": "/produtos-estoque-lotes",
  "/gestao/cadastro-produtos": "/produtos-estoque-lotes",
  "/estoque": "/produtos-estoque-lotes",
  "/gestao/estoque": "/produtos-estoque-lotes",
  "/gestao/compras/importar-nfe": "/compras/importar-nfe",
  "/gestao/remessas": "/remessas",
  "/gestao/transferencia-estoque": "/remessas",
  "/estoque.transferencia": "/remessas",
  "/relatorios/financeiro": "/financeiro/relatorio",
};

/**
 * Permissão exigida por uma rota, lida da MESMA estrutura que monta o menu.
 *
 * O guard de rota (root-layout) consulta isto. Manter um segundo mapa
 * rota→permissão apodreceria: o menu esconderia um item que a URL abre, ou
 * o contrário. Rota sem item de menu, ou item sem `perm`, é aberta a todo
 * usuário logado — Dashboard, Ajuda e Tutoriais estão nesse caso de
 * propósito.
 */
export function permissaoDaRota(pathname: string): Permission | null {
  // apelido primeiro: /funcionarios responde pela permissão de
  // /gestao/funcionarios, que é quem está no menu
  const canonica = ROTAS_APELIDO[pathname]
    ?? Object.entries(ROTAS_APELIDO).find(([a]) => pathname.startsWith(a + "/"))?.[1];
  if (canonica) pathname = canonica;

  const folhas: NavItem[] = [];
  const varre = (itens: NavItem[]) => {
    for (const i of itens) {
      if (i.children) varre(i.children);
      else if (i.url && !i.external) folhas.push(i);
    }
  };
  for (const s of sections) varre(s.items);

  // a rota mais específica ganha: /gestao/clientes antes de /gestao
  const casa = folhas
    .filter((i) => {
      const base = i.url.split("?")[0];
      return pathname === base || pathname.startsWith(base + "/");
    })
    .sort((a, b) => b.url.length - a.url.length)[0];
  if (casa?.perm) return casa.perm;
  const aba = ABAS_NOTAS_FISCAIS
    .filter((a) => { const base = a.url.split("?")[0]; return pathname === base || pathname.startsWith(base + "/"); })
    .sort((a, b) => b.url.length - a.url.length)[0];
  return aba?.perm ?? casa?.perm ?? null;
}

// Preto com destaque vermelho vivo, como pediu a loja (10/10/2026): o
// degradê vinho anterior era "um preto meio apagado, um vermelho bem apagado,
// doía a vista".
const SIDEBAR_BG =
  "linear-gradient(180deg, #161616 0%, #0b0b0b 100%)";

// Ícones auxiliares (locais — `as any` para compatibilidade com o tipo do lucide-react)
const Bell: any = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
const MapPin: any = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const ThumbsUp: any = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 10v12" />
    <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l3.34-7A2 2 0 0 1 12.16 2c.55 0 1.07.22 1.45.62.39.39.6.93.55 1.48L13.7 5.88Z" />
  </svg>
);

// ========= CONFIGURAÇÃO DO ENCAIXE DA ABA ATIVA =========
const BULGE_WIDTH = 40;
const BULGE_HEIGHT = 0;
const TAB_RADIUS = 100;
const SCROLLBAR_W = 0;
// =========================================================

// ============================================================
// Menu na MESMA estrutura do Excellent Sistemas (o ERP anterior da
// X-Life): as mesmas seções, os mesmos grupos, a mesma ordem e os
// mesmos nomes — para a equipe que migra achar tudo onde sempre
// esteve. Extraído das páginas salvas em
// supplement-store-erp-x-life/excellentsistemas (menu idêntico nas 70).
//
// O que o Excellent não tinha (Kardex, inventário, kits, importação
// de NF-e, fiscal, lojas…) entra no grupo onde um usuário deles
// procuraria. O que não existe aqui (Comanda/Mesa, DOC/TED, consulta
// veicular) simplesmente não aparece. Flags e permissões continuam
// mandando: item desligado some, grupo vazio some.
// ============================================================
// Telas fiscais que, como no Excellent, abrem pelas abas de "Notas Fiscais"
// (Notas vendas, Notas entrada, Notas devolução fornecedor…) e não têm item
// próprio no menu. Sem esta lista elas ficariam abertas a qualquer usuário
// logado: permissaoDaRota só enxerga o que está no menu.
export const ABAS_NOTAS_FISCAIS: { titulo: string; url: string; perm: Permission }[] = [
  { titulo: "Notas vendas", url: "/notas-fiscais", perm: "fiscal.emitir" },
  { titulo: "Notas entrada", url: "/compras/importar-nfe", perm: "compra.criar" },
  { titulo: "Notas devolução fornecedor", url: "/devolucao-fornecedor", perm: "compra.criar" },
  { titulo: "Inutilização sequência", url: "/notas-fiscais?aba=inutilizacoes", perm: "fiscal.emitir" },
  { titulo: "Manifesto", url: "/fiscal/notas-recebidas", perm: "compra.criar" },
  { titulo: "Sintegra / SPED", url: "/fiscal/escrituracao", perm: "fiscal.emitir" },
  // do ERP (o Excellent não tinha):
  { titulo: "Remessas entre filiais", url: "/remessas", perm: "fiscal.emitir" },
  { titulo: "Relatório da contadora", url: "/fiscal/relatorio-contadora", perm: "fiscal.emitir" },
  { titulo: "Documentos demonstrativos", url: "/gestao/documentos-demonstrativos", perm: "fiscal.emitir" },
];

// ============================================================
// Menu com os MESMOS nomes e nas MESMAS posições do Excellent Sistemas (o
// sistema anterior da loja), conferido no próprio Excellent em 11/10/2026:
// Página Inicial; Vendas e Pedidos; Gestão; Vendas pela Internet;
// Configurações — cada grupo na ordem de lá. Sem o prefixo "Ex", que é a
// marca deles.
//
// O que só o ERP tem fica no FIM do grupo onde um usuário do Excellent
// procuraria, para não tirar nada do lugar. O que não existe aqui (Pedidos
// iFood, Comanda/Mesa, Gerador de Boletos, Mala Direta, Torpedos, Boleto,
// DOC/TED, Consultas Veiculares, Gestão Agendas, Painel Gestor, Downloads,
// Links Úteis) não aparece. As telas fiscais abrem pelas abas de "Notas
// Fiscais", como lá (ABAS_NOTAS_FISCAIS). Flags e permissões continuam
// mandando: item desligado some, grupo vazio some.
// ============================================================
export const sections: NavSection[] = [
  {
    label: "",
    items: [
      { title: "Página Inicial", url: "/", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Vendas e Pedidos",
    items: [
      { title: "Frente de Caixa", url: "/pdv", icon: ScanBarcode, perm: "pdv.usar" },
      { title: "Notas Fiscais", url: "/notas-fiscais", icon: FileText, perm: "fiscal.emitir",
        tambem: ABAS_NOTAS_FISCAIS.map((a) => a.url.split("?")[0]).filter((u) => u !== "/notas-fiscais") },
      { title: "Pedidos Delivery", url: "/pedidos-delivery", icon: Bike, perm: "pedido.delivery" },
      // { title: "Pedidos iFood", url: "/ifood", icon: ShoppingCart, perm: "venda.criar" }, // desativado: cliente não usa iFood — reativar descomentando aqui e a rota
      { title: "ExApp Pedidos", url: "/exapp-pedidos", icon: MessageSquare, perm: "venda.criar" },
      {
        title: "Venda Mais", url: "", icon: Star,
        children: [
          { title: "E-mail Marketing", url: "/email-marketing", icon: Mail, perm: "cliente.ver" },
          { title: "Cartão Fidelidade", url: "/cartao-fidelidade", icon: CreditCard, perm: "cliente.ver" },
          // como no Excellent, também aparecem em Gestão Recebimentos
          { title: "Crediário Próprio", url: "/crediario-proprio", icon: CreditCard, perm: "financeiro.ver" },
          { title: "Promissória", url: "/promissoria", icon: ScrollText, perm: "financeiro.ver" },
        ],
      },
      {
        title: "Controle Comercial", url: "", icon: Briefcase,
        children: [
          { title: "Pedido/Pré-venda", url: "/controle-comercial/pedido", icon: ShoppingCart, perm: "venda.criar" },
          { title: "Orçamento", url: "/controle-comercial/orcamento", icon: FileText, perm: "venda.criar" },
          { title: "Ordem de Serviço", url: "/controle-comercial/os", icon: Wrench, perm: "venda.criar" },
          { title: "Venda Consignada", url: "/controle-comercial/consignacao", icon: Truck, perm: "venda.criar" },
          { title: "Locação", url: "/controle-comercial/locacao", icon: Store, perm: "venda.criar" },
        ],
      },
      { title: "TEF / SITEF", url: "/tef-sitef", icon: CreditCard, perm: "config.ver" },
      // do ERP:
      { title: "Caixa", url: "/caixa", icon: Wallet, perm: "caixa.abrir" },
      { title: "Vendas", url: "/vendas", icon: Receipt, perm: "pdv.usar" },
      { title: "Devoluções", url: "/devolucoes", icon: RotateCcw, perm: "venda.criar" },
    ],
  },
  {
    label: "Gestão",
    items: [
      {
        title: "Financeiro", url: "", icon: LineChart,
        children: [
          { title: "Relatórios Financeiros", url: "/financeiro", icon: LineChart, perm: "financeiro.ver" },
        ],
      },
      {
        title: "Gestão Empresarial", url: "", icon: Building2,
        children: [
          { title: "Clientes", url: "/gestao/clientes", icon: Users, perm: "cliente.editar" },
          { title: "Fornecedores", url: "/gestao/fornecedores", icon: Truck, perm: "compra.ver" },
          { title: "Funcionários", url: "/gestao/funcionarios", icon: Building2, perm: "usuario.ver" },
          { title: "Transportadoras", url: "/gestao/transportadoras", icon: Truck, perm: "compra.ver" },
          { title: "Estoque Produtos", url: "/produtos-estoque-lotes", icon: Package, perm: "produto.ver" },
          { title: "Serviços Oferecidos", url: "/gestao/servicos", icon: Wrench, perm: "produto.ver" },
          { title: "Agenda Telefônica", url: "/gestao/agenda-telefonica", icon: Smartphone, perm: "cliente.ver" },
          { title: "Documentos Administrativos", url: "/gestao/documentos", icon: FolderTree, perm: "cliente.ver" },
          { title: "Arquivos e Pastas", url: "/gestao/arquivos-pastas", icon: FolderTree, perm: "cliente.ver" },
          { title: "E-mail Inteligente", url: "/gestao/email-inteligente", icon: Mail, perm: "cliente.ver" },
          { title: "Agenda de Compromissos", url: "/gestao/agenda-compromissos", icon: Calendar, perm: "cliente.ver" },
          { title: "Regiões de Entrega", url: "/gestao/regioes-entrega", icon: MapPin, perm: "config.ver" },
          // do ERP:
          { title: "Comissões", url: "/gestao/comissoes", icon: Banknote, perm: "usuario.ver" },
          { title: "Comissão Dinâmica", url: "/gestao/comissao-dinamica", icon: TrendingUp, perm: "usuario.ver" },
          { title: "Movimentações (Kardex)", url: "/estoque/movimentacoes", icon: ArrowLeftRight, perm: "produto.ver" },
          { title: "Inventário / Balanço", url: "/estoque/inventario", icon: Package, perm: "estoque.ajustar" },
          { title: "Transferências", url: "/estoque.transferencia", icon: ArrowLeftRight, perm: "estoque.transferir" },
          { title: "Compras", url: "/compras", icon: ShoppingBag, perm: "compra.criar" },
          { title: "Kits & Combos", url: "/kits", icon: PackagePlus, perm: "produto.ver" },
          { title: "Lojas", url: "/lojas", icon: Store, perm: "loja.ver" },
        ],
      },
      {
        title: "Gestão Cobrança", url: "", icon: AlertTriangle,
        children: [
          { title: "Parcelar Débitos", url: "/gestao/parcelar-debitos", icon: ScrollText, perm: "financeiro.ver" },
          { title: "Localizar Pessoas", url: "/gestao/localizar-pessoas", icon: Search, perm: "financeiro.ver" },
          { title: "Negativar Devedores", url: "/gestao/negativar-devedores", icon: AlertTriangle, perm: "financeiro.ver" },
          { title: "Encaminhar para Protesto", url: "/gestao/encaminhar-protesto", icon: Send, perm: "financeiro.ver" },
          { title: "Recomendo/Não Recomendo", url: "/gestao/recomendacoes", icon: ThumbsUp, perm: "financeiro.ver" },
          // do ERP:
          { title: "Solicitação de Parceria", url: "/gestao/solicitacao-parceria", icon: Network, perm: "financeiro.ver" },
        ],
      },
      {
        title: "Gestão Recebimentos", url: "", icon: Banknote,
        children: [
          { title: "Crediário Próprio", url: "/crediario-proprio", icon: CreditCard, perm: "financeiro.ver" },
          { title: "Crediário", url: "/gestao/gerar-crediario", icon: CreditCard, perm: "financeiro.ver" },
          { title: "Promissória", url: "/promissoria", icon: ScrollText, perm: "financeiro.ver" },
          // por forma de pagamento: os números estão em Relatórios Financeiros › Formas
          { title: "Cheque", url: "/financeiro?aba=formas&forma=cheque", icon: ScrollText, perm: "financeiro.ver" },
          { title: "Dinheiro", url: "/financeiro?aba=formas&forma=dinheiro", icon: Banknote, perm: "financeiro.ver" },
          { title: "Cartão de Débito", url: "/financeiro?aba=formas&forma=cartao_debito", icon: CreditCard, perm: "financeiro.ver" },
          { title: "Cartão de Crédito", url: "/financeiro?aba=formas&forma=cartao_credito", icon: CreditCard, perm: "financeiro.ver" },
        ],
      },
      {
        title: "Análise de Crédito", url: "", icon: Search,
        children: [
          { title: "Consulta Pessoa Física", url: "/gestao/consulta-pessoa-fisica", icon: Users, perm: "financeiro.ver" },
          { title: "Consulta Pessoa Jurídica", url: "/gestao/consulta-pessoa-juridica", icon: Building2, perm: "financeiro.ver" },
          { title: "Consulta de Cheque", url: "/gestao/consulta-cheque", icon: ScrollText, perm: "financeiro.ver" },
        ],
      },
      { title: "Gestão Usuários", url: "/gestao/usuarios", icon: Users, perm: "usuario.ver" },
      { title: "Faturamento", url: "/faturamento", icon: FileText, perm: "fiscal.emitir" },
      // do ERP:
      {
        title: "Atendimento", url: "", icon: Bell,
        children: [
          { title: "Notificações", url: "/gestao/notificacoes", icon: Bell },
          { title: "Ocorrências", url: "/gestao/ocorrencias", icon: MessageSquare, perm: "cliente.ver" },
          { title: "Avaliações", url: "/gestao/avaliacoes", icon: Star, perm: "cliente.ver" },
          { title: "Exclusão LGPD", url: "/gestao/exclusao-informacoes", icon: Shield, perm: "config.editar" },
        ],
      },
    ],
  },
  {
    label: "Vendas pela Internet",
    items: [
      // { title: "iFood", url: "/marketplace-ifood", icon: ShoppingCart }, // desativado: cliente não usa iFood — reativar descomentando aqui e a rota
    ],
  },
  {
    label: "Configurações",
    items: [
      { title: "Configurações do Sistema", url: "/config/sistema", icon: Cog, perm: "config.ver" },
      { title: "Configurações Empresariais", url: "/config/empresarial", icon: Briefcase, perm: "config.editar" },
      { title: "Minhas Chaves", url: "/config/minhas-chaves", icon: Key, perm: "config.ver" },
      { title: "Acessar meu Contador", url: "/gestao/painel-contador", icon: Calculator, perm: "fiscal.emitir" },
      {
        title: "Treinamento Sistema", url: "", icon: HelpCircle,
        children: [
          { title: "Tutoriais", url: "/tutoriais", icon: BookOpen },
          { title: "Treinamento", url: "/treinamento/tutoriais", icon: HelpCircle },
          { title: "Ajuda", url: "/ajuda", icon: HelpCircle },
        ],
      },
      // do ERP:
      { title: "Certificado Digital", url: "/gestao/nfe-certificado", icon: Lock, perm: "config.editar" },
      { title: "Configurações SEFAZ", url: "/gestao/configuracoes-sefaz", icon: Settings, perm: "fiscal.emitir" },
      { title: "Dados Empresariais", url: "/gestao/dados-empresariais", icon: Building2, perm: "config.ver" },
      { title: "Configurações Gerais", url: "/gestao/configuracoes-gerais", icon: Settings, perm: "config.editar" },
      { title: "Gerar Código de Barras", url: "/gestao/codigo-barras", icon: Barcode, perm: "produto.ver" },
      { title: "Equipamentos", url: "/equipamentos", icon: Barcode, perm: "config.ver" },
    ],
  },
];

/** Sub-componente: renderiza uma seção da sidebar com cabeçalho colapsável. */
type FlagMap = Record<string, { ativo: boolean; titulo: string; motivo_desativacao?: string | null; is_protegida?: boolean }>;

/** Um item folha: link interno, link externo ou "em breve". */
function SidebarLeaf({
  item, active, globalCollapsed, flagMap, nested,
}: {
  item: NavItem; active: boolean; globalCollapsed: boolean; flagMap: FlagMap; nested?: boolean;
}) {
  const base = cn(
    "group relative flex min-h-11 items-center text-sm transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
    globalCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-2.5 py-2.5",
    nested && !globalCollapsed && "min-h-9 py-1.5 text-[13px]",
  );

  if (item.soon) {
    const soonEl = (
      <div aria-disabled="true" title={`${item.title} — Em breve`}
        className={cn(base, "cursor-not-allowed rounded-[10px] text-white/40")}>
        <item.icon className="h-4 w-4 shrink-0" />
        {!globalCollapsed && (
          <>
            <span className="flex-1 truncate">{item.title}</span>
            <span className="rounded-full border border-white/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">Em breve</span>
          </>
        )}
      </div>
    );
    return globalCollapsed ? (
      <Tooltip><TooltipTrigger asChild>{soonEl}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">{item.title} · Em breve</TooltipContent></Tooltip>
    ) : soonEl;
  }

  if (item.external) {
    const a = (
      <a href={item.url} target="_blank" rel="noreferrer" aria-label={item.title}
        className={cn(base, "rounded-[10px] text-white/75 hover:bg-white/10 hover:text-white")}>
        <item.icon className="h-4 w-4 shrink-0" />
        {!globalCollapsed && <span className="flex-1 truncate">{item.title}</span>}
        {!globalCollapsed && <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />}
      </a>
    );
    return globalCollapsed ? (
      <Tooltip><TooltipTrigger asChild>{a}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">{item.title} ↗</TooltipContent></Tooltip>
    ) : a;
  }

  const linkEl = (
    <Link
      to={item.url}
      aria-label={item.title}
      aria-current={active ? "page" : undefined}
      style={{
        borderTopLeftRadius: TAB_RADIUS,
        borderBottomLeftRadius: TAB_RADIUS,
        paddingRight: 10 + SCROLLBAR_W,
      }}
      className={cn(
        base,
        active
          ? "bg-[hsl(var(--area))] text-foreground font-semibold hover:bg-[hsl(var(--area))] shadow-sm"
          : "text-white/85 hover:bg-red-600 hover:text-white",
      )}
    >
      {active && (
        <>
          <span aria-hidden className="pointer-events-none absolute right-0 bg-[hsl(var(--area))]"
            style={{
              top: `-${BULGE_HEIGHT}px`, height: `${BULGE_HEIGHT}px`, width: `${BULGE_WIDTH}px`,
              WebkitMaskImage: `radial-gradient(${BULGE_WIDTH}px ${BULGE_HEIGHT}px at 100% 100%, black 100%, transparent 100.5%)`,
              maskImage: `radial-gradient(${BULGE_WIDTH}px ${BULGE_HEIGHT}px at 100% 100%, black 100%, transparent 100.5%)`,
            }} />
          <span aria-hidden className="pointer-events-none absolute right-0 bg-[hsl(var(--area))]"
            style={{
              bottom: `-${BULGE_HEIGHT}px`, height: `${BULGE_HEIGHT}px`, width: `${BULGE_WIDTH}px`,
              WebkitMaskImage: `radial-gradient(${BULGE_WIDTH}px ${BULGE_HEIGHT}px at 100% 0%, black 100%, transparent 100.5%)`,
              maskImage: `radial-gradient(${BULGE_WIDTH}px ${BULGE_HEIGHT}px at 100% 0%, black 100%, transparent 100.5%)`,
            }} />
        </>
      )}
      <item.icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} strokeWidth={active ? 2.4 : 2} />
      {!globalCollapsed && <span className="flex-1 truncate">{item.title}</span>}
      {!globalCollapsed && flagMap[item.url]?.is_protegida && (
        // só o escudo: a pílula rosa parecia um contador vazio ("0") e, no
        // item ativo (fundo claro), uma bolinha sem nada dentro
        <span title="Página protegida — sempre ativa no sistema"
          className={cn("flex items-center", active ? "text-red-600" : "text-neutral-500")}>
          <Shield className="h-3 w-3" />
        </span>
      )}
      {!globalCollapsed && item.badge && (
        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
          {item.badge}
        </span>
      )}
    </Link>
  );
  return globalCollapsed ? (
    <Tooltip><TooltipTrigger asChild>{linkEl}</TooltipTrigger>
      <TooltipContent side="right" className="font-medium">{item.title}</TooltipContent></Tooltip>
  ) : linkEl;
}

/**
 * Grupo expansível — o segundo nível do menu (Venda Mais, Gestão
 * Empresarial…). Nasce fechado, como o child_menu do Excellent, e abre
 * sozinho quando a página ativa está dentro dele. Com a sidebar recolhida
 * os filhos viram ícones diretos: grupo fechado não pode esconder acesso.
 */
function SidebarGroup({
  item, globalCollapsed, isActive, flagMap,
}: {
  item: NavItem; globalCollapsed: boolean;
  isActive: (url: string, exact?: boolean, tambem?: string[]) => boolean; flagMap: FlagMap;
}) {
  const filhos = item.children ?? [];
  const temAtivo = filhos.some((f) => !f.external && isActive(f.url, f.exact, f.tambem));
  const [aberto, setAberto] = useState(temAtivo);
  useEffect(() => { if (temAtivo) setAberto(true); }, [temAtivo]);

  if (globalCollapsed) {
    return (
      <>
        {filhos.map((f) => (
          <li key={f.url} className="relative" style={{ marginRight: `-${8 + SCROLLBAR_W}px` }}>
            <SidebarLeaf item={f} active={!f.external && isActive(f.url, f.exact, f.tambem)} globalCollapsed flagMap={flagMap} />
          </li>
        ))}
      </>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={cn(
          "flex min-h-11 w-full items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
          temAtivo ? "text-white font-semibold bg-red-600/25" : "text-white/85 hover:bg-red-600 hover:text-white",
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{item.title}</span>
        <span className="text-[9px] text-white/40 tabular-nums">{filhos.length}</span>
        {aberto ? <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />}
      </button>
      {aberto && (
        <ul className="ml-4 flex flex-col gap-0.5 border-l border-white/10 pl-1">
          {filhos.map((f) => (
            <li key={f.url} className="relative" style={{ marginRight: `-${12 + SCROLLBAR_W + 20}px` }}>
              <SidebarLeaf item={f} active={!f.external && isActive(f.url, f.exact, f.tambem)} globalCollapsed={false} flagMap={flagMap} nested />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Conta só as folhas — é o número que aparece ao lado do título da seção. */
const contaFolhas = (items: NavItem[]): number =>
  items.reduce((n, i) => n + (i.children ? contaFolhas(i.children) : 1), 0);

function SidebarSection({
  section, globalCollapsed, isActive, flagMap,
}: {
  section: NavSection; globalCollapsed: boolean;
  isActive: (url: string, exact?: boolean, tambem?: string[]) => boolean; flagMap: FlagMap;
}) {
  // Hook aqui é seguro — sempre chamado no mesmo nível do componente.
  const sectionCollapsed = useSectionCollapsed(section.label);

  // Quando a sidebar está colapsada globalmente, mostramos todos os ícones
  // e escondemos o cabeçalho. O usuário ainda pode recolher/expandir
  // individualmente quando a sidebar está expandida.
  const isHidden = !globalCollapsed && sectionCollapsed;

  return (
    <div className={cn("py-1.5", globalCollapsed ? "px-2" : "px-3")}>
      {!section.label ? null : !globalCollapsed ? (
        <button
          type="button"
          onClick={() => toggleSection(section.label)}
          aria-expanded={!isHidden}
          className="flex w-full items-center justify-between rounded-md px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-red-500 transition hover:text-red-300"
          title={isHidden ? `Expandir ${section.label}` : `Recolher ${section.label}`}
        >
          <span className="flex items-center gap-1">
            {isHidden ? <ChevronRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {section.label}
          </span>
          <span className="text-[9px] text-white/40 tabular-nums">{contaFolhas(section.items)}</span>
        </button>
      ) : (
        <div className="mx-2 mb-1.5 h-px bg-white/10" aria-hidden />
      )}
      {!isHidden && (
        <ul className="flex flex-col gap-0.5">
          {section.items.map((item) =>
            item.children ? (
              <SidebarGroup key={item.title} item={item} globalCollapsed={globalCollapsed} isActive={isActive} flagMap={flagMap} />
            ) : (
              <li key={item.url} className="relative" style={{ marginRight: `-${(globalCollapsed ? 8 : 12) + SCROLLBAR_W}px` }}>
                <SidebarLeaf item={item} active={!item.external && isActive(item.url, item.exact, item.tambem)} globalCollapsed={globalCollapsed} flagMap={flagMap} />
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

export function AppSidebar() {
  const { pathname, search } = useLocation();
  const collapsed = useSidebarCollapsed();
  const { user, can } = useAuth();
  const { data: flags = [] } = useFeatureFlags();

  // Map<path, FeatureFlag> para consulta rápida
  const flagMap = useMemo(() => {
    const m: Record<string, typeof flags[number]> = {};
    for (const f of flags) m[f.path] = f;
    return m;
  }, [flags]);

  // ===== Construir lista de itens visíveis =====
  // TODOS os usuários (incluindo admin) veem apenas páginas ativas
  // na sidebar. Páginas desativadas ficam ocultas da navegação e
  // visíveis APENAS em /config/sistema (Feature Flags). Para acessar
  // uma página desativada via URL direto, o FeatureGuard exibe tela
  // de bloqueio (não-admin) ou banner de preview com botão "Reativar"
  // (admin).
  // Recursivo: permissão e flag valem para a folha; grupo sem filho visível some.
  const visivel = (i: NavItem): NavItem | null => {
    if (i.perm && !can(i.perm)) return null;
    if (i.children) {
      const filhos = i.children.map(visivel).filter((f): f is NavItem => !!f);
      return filhos.length ? { ...i, children: filhos } : null;
    }
    if (i.external) return i;
    const flag = flagMap[i.url];
    if (!flag) return i;          // fail-open para rotas sem flag
    return flag.ativo ? i : null; // oculta da sidebar se desativada (admin ou não)
  };
  const visibleSections = sections
    .map((s) => ({ ...s, items: s.items.map(visivel).filter((i): i is NavItem => !!i) }))
    .filter((s) => s.items.length > 0);

  // ===== Todas as URLs internas (folhas), para o isActive =====
  const folhas = (items: NavItem[]): string[] =>
    items.flatMap((i) => (i.children ? folhas(i.children) : i.external ? [] : [i.url]));
  const allUrls = sections.flatMap((s) => folhas(s.items));

  // Item com query string (ex.: /financeiro?aba=apagar) só acende quando a
  // query bate; e o item "pai" sem query (/financeiro) NÃO acende enquanto
  // um irmão com query estiver ativo — senão os dois ficam destacados.
  const irmaosComQuery = (base: string) =>
    allUrls.filter((u) => u.startsWith(base + "?"));
  const isActive = (url: string, exact?: boolean, tambem?: string[]) => {
    if (tambem?.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
    const [urlPath, urlQuery] = url.split("?");
    if (urlQuery) return pathname === urlPath && search === "?" + urlQuery;
    if (irmaosComQuery(url).some((u) => pathname === urlPath && search === "?" + u.split("?")[1])) return false;
    if (exact) return pathname === url;
    if (pathname === url) return true;
    if (!pathname.startsWith(url + "/")) return false;
    return !allUrls.some(
      (other) =>
        other !== url &&
        other.length > url.length &&
        (pathname === other || pathname.startsWith(other + "/"))
    );
  };

  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={0}>
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-screen shrink-0 flex-col text-sidebar-foreground shadow-lg transition-[width] duration-200 ease-out md:flex print:hidden",
          collapsed ? "w-16" : "w-60"
        )}
        style={{ backgroundImage: SIDEBAR_BG }}
        aria-label="Navegação principal"
      >
        {/* Header / Logo */}
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-4">
          <button
            onClick={() => toggleSidebar()}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md transition hover:bg-white/10"
            aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          >
            {/* Logo oficial da X-Life — a mesma usada no CRM */}
            <img
              src="/logo-xlife.png"
              alt="X-Life Suplementos"
              className="h-10 w-10 shrink-0 rounded-full shadow ring-2 ring-white/20"
            />
            {!collapsed && (
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-black tracking-wide text-white">
                  ERP System
                </span>
                <span className="truncate text-[10px] uppercase tracking-[0.2em] text-white/60">
                  X-LIFE Suplementos
                </span>
              </div>
            )}
          </button>
        </div>

        {/* Perfil do usuário */}
        {!collapsed && (
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
              {(user?.nome ?? "Jean Suplementos").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/60">Bem-vindo(a),</p>
              <p className="text-sm font-medium truncate text-white">{user?.nome ?? "Jean Suplementos"}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/50">
                {user?.role ? (roleLabels[user.role] ?? user.role) : "Usuário master"}
              </p>
            </div>
          </div>
        )}

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleSections.map((section) => (
            <SidebarSection
              key={section.label}
              section={section}
              globalCollapsed={collapsed}
              isActive={isActive}
              flagMap={flagMap}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-2 space-y-1">
          {/* Indicador de feature flags (páginas desativadas) */}
          {(() => {
            const totalFlags = flags.length;
            const desativadas = flags.filter((f) => !f.ativo && !f.is_protegida).length;
            if (totalFlags === 0 || desativadas === 0) return null;
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/config/sistema"
                    className="relative flex items-center justify-around rounded text-white/70 transition hover:bg-white/10 hover:text-white py-1.5"
                    title={`${desativadas} página(s) desativada(s) — abrir Configurações do Sistema`}
                    aria-label="Feature flags"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    {!collapsed && <span className="text-[10px] font-semibold uppercase tracking-wider">Páginas</span>}
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      {desativadas}
                    </span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <span className="font-medium">Feature Flags</span>
                  <div className="text-[10px] opacity-80 mt-0.5">
                    {desativadas} página(s) oculta(s) — clique para gerenciar
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })()}

          <div className="flex items-center justify-around">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => toggleSidebar()}
                  className="flex h-8 w-8 items-center justify-center rounded text-white/70 transition hover:bg-white/10 hover:text-white"
                  title={collapsed ? "Expandir" : "Recolher"}
                  aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
                >
                  {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{collapsed ? "Expandir" : "Recolher"} sidebar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/config/sistema"
                  className="flex h-8 w-8 items-center justify-center rounded text-white/70 transition hover:bg-white/10 hover:text-white"
                  title="Configurações"
                  aria-label="Configurações"
                >
                  <Settings className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Configurações</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/ajuda"
                  className="flex h-8 w-8 items-center justify-center rounded text-white/70 transition hover:bg-white/10 hover:text-white"
                  title="Ajuda"
                  aria-label="Ajuda"
                >
                  <HelpCircle className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Ajuda</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}

// Re-export para garantir compatibilidade com imports existentes
export { SIDEBAR_BG };
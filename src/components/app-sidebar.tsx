import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Calculator,
  Wallet,
  Receipt,
  Truck,
  Bike,
  MessageSquare,
  ShoppingCart,
  Barcode,
  DollarSign,
  CreditCard,
  Wrench,
  FileText,
  Users,
  Building2,
  Package,
  Calendar,
  LineChart,
  Briefcase,
  Mail,
  Settings,
  Cog,
  Store,
  Key,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Globe,
  RotateCcw,
  Boxes,
  PackagePlus,
  ShoppingBag,
  ArrowLeftRight,
  ScrollText,
  Banknote,
  Car,
  AlertTriangle,
  Shield,
  Search,
  Smartphone,
  Star,
  Lock,
  Network,
  Send,
  FolderTree,
  ScanBarcode,
  ChevronRight,
  Minus,
  Flag,
  Upload,
} from "lucide-react";

import { useAuth, type Permission } from "@/lib/store/auth-store";
import { useSidebarCollapsed, toggleSidebar, useSectionCollapsed, toggleSection } from "@/lib/store/sidebar-store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFeatureFlags } from "@/lib/supabase-queries";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  url: string;
  icon: typeof Home;
  exact?: boolean;
  perm?: Permission;
  /** Página ainda sem rota implementada — exibida com a tag "Em breve". */
  soon?: boolean;
  badge?: string;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const SIDEBAR_BG =
  "linear-gradient(180deg, oklch(0.34 0.14 27) 0%, oklch(0.24 0.11 27) 100%)";

// Ícones auxiliares (locais — `as any` para compatibilidade com o tipo do lucide-react)
const Phone: any = (props: any) => <Smartphone {...props} />;
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

const sections: NavSection[] = [
  {
    label: "Operação",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard, exact: true },
      { title: "Visão Geral", url: "/visao-geral", icon: Globe, perm: "relatorio.ver" },
      { title: "PDV", url: "/pdv", icon: ScanBarcode, perm: "pdv.usar" },
      { title: "Caixa", url: "/caixa", icon: Wallet, perm: "caixa.abrir" },
      { title: "Vendas", url: "/vendas", icon: Receipt, perm: "pdv.usar" },
      { title: "Pedidos Delivery", url: "/pedidos-delivery", icon: Bike, perm: "venda.criar" },
      { title: "Pedidos iFood", url: "/ifood", icon: ShoppingCart, perm: "venda.criar" },
      { title: "ExApp Pedidos", url: "/exapp-pedidos", icon: MessageSquare, perm: "venda.criar" },
      { title: "Devoluções", url: "/devolucoes", icon: RotateCcw, perm: "venda.criar" },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { title: "Produtos", url: "/produtos", icon: Package, perm: "produto.ver" },
      { title: "Estoque", url: "/gestao/estoque", icon: Boxes, perm: "estoque.ajustar" },
      { title: "Transferências", url: "/estoque.transferencia", icon: ArrowLeftRight, perm: "estoque.transferir" },
      { title: "Lotes & Validade", url: "/lotes", icon: ScrollText, perm: "estoque.ver" },
      { title: "Compras", url: "/compras", icon: ShoppingBag, perm: "compra.criar" },
      { title: "Importar NFe", url: "/compras/importar-nfe", icon: Upload, perm: "compra.criar", badge: "novo" },
      { title: "Kits & Combos", url: "/kits", icon: PackagePlus, perm: "produto.ver" },
      { title: "Fornecedores", url: "/gestao/fornecedores", icon: Truck, perm: "compra.ver" },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { title: "Clientes", url: "/gestao/clientes", icon: Users, perm: "cliente.editar" },
      { title: "Pessoa Física", url: "/gestao/consulta-pessoa-fisica", icon: Users },
      { title: "Pessoa Jurídica", url: "/gestao/consulta-pessoa-juridica", icon: Building2 },
      { title: "Funcionários", url: "/gestao/funcionarios", icon: Building2, perm: "usuario.ver" },
      { title: "Transportadoras", url: "/gestao/transportadoras", icon: Truck, perm: "loja.ver" },
      { title: "Regiões de Entrega", url: "/gestao/regioes-entrega", icon: MapPin },
      { title: "Agenda Telefônica", url: "/gestao/agenda-telefonica", icon: Phone },
      { title: "Localizar Pessoas", url: "/gestao/localizar-pessoas", icon: Search },
      { title: "Lojas", url: "/lojas", icon: Store, perm: "loja.ver" },
    ],
  },
  {
    label: "Gestão Empresarial",
    items: [
      { title: "Visão Geral", url: "/gestao", icon: LayoutDashboard },
      { title: "Agenda Compromissos", url: "/gestao/agenda-compromissos", icon: Calendar },
      { title: "Documentos", url: "/gestao/documentos", icon: FolderTree },
      { title: "Arquivos e Pastas", url: "/gestao/arquivos-pastas", icon: FolderTree },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Relatórios Financeiros", url: "/financeiro", icon: LineChart, perm: "financeiro.ver" },
      { title: "Contas a Pagar/Receber", url: "/financeiro", icon: Banknote, perm: "financeiro.ver" },
      { title: "Cheques", url: "/gestao/consulta-cheque", icon: ScrollText },
      { title: "Recebimento Cheque", url: "/gestao/recebimento-cheque", icon: ScrollText },
      { title: "Cartão de Crédito", url: "/gestao/cartao-credito", icon: CreditCard },
      { title: "Cartão de Débito", url: "/gestao/cartao-debito", icon: CreditCard },
      { title: "Dinheiro", url: "/gestao/dinheiro", icon: DollarSign },
      { title: "Boletos", url: "/gerador-boletos", icon: Barcode, badge: "novo" },
      { title: "Promissórias", url: "/promissoria", icon: ScrollText },
      { title: "Crediário Próprio", url: "/crediario-proprio", icon: CreditCard },
      { title: "Crediário (com juros)", url: "/gestao/gerar-crediario", icon: CreditCard },
    ],
  },
  {
    label: "Cobrança",
    items: [
      { title: "Negativar Devedores", url: "/gestao/negativar-devedores", icon: AlertTriangle },
      { title: "Parcelar Débitos", url: "/gestao/parcelar-debitos", icon: ScrollText },
      { title: "Encaminhar Protesto", url: "/gestao/encaminhar-protesto", icon: Send },
      { title: "Solicitação de Parceria", url: "/gestao/solicitacao-parceria", icon: Network },
    ],
  },
  {
    label: "Venda Mais",
    items: [
      { title: "Mala Direta", url: "/mala-direta", icon: Mail },
      { title: "E-mail Marketing", url: "/email-marketing", icon: Mail },
      { title: "Torpedos SMS", url: "/torpedos", icon: Smartphone },
      { title: "Cartão Fidelidade", url: "/cartao-fidelidade", icon: CreditCard },
      { title: "Email Inteligente", url: "/gestao/email-inteligente", icon: Mail },
    ],
  },
  {
    label: "Fiscal",
    items: [
      { title: "Notas Fiscais", url: "/notas-fiscais", icon: FileText, perm: "fiscal.emitir" },
      { title: "Faturamento", url: "/faturamento", icon: FileText, perm: "fiscal.emitir", badge: "novo" },
      { title: "Remessas entre Filiais", url: "/remessas", icon: ArrowLeftRight, perm: "fiscal.emitir", badge: "novo" },
      { title: "Certificado Digital", url: "/gestao/nfe-certificado", icon: Lock, perm: "fiscal.emitir" },
      { title: "Configurações SEFAZ", url: "/gestao/configuracoes-sefaz", icon: Settings, perm: "fiscal.emitir" },
      { title: "Painel do Contador", url: "/gestao/painel-contador", icon: Calculator },
      { title: "Documentos Demonstrativos", url: "/gestao/documentos-demonstrativos", icon: LineChart },
    ],
  },
  {
    label: "CRM & Marketing",
    items: [
      { title: "Avaliações", url: "/gestao/avaliacoes", icon: Star },
      { title: "Recomendações", url: "/gestao/recomendacoes", icon: ThumbsUp },
      { title: "Notificações", url: "/gestao/notificacoes", icon: Bell },
      { title: "Ocorrências", url: "/gestao/ocorrencias", icon: MessageSquare },
      { title: "Exclusão LGPD", url: "/gestao/exclusao-informacoes", icon: Shield },
    ],
  },
  {
    label: "Controle Comercial",
    items: [
      { title: "Pedido / Pré-venda", url: "/controle-comercial/pedido", icon: ShoppingCart },
      { title: "Orçamento", url: "/controle-comercial/orcamento", icon: FileText },
      { title: "Ordem de Serviço", url: "/controle-comercial/os", icon: Wrench },
      { title: "Venda Consignada", url: "/controle-comercial/consignacao", icon: Truck },
      { title: "Locação", url: "/controle-comercial/locacao", icon: Store },
      { title: "TEF / SITEF", url: "/tef-sitef", icon: CreditCard, badge: "novo" },
    ],
  },
  {
    label: "Vendas Online",
    items: [
      { title: "iFood Marketplace", url: "/marketplace-ifood", icon: ShoppingCart },
    ],
  },
  {
    label: "Administração",
    items: [
      { title: "Gestão Usuários", url: "/gestao/usuarios", icon: Users, perm: "usuario.ver" },
      { title: "Permissões", url: "/gestao/usuario-permissoes", icon: Shield },
      { title: "Dados Empresariais", url: "/gestao/dados-empresariais", icon: Building2 },
      { title: "Configurações Sistema", url: "/config/sistema", icon: Cog, perm: "config.ver" },
      { title: "Configurações Gerais", url: "/gestao/configuracoes-gerais", icon: Settings },
      { title: "Configurações Empresariais", url: "/config/empresarial", icon: Briefcase, perm: "config.editar" },
      { title: "Minhas Chaves PIX", url: "/config/minhas-chaves", icon: Key, badge: "novo" },
      { title: "Gerar Código de Barras", url: "/gestao/codigo-barras", icon: Barcode },
      { title: "Downloads", url: "/config/downloads", icon: Barcode },
      { title: "Treinamento", url: "/treinamento/tutoriais", icon: HelpCircle },
      { title: "Relatórios", url: "/relatorios", icon: LineChart },
      { title: "Ajuda", url: "/ajuda", icon: HelpCircle },
    ],
  },
];

/** Sub-componente: renderiza uma seção da sidebar com cabeçalho colapsável. */
function SidebarSection({
  section,
  globalCollapsed,
  isActive,
  flagMap,
}: {
  section: NavSection;
  globalCollapsed: boolean;
  isActive: (url: string, exact?: boolean) => boolean;
  flagMap: Record<string, { ativo: boolean; titulo: string; motivo_desativacao?: string | null; is_protegida?: boolean }>;
}) {
  // Hook aqui é seguro — sempre chamado no mesmo nível do componente.
  const sectionCollapsed = useSectionCollapsed(section.label);

  // Quando a sidebar está colapsada globalmente, mostramos todos os ícones
  // e escondemos o cabeçalho. O usuário ainda pode recolher/expandir
  // individualmente quando a sidebar está expandida.
  const isHidden = !globalCollapsed && sectionCollapsed;

  return (
    <div className={cn("py-1.5", globalCollapsed ? "px-2" : "px-3")}>
      {!globalCollapsed ? (
        <button
          type="button"
          onClick={() => toggleSection(section.label)}
          aria-expanded={!isHidden}
          className="flex w-full items-center justify-between rounded-md px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50 transition hover:text-white/80"
          title={isHidden ? `Expandir ${section.label}` : `Recolher ${section.label}`}
        >
          <span className="flex items-center gap-1">
            {isHidden ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {section.label}
          </span>
          <span className="text-[9px] text-white/40 tabular-nums">{section.items.length}</span>
        </button>
      ) : (
        <div className="mx-2 mb-1.5 h-px bg-white/10" aria-hidden />
      )}
      {!isHidden && (
        <ul className="flex flex-col gap-0.5">
          {section.items.map((item) => {
            const active = isActive(item.url, item.exact);

            if (item.soon) {
              const soonEl = (
                <div
                  aria-disabled="true"
                  title={`${item.title} — Em breve`}
                  className={cn(
                    "flex min-h-11 cursor-not-allowed items-center rounded-[10px] text-sm text-white/40",
                    globalCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-2.5 py-2.5"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!globalCollapsed && (
                    <>
                      <span className="flex-1 truncate">{item.title}</span>
                      <span className="rounded-full border border-white/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                        Em breve
                      </span>
                    </>
                  )}
                </div>
              );
              return (
                <li key={item.url}>
                  {globalCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{soonEl}</TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.title} · Em breve
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    soonEl
                  )}
                </li>
              );
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
                  "group relative flex min-h-11 items-center text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                  globalCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-2.5 py-2.5",
                  active
                    ? "bg-background text-foreground font-semibold hover:bg-background shadow-sm"
                    : "text-white/85 hover:bg-white/10 hover:text-white"
                )}
              >
                {active && (
                  <>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute right-0 bg-background"
                      style={{
                        top: `-${BULGE_HEIGHT}px`,
                        height: `${BULGE_HEIGHT}px`,
                        width: `${BULGE_WIDTH}px`,
                        WebkitMaskImage: `radial-gradient(${BULGE_WIDTH}px ${BULGE_HEIGHT}px at 100% 100%, black 100%, transparent 100.5%)`,
                        maskImage: `radial-gradient(${BULGE_WIDTH}px ${BULGE_HEIGHT}px at 100% 100%, black 100%, transparent 100.5%)`,
                      }}
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute right-0 bg-background"
                      style={{
                        bottom: `-${BULGE_HEIGHT}px`,
                        height: `${BULGE_HEIGHT}px`,
                        width: `${BULGE_WIDTH}px`,
                        WebkitMaskImage: `radial-gradient(${BULGE_WIDTH}px ${BULGE_HEIGHT}px at 100% 0%, black 100%, transparent 100.5%)`,
                        maskImage: `radial-gradient(${BULGE_WIDTH}px ${BULGE_HEIGHT}px at 100% 0%, black 100%, transparent 100.5%)`,
                      }}
                    />
                  </>
                )}
                <item.icon
                  className={cn("h-4 w-4 shrink-0", active && "text-primary")}
                  strokeWidth={active ? 2.4 : 2}
                />
                {!globalCollapsed && <span className="flex-1 truncate">{item.title}</span>}
                {/* Indicador de flag protegida (essencial, sempre ativa) */}
                {!globalCollapsed && flagMap[item.url]?.is_protegida && (
                  <span
                    title="Página protegida — sempre ativa no sistema"
                    className="flex items-center gap-0.5 rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-blue-200"
                  >
                    <Shield className="h-2.5 w-2.5" />
                  </span>
                )}
                {!globalCollapsed && item.badge && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
            return (
              <li
                key={item.url}
                className="relative"
                style={{ marginRight: `-${(globalCollapsed ? 8 : 12) + SCROLLBAR_W}px` }}
              >
                {globalCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  linkEl
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function AppSidebar() {
  const pathname = useLocation().pathname;
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
  const visibleSections = sections
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => !i.perm || can(i.perm)).filter((i) => {
        const flag = flagMap[i.url];
        if (!flag) return true; // fail-open para rotas sem flag
        return flag.ativo;      // oculta da sidebar se desativada (admin ou não)
      }),
    }))
    .filter((s) => s.items.length > 0);

  // ===== Build set de URLs ativas para o isActive respeitar flags =====
  const allUrls = sections.flatMap((s) => s.items.map((i) => i.url));

  const isActive = (url: string, exact?: boolean) => {
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
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-white/20">
              <Store className="h-5 w-5" />
            </div>
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
                {(user?.role ?? "FUNCIONARIO MASTER").toString().replace(/_/g, " ")}
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
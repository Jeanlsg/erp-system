import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  ShoppingCart,
  Truck,
  FileText,
  Bike,
  MessageSquare,
  Coffee,
  Barcode,
  DollarSign,
  CreditCard,
  Wrench,
  Calculator,
  Briefcase,
  Users,
  Building2,
  Package,
  Calendar,
  LineChart,
  Key,
  Settings,
  Cog,
  Store,
  HelpCircle,
  ChevronDown,
  Mail,
} from "lucide-react";

import { useAuth, type Permission } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type NavItem = {
  title: string;
  url: string;
  icon: typeof Home;
  exact?: boolean;
  perm?: Permission;
  badge?: string;
};

type NavGroup = {
  label: string;
  items: (NavItem | NavSubmenu)[];
};

type NavSubmenu = {
  title: string;
  icon: typeof Home;
  items: NavItem[];
  perm?: Permission;
};

// ===== Estrutura idêntica ao site excellentsistemas =====

const groups: NavGroup[] = [
  // PÁGINA INICIAL (standalone)
  {
    label: "",
    items: [
      { title: "Página Inicial", url: "/", icon: Home, exact: true },
    ],
  },

  // VENDAS E PEDIDOS
  {
    label: "Vendas e Pedidos",
    items: [
      { title: "PDV / Frente de Caixa", url: "/pdv", icon: Calculator, perm: "pdv.usar" },
      { title: "Notas Fiscais", url: "/notas-fiscais", icon: FileText, perm: "fiscal.emitir" },
      { title: "Pedidos Delivery", url: "/pedidos-delivery", icon: Bike, perm: "venda.criar" },
      { title: "Pedidos iFood", url: "/ifood", icon: ShoppingCart, perm: "venda.criar" },
      { title: "ExApp Pedidos", url: "/exapp-pedidos", icon: MessageSquare, perm: "venda.criar" },
      { title: "Comanda/Mesa", url: "/comanda-mesa", icon: Coffee, perm: "venda.criar" },
      { title: "Gerador de Boletos", url: "/gerador-boletos", icon: Barcode, perm: "financeiro.ver", badge: "novo" },
      {
        title: "Venda Mais",
        icon: DollarSign,
        items: [
          { title: "Mala Direta", url: "/mala-direta", icon: Mail },
          { title: "E-mail Marketing", url: "/email-marketing", icon: Mail },
          { title: "Torpedos Celular", url: "/torpedos", icon: MessageSquare },
          { title: "Cartão Fidelidade", url: "/cartao-fidelidade", icon: CreditCard },
          { title: "Crediário Próprio", url: "/crediario-proprio", icon: CreditCard },
          { title: "Promissória", url: "/promissoria", icon: FileText },
        ],
        perm: "venda.criar",
      },
      {
        title: "Controle Comercial",
        icon: ShoppingCart,
        items: [
          { title: "Pedido/Pré-venda", url: "/controle-comercial/pedido" },
          { title: "Orçamento", url: "/controle-comercial/orcamento" },
          { title: "Ordem de Serviço", url: "/controle-comercial/os", icon: Wrench },
          { title: "Venda Consignada", url: "/controle-comercial/consignacao" },
          { title: "Locação", url: "/controle-comercial/locacao" },
        ],
        perm: "venda.criar",
      },
      { title: "TEF / SITEF", url: "/tef-sitef", icon: CreditCard, badge: "novo", perm: "venda.criar" },
    ],
  },

  // GESTÃO
  {
    label: "Gestão",
    items: [
      // Financeiro (com submenu - Relatórios Financeiros ativo)
      {
        title: "Financeiro",
        icon: LineChart,
        perm: "financeiro.ver",
        items: [
          { title: "Relatórios Financeiros", url: "/financeiro", exact: true },
        ],
      },
      // Gestão Empresarial
      {
        title: "Gestão Empresarial",
        icon: Briefcase,
        items: [
          { title: "Clientes", url: "/gestao/clientes", icon: Users, perm: "cliente.ver" },
          { title: "Fornecedores", url: "/gestao/fornecedores", icon: Truck, perm: "compra.ver" },
          { title: "Funcionários", url: "/gestao/funcionarios", icon: Building2, perm: "usuario.ver" },
          { title: "Transportadoras", url: "/gestao/transportadoras", icon: Truck, perm: "loja.ver" },
          { title: "Estoque Produtos", url: "/gestao/estoque", icon: Package, perm: "estoque.ver" },
          { title: "Entregas Futuras", url: "/gestao/entregas-futuras", icon: Truck, perm: "venda.criar" },
          { title: "Serviços Oferecidos", url: "/gestao/servicos", icon: Briefcase },
          { title: "Agenda Telefônica", url: "/gestao/agenda-telefonica", icon: Calendar },
          { title: "Documentos Administrativos", url: "/gestao/documentos", icon: FileText },
          { title: "Arquivos e Pastas", url: "/gestao/arquivos-pastas", icon: FileText },
          { title: "E-mail Inteligente", url: "/gestao/email-inteligente", icon: Mail },
          { title: "Agenda de Compromissos", url: "/gestao/agenda-compromissos", icon: Calendar },
          { title: "Regiões de Entrega", url: "/gestao/regioes-entrega", icon: Truck },
        ],
      },
      // Gestão Usuários (link direto)
      { title: "Gestão Usuários", url: "/gestao/usuarios", icon: Users, perm: "usuario.ver" },
      // Faturamento (badge novo)
      { title: "Faturamento", url: "/faturamento", icon: FileText, badge: "novo", perm: "fiscal.emitir" },
    ],
  },

  // VENDAS PELA INTERNET
  {
    label: "Vendas pela Internet",
    items: [
      { title: "iFood", url: "/marketplace-ifood", icon: ShoppingCart, perm: "venda.criar" },
    ],
  },

  // CONFIGURAÇÕES
  {
    label: "Configurações",
    items: [
      { title: "Configurações do Sistema", url: "/config/sistema", icon: Cog, perm: "config.ver" },
      { title: "Configurações Empresariais", url: "/config/empresarial", icon: Briefcase, perm: "config.editar" },
      { title: "Minhas Chaves", url: "/config/minhas-chaves", icon: Key, badge: "novo" },
      { title: "Downloads", url: "/config/downloads", icon: Barcode },
      {
        title: "Treinamento Sistema",
        icon: HelpCircle,
        items: [
          { title: "Tutoriais", url: "/treinamento/tutoriais", icon: HelpCircle },
        ],
      },
      {
        title: "Links Úteis",
        icon: Truck,
        items: [
          { title: "Testar Velocidade", url: "https://fast.com/pt/", icon: Truck },
          { title: "Testar Teclado", url: "https://teclado.online/pt/teste.php", icon: Truck },
          { title: "Simples Nacional", url: "http://www8.receita.fazenda.gov.br/SimplesNacional/Default.aspx", icon: Truck },
          { title: "Baixar AnyDesk", url: "https://anydesk.com/pt/downloads/windows", icon: Truck },
          { title: "TeamViewer", url: "#", icon: Truck },
          { title: "Remover Vírus", url: "https://www.avast.com/pt-br/c-virus-removal-tool", icon: Truck },
          { title: "Limpar Histórico (Cache)", url: "https://support.google.com/chrome/answer/95589", icon: Truck },
          { title: "Outros Downloads", url: "/config/downloads", icon: Truck },
        ],
      },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { can } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(() => {
    // Abre "Financeiro" por padrão se estiver na rota
    if (location.pathname.startsWith("/financeiro")) return ["Financeiro"];
    return [];
  });

  const isActive = (item: NavItem) => {
    if (item.exact) return location.pathname === item.url;
    return location.pathname === item.url || location.pathname.startsWith(item.url + "/");
  };

  const isSubmenuActive = (submenu: NavSubmenu) => {
    return submenu.items.some((item) => isActive(item));
  };

  const toggleMenu = (title: string) => {
    setExpandedMenus((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  const hasPermission = (perm?: Permission) => !perm || can(perm);

  const renderSubmenuItem = (submenu: NavSubmenu, parentLabel: string) => {
    const visibleItems = submenu.items.filter(hasPermission);
    if (visibleItems.length === 0) return null;
    
    const isOpen = expandedMenus.includes(parentLabel) || isSubmenuActive(submenu);

    return (
      <li key={parentLabel}>
        <button
          type="button"
          onClick={() => toggleMenu(parentLabel)}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            isSubmenuActive(submenu)
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
        >
          <submenu.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{submenu.title}</span>
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform",
              isOpen ? "rotate-180" : ""
            )}
          />
        </button>
        {isOpen && (
          <ul className="mt-1 space-y-0.5 pl-4">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <li key={item.url}>
                  <Link
                    to={item.url}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                    <span className="flex-1 truncate">{item.title}</span>
                    {item.badge && (
                      <Badge variant="secondary" className="ml-auto text-[9px] h-4 px-1.5">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  const renderItem = (item: NavItem | NavSubmenu) => {
    if ("items" in item) {
      if (!hasPermission(item.perm)) return null;
      return renderSubmenuItem(item as NavSubmenu, item.title);
    }

    if (!hasPermission(item.perm)) return null;
    const Icon = item.icon;
    const active = isActive(item);

    return (
      <li key={item.url}>
        <Link
          to={item.url}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            active
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{item.title}</span>
          {item.badge && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
              {item.badge}
            </Badge>
          )}
        </Link>
      </li>
    );
  };

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Store className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">ERP System</span>
            <span className="text-[10px] text-muted-foreground">X-LIFE Suplementos</span>
          </div>
        </Link>
      </div>

      {/* Perfil do usuário (estilo site) */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          JS
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Bem-vindo(a),</p>
          <p className="text-sm font-medium truncate">Jean Suplementos</p>
          <p className="text-[10px] text-muted-foreground">FUNCIONARIO MASTER</p>
        </div>
      </div>

      {/* Menu Sections */}
      <nav className="flex-1 overflow-y-auto py-2">
        {groups.map((group, idx) => {
          const visibleItems = group.items.filter((item) => {
            if ("items" in item) return hasPermission(item.perm);
            return hasPermission(item.perm);
          });
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label || `group-${idx}`}>
              {group.label && (
                <h3 className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h3>
              )}
              <ul className="space-y-0.5 px-2">
                {visibleItems.map(renderItem)}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Footer (estilo sidebar-footer) */}
      <div className="flex items-center justify-around border-t border-sidebar-border p-2">
        <Link
          to="/config/sistema"
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground"
          title="Configuração"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <button
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground"
          title="Tela cheia"
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else {
              document.documentElement.requestFullscreen();
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5v4m0-4h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <Link
          to="/config/downloads"
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground"
          title="Downloads"
        >
          <Barcode className="h-4 w-4" />
        </Link>
        <Link
          to="/login"
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground"
          title="Sair"
        >
          <HelpCircle className="h-4 w-4" />
        </Link>
      </div>
    </aside>
  );
}
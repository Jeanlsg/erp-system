import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Boxes,
  ScanBarcode,
  Receipt,
  Users,
  Truck,
  ShoppingCart,
  BarChart3,
  Settings,
  Wallet,
  RotateCcw,
  FileText,
  Store,
  Building2,
  ArrowLeftRight,
  Globe,
  HelpCircle,
  KanbanSquare,
  PackagePlus,
  Banknote,
} from "lucide-react";

import { useAuth, type Permission } from "@/lib/store/auth-store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  url: string;
  icon: typeof Package;
  exact?: boolean;
  perm?: Permission;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const sections: NavSection[] = [
  {
    label: "Operação",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard, exact: true },
      { title: "Visão Geral", url: "/visao-geral", icon: Globe, perm: "relatorio.ver" },
      { title: "PDV", url: "/pdv", icon: ScanBarcode, perm: "pdv.usar" },
      { title: "Caixa", url: "/caixa", icon: Wallet, perm: "caixa.abrir" },
    ],
  },
  {
    label: "Vendas",
    items: [
      { title: "Pedidos", url: "/pedidos", icon: ShoppingCart, perm: "venda.criar" },
      { title: "Vendas", url: "/vendas", icon: Receipt, perm: "relatorio.ver" },
      { title: "Devoluções", url: "/devolucoes", icon: RotateCcw, perm: "venda.cancelar" },
      { title: "Kits", url: "/kits", icon: KanbanSquare, perm: "produto.ver" },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { title: "Produtos", url: "/produtos", icon: Package, perm: "produto.ver" },
      { title: "Estoque", url: "/estoque", icon: Boxes, perm: "estoque.ver" },
      { title: "Transferência", url: "/estoque.transferencia", icon: ArrowLeftRight, perm: "estoque.transferir" },
      { title: "Compras", url: "/compras", icon: PackagePlus, perm: "compra.ver" },
      { title: "Fornecedores", url: "/fornecedores", icon: Truck, perm: "compra.ver" },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { title: "Clientes", url: "/clientes", icon: Users, perm: "cliente.ver" },
      { title: "Funcionários", url: "/funcionarios", icon: Building2, perm: "usuario.ver" },
    ],
  },
  {
    label: "Financeiro & Fiscal",
    items: [
      { title: "Financeiro", url: "/financeiro", icon: Banknote, perm: "financeiro.ver" },
      { title: "Fiscal", url: "/fiscal", icon: FileText, perm: "fiscal.emitir" },
      { title: "Relatórios", url: "/relatorios", icon: BarChart3, perm: "relatorio.ver" },
    ],
  },
  {
    label: "Configuração",
    items: [
      { title: "Lojas", url: "/lojas", icon: Store, perm: "loja.ver" },
      { title: "Configurações", url: "/configuracoes", icon: Settings, perm: "config.ver" },
      { title: "Ajuda", url: "/ajuda", icon: HelpCircle },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { can } = useAuth();

  const isActive = (item: NavItem) => {
    if (item.exact) return location.pathname === item.url;
    return location.pathname === item.url || location.pathname.startsWith(item.url + "/");
  };

  return (
    <TooltipProvider delayDuration={300}>
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Store className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">ERP System</span>
              <span className="text-[10px] text-muted-foreground">Multi-Loja</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {sections.map((section) => {
            const visible = section.items.filter((i) => !i.perm || can(i.perm));
            if (visible.length === 0) return null;
            return (
              <div key={section.label} className="py-2">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </p>
                <ul className="space-y-0.5">
                  {visible.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item);
                    return (
                      <li key={item.url}>
                        <Tooltip>
                          <TooltipTrigger asChild>
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
                              <span className="truncate">{item.title}</span>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right">{item.title}</TooltipContent>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>
    </TooltipProvider>
  );
}
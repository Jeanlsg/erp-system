// ============================================================
// Componente: NotificationIcons (Header)
// Renderiza TODOS os 6 ícones em fileira sempre visíveis.
// - Estado ATIVO (com cor) quando há notificações
// - Estado VAZIO (cinza, opaco) quando count = 0
// - Tooltip explicativo em ambos os estados
// - Dropdown mostra detalhes quando clicado
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Package2, Cake, AlertOctagon, Calendar, Shield,
  MessageSquare, ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNotificacoesHeader, type NotificacaoItem } from "@/lib/hooks/use-notificacoes-header";

type NotifKey = "estoque_baixo" | "aniversariantes" | "contas_vencidas" | "lotes_vencendo" | "cert_vencendo" | "ocorrencias";

interface IconConfig {
  key: NotifKey;
  icon: LucideIcon;
  label: string;
  cor: string;
  bgCor: string;
  hoverBgCor: string;
  borderCor: string;
  linkVazio: string;
}

const ICONS: IconConfig[] = [
  {
    key: "estoque_baixo",
    icon: Package2,
    label: "Estoque Baixo",
    cor: "text-orange-700 dark:text-orange-400",
    bgCor: "bg-orange-50 dark:bg-orange-950/40",
    hoverBgCor: "hover:bg-orange-100 dark:hover:bg-orange-950/60",
    borderCor: "border-orange-200 dark:border-orange-900",
    linkVazio: "/produtos-estoque",
  },
  {
    key: "aniversariantes",
    icon: Cake,
    label: "Aniversariantes",
    cor: "text-pink-700 dark:text-pink-400",
    bgCor: "bg-pink-50 dark:bg-pink-950/40",
    hoverBgCor: "hover:bg-pink-100 dark:hover:bg-pink-950/60",
    borderCor: "border-pink-200 dark:border-pink-900",
    linkVazio: "/gestao/localizar-pessoas",
  },
  {
    key: "contas_vencidas",
    icon: AlertOctagon,
    label: "Contas Vencidas",
    cor: "text-red-700 dark:text-red-400",
    bgCor: "bg-red-50 dark:bg-red-950/40",
    hoverBgCor: "hover:bg-red-100 dark:hover:bg-red-950/60",
    borderCor: "border-red-200 dark:border-red-900",
    linkVazio: "/financeiro",
  },
  {
    key: "lotes_vencendo",
    icon: Calendar,
    label: "Lotes Vencendo",
    cor: "text-amber-700 dark:text-amber-400",
    bgCor: "bg-amber-50 dark:bg-amber-950/40",
    hoverBgCor: "hover:bg-amber-100 dark:hover:bg-amber-950/60",
    borderCor: "border-amber-200 dark:border-amber-900",
    linkVazio: "/lotes",
  },
  {
    key: "cert_vencendo",
    icon: Shield,
    label: "Certificado",
    cor: "text-red-700 dark:text-red-400",
    bgCor: "bg-red-50 dark:bg-red-950/40",
    hoverBgCor: "hover:bg-red-100 dark:hover:bg-red-950/60",
    borderCor: "border-red-200 dark:border-red-900",
    linkVazio: "/gestao/nfe-certificado",
  },
  {
    key: "ocorrencias",
    icon: MessageSquare,
    label: "Ocorrências",
    cor: "text-purple-700 dark:text-purple-400",
    bgCor: "bg-purple-50 dark:bg-purple-950/40",
    hoverBgCor: "hover:bg-purple-100 dark:hover:bg-purple-950/60",
    borderCor: "border-purple-200 dark:border-purple-900",
    linkVazio: "/gestao/ocorrencias",
  },
];

export function NotificationIcons() {
  const navigate = useNavigate();
  const { data, isLoading } = useNotificacoesHeader();
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Tooltip customizado por tipo
  function tooltipText(key: NotifKey, count: number): string {
    if (count === 0) {
      switch (key) {
        case "estoque_baixo": return "Nenhum produto abaixo do mínimo";
        case "aniversariantes": return "Sem aniversariantes este mês";
        case "contas_vencidas": return "Nenhuma conta vencida";
        case "lotes_vencendo": return "Sem lotes vencendo";
        case "cert_vencendo": return "Certificado digital em dia";
        case "ocorrencias": return "Sem ocorrências pendentes";
      }
    }
    switch (key) {
      case "estoque_baixo":
        return `${count} produto(s) abaixo do mínimo`;
      case "aniversariantes":
        return `${count} cliente(s) aniversariando`;
      case "contas_vencidas":
        return `${count} conta(s) vencida(s)`;
      case "lotes_vencendo":
        return `${count} produto(s) vencendo ou vencido(s)`;
      case "cert_vencendo":
        return `Certificado digital vencendo`;
      case "ocorrencias":
        return `${count} ocorrência(s) pendente(s)`;
    }
  }

  return (
    <div className="flex items-center gap-0.5">
      {ICONS.map((cfg) => {        const Icon = cfg.icon;
        const bloco = data?.[cfg.key] ?? { count: 0, itens: [] };
        const count = bloco.count;
        const open = openKey === cfg.key;
        const isActive = !isLoading && count > 0;

        return (
          <DropdownMenu
            key={cfg.key}
            open={open}
            onOpenChange={(o) => setOpenKey(o ? cfg.key : null)}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={cfg.label}
                    className={cn(
                      "relative flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                      isActive
                        ? cn(cfg.bgCor, cfg.hoverBgCor, cfg.borderCor)
                        : "bg-muted/40 border-border hover:bg-muted text-muted-foreground hover:text-foreground",
                      open && isActive && "ring-1 ring-primary/30"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isActive ? cfg.cor : "text-muted-foreground")} />
                    {isActive && (
                      <span
                        className={cn(
                          "absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground shadow-sm ring-2 ring-background",
                          count > 99 && "px-1.5"
                        )}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{cfg.label}</p>
                <p className="text-xs text-muted-foreground">
                  {isLoading ? "Carregando..." : tooltipText(cfg.key, count)}
                </p>
              </TooltipContent>
            </Tooltip>

            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="w-80 max-h-[440px] overflow-y-auto p-0"
            >
              <DropdownMenuLabel
                className={cn(
                  "flex items-center gap-2 rounded-none px-3 py-2.5 border-b",
                  isActive
                    ? cn(cfg.bgCor, cfg.borderCor)
                    : "bg-muted/40 border-border"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? cfg.cor : "text-muted-foreground")} />
                <span className="font-semibold text-sm">{cfg.label}</span>
                <span
                  className={cn(
                    "ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                    isActive
                      ? cn(cfg.cor, "bg-background border", cfg.borderCor)
                      : "bg-background border border-border text-muted-foreground"
                  )}
                >
                  {isLoading ? "—" : count}
                </span>
              </DropdownMenuLabel>

              {isLoading ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Carregando...
                </div>
              ) : bloco.itens.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhum item no momento
                </div>
              ) : (
                <div className="py-1">
                  {bloco.itens.map((item: NotificacaoItem) => (
                    <DropdownMenuItem
                      key={item.id}
                      className="mx-1 flex cursor-pointer flex-col items-start gap-0.5 rounded-md px-2.5 py-2 focus:bg-accent"
                      onClick={() => {
                        setOpenKey(null);
                        navigate(item.link);
                      }}
                    >
                      <div className="flex w-full items-center gap-2">
                        <p className="truncate text-sm font-medium flex-1">
                          {item.titulo}
                        </p>
                        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      </div>
                      {item.subtitulo && (
                        <p className="text-xs text-muted-foreground">
                          {item.subtitulo}
                        </p>
                      )}
                      {item.valor && (
                        <p className="text-xs font-mono text-muted-foreground">
                          {item.valor}
                        </p>
                      )}
                    </DropdownMenuItem>
                  ))}
                </div>
              )}

              {!isLoading && bloco.count > bloco.itens.length && bloco.count > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <button
                    onClick={() => {
                      setOpenKey(null);
                      navigate(cfg.linkVazio);
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-center text-xs font-medium transition-colors hover:bg-accent",
                      cfg.cor
                    )}
                  >
                    Ver todos ({bloco.count}) →
                  </button>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </div>
  );
}
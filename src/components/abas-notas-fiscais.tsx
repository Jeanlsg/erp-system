// ============================================================
// Barra de abas de "Notas Fiscais", como no Excellent (Notas vendas | Notas
// entrada | Notas devolução fornecedor | Inutilização sequência | Manifesto |
// Sintegra…). Aparece no topo de cada tela fiscal, que deixaram de ter item
// próprio no menu; cada aba respeita a permissão da tela.
// ============================================================

import { Link, useLocation } from "react-router-dom";

import { ABAS_NOTAS_FISCAIS } from "@/components/app-sidebar";
import { useAuth } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

/** A rota é uma das telas abertas pelas abas de Notas Fiscais? */
export function ehTelaDeNotas(pathname: string): boolean {
  return ABAS_NOTAS_FISCAIS.some((a) => {
    const base = a.url.split("?")[0];
    return pathname === base || pathname.startsWith(base + "/");
  });
}

export function AbasNotasFiscais() {
  const { pathname, search } = useLocation();
  const { can } = useAuth();
  const aba = new URLSearchParams(search).get("aba");
  const abas = ABAS_NOTAS_FISCAIS.filter((a) => can(a.perm));
  if (abas.length < 2) return null;

  const ativa = (url: string) => {
    const [base, query] = url.split("?");
    if (query) return pathname === base && aba === new URLSearchParams(query).get("aba");
    // "Notas vendas" é a lista sem a aba de inutilizações
    if (base === "/notas-fiscais") return pathname === base && aba !== "inutilizacoes";
    return pathname === base || pathname.startsWith(base + "/");
  };

  return (
    <nav aria-label="Notas Fiscais" className="mb-4 flex flex-wrap gap-1 border-b pb-2">
      {abas.map((a) => (
        <Link
          key={a.url}
          to={a.url}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            ativa(a.url)
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {a.titulo}
        </Link>
      ))}
    </nav>
  );
}

import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldOff, Settings, ArrowLeft, EyeOff } from "lucide-react";
import { useFeatureFlags } from "@/lib/supabase-queries";
import { useAuth } from "@/lib/store/auth-store";
import { date } from "@/lib/format";

interface Props {
  /** Path da rota que esta guard está protegendo (ex: "/pdv"). */
  path: string;
  children: ReactNode;
}

/**
 * Bloqueia o acesso a uma rota cuja feature flag esteja desativada.
 *
 * - Usuários não-admin: veem tela de "página desativada" e podem voltar.
 * - Admins: veem a página normalmente + banner amarelo no topo avisando.
 *   Assim o admin consegue testar/previewar a página desativada.
 */
export function FeatureGuard({ path, children }: Props) {
  const { data: flags = [], isLoading } = useFeatureFlags();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Enquanto carrega, permite acesso (fail-open)
  if (isLoading) return <>{children}</>;

  const flag = flags.find((f) => f.path === path);

  // Sem flag → sempre permite
  if (!flag) return <>{children}</>;

  // Flag protegida → sempre permite acesso (mesmo se ativo = false)
  if (flag.is_protegida) return <>{children}</>;

  // Flag ativa → permite
  if (flag.ativo) return <>{children}</>;

  // Flag desativada:
  // - Admin: mostra a página com banner amarelo de aviso
  // - Não-admin: tela de bloqueio
  if (isAdmin) {
    return (
      <>
        <div className="bg-yellow-100 dark:bg-yellow-950/30 border-b border-yellow-300 dark:border-yellow-900 px-4 py-2 flex items-center gap-3 text-sm">
          <EyeOff className="h-4 w-4 text-yellow-700 dark:text-yellow-400 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-yellow-900 dark:text-yellow-200">
              Página desativada — Modo Admin
            </p>
            <p className="text-xs text-yellow-800 dark:text-yellow-300">
              Esta página está desativada para todos os usuários. Você (admin) está vendo em modo preview.
              {flag.motivo_desativacao && <span> Motivo: <em>{flag.motivo_desativacao}</em></span>}
              {flag.desativado_em && <span> · Em {date(flag.desativado_em)}</span>}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/config/sistema">
              <Settings className="h-3.5 w-3.5 mr-1.5" /> Reativar
            </Link>
          </Button>
        </div>
        {children}
      </>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30">
            <ShieldOff className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Página desativada</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Esta funcionalidade foi desativada temporariamente pelo administrador.
          </p>

          {flag.motivo_desativacao && (
            <div className="bg-muted rounded-md p-3 text-left mb-4 text-sm">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Motivo</p>
              <p>{flag.motivo_desativacao}</p>
            </div>
          )}

          <div className="flex gap-2 justify-center">
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao início
              </Link>
            </Button>
            <Button asChild>
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground mt-4 font-mono">
            {flag.path}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
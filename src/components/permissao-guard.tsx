// ============================================================
// Guard de rota por permissão — a tela inteira, não só o item de menu.
//
// Esconder na sidebar não protege nada: a URL digitada abria qualquer
// tela para qualquer usuário logado. Um operador de caixa chegava em
// /financeiro, /gestao/funcionarios e /config/sistema.
//
// A permissão exigida sai de permissaoDaRota(), que lê a mesma estrutura
// do menu — uma fonte de verdade só.
//
// Isto é a camada de CONVENIÊNCIA. A trava de verdade é o RLS do banco
// (migration 078): mesmo que alguém contorne esta tela, a API não devolve
// folha de pagamento nem financeiro para quem não é admin/gerente.
// ============================================================

import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth, roleLabels, type Role } from "@/lib/store/auth-store";
import { permissaoDaRota } from "@/components/app-sidebar";

export function PermissaoGuard({ path, children }: { path: string; children: ReactNode }) {
  const { user, can } = useAuth();
  const perm = permissaoDaRota(path);

  // rota sem permissão declarada, ou usuário ainda carregando: deixa passar
  if (!perm || !user) return <>{children}</>;
  if (can(perm)) return <>{children}</>;

  const papeis = (user.papeis?.length ? user.papeis : [user.role]) as Role[];

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <ShieldOff className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">Esta tela não é do seu perfil</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Seu acesso é de <b>{papeis.map((p) => roleLabels[p] ?? p).join(", ")}</b>, que não inclui
            esta página. Se você precisa dela para trabalhar, peça ao administrador.
          </p>
          <p className="mb-4 font-mono text-[11px] text-muted-foreground">
            {path} · exige {perm}
          </p>
          <Button asChild variant="outline">
            <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao início</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

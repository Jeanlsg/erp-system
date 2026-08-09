import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { LogOut, Store, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/app-sidebar";
import { FeatureGuard } from "@/components/feature-guard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, roleLabels, logout } from "@/lib/store/auth-store";
import { useLojaAtualStore } from "@/lib/store/loja-atual";
import { useLojas, isSupabaseConfigured } from "@/lib/supabase-queries";

export function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { data: lojas = [] } = useLojas();
  const currentLojaId = useLojaAtualStore((s) => s.currentLojaId);
  const setCurrentLojaId = useLojaAtualStore((s) => s.setCurrentLojaId);

  const [hydrated, setHydrated] = useState(false);

  // ===== TODOS OS HOOKS ANTES DE QUALQUER EARLY RETURN =====
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [hydrated, isAuthenticated, navigate]);

  // Auto-selecionar primeira loja ao carregar
  useEffect(() => {
    if (lojas.length > 0 && !currentLojaId) {
      const matriz = lojas.find((l) => l.matriz) ?? lojas[0];
      setCurrentLojaId(matriz.id);
    }
  }, [lojas, currentLojaId, setCurrentLojaId]);

  function handleLogout() {
    logout();
    toast.success("Logout realizado!");
    navigate("/login", { replace: true });
  }

  // ===== EARLY RETURN (após todos os hooks) =====
  if (!hydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm">Carregando…</p>
        </div>
      </div>
    );
  }

  const lojaAtual = lojas.find((l) => l.id === currentLojaId);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            {isSupabaseConfigured() && lojas.length > 0 ? (
              <Select value={currentLojaId ?? ""} onValueChange={setCurrentLojaId}>
                <SelectTrigger className="w-48">
                  <Store className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Selecione loja" />
                </SelectTrigger>
                <SelectContent>
                  {lojas.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.apelido} {l.matriz && "★"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Store className="h-4 w-4" />
                {lojaAtual?.apelido ?? "Sistema"}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {user ? roleLabels[user.role] : ""}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <UserIcon className="h-4 w-4" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.nome}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/config/sistema">
                    <UserIcon className="mr-2 h-4 w-4" /> Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1">
          <div className="p-4 md:p-6">
            <FeatureGuard path={location.pathname}>
              <Outlet />
            </FeatureGuard>
          </div>
        </main>
      </div>
    </div>
  );
}
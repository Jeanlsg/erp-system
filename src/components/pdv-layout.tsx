// ============================================================
// Layout do PDV: a tela de venda ocupa o monitor inteiro.
//
// O PDV vivia dentro do mesmo casco das telas de gestão, com o menu
// lateral ao lado — num balcão isso é espaço perdido e caminho para sair
// da venda sem querer. Aqui só existe o que o operador precisa: a loja em
// que está, quem está logado e a saída.
//
// Para quem só opera o balcão esta é a única tela do sistema; o redirect
// vive no RootLayout, que devolve essa pessoa para cá se ela cair em
// qualquer outra rota.
// ============================================================

import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { LogOut, Store, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth, logout, roleLabels, ehOperadorDeBalcao, type Role } from "@/lib/store/auth-store";
import { usePdvModo } from "@/lib/store/pdv-modo";
import { AppSidebar } from "@/components/app-sidebar";
import { useLojaAtualStore } from "@/lib/store/loja-atual";
import { useLojas, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useConexao } from "@/lib/offline/conexao";

export function PdvLayout() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { data: lojas = [] } = useLojas();
  const currentLojaId = useLojaAtualStore((s) => s.currentLojaId);
  const setCurrentLojaId = useLojaAtualStore((s) => s.setCurrentLojaId);
  const online = useConexao();
  const vendendo = usePdvModo((s) => s.vendendo);

  // Fora da venda a tela é administrativa (escolher caixa, conferir
  // fechamento) e o menu ajuda. Com a venda aberta ele sai: o balcão quer a
  // tela inteira, e um menu ao lado é convite a sair da venda sem querer.
  // Quem só opera o balcão não vê o menu em momento nenhum — clicar nele o
  // devolveria para cá de qualquer forma.
  const mostrarMenu = !vendendo && !ehOperadorDeBalcao();
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => { setHidratado(true); }, []);
  useEffect(() => {
    if (hidratado && !isAuthenticated) navigate("/login", { replace: true });
  }, [hidratado, isAuthenticated, navigate]);

  useEffect(() => {
    if (lojas.length > 0 && !currentLojaId) {
      setCurrentLojaId((lojas.find((l: any) => l.matriz) ?? lojas[0]).id);
    }
  }, [lojas, currentLojaId, setCurrentLojaId]);

  if (!hidratado || !isAuthenticated) return null;

  const papeis = (user?.papeis?.length ? user.papeis : [user?.role]) as Role[];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {mostrarMenu && <AppSidebar />}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-card px-4 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold tracking-tight">Frente de caixa</span>
          {isSupabaseConfigured() && lojas.length > 1 ? (
            <Select value={currentLojaId ?? ""} onValueChange={setCurrentLojaId}>
              <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Escolha a loja" /></SelectTrigger>
              <SelectContent>
                {lojas.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.apelido || l.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Store className="h-3.5 w-3.5" />
              {(lojas.find((l: any) => l.id === currentLojaId) as any)?.apelido ?? "—"}
            </span>
          )}
          {!online && (
            <span className="flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <WifiOff className="h-3 w-3" /> sem internet — as vendas ficam na fila
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium">{user?.nome}</p>
            <p className="text-xs text-muted-foreground">
              {papeis.map((p) => roleLabels[p] ?? p).join(", ")}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { logout(); navigate("/login", { replace: true }); }}>
            <LogOut className="mr-1 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      {/* overflow-hidden: o PDV controla o próprio scroll (catálogo e carrinho
          rolam separados) */}
      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
      </div>
    </div>
  );
}

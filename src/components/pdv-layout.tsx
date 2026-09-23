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
import { Lock, LogOut, Store, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth, logout, roleLabels, ehOperadorDeBalcao, type Role } from "@/lib/store/auth-store";
import { usePdvModo } from "@/lib/store/pdv-modo";
import { AppSidebar } from "@/components/app-sidebar";
import { useLojaAtualStore } from "@/lib/store/loja-atual";
import { isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { alternaFiliais } from "@/lib/lojas-permitidas";
import { useConexao } from "@/lib/offline/conexao";
import { podeTrocarDeLoja } from "@/lib/loja-do-caixa";

export function PdvLayout() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  // só as filiais do usuário: o dono vê todas, os demais as cadastradas
  // para eles; uma filial = sem seletor (migration 095)
  const { lojaId: currentLojaId, lojas, semFilial } = useAutoSelectLoja();
  const setCurrentLojaId = useLojaAtualStore((s) => s.setCurrentLojaId);
  const online = useConexao();
  const vendendo = usePdvModo((s) => s.vendendo);

  // A filial é a do seletor do topo; o caixa operado é o aberto NESTA filial
  // (lib/loja-do-caixa). Trocar a filial com o caixa de Petrolina aberto leva
  // a Juazeiro: ao caixa aberto lá, ou à abertura dele.
  //
  // Só trava com venda em andamento — o cupom começado numa loja não pode
  // terminar na outra. Antes travava com o caixa aberto, cupom vazio ou não,
  // e ainda devolvia o seletor para a loja do caixa ao entrar no PDV.
  const cupomComItens = usePdvModo((s) => s.cupomComItens);
  const lojaTravada = !podeTrocarDeLoja(cupomComItens);

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



  if (!hidratado || !isAuthenticated) return null;

  const papeis = (user?.papeis?.length ? user.papeis : [user?.role]) as Role[];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {mostrarMenu && <AppSidebar />}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-card px-4 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold tracking-tight">Frente de caixa</span>
          {/* Trava só com venda em andamento. Com o cupom vazio, trocar a
              filial leva ao caixa aberto dela ou à abertura — é assim que o
              admin alterna entre Petrolina e Juazeiro, e que quem só opera o
              balcão (sem menu lateral) escolhe onde abrir. */}
          {lojaTravada ? (
            <span
              className="flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-sm"
              title="Venda em andamento. Finalize ou cancele o cupom para trocar de filial."
            >
              <Store className="h-3.5 w-3.5" />
              {(lojas.find((l: any) => l.id === currentLojaId) as any)?.apelido
                ?? (lojas.find((l: any) => l.id === currentLojaId) as any)?.nome
                ?? "—"}
              <Lock className="h-3 w-3 text-muted-foreground" />
            </span>
          ) : isSupabaseConfigured() && alternaFiliais(lojas) ? (
            <Select value={currentLojaId ?? ""} onValueChange={setCurrentLojaId}>
              <SelectTrigger className="h-8 w-56">
                <Store className="mr-2 h-3.5 w-3.5" />
                <SelectValue placeholder="Escolha a loja" />
              </SelectTrigger>
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
        {semFilial ? (
          <div className="mx-auto mt-16 max-w-md rounded-lg border p-6 text-center">
            <p className="font-medium">Seu usuário não está em nenhuma filial.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Peça ao administrador para cadastrar em qual filial você trabalha, em
              Usuários e Permissões.
            </p>
          </div>
        ) : <Outlet />}
      </main>
      </div>
    </div>
  );
}

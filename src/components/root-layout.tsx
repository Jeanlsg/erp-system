import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { HelpCircle, LogOut, Store, User as UserIcon, PlayCircle, BookOpen } from "lucide-react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/app-sidebar";
import { AbasNotasFiscais, ehTelaDeNotas } from "@/components/abas-notas-fiscais";
import { ModoDemonstracao, temDemonstracao } from "@/components/modo-demonstracao";
import { FeatureGuard } from "@/components/feature-guard";
import { PermissaoGuard } from "@/components/permissao-guard";
import { NotificationIcons } from "@/components/notification-icons";
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
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth, roleLabels, logout, podeSair, ehOperadorDeBalcao } from "@/lib/store/auth-store";
import { ajudaDaRota } from "@/lib/ajuda-paginas";
import { useLojaAtualStore } from "@/lib/store/loja-atual";
import { useLojas, useCaixasAbertosDoUsuario, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { alternaFiliais } from "@/lib/lojas-permitidas";

/**
 * Telas de cadastro comum a todas as filiais.
 *
 * Cada filial tem os próprios dados — vendas, caixa, estoque, notas, contas —
 * e todas essas telas seguem a loja escolhida aqui no topo. Não há mais tela
 * com seletor de loja próprio: dois seletores na mesma página discordavam, e
 * o do topo não mandava.
 *
 * Estas rotas são a exceção de conteúdo, não de seletor: fornecedor e
 * funcionário são da empresa, não da filial. Cliente deixou de ser (096):
 * cada filial vê os seus. O seletor continua visível
 * (a escolha vale para a próxima tela), com um aviso para ninguém trocar de
 * filial e estranhar que a lista não mudou.
 */
export const ROTAS_DA_EMPRESA = [
  "/gestao/fornecedores", "/fornecedores",
  "/gestao/funcionarios", "/funcionarios",
  "/gestao/servicos",
  "/gestao/transportadoras",
  "/gestao/usuarios", "/gestao/administrar-usuarios", "/gestao/usuario-permissoes",
  "/kits",
  "/lojas",
  "/gestao/configuracoes-gerais", "/config/sistema", "/configuracoes",
];

/** "Xlife Tecnologia" → "XT" (avatar do header). */
function iniciais(nome?: string | null): string {
  const partes = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  // todas as lojas do sistema: só para saber se o setup já foi feito
  const { data: todasLojas = [], isSuccess: lojasCarregadas } = useLojas();
  // as filiais DESTE usuário: o dono vê todas; os demais, só as cadastradas
  // para eles. Uma filial = sem seletor. O hook também corrige a loja
  // guardada no navegador quando ela deixa de ser do usuário.
  const { lojaId: currentLojaId, lojas, semFilial } = useAutoSelectLoja();
  const setCurrentLojaId = useLojaAtualStore((s) => s.setCurrentLojaId);
  // mesma queryKey do PDV: o header não faz requisição a mais. O caixa é o
  // da filial escolhida no topo — antes aparecia "Caixa 1 aberto" com
  // Juazeiro selecionado e o caixa aberto em Petrolina (11/10/2026).
  const { data: caixasAbertos = [] } = useCaixasAbertosDoUsuario(user?.id);
  const caixaAberto = (caixasAbertos as any[]).find((c) => c.loja_id === currentLojaId) ?? null;
  const caixaEmOutraLoja = caixaAberto ? null : (caixasAbertos as any[])[0] ?? null;
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const dadoDaEmpresa = ROTAS_DA_EMPRESA.includes(location.pathname);

  const [hydrated, setHydrated] = useState(false);
  // Modo demonstração: o "?" explica a página e, quando há tour, percorre
  // os botões um a um sem executar nenhuma ação real.
  const [demo, setDemo] = useState(false);

  // ===== TODOS OS HOOKS ANTES DE QUALQUER EARLY RETURN =====
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [hydrated, isAuthenticated, navigate]);

  // Operador de balcão não tem o que fazer no menu de gestão: qualquer rota
  // daqui o devolve para a frente de caixa. É o mesmo teste do login, aqui
  // de novo porque a URL digitada não passa pelo login.
  useEffect(() => {
    if (hydrated && isAuthenticated && ehOperadorDeBalcao()) {
      navigate("/pdv", { replace: true });
    }
  }, [hydrated, isAuthenticated, location.pathname, navigate]);

  // Redirecionar para setup se não houver nenhuma loja cadastrada.
  // Só depois da query RESOLVER: enquanto carrega, `lojas` é [] e o
  // redirect mandava usuário com loja cadastrada para o /setup.
  useEffect(() => {
    if (hydrated && isAuthenticated && lojasCarregadas && todasLojas.length === 0) {
      navigate("/setup", { replace: true });
    }
  }, [hydrated, isAuthenticated, lojasCarregadas, todasLojas.length, navigate]);

  async function handleLogout() {
    if (!(await podeSair())) return;
    // espera a sessão e o cache sumirem antes de ir para o login: navegar antes
    // deixava a próxima tela ler com o token e o cache de quem saiu
    await logout();
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

  const lojaAtual = (lojas as any[]).find((l) => l.id === currentLojaId);
  const tituloDaPagina = ajudaDaRota(location.pathname)?.titulo ?? null;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header preto como o menu (pedido da loja, 10/10/2026: "muito branco",
            alertas sem destaque). `dark` faz os componentes de dentro usarem a
            paleta escura sem mudar o tema do resto da tela. */}
        <header className="dark sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b-2 border-b-red-600 bg-[#121212] px-4 text-foreground">
          <div className="flex min-w-0 items-center gap-3">
            {/* Seletor só para quem trabalha em mais de uma filial (ou o dono). */}
            {isSupabaseConfigured() && alternaFiliais(lojas) ? (
              <Select value={currentLojaId ?? ""} onValueChange={setCurrentLojaId}>
                <SelectTrigger className="w-48">
                  <Store className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Selecione loja" />
                </SelectTrigger>
                <SelectContent>
                  {lojas.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {/* ★ marca a matriz; desde a migration 114 o apelido já é "Matriz", e "Matriz ★" repetiria */}
                      {l.apelido}{l.matriz && !/matriz/i.test(l.apelido ?? "") && " ★"}
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
            {tituloDaPagina && (
              <div className="hidden min-w-0 items-center gap-2 md:flex">
                <span className="h-5 w-px bg-white/15" aria-hidden="true" />
                <span className="truncate text-sm font-semibold text-white">{tituloDaPagina}</span>
              </div>
            )}
            {dadoDaEmpresa && lojas.length > 1 && (
              <span className="hidden rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-neutral-300 lg:inline"
                title="Este cadastro é da empresa, não da filial: é o mesmo nas duas lojas.">
                cadastro comum às filiais
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider delayDuration={150}>
              {/* "O que esta página faz" — a descrição acompanha a rota atual,
                  então toda tela ganha ajuda sem precisar de código próprio. */}
              {(() => {
                const ajuda = ajudaDaRota(location.pathname);
                if (!ajuda) return null;
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        title="O que esta página faz"
                        aria-label="O que esta página faz"
                      >
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80 p-3">
                      <p className="mb-1 text-sm font-semibold">{ajuda.titulo}</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {ajuda.descricao}
                      </p>
                      <div className="mt-3 flex flex-col gap-1.5 border-t pt-3">
                        {temDemonstracao(location.pathname) && (
                          <Button size="sm" className="w-full justify-start" onClick={() => setDemo(true)}>
                            <PlayCircle className="mr-2 h-3.5 w-3.5" />
                            Ver como usar esta tela
                          </Button>
                        )}
                        <Button asChild size="sm" variant="ghost" className="w-full justify-start">
                          <Link to="/tutoriais">
                            <BookOpen className="mr-2 h-3.5 w-3.5" /> Tutorial completo
                          </Link>
                        </Button>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })()}

              {/* Caixa do usuário NESTA filial: quem está no balcão vê de relance se abriu */}
              {isSupabaseConfigured() && (
                <Link to="/caixa"
                  className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:flex ${
                    caixaAberto ? "bg-green-600 text-white hover:bg-green-700"
                      : caixaEmOutraLoja ? "border border-amber-400/60 text-amber-300 hover:bg-white/10"
                      : "bg-white/10 text-neutral-300 hover:bg-white/15"}`}
                  title={caixaAberto ? `Aberto desde ${new Date(caixaAberto.data_abertura ?? Date.now()).toLocaleString("pt-BR")}`
                    : caixaEmOutraLoja ? "Você tem um caixa aberto em outra filial. Troque a filial no topo para vê-lo."
                    : "Nenhum caixa aberto por você nesta filial"}>
                  <span className={`h-2 w-2 rounded-full ${caixaAberto ? "bg-white" : caixaEmOutraLoja ? "bg-amber-400" : "bg-neutral-500"}`} />
                  {caixaAberto ? `Caixa ${caixaAberto.numero_caixa ?? ""} aberto`.replace("  ", " ")
                    : caixaEmOutraLoja ? `Caixa ${caixaEmOutraLoja.numero_caixa ?? ""} aberto em ${
                        ((lojas as any[]).find((l) => l.id === caixaEmOutraLoja.loja_id)?.apelido) ?? "outra filial"}`.replace("  ", " ")
                    : "Caixa fechado"}
                </Link>
              )}

              <span className="hidden text-xs tabular-nums text-neutral-300 xl:inline" title="Data e hora">
                {agora.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })} · {agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>

              {/* Ícones de notificação no header */}
              {isSupabaseConfigured() && <NotificationIcons />}

              {/* Divisor vertical */}
              <div
                aria-hidden="true"
                className="mx-1 h-5 w-px bg-border"
              />

              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-10 gap-2 rounded-full px-1.5 hover:bg-white/10 md:pr-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                          {iniciais(user?.nome) || <UserIcon className="h-4 w-4" />}
                        </div>
                        <div className="hidden text-left leading-tight md:block">
                          <p className="max-w-[140px] truncate text-xs font-semibold text-white">{user?.nome ?? "Usuário"}</p>
                          <p className="text-[10px] uppercase tracking-wide text-neutral-400">{user ? roleLabels[user.role] : ""}</p>
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium">{user?.nome}</p>
                          <p className="text-xs text-muted-foreground">{user?.email}</p>
                          {user && (
                            <p className="text-xs text-muted-foreground">
                              {roleLabels[user.role]}
                            </p>
                          )}
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
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{user?.nome ?? "Usuário"}</p>
                  <p className="text-xs text-muted-foreground">
                    {user ? roleLabels[user.role] : ""}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </header>

        <main className="flex-1 bg-[hsl(var(--area))]">
          <div className="p-4 md:p-6">
            <FeatureGuard path={location.pathname}>
              <PermissaoGuard path={location.pathname}>
                {semFilial ? (
                  <div className="mx-auto mt-16 max-w-md rounded-lg border p-6 text-center">
                    <p className="font-medium">Seu usuário não está em nenhuma filial.</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Peça ao administrador para cadastrar em qual filial você trabalha, em
                      Usuários e Permissões.
                    </p>
                  </div>
                ) : (
                  <>
                    {ehTelaDeNotas(location.pathname) && <AbasNotasFiscais />}
                    <Outlet />
                  </>
                )}
              </PermissaoGuard>
            </FeatureGuard>
          </div>
        </main>
      </div>

      {demo && <ModoDemonstracao rota={location.pathname} aoFechar={() => setDemo(false)} />}
    </div>
  );
}

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cog, Flag, Search, Loader2, ShieldOff, ShieldCheck, Power, AlertTriangle, Eye, History, Lock } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useFeatureFlags, useToggleFeatureFlag } from "@/lib/supabase-queries";
import type { FeatureFlag as FF } from "@/types/database";
import { useAuth } from "@/lib/store/auth-store";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { dateTime, date } from "@/lib/format";
import { cn } from "@/lib/utils";

const CATEGORIAS_LABEL: Record<string, string> = {
  operacao: "Operação",
  catalogo: "Catálogo",
  cadastros: "Cadastros",
  gestao: "Gestão Empresarial",
  financeiro: "Financeiro",
  cobranca: "Cobrança",
  "venda-mais": "Venda Mais (Marketing)",
  fiscal: "Fiscal",
  crm: "CRM & Atendimento",
  "controle-comercial": "Controle Comercial",
  "vendas-online": "Vendas Online",
  administracao: "Administração",
};

export function ConfigSistemaPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [abaAtiva, setAbaAtiva] = useState(isAdmin ? "features" : "config");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Cog className="h-6 w-6" /> Configurações do Sistema
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin
            ? "Gerencie parâmetros técnicos, feature flags e permissões globais"
            : "Parâmetros técnicos do sistema"}
        </p>
      </div>

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <TabsList className="w-full sm:w-auto">
          {isAdmin && (
            <TabsTrigger value="features">
              <Flag className="h-3.5 w-3.5 mr-1.5" /> Feature Flags
            </TabsTrigger>
          )}
          <TabsTrigger value="config">
            <Cog className="h-3.5 w-3.5 mr-1.5" /> Configurações Técnicas
          </TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="features">
            <FeatureFlagsPanel />
          </TabsContent>
        )}

        <TabsContent value="config">
          <ConfigTecnicasPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ====================================================================
// FEATURE FLAGS PANEL (somente admin)
// ====================================================================
function FeatureFlagsPanel() {
  const { user } = useAuth();
  const { data: flags = [], isLoading } = useFeatureFlags();
  const toggle = useToggleFeatureFlag();
  const [search, setSearch] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("todas");
  const [showApenasAtivas, setShowApenasAtivas] = useState(false);
  const [modalMotivo, setModalMotivo] = useState<{ flag: FF; novoValor: boolean } | null>(null);
  const [motivo, setMotivo] = useState("");

  const flagsFiltradas = useMemo(() => {
    let result = flags;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.titulo.toLowerCase().includes(s) ||
          f.path.toLowerCase().includes(s) ||
          f.chave.toLowerCase().includes(s) ||
          (f.descricao ?? "").toLowerCase().includes(s)
      );
    }
    if (categoriaAtiva !== "todas") {
      result = result.filter((f) => f.categoria === categoriaAtiva);
    }
    if (showApenasAtivas) {
      result = result.filter((f) => f.ativo);
    }
    return result;
  }, [flags, search, categoriaAtiva, showApenasAtivas]);

  const flagsAgrupadas = useMemo(() => {
    const mapa: Record<string, FF[]> = {};
    for (const f of flagsFiltradas) {
      if (!mapa[f.categoria]) mapa[f.categoria] = [];
      mapa[f.categoria].push(f);
    }
    return mapa;
  }, [flagsFiltradas]);

  const categoriasDisponiveis = useMemo(() => {
    return Array.from(new Set(flags.map((f) => f.categoria))).sort();
  }, [flags]);

  const totalAtivas = flags.filter((f) => f.ativo).length;
  const totalDesativadas = flags.filter((f) => !f.ativo).length;
  const ultimaDesativacao = useMemo(() => {
    const desativadas = flags.filter((f) => f.desativado_em).sort((a, b) =>
      (b.desativado_em ?? "").localeCompare(a.desativado_em ?? "")
    );
    return desativadas[0];
  }, [flags]);

  const handleToggle = (flag: FF) => {
    // Flags protegidas não podem ser desativadas — sempre exibidas no painel
    if (flag.is_protegida && flag.ativo) {
      return;
    }
    const novoValor = !flag.ativo;
    if (!novoValor) {
      // Desativar → pedir motivo
      setModalMotivo({ flag, novoValor: false });
      setMotivo("");
    } else {
      // Reativar → imediato
      toggle.mutate({ id: flag.id, ativo: true, userId: user?.id });
    }
  };

  const confirmarDesativacao = () => {
    if (!modalMotivo) return;
    toggle.mutate({
      id: modalMotivo.flag.id,
      ativo: false,
      motivo: motivo || "Desativada pelo admin",
      userId: user?.id,
    });
    setModalMotivo(null);
    setMotivo("");
  };

  const handleAtivarTodas = () => {
    if (!confirm(`Reativar todas as ${totalDesativadas} página(s) desativada(s)?`)) return;
    for (const f of flags.filter((x) => !x.ativo)) {
      toggle.mutate({ id: f.id, ativo: true, userId: user?.id });
    }
  };

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Feature Flags" />;

  return (
    <>
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Total de Páginas</p>
                <p className="text-2xl font-bold mt-1">{flags.length}</p>
              </div>
              <Flag className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Ativas</p>
                <p className="text-2xl font-bold mt-1 text-green-600">{totalAtivas}</p>
              </div>
              <ShieldCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Desativadas</p>
                <p className="text-2xl font-bold mt-1 text-red-600">{totalDesativadas}</p>
              </div>
              <ShieldOff className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Última Desativação</p>
            <p className="text-sm font-medium mt-1">
              {ultimaDesativacao ? ultimaDesativacao.titulo : "—"}
            </p>
            {ultimaDesativacao?.desativado_em && (
              <p className="text-xs text-muted-foreground">{dateTime(ultimaDesativacao.desativado_em)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, path ou chave..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={categoriaAtiva}
              onChange={(e) => setCategoriaAtiva(e.target.value)}
            >
              <option value="todas">Todas categorias ({flags.length})</option>
              {categoriasDisponiveis.map((c) => {
                const count = flags.filter((f) => f.categoria === c).length;
                return (
                  <option key={c} value={c}>
                    {CATEGORIAS_LABEL[c] ?? c} ({count})
                  </option>
                );
              })}
            </select>
            <Button
              variant={showApenasAtivas ? "default" : "outline"}
              size="sm"
              onClick={() => setShowApenasAtivas(!showApenasAtivas)}
            >
              {showApenasAtivas ? "Mostrar todas" : "Apenas ativas"}
            </Button>
            {totalDesativadas > 0 && (
              <Button variant="outline" size="sm" onClick={handleAtivarTodas}>
                <Power className="h-3.5 w-3.5 mr-1.5" /> Reativar todas ({totalDesativadas})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Aviso */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md p-3 flex gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-amber-900 dark:text-amber-200">
          <strong>Atenção:</strong> ao desativar uma página, ela desaparece da sidebar de <strong>todos os usuários</strong> e o acesso direto pela URL é bloqueado.
        </p>
      </div>

      {/* Lista agrupada por categoria */}
      {isLoading ? (
        <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : (
        <div className="space-y-4">
          {Object.keys(flagsAgrupadas).length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhuma página encontrada com os filtros atuais.
              </CardContent>
            </Card>
          ) : (
            Object.entries(flagsAgrupadas).map(([categoria, items]) => (
              <Card key={categoria}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      {CATEGORIAS_LABEL[categoria] ?? categoria}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {items.filter((f) => f.ativo).length}/{items.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full">
                    <thead className="border-y text-xs text-muted-foreground bg-muted/30">
                      <tr>
                        <th className="text-left p-3 w-12">Ativa</th>
                        <th className="text-left p-3">Página</th>
                        <th className="text-left p-3 hidden md:table-cell">Path</th>
                        <th className="text-center p-3 hidden lg:table-cell">Admin</th>
                        <th className="text-left p-3 hidden lg:table-cell">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((f) => (
                        <tr
                          key={f.id}
                          className={cn(
                            "border-b transition-colors",
                            !f.ativo && "bg-red-50/50 dark:bg-red-950/10 opacity-75"
                          )}
                        >
                          <td className="p-3">
                            {f.is_protegida ? (
                              <div className="flex items-center gap-2">
                                <div
                                  className="relative inline-flex h-6 w-11 shrink-0 cursor-not-allowed items-center rounded-full border-2 border-transparent bg-green-600 opacity-60"
                                  title="Página protegida — sempre ativa, não pode ser desativada"
                                >
                                  <Lock className="absolute left-1.5 h-3 w-3 text-white" />
                                  <span className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow translate-x-5" />
                                </div>
                                <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-300">
                                  <Lock className="h-2.5 w-2.5 mr-0.5" /> Protegida
                                </Badge>
                              </div>
                            ) : (
                              <button
                                type="button"
                                role="switch"
                                aria-checked={f.ativo}
                                onClick={() => handleToggle(f)}
                                disabled={toggle.isPending}
                                className={cn(
                                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
                                  f.ativo ? "bg-green-600" : "bg-gray-300 dark:bg-gray-700"
                                )}
                                title={f.ativo ? "Desativar" : "Ativar"}
                              >
                                <span
                                  className={cn(
                                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform",
                                    f.ativo ? "translate-x-5" : "translate-x-0"
                                  )}
                                />
                              </button>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className={cn("font-medium", !f.ativo && "line-through text-muted-foreground")}>
                                  {f.titulo}
                                </p>
                                {f.descricao && (
                                  <p className="text-xs text-muted-foreground">{f.descricao}</p>
                                )}
                              </div>
                              {/* badge custom removido — não é parte da tabela erp_feature_flags */}
                            </div>
                            {/* mobile: mostra o path */}
                            <p className="text-xs text-muted-foreground font-mono md:hidden mt-1">
                              {f.path}
                            </p>
                          </td>
                          <td className="p-3 font-mono text-xs text-muted-foreground hidden md:table-cell">
                            {f.path}
                          </td>
                          <td className="p-3 text-center hidden lg:table-cell">
                            {f.somente_admin && (
                              <Badge variant="outline" className="text-[9px]">Admin</Badge>
                            )}
                          </td>
                          <td className="p-3 hidden lg:table-cell">
                            {f.ativo ? (
                              <Badge variant="default" className="bg-green-600">Ativa</Badge>
                            ) : (
                              <div className="space-y-1">
                                <Badge variant="destructive">Desativada</Badge>
                                {f.desativado_em && (
                                  <p className="text-[10px] text-muted-foreground">
                                    {date(f.desativado_em)}
                                  </p>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Histórico de desativações recentes */}
      {flags.filter((f) => !f.ativo && f.desativado_em).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" /> Desativações Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {flags
              .filter((f) => !f.ativo && f.desativado_em)
              .sort((a, b) => (b.desativado_em ?? "").localeCompare(a.desativado_em ?? ""))
              .slice(0, 5)
              .map((f) => (
                <div key={f.id} className="flex items-start justify-between gap-3 text-sm border-b pb-2 last:border-b-0 last:pb-0">
                  <div className="flex-1">
                    <p className="font-medium">{f.titulo}</p>
                    <p className="text-xs text-muted-foreground">{f.motivo_desativacao ?? "Sem motivo"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {dateTime(f.desativado_em)}
                  </p>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Modal de motivo para desativação */}
      <Dialog open={!!modalMotivo} onOpenChange={(o) => !o && setModalMotivo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldOff className="h-5 w-5 text-red-600" />
              Desativar página
            </DialogTitle>
            <DialogClose />
          </DialogHeader>
          <div className="space-y-3">
            {modalMotivo && (
              <div className="bg-muted rounded-md p-3 text-sm">
                <p><strong>Página:</strong> {modalMotivo.flag.titulo}</p>
                <p className="text-xs text-muted-foreground font-mono">{modalMotivo.flag.path}</p>
              </div>
            )}
            <div>
              <Label>Motivo da desativação *</Label>
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Em manutenção, módulo em desenvolvimento..."
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Este motivo ficará registrado no histórico e será exibido na sidebar quando o admin expandir uma seção com páginas desativadas.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalMotivo(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarDesativacao} disabled={!motivo.trim()}>
              <ShieldOff className="h-4 w-4 mr-1" /> Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ====================================================================
// CONFIG TÉCNICAS PANEL (todos os usuários autenticados)
// ====================================================================
function ConfigTecnicasPanel() {
  const { data: configs = [], refetch } = useQuery<any[]>({
    queryKey: ["erp_configuracoes_sistema"],
    queryFn: async () => {
      const { data, error } = await supabase.from("erp_configuracoes_sistema").select("*").order("chave");
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await supabase.from("erp_configuracoes_sistema").upsert(item);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Configurações Técnicas" />;

  const categorias = Array.from(new Set(configs.map((c: any) => c.categoria ?? "Outros")));

  return (
    <>
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md p-3 text-sm flex gap-2">
        <Eye className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-blue-900 dark:text-blue-200">
          Para ativar/desativar páginas no sistema, use a aba <strong>Feature Flags</strong> acima.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parâmetros Técnicos ({configs.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {configs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma configuração cadastrada. Adicione via SQL ou pela migration inicial.
            </p>
          ) : (
            categorias.map((cat) => (
              <div key={cat}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-4">
                  {cat}
                </p>
                {configs.filter((c: any) => (c.categoria ?? "Outros") === cat).map((c: any) => (
                  <div key={c.id} className="grid grid-cols-3 gap-3 items-end border-b pb-3 mb-3">
                    <div className="col-span-3 md:col-span-1">
                      <Label className="text-xs font-mono">{c.chave}</Label>
                      {c.descricao && (
                        <p className="text-xs text-muted-foreground">{c.descricao}</p>
                      )}
                    </div>
                    <Input
                      className="col-span-2 md:col-span-1"
                      defaultValue={c.valor ?? ""}
                      onBlur={(e) => {
                        if (e.target.value !== c.valor) {
                          upsert.mutate({ id: c.id, chave: c.chave, valor: e.target.value });
                        }
                      }}
                    />
                    <span className="text-xs text-muted-foreground col-span-3 md:col-span-1 md:text-right">
                      Tipo: <span className="font-mono">{c.tipo}</span>
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
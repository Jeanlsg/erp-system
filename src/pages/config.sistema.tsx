import { useState, useMemo, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cog, Flag, Search, Loader2, ShieldOff, ShieldCheck, Power, AlertTriangle, Eye, History, Lock, CheckSquare, Square, Layers, Save, Trash2, Crown, CornerDownRight } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  useFeatureFlags, useToggleFeatureFlag, useAdminPrincipal,
  useFlagPresets, useSalvarPreset, useAplicarPreset, useExcluirPreset,
} from "@/lib/supabase-queries";
import { toast } from "sonner";
import type { FeatureFlag as FF } from "@/types/database";
import { useAuth } from "@/lib/store/auth-store";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { dateTime, date } from "@/lib/format";
import { cn } from "@/lib/utils";
import { sections as MENU, type NavItem } from "@/components/app-sidebar";

export function ConfigSistemaPage() {
  // O conjunto de telas do sistema é decisão do dono, não de qualquer admin:
  // a aba de Feature Flags só existe para o administrador principal.
  const { data: isAdmin = false } = useAdminPrincipal();
  const [abaAtiva, setAbaAtiva] = useState("config");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Cog className="h-6 w-6" /> Configurações do Sistema
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin
            ? "Parâmetros técnicos, páginas ativas e padrões de tela"
            : "Parâmetros técnicos do sistema"}
        </p>
      </div>

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <TabsList className="w-full sm:w-auto">
          {isAdmin && (
            <TabsTrigger value="features">
              <Crown className="h-3.5 w-3.5 mr-1.5" /> Páginas do sistema
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
// PRESETS DE TELAS — conjuntos nomeados de páginas ativas
// ====================================================================
// Ligar e desligar dezenas de páginas na mão a cada mudança de fase da
// loja é inviável. Aqui salva-se o conjunto atual com um nome e alterna-se
// entre padrões (implantação, operação enxuta, sistema completo). Páginas
// protegidas nunca entram: preset nenhum consegue desligá-las.
function PresetsPanel() {
  const { data: presets = [], isLoading } = useFlagPresets();
  const salvar = useSalvarPreset();
  const aplicar = useAplicarPreset();
  const excluir = useExcluirPreset();
  const [modalSalvar, setModalSalvar] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const aplicarPreset = async (p: { id: string; nome: string }) => {
    if (!confirm(`Aplicar "${p.nome}"? O menu de TODOS os usuários muda na hora.`)) return;
    try {
      const r = await aplicar.mutateAsync(p.id);
      toast.success(`"${r.preset}" aplicado.`, {
        description: `${r.desativadas} desativada(s), ${r.reativadas} reativada(s) — ${r.ativas_agora} páginas ativas.`,
      });
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    }
  };

  const salvarAtual = async () => {
    if (!nome.trim()) { toast.error("Dê um nome ao conjunto."); return; }
    try {
      await salvar.mutateAsync({ nome: nome.trim(), descricao: descricao.trim() || undefined });
      toast.success(`Conjunto "${nome.trim()}" salvo com as páginas desativadas de agora.`);
      setModalSalvar(false); setNome(""); setDescricao("");
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" /> Padrões de tela
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Alterne o conjunto de páginas visíveis sem religar uma a uma.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setModalSalvar(true)}>
            <Save className="mr-2 h-3.5 w-3.5" /> Salvar conjunto atual
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : presets.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum padrão salvo. Ajuste as páginas abaixo e use “Salvar conjunto atual”.
            </p>
          ) : (
            <ul className="divide-y">
              {presets.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.nome}</p>
                    {p.descricao && <p className="text-xs text-muted-foreground">{p.descricao}</p>}
                    <p className="text-[11px] text-muted-foreground">
                      {p.paths_desativados.length === 0
                        ? "todas as páginas ligadas"
                        : `${p.paths_desativados.length} página(s) desligada(s)`}
                      {p.aplicado_em ? ` · aplicado em ${dateTime(p.aplicado_em)}` : ""}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => void aplicarPreset(p)} disabled={aplicar.isPending}>
                    {aplicar.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Power className="mr-2 h-3.5 w-3.5" />}
                    Aplicar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Excluir padrão"
                    onClick={() => { if (confirm(`Excluir o padrão "${p.nome}"? As páginas ficam como estão.`)) excluir.mutate(p.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalSalvar} onOpenChange={setModalSalvar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Save className="h-5 w-5" /> Salvar conjunto atual</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Guarda as páginas desativadas neste momento. Reaplicar depois devolve exatamente este menu.
            </p>
            <div>
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Operação enxuta" autoFocus />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Quando usar este padrão" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalSalvar(false)}>Cancelar</Button>
            <Button onClick={() => void salvarAtual()} disabled={salvar.isPending || !nome.trim()}>
              {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ====================================================================
// FEATURE FLAGS PANEL (somente o administrador principal)
// ====================================================================
// Uma página do menu na aba: o item da sidebar e, se existir, a flag dele.
type Linha = { titulo: string; path: string; flag?: FF };
type Bloco = { titulo?: string; linhas: Linha[] };
type Secao = { titulo: string; blocos: Bloco[] };

/** Só as flags (páginas com controle) dentro de um conjunto de seções. */
const flagsDe = (secs: Secao[]): FF[] =>
  secs.flatMap((s) => s.blocos.flatMap((b) => b.linhas.map((l) => l.flag)))
      .filter((f): f is FF => !!f);

function FeatureFlagsPanel() {
  const { user } = useAuth();
  const { data: flags = [], isLoading } = useFeatureFlags();
  const toggle = useToggleFeatureFlag();
  const [search, setSearch] = useState("");
  const [secaoAtiva, setSecaoAtiva] = useState<string>("todas");
  const [showApenasAtivas, setShowApenasAtivas] = useState(false);
  const [modalMotivo, setModalMotivo] = useState<{ flag: FF; novoValor: boolean } | null>(null);
  const [motivo, setMotivo] = useState("");
  // Seleção múltipla: desligar página por página é inviável quando se está
  // enxugando o menu — aqui marca-se um lote e aplica de uma vez.
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [modalLote, setModalLote] = useState<null | "ativar" | "desativar">(null);
  const [motivoLote, setMotivoLote] = useState("");
  const [aplicandoLote, setAplicandoLote] = useState(false);

  // ---- a lista segue a sidebar ----
  // Antes a aba agrupava por `categoria` da flag — uma taxonomia que não
  // aparece em lugar nenhum da tela. Quem vem aqui quer ligar ou desligar o
  // que vê no menu; então a lista tem as mesmas seções, os mesmos grupos e a
  // mesma ordem da sidebar, lida da MESMA estrutura (nada para manter em
  // dois lugares). Flag que não está no menu fica numa seção própria no fim,
  // para nada ficar inalcançável. Página do menu sem flag aparece como
  // "sempre visível".
  const flagPorPath = useMemo(() => {
    const m: Record<string, FF> = {};
    for (const f of flags) m[f.path] = f;
    return m;
  }, [flags]);

  const secoes = useMemo<Secao[]>(() => {
    const usados = new Set<string>();
    const linha = (i: NavItem): Linha | null => {
      if (i.external || !i.url) return null;
      // "/financeiro?aba=apagar" é a mesma página que "/financeiro": uma flag só.
      // Item repetido em dois grupos (Promissórias) aparece no primeiro.
      const path = i.url.split("?")[0];
      if (usados.has(path)) return null;
      usados.add(path);
      return { titulo: i.title, path, flag: flagPorPath[path] };
    };
    const lista: Secao[] = [];
    for (const s of MENU) {
      const blocos: Bloco[] = [];
      const soltas: Linha[] = [];
      for (const i of s.items) {
        if (i.children) {
          const linhas = i.children.map(linha).filter((l): l is Linha => !!l);
          if (linhas.length) blocos.push({ titulo: i.title, linhas });
        } else {
          const l = linha(i);
          if (l) soltas.push(l);
        }
      }
      if (soltas.length) blocos.unshift({ linhas: soltas });
      if (blocos.length) lista.push({ titulo: s.label || "Página inicial", blocos });
    }
    const fora = flags
      .filter((f) => !usados.has(f.path))
      .map((f) => ({ titulo: f.titulo, path: f.path, flag: f }));
    if (fora.length) lista.push({ titulo: "Fora do menu (acesso só por URL)", blocos: [{ linhas: fora }] });
    return lista;
  }, [flags, flagPorPath]);

  const secoesFiltradas = useMemo(() => {
    const s = search.toLowerCase();
    const passa = (l: Linha) => {
      if (showApenasAtivas && !l.flag?.ativo) return false;
      if (!s) return true;
      return l.titulo.toLowerCase().includes(s)
        || l.path.toLowerCase().includes(s)
        || (l.flag?.titulo ?? "").toLowerCase().includes(s)
        || (l.flag?.chave ?? "").toLowerCase().includes(s)
        || (l.flag?.descricao ?? "").toLowerCase().includes(s);
    };
    return secoes
      .filter((sec) => secaoAtiva === "todas" || sec.titulo === secaoAtiva)
      .map((sec) => ({
        ...sec,
        blocos: sec.blocos
          .map((b) => ({ ...b, linhas: b.linhas.filter(passa) }))
          .filter((b) => b.linhas.length > 0),
      }))
      .filter((sec) => sec.blocos.length > 0);
  }, [secoes, search, secaoAtiva, showApenasAtivas]);

  // as flags visíveis com os filtros atuais — é sobre elas que a seleção em lote age
  const flagsFiltradas = useMemo(() => flagsDe(secoesFiltradas), [secoesFiltradas]);

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

  // ---- seleção múltipla ----
  // Protegidas nunca entram na seleção: o switch delas é travado, e deixá-las
  // marcáveis daria a impressão de que o lote vai desligá-las.
  const selecionaveis = useMemo(
    () => flagsFiltradas.filter((f) => !f.is_protegida),
    [flagsFiltradas],
  );
  const todasMarcadas = selecionaveis.length > 0 && selecionaveis.every((f) => selecionadas.has(f.id));

  const alternarUma = (id: string) => {
    setSelecionadas((prev) => {
      const nova = new Set(prev);
      if (nova.has(id)) nova.delete(id); else nova.add(id);
      return nova;
    });
  };

  const alternarGrupo = (items: FF[]) => {
    const alvos = items.filter((f) => !f.is_protegida);
    const todos = alvos.length > 0 && alvos.every((f) => selecionadas.has(f.id));
    setSelecionadas((prev) => {
      const nova = new Set(prev);
      for (const f of alvos) { if (todos) nova.delete(f.id); else nova.add(f.id); }
      return nova;
    });
  };

  const alternarTodasVisiveis = () => {
    setSelecionadas((prev) => {
      const nova = new Set(prev);
      for (const f of selecionaveis) { if (todasMarcadas) nova.delete(f.id); else nova.add(f.id); }
      return nova;
    });
  };

  const aplicarLote = async () => {
    if (!modalLote) return;
    const ativo = modalLote === "ativar";
    const alvos = flags.filter((f) => selecionadas.has(f.id) && !f.is_protegida && f.ativo !== ativo);
    setAplicandoLote(true);
    try {
      // Uma chamada por flag: a mutation já cuida do log de quem desativou
      // e do motivo. São dezenas de linhas, não milhares.
      for (const f of alvos) {
        await toggle.mutateAsync({
          id: f.id,
          ativo,
          motivo: ativo ? undefined : (motivoLote || "Desativada em lote pelo admin"),
          userId: user?.id,
        });
      }
      setSelecionadas(new Set());
      setModalLote(null);
      setMotivoLote("");
    } finally {
      setAplicandoLote(false);
    }
  };

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Feature Flags" />;

  return (
    <>
      <PresetsPanel />

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
              value={secaoAtiva}
              onChange={(e) => setSecaoAtiva(e.target.value)}
            >
              <option value="todas">Todas as seções ({flags.length})</option>
              {secoes.map((sec) => (
                <option key={sec.titulo} value={sec.titulo}>
                  {sec.titulo} ({flagsDe([sec]).length})
                </option>
              ))}
            </select>
            <Button
              variant={showApenasAtivas ? "default" : "outline"}
              size="sm"
              onClick={() => setShowApenasAtivas(!showApenasAtivas)}
            >
              {showApenasAtivas ? "Mostrar todas" : "Apenas ativas"}
            </Button>
            <Button variant="outline" size="sm" onClick={alternarTodasVisiveis}
              disabled={selecionaveis.length === 0}>
              {todasMarcadas
                ? <><Square className="h-3.5 w-3.5 mr-1.5" /> Limpar seleção</>
                : <><CheckSquare className="h-3.5 w-3.5 mr-1.5" /> Selecionar visíveis ({selecionaveis.length})</>}
            </Button>
            {totalDesativadas > 0 && (
              <Button variant="outline" size="sm" onClick={handleAtivarTodas}>
                <Power className="h-3.5 w-3.5 mr-1.5" /> Reativar todas ({totalDesativadas})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ações em lote — só aparece com algo marcado */}
      {selecionadas.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-md border bg-background p-3 shadow-sm">
          <span className="text-sm font-medium">
            {selecionadas.size} página(s) selecionada(s)
          </span>
          <div className="flex flex-wrap gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => setSelecionadas(new Set())}>
              Limpar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setModalLote("ativar")}>
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Ativar selecionadas
            </Button>
            <Button size="sm" variant="destructive" onClick={() => { setModalLote("desativar"); setMotivoLote(""); }}>
              <ShieldOff className="h-3.5 w-3.5 mr-1.5" /> Desativar selecionadas
            </Button>
          </div>
        </div>
      )}

      {/* Aviso */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md p-3 flex gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-amber-900 dark:text-amber-200">
          <strong>Atenção:</strong> ao desativar uma página, ela desaparece da sidebar de <strong>todos os cargos — inclusive de outros administradores</strong> — e o acesso direto pela URL é bloqueado. Só você, como administrador principal, continua vendo em modo preview.
        </p>
      </div>

      {/* Lista na ordem da sidebar: seção › grupo › página */}
      {isLoading ? (
        <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : (
        <div className="space-y-4">
          {secoesFiltradas.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhuma página encontrada com os filtros atuais.
              </CardContent>
            </Card>
          ) : (
            secoesFiltradas.map((sec) => {
              const items = flagsDe([sec]);
              return (
              <Card key={sec.titulo}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <button type="button" onClick={() => alternarGrupo(items)}
                        title="Selecionar/desmarcar a seção inteira"
                        className="text-muted-foreground hover:text-foreground">
                        {items.filter((f) => !f.is_protegida).every((f) => selecionadas.has(f.id))
                          && items.some((f) => !f.is_protegida)
                          ? <CheckSquare className="h-4 w-4" />
                          : <Square className="h-4 w-4" />}
                      </button>
                      {sec.titulo}
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
                        <th className="text-left p-3 w-10"><span className="sr-only">Selecionar</span></th>
                        <th className="text-left p-3 w-12">Ativa</th>
                        <th className="text-left p-3">Página</th>
                        <th className="text-left p-3 hidden md:table-cell">Path</th>
                        <th className="text-center p-3 hidden lg:table-cell">Admin</th>
                        <th className="text-left p-3 hidden lg:table-cell">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sec.blocos.map((b, bi) => (
                        <Fragment key={b.titulo ?? `soltas-${bi}`}>
                          {b.titulo && (() => {
                            const fs = flagsDe([{ titulo: "", blocos: [b] }]);
                            const alvos = fs.filter((f) => !f.is_protegida);
                            const marcado = alvos.length > 0 && alvos.every((f) => selecionadas.has(f.id));
                            return (
                              <tr className="border-b bg-muted/40">
                                <td className="p-3">
                                  {alvos.length > 0 && (
                                    <button type="button" onClick={() => alternarGrupo(fs)}
                                      title={`Selecionar/desmarcar o grupo ${b.titulo}`}
                                      className="text-muted-foreground hover:text-foreground">
                                      {marcado ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                                    </button>
                                  )}
                                </td>
                                <td colSpan={5} className="p-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  <CornerDownRight className="mr-1 inline h-3 w-3" />
                                  {b.titulo}
                                  <span className="ml-2 font-normal normal-case tracking-normal">
                                    {fs.filter((f) => f.ativo).length}/{fs.length}
                                  </span>
                                </td>
                              </tr>
                            );
                          })()}
                          {b.linhas.map((l) => {
                        const f = l.flag;
                        if (!f) return (
                          <tr key={l.path} className="border-b text-muted-foreground">
                            <td className="p-3" />
                            <td className="p-3">
                              <Badge variant="outline" className="text-[9px]">Sempre visível</Badge>
                            </td>
                            <td className="p-3">
                              <p className="font-medium">{l.titulo}</p>
                              <p className="mt-1 text-xs font-mono md:hidden">{l.path}</p>
                              <p className="text-xs">Página sem controle de visualização — não pode ser desligada.</p>
                            </td>
                            <td className="p-3 font-mono text-xs hidden md:table-cell">{l.path}</td>
                            <td className="hidden lg:table-cell" />
                            <td className="hidden lg:table-cell" />
                          </tr>
                        );
                        return (
                        <tr
                          key={f.id}
                          className={cn(
                            "border-b transition-colors",
                            !f.ativo && "bg-red-50/50 dark:bg-red-950/10 opacity-75",
                            selecionadas.has(f.id) && "bg-primary/5"
                          )}
                        >
                          <td className="p-3">
                            {!f.is_protegida && (
                              <button type="button" onClick={() => alternarUma(f.id)}
                                aria-label={`Selecionar ${f.titulo}`}
                                className="text-muted-foreground hover:text-foreground">
                                {selecionadas.has(f.id)
                                  ? <CheckSquare className="h-4 w-4 text-primary" />
                                  : <Square className="h-4 w-4" />}
                              </button>
                            )}
                          </td>
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
                                <Badge variant="outline" className="text-[9px] bg-red-50 text-red-700 border-red-300">
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
                        );
                      })}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              );
            })
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

      {/* Confirmação do lote */}
      <Dialog open={!!modalLote} onOpenChange={(o) => !o && setModalLote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalLote === "ativar"
                ? <><ShieldCheck className="h-5 w-5 text-green-600" /> Ativar páginas selecionadas</>
                : <><ShieldOff className="h-5 w-5 text-red-600" /> Desativar páginas selecionadas</>}
            </DialogTitle>
            <DialogClose />
          </DialogHeader>
          <div className="space-y-3">
            <div className="max-h-48 overflow-y-auto rounded-md border p-2 text-sm space-y-0.5">
              {flags.filter((f) => selecionadas.has(f.id)).map((f) => (
                <p key={f.id} className="flex justify-between gap-3">
                  <span>{f.titulo}</span>
                  <span className="font-mono text-xs text-muted-foreground">{f.path}</span>
                </p>
              ))}
            </div>
            {modalLote === "desativar" ? (
              <div>
                <Label>Motivo da desativação</Label>
                <Input
                  value={motivoLote}
                  onChange={(e) => setMotivoLote(e.target.value)}
                  placeholder="Ex: fora do uso da loja"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">
                  O mesmo motivo é gravado em todas. Elas somem da sidebar de todos os usuários;
                  o admin continua vendo em modo preview.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                As páginas voltam para a sidebar de todos os usuários.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalLote(null)} disabled={aplicandoLote}>
              Cancelar
            </Button>
            <Button
              variant={modalLote === "ativar" ? "default" : "destructive"}
              onClick={() => void aplicarLote()}
              disabled={aplicandoLote}
            >
              {aplicandoLote && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {modalLote === "ativar" ? "Ativar" : "Desativar"} {selecionadas.size} página(s)
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
// Chaves que NUNCA aparecem nesta tela: editar a chave de criptografia
// sem re-encriptar as senhas junto inutiliza os certificados A1 na hora.
// Rotação só pelo scripts/rotacionar-chave-certificado.sh.
const CHAVES_OCULTAS = new Set(["chave_cripto_certificado"]);

function ConfigTecnicasPanel() {
  // a aba de páginas só existe para o administrador principal; mandar os
  // outros usuários para uma aba que eles não têm é pior que não dizer nada
  const { data: ehPrincipal = false } = useAdminPrincipal();
  const { data: configs = [], refetch } = useQuery<any[]>({
    queryKey: ["erp_configuracoes_sistema"],
    queryFn: async () => {
      const { data, error } = await supabase.from("erp_configuracoes_sistema").select("*").order("chave");
      if (error) throw error;
      return (data ?? []).filter((c: any) => !CHAVES_OCULTAS.has(c.chave));
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
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md p-3 text-sm flex gap-2">
        <Eye className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-amber-900 dark:text-amber-200">
          Estes são parâmetros técnicos, não as páginas do menu.{" "}
          {ehPrincipal ? (
            <>Para ligar ou desligar páginas, use a aba <strong>Páginas do sistema</strong> acima.</>
          ) : (
            <>Ligar e desligar páginas é exclusivo do <strong>administrador principal</strong>.</>
          )}
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
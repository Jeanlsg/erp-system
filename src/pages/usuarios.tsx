// ============================================================
// Página: Gestão de Usuários e Permissões
// CRUD completo + gerenciamento granular de permissões
// ============================================================

import { useState, useMemo, useEffect } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Users, Plus, Edit, Shield, Lock, Unlock,
  Search, Loader2, Save, AlertCircle, RefreshCw,
  Mail, Phone, KeyRound, Trash2, Check, Eye, EyeOff,
} from "lucide-react";
import {
  useUsuarios, useUpdateUsuario, useDesbloquearUsuario,
  useUpdatePermissoesUsuario, useLojas,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { supabase } from "@/lib/supabase";
import { useAuth, type Role, roleLabels, ROLE_PERMISSIONS } from "@/lib/store/auth-store";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { toast } from "sonner";

// ===== Definição de permissões agrupadas por módulo =====
const PERMISSOES_POR_MODULO: Record<string, string[]> = {
  "PDV / Caixa": [
    "pdv.usar",
    "caixa.abrir",
    "caixa.fechar",
    "venda.criar",
    "venda.cancelar",
    "venda.desconto",
  ],
  "Produtos": [
    "produto.ver",
    "produto.criar",
    "produto.editar",
    "produto.excluir",
  ],
  "Estoque": [
    "estoque.ver",
    "estoque.ajustar",
    "estoque.transferir",
  ],
  "Clientes": [
    "cliente.ver",
    "cliente.criar",
    "cliente.editar",
  ],
  "Compras": [
    "compra.ver",
    "compra.criar",
    "compra.receber",
  ],
  "Financeiro": [
    "financeiro.ver",
    "financeiro.lancar",
    "financeiro.conciliar",
  ],
  "Fiscal": [
    "fiscal.emitir",
  ],
  "Relatórios": [
    "relatorio.ver",
    "relatorio.exportar",
  ],
  "Configurações": [
    "config.ver",
    "config.editar",
    "usuario.ver",
    "usuario.criar",
    "usuario.editar",
    "loja.ver",
    "loja.criar",
    "loja.editar",
  ],
};

const TODAS_PERMISSOES = Object.values(PERMISSOES_POR_MODULO).flat();

export function UsuariosPage() {
  const { user: currentUser } = useAuth();
  const { data: usuarios = [], isLoading, refetch } = useUsuarios();
  const { data: lojas = [] } = useLojas();
  const updateUsuario = useUpdateUsuario();
  const desbloquearUsuario = useDesbloquearUsuario();
  const updatePermissoes = useUpdatePermissoesUsuario();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  // Modais
  const [modalUsuario, setModalUsuario] = useState(false);
  const [modalPermissoes, setModalPermissoes] = useState(false);
  const [modalConfirmDelete, setModalConfirmDelete] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [permissoesUsuarioId, setPermissoesUsuarioId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form
  const [formUsuario, setFormUsuario] = useState({
    nome: "",
    email: "",
    role: "caixa" as Role,
    ativo: true,
    loja_default_id: "",
    telefone: "",
    senha: "",
    definirSenha: false,
  });
  const [showPasswordUsuario, setShowPasswordUsuario] = useState(false);
  const [permissoesCustom, setPermissoesCustom] = useState<Record<string, boolean>>({});
  const [usarPermissoesCustom, setUsarPermissoesCustom] = useState(false);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Gestão de Usuários" />;

  const isAdmin = currentUser?.role === "admin";

  const lojaMap = Object.fromEntries(lojas.map((l) => [l.id, l.apelido || l.nome]));

  // ===== Filtros =====
  const filtered = useMemo(() => {
    let lista = usuarios;
    if (search) {
      const s = search.toLowerCase();
      lista = lista.filter((u) =>
        u.nome.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s)
      );
    }
    if (roleFilter !== "todos") {
      lista = lista.filter((u) => u.role === roleFilter);
    }
    if (statusFilter === "ativos") lista = lista.filter((u) => u.ativo && !u.bloqueado);
    if (statusFilter === "inativos") lista = lista.filter((u) => !u.ativo);
    if (statusFilter === "bloqueados") lista = lista.filter((u) => u.bloqueado);
    return lista;
  }, [usuarios, search, roleFilter, statusFilter]);

  // ===== KPIs =====
  const totalUsuarios = usuarios.length;
  const ativos = usuarios.filter((u) => u.ativo && !u.bloqueado).length;
  const bloqueados = usuarios.filter((u) => u.bloqueado).length;
  const inativos = usuarios.filter((u) => !u.ativo).length;

  // ===== Handlers =====
  const abrirNovoUsuario = () => {
    setEditId(null);
    setFormUsuario({
      nome: "",
      email: "",
      role: "caixa",
      ativo: true,
      loja_default_id: "",
      telefone: "",
      senha: "",
      definirSenha: false,
    });
    setShowPasswordUsuario(false);
    setModalUsuario(true);
  };

  const abrirEdicaoUsuario = (u: any) => {
    setEditId(u.id);
    setFormUsuario({
      nome: u.nome ?? "",
      email: u.email ?? "",
      role: u.role ?? "caixa",
      ativo: u.ativo ?? true,
      loja_default_id: u.loja_default_id ?? "",
      telefone: u.telefone ?? "",
      senha: "",
      definirSenha: false,
    });
    setShowPasswordUsuario(false);
    setModalUsuario(true);
  };

  const salvarUsuario = async () => {
    if (!formUsuario.nome || !formUsuario.email) {
      toast.error("Preencha nome e e-mail");
      return;
    }
    if (!formUsuario.email.includes("@")) {
      toast.error("E-mail inválido");
      return;
    }
    // Validação de senha apenas na criação (e se o usuário marcou para definir agora)
    if (!editId && formUsuario.definirSenha && formUsuario.senha.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    try {
      if (editId) {
        // Edição: atualiza via hook normal
        await updateUsuario.mutateAsync({
          id: editId,
          nome: formUsuario.nome,
          email: formUsuario.email,
          role: formUsuario.role,
          ativo: formUsuario.ativo,
          loja_default_id: formUsuario.loja_default_id || null,
          telefone: formUsuario.telefone || null,
        });

        // Se admin pediu para trocar a senha do usuário
        if (formUsuario.definirSenha && formUsuario.senha.length >= 6) {
          const { data, error } = await supabase.functions.invoke<{
            success: boolean;
            error?: string;
          }>("reset-password", {
            body: { user_id: editId },
          });
          // O reset-password apenas envia email; vamos chamar admin API em um próximo passo
          // Por enquanto, apenas avisamos que o usuário deve redefinir via email
          toast.success(
            `Usuário atualizado. Email de redefinição de senha será enviado para ${formUsuario.email}.`
          );
        } else {
          toast.success("Usuário atualizado");
        }
      } else {
        // Criação: usa Edge Function create-user
        const { data, error } = await supabase.functions.invoke<{
          success: boolean;
          user_id?: string;
          error?: string;
          invite_sent?: boolean;
        }>("create-user", {
          body: {
            email: formUsuario.email,
            nome: formUsuario.nome,
            role: formUsuario.role,
            loja_default_id: formUsuario.loja_default_id || null,
            telefone: formUsuario.telefone || null,
            senha:
              formUsuario.definirSenha && formUsuario.senha.length >= 6
                ? formUsuario.senha
                : null,
            send_invite: !formUsuario.definirSenha,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (!data?.success) throw new Error("Erro desconhecido ao criar usuário");
        if (formUsuario.definirSenha) {
          toast.success(
            `Usuário criado com senha! Pode logar imediatamente com: ${formUsuario.email}`
          );
        } else if (data.invite_sent) {
          toast.success(
            `Usuário criado! Email de convite enviado para ${formUsuario.email}`
          );
        } else {
          toast.success("Usuário criado com sucesso");
        }
      }
      setModalUsuario(false);
      refetch();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const resetarSenha = async (id: string, email: string) => {
    if (!confirm(`Enviar email de redefinição de senha para ${email}?`)) return;
    try {
      const { data, error } = await supabase.functions.invoke<{
        success: boolean;
        error?: string;
      }>("reset-password", {
        body: { user_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Email de redefinição enviado para ${email}`);
      refetch();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const excluirUsuario = async (u: any) => {
    if (u.id === currentUser?.id) {
      toast.error("Você não pode excluir seu próprio usuário");
      return;
    }
    if (!confirm(`Excluir o usuário "${u.nome}"?\n\nEsta ação é IRREVERSÍVEL e remove também o login.`)) return;
    try {
      const { data, error } = await supabase.functions.invoke<{
        success: boolean;
        error?: string;
      }>("delete-user", {
        body: { user_id: u.id, hard_delete: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário excluído");
      refetch();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const toggleAtivo = async (u: any) => {
    try {
      await updateUsuario.mutateAsync({ id: u.id, ativo: !u.ativo });
      toast.success(u.ativo ? "Usuário desativado" : "Usuário ativado");
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const desbloquear = async (id: string) => {
    try {
      await desbloquearUsuario.mutateAsync(id);
      toast.success("Usuário desbloqueado e tentativas zeradas");
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const abrirPermissoes = (u: any) => {
    setPermissoesUsuarioId(u.id);
    // Carrega permissões customizadas se existirem
    const custom = (u.permissoes ?? {}) as Record<string, boolean>;
    setPermissoesCustom(custom);
    // Se tem pelo menos 1 permissão customizada, usa custom
    setUsarPermissoesCustom(Object.keys(custom).length > 0);
    setModalPermissoes(true);
  };

  const aplicarPermissoesDoRole = (role: Role) => {
    setPermissoesCustom({});
    setUsarPermissoesCustom(false);
    // Recarrega dados do usuário selecionado
    const u = usuarios.find((x) => x.id === permissoesUsuarioId);
    if (u) {
      setPermissoesCustom(
        Object.fromEntries(ROLE_PERMISSIONS[role].map((p) => [p, true]))
      );
    }
  };

  const togglePermissao = (perm: string) => {
    setPermissoesCustom((prev) => ({ ...prev, [perm]: !prev[perm] }));
  };

  const selecionarTodasDoModulo = (modulo: string, valor: boolean) => {
    setPermissoesCustom((prev) => {
      const novo = { ...prev };
      for (const p of PERMISSOES_POR_MODULO[modulo]) {
        novo[p] = valor;
      }
      return novo;
    });
  };

  const salvarPermissoes = async () => {
    if (!permissoesUsuarioId) return;
    try {
      // Se usarPermissoesCustom for false, limpa o JSON (vai usar padrão do role)
      const payload = usarPermissoesCustom ? permissoesCustom : {};
      await updatePermissoes.mutateAsync({
        id: permissoesUsuarioId,
        permissoes: payload,
      });
      toast.success(
        usarPermissoesCustom
          ? "Permissões customizadas salvas"
          : "Permissões resetadas para o padrão do role"
      );
      setModalPermissoes(false);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const usuarioSelecionado = usuarios.find((u) => u.id === permissoesUsuarioId);
  const roleSelecionado = (usuarioSelecionado?.role ?? "caixa") as Role;
  const permissoesEfetivas = usarPermissoesCustom
    ? permissoesCustom
    : Object.fromEntries(ROLE_PERMISSIONS[roleSelecionado].map((p) => [p, true]));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" /> Usuários e Permissões
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalUsuarios} usuário(s) cadastrado(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
          <Button size="sm" onClick={abrirNovoUsuario} disabled={!isAdmin}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Total</p>
            <p className="text-xl font-semibold">{totalUsuarios}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Ativos</p>
            <p className="text-xl font-semibold text-green-600">{ativos}</p>
          </CardContent>
        </Card>
        <Card className={bloqueados > 0 ? "border-red-500" : ""}>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Bloqueados</p>
            <p className={`text-xl font-semibold ${bloqueados > 0 ? "text-red-600" : ""}`}>
              {bloqueados}
            </p>
          </CardContent>
        </Card>
        <Card className={inativos > 0 ? "border-orange-500" : ""}>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Inativos</p>
            <p className={`text-xl font-semibold ${inativos > 0 ? "text-orange-600" : ""}`}>
              {inativos}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome ou e-mail..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Papel (Role)</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="caixa">Operador de Caixa</SelectItem>
                  <SelectItem value="estoquista">Estoquista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativos">Ativos</SelectItem>
                  <SelectItem value="bloqueados">Bloqueados</SelectItem>
                  <SelectItem value="inativos">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuários do Sistema</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Nenhum usuário encontrado com os filtros atuais
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Nome</th>
                    <th className="text-left p-2">Email</th>
                    <th className="text-center p-2">Papel</th>
                    <th className="text-left p-2">Loja Padrão</th>
                    <th className="text-center p-2">Permissões</th>
                    <th className="text-center p-2">Status</th>
                    <th className="text-center p-2">Último Login</th>
                    <th className="text-center p-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const temCustom = u.permissoes && Object.keys(u.permissoes).length > 0;
                    const isCurrentUser = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className={`border-b hover:bg-accent transition-colors ${u.bloqueado ? "bg-red-50 dark:bg-red-950/10" : ""}`}>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <Shield className="h-3 w-3 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">
                                {u.nome}
                                {isCurrentUser && (
                                  <Badge variant="outline" className="ml-2 text-[10px]">você</Badge>
                                )}
                              </p>
                              {u.telefone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-2 w-2" /> {u.telefone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-2 text-xs">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {u.email}
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant={u.role === "admin" ? "default" : "outline"}>
                            {roleLabels[u.role as Role] ?? u.role}
                          </Badge>
                        </td>
                        <td className="p-2 text-sm">
                          {u.loja_default_id ? lojaMap[u.loja_default_id] ?? "—" : "—"}
                        </td>
                        <td className="p-2 text-center">
                          {temCustom ? (
                            <Badge variant="outline" className="text-blue-600 border-blue-500 text-[10px]">
                              Custom
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Padrão</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {u.bloqueado ? (
                            <Badge variant="destructive" className="text-[10px]">
                              <Lock className="h-2 w-2 mr-0.5" />
                              Bloqueado
                            </Badge>
                          ) : u.ativo ? (
                            <Badge variant="default" className="text-[10px]">
                              <Unlock className="h-2 w-2 mr-0.5" />
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Inativo</Badge>
                          )}
                        </td>
                        <td className="p-2 text-xs">
                          {u.ultimo_login
                            ? new Date(u.ultimo_login).toLocaleString("pt-BR")
                            : "Nunca"}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => abrirEdicaoUsuario(u)}
                              title="Editar"
                              disabled={!isAdmin}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => abrirPermissoes(u)}
                              title="Gerenciar permissões"
                              disabled={!isAdmin}
                            >
                              <Shield className="h-3 w-3" />
                            </Button>
                            {u.bloqueado && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-green-600"
                                onClick={() => desbloquear(u.id)}
                                title="Desbloquear"
                                disabled={!isAdmin}
                              >
                                <Unlock className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-blue-600"
                              onClick={() => resetarSenha(u.id, u.email)}
                              title="Enviar email de redefinição de senha"
                              disabled={!isAdmin || !u.ativo}
                            >
                              <KeyRound className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`h-7 w-7 p-0 ${u.ativo ? "text-orange-600" : "text-green-600"}`}
                              onClick={() => toggleAtivo(u)}
                              title={u.ativo ? "Desativar" : "Ativar"}
                              disabled={!isAdmin || isCurrentUser}
                            >
                              {u.ativo ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive"
                              onClick={() => excluirUsuario(u)}
                              title="Excluir usuário"
                              disabled={!isAdmin || isCurrentUser}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Editar Usuário */}
      <Dialog open={modalUsuario} onOpenChange={setModalUsuario}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={formUsuario.nome}
                  onChange={(e) => setFormUsuario({ ...formUsuario, nome: e.target.value })}
                />
              </div>
              <div>
                <Label>E-mail *</Label>
                <Input
                  type="email"
                  value={formUsuario.email}
                  onChange={(e) => setFormUsuario({ ...formUsuario, email: e.target.value })}
                  disabled={!!editId}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Papel</Label>
                <Select
                  value={formUsuario.role}
                  onValueChange={(v) => setFormUsuario({ ...formUsuario, role: v as Role })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="caixa">Operador de Caixa</SelectItem>
                    <SelectItem value="estoquista">Estoquista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Loja Padrão</Label>
                <Select
                  value={formUsuario.loja_default_id || "nenhuma"}
                  onValueChange={(v) => setFormUsuario({ ...formUsuario, loja_default_id: v === "nenhuma" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">— Nenhuma —</SelectItem>
                    {lojas.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.apelido || l.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input
                  value={formUsuario.telefone}
                  onChange={(e) => setFormUsuario({ ...formUsuario, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label>Status</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="ativo"
                    checked={formUsuario.ativo}
                    onChange={(e) => setFormUsuario({ ...formUsuario, ativo: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="ativo" className="text-sm cursor-pointer">
                    Usuário ativo
                  </label>
                </div>
              </div>
            </div>

            {/* Campo de Senha - apenas na criação */}
            {!editId && (
              <div className="space-y-2 border rounded-md p-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="definirSenha"
                    checked={formUsuario.definirSenha}
                    onChange={(e) =>
                      setFormUsuario({
                        ...formUsuario,
                        definirSenha: e.target.checked,
                        senha: e.target.checked ? formUsuario.senha : "",
                      })
                    }
                    className="h-4 w-4"
                  />
                  <label htmlFor="definirSenha" className="text-sm cursor-pointer font-medium">
                    Definir senha agora (senão, envia e-mail de convite)
                  </label>
                </div>
                {formUsuario.definirSenha && (
                  <div>
                    <Label>Senha (mínimo 6 caracteres)</Label>
                    <div className="relative">
                      <Input
                        type={showPasswordUsuario ? "text" : "password"}
                        value={formUsuario.senha}
                        onChange={(e) =>
                          setFormUsuario({ ...formUsuario, senha: e.target.value })
                        }
                        placeholder="Digite a senha"
                        minLength={6}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordUsuario(!showPasswordUsuario)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPasswordUsuario ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Aviso contextual */}
            {!editId && !formUsuario.definirSenha && (
              <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2 rounded">
                <Mail className="h-3 w-3 inline mr-1 text-blue-600" />
                Será enviado um e-mail de convite (via Resend) para o usuário
                definir sua senha.
              </div>
            )}
            {!editId && formUsuario.definirSenha && (
              <div className="text-xs text-muted-foreground bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-2 rounded">
                <Check className="h-3 w-3 inline mr-1 text-green-600" />
                O usuário poderá logar imediatamente com a senha definida acima.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalUsuario(false)}>
              Cancelar
            </Button>
            <Button
              onClick={salvarUsuario}
              disabled={!formUsuario.nome || !formUsuario.email || updateUsuario.isPending}
            >
              {updateUsuario.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Gerenciar Permissões */}
      <Dialog open={modalPermissoes} onOpenChange={setModalPermissoes}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 [&_svg]:shrink-0">
              <Shield className="h-5 w-5" />
              <span>Permissões de {usuarioSelecionado?.nome}</span>
            </DialogTitle>
            <DialogClose />
          </DialogHeader>

          {/* Toggle: Padrão vs Custom */}
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <input
              type="checkbox"
              id="custom"
              checked={usarPermissoesCustom}
              onChange={(e) => setUsarPermissoesCustom(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="custom" className="text-sm cursor-pointer flex-1">
              <strong>Permissões customizadas</strong>
              <p className="text-xs text-muted-foreground">
                {usarPermissoesCustom
                  ? "Permissões definidas individualmente abaixo"
                  : "Usando permissões padrão do role: " + roleLabels[roleSelecionado]}
              </p>
            </label>
            {usarPermissoesCustom && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => aplicarPermissoesDoRole(roleSelecionado)}
                title="Preencher com todas as permissões do role"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Copiar do Role
              </Button>
            )}
          </div>

          {/* Grid de Permissões por Módulo */}
          {usarPermissoesCustom && (
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2">
              {Object.entries(PERMISSOES_POR_MODULO).map(([modulo, perms]) => {
                const todasMarcadas = perms.every((p) => permissoesCustom[p]);
                const nenhumaMarcada = perms.every((p) => !permissoesCustom[p]);
                return (
                  <Card key={modulo}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{modulo}</CardTitle>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => selecionarTodasDoModulo(modulo, true)}
                            disabled={todasMarcadas}
                          >
                            Todas
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => selecionarTodasDoModulo(modulo, false)}
                            disabled={nenhumaMarcada}
                          >
                            Nenhuma
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {perms.map((p) => (
                          <label
                            key={p}
                            className="flex items-center gap-2 cursor-pointer hover:bg-accent p-2 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={!!permissoesCustom[p]}
                              onChange={() => togglePermissao(p)}
                              className="h-4 w-4"
                            />
                            <span className="text-sm">{p}</span>
                          </label>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Visão de Permissões Efetivas (somente leitura quando custom está off) */}
          {!usarPermissoesCustom && (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-2">
              <p className="text-xs text-muted-foreground">
                Permissões padrão do role <strong>{roleLabels[roleSelecionado]}</strong>:
              </p>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {ROLE_PERMISSIONS[roleSelecionado].map((p) => (
                  <div key={p} className="flex items-center gap-2 p-1 text-xs">
                    <Check className="h-3 w-3 text-green-600" />
                    {p}
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPermissoes(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarPermissoes} disabled={updatePermissoes.isPending}>
              {updatePermissoes.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Salvar Permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
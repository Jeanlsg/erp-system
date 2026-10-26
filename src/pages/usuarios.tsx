// ============================================================
// Página: Gestão de Usuários e Permissões
// CRUD completo + gerenciamento granular de permissões
// ============================================================

import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidarDominios } from "@/lib/dominios-cache";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
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
  Search, Loader2, Save, RefreshCw,
  Mail, Phone, KeyRound, Trash2, Check, Eye, EyeOff, RotateCcw, Layers, Download, Briefcase,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useUsuarios, useUpdateUsuario, useDesbloquearUsuario,
  useUpdatePermissoesUsuario, useLojas,
  usePapelPermissoes, useSalvarPapelPermissoes,
  useFuncionarios, useCreateFuncionario, useUpdateFuncionario,
  useCaixasPermitidos, useDefinirCaixasPermitidos, useTodosPontosVenda,
  useUsuarioLojas, useDefinirLojasDoUsuario,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { supabase } from "@/lib/supabase";
import { useAuth, type Role, roleLabels, ROLE_PERMISSIONS, ROLES, papelPrincipal } from "@/lib/store/auth-store";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { toast } from "sonner";

// ===== Definição de permissões agrupadas por módulo =====
const PERMISSOES_POR_MODULO: Record<string, string[]> = {
  "PDV / Caixa": [
    "pdv.usar",
    "caixa.abrir",
    "caixa.fechar",
    "caixa.sangria",
    "venda.criar",
    "venda.cancelar",
    "venda.desconto",
    "pedido.delivery",
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

// O que o master decide para o vendedor já ao criar o login. Vira permissão
// própria do usuário; o resto do padrão da função continua igual.
const FUNCOES_DO_VENDEDOR: { perm: string; rotulo: string }[] = [
  { perm: "caixa.abrir", rotulo: "Abrir caixa" },
  { perm: "caixa.fechar", rotulo: "Fechar o próprio caixa" },
  { perm: "caixa.sangria", rotulo: "Sangria e entrada de valores" },
  { perm: "venda.desconto", rotulo: "Dar desconto e acréscimo" },
  { perm: "pedido.delivery", rotulo: "Delivery (Ciclo de pedidos e entrega na venda)" },
];

// ============================================================
// Aba "Papéis": as permissões padrão de cada papel, editáveis.
//
// Saíram do código (ROLE_PERMISSIONS) para erp_papel_permissoes. O que está
// aqui vale para todo usuário do papel que NÃO tenha permissões próprias.
// "Restaurar padrão do sistema" volta ao mapa do código.
// ============================================================
function PapeisPanel({ isAdmin, userId }: { isAdmin: boolean; userId?: string }) {
  const { data: linhas = [], isLoading } = usePapelPermissoes();
  const salvar = useSalvarPapelPermissoes();
  const [edicao, setEdicao] = useState<Partial<Record<Role, Record<string, boolean>>>>({});
  const [sujo, setSujo] = useState<Partial<Record<Role, boolean>>>({});

  // o que está gravado (ou o padrão do código, se a tabela ainda não tem o papel)
  const gravado = useMemo(() => {
    const m: Record<Role, string[]> = { ...ROLE_PERMISSIONS };
    for (const l of linhas) m[l.papel as Role] = l.permissoes;
    return m;
  }, [linhas]);

  const marcadas = (papel: Role): Record<string, boolean> =>
    edicao[papel] ?? Object.fromEntries(gravado[papel].map((p) => [p, true]));

  const definir = (papel: Role, mudar: (atual: Record<string, boolean>) => Record<string, boolean>) => {
    setEdicao((prev) => ({ ...prev, [papel]: mudar(marcadas(papel)) }));
    setSujo((prev) => ({ ...prev, [papel]: true }));
  };

  const gravar = async (papel: Role) => {
    const lista = Object.entries(marcadas(papel)).filter(([, v]) => v).map(([k]) => k);
    try {
      await salvar.mutateAsync({ papel, permissoes: lista, userId });
      setSujo((prev) => ({ ...prev, [papel]: false }));
      setEdicao((prev) => { const n = { ...prev }; delete n[papel]; return n; });
      toast.success(`Permissões padrão de ${roleLabels[papel]} salvas — valem no próximo login de cada usuário.`);
    } catch (e: any) {
      toast.error(`Não foi possível salvar: ${e.message ?? e}`);
    }
  };

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/20">
        <p className="font-medium">O que isto controla</p>
        <p className="mt-1 text-muted-foreground">
          Quais itens de menu e botões cada função vê, para todo usuário da função que não tenha
          permissões próprias. Um usuário com várias funções enxerga a união delas. O acesso ao
          banco continua governado pela função principal (a mais alta) nas regras do Supabase.
        </p>
      </div>
      {ROLES.map((papel) => {
        const atual = marcadas(papel);
        const total = Object.values(atual).filter(Boolean).length;
        return (
          <Card key={papel}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" /> {roleLabels[papel]}
                  <Badge variant="outline" className="text-[10px]">{total} permissões</Badge>
                  {sujo[papel] && <Badge className="text-[10px]">não salvo</Badge>}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={!isAdmin}
                    onClick={() => definir(papel, () => Object.fromEntries(ROLE_PERMISSIONS[papel].map((p) => [p, true])))}
                    title="Volta ao conjunto que veio com o sistema">
                    <RotateCcw className="h-3 w-3 mr-1" /> Restaurar padrão do sistema
                  </Button>
                  <Button size="sm" disabled={!isAdmin || !sujo[papel] || salvar.isPending} onClick={() => gravar(papel)}>
                    {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Salvar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Object.entries(PERMISSOES_POR_MODULO).map(([modulo, perms]) => (
                  <div key={modulo} className="rounded-md border p-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold">{modulo}</p>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={!isAdmin}
                          onClick={() => definir(papel, (a) => ({ ...a, ...Object.fromEntries(perms.map((p) => [p, true])) }))}>
                          Todas
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={!isAdmin}
                          onClick={() => definir(papel, (a) => ({ ...a, ...Object.fromEntries(perms.map((p) => [p, false])) }))}>
                          Nenhuma
                        </Button>
                      </div>
                    </div>
                    {perms.map((p) => (
                      <label key={p} className="flex items-center gap-2 cursor-pointer hover:bg-accent px-1 py-0.5 rounded">
                        <input type="checkbox" className="h-4 w-4" checked={!!atual[p]} disabled={!isAdmin}
                          onChange={() => definir(papel, (a) => ({ ...a, [p]: !a[p] }))} />
                        <span className="text-xs">{p}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// "Importar do CRM": ERP e CRM dividem o mesmo auth.users. Quem já tem
// login no CRM não precisa de convite (que cairia na tela do CRM): basta a
// linha em erp_usuarios com o mesmo id e os papéis.
// ============================================================
type UsuarioCrm = { id: string; email: string; nome: string; criado_em: string };

/**
 * Corpo da resposta de uma edge, mesmo em erro: o supabase-js esconde o
 * motivo atrás de "Edge Function returned a non-2xx status code" e o admin
 * não via "Já existe um usuário com este email" nem "tem histórico".
 */
async function corpoDaEdge(data: any, error: any): Promise<{ success?: boolean; error?: string; [k: string]: any }> {
  if (data) return data;
  const corpo = error?.context?.json ? await error.context.json().catch(() => null) : null;
  return corpo ?? { success: false, error: error?.message ?? "falha desconhecida" };
}

function ImportarDoCrmDialog({ open, onOpenChange, onImportado, lojas }: {
  open: boolean; onOpenChange: (v: boolean) => void; onImportado: () => void; lojas: any[];
}) {
  // Busca pelo e-mail exato: antes a tela listava todos os logins do
  // auth.users (que é dividido com o CRM) — nome e e-mail de quem não é da loja.
  const [email, setEmail] = useState("");
  const [achado, setAchado] = useState<UsuarioCrm | null | undefined>(undefined);
  const [buscando, setBuscando] = useState(false);
  const [papeis, setPapeis] = useState<Role[]>(["caixa"]);
  const [filiais, setFiliais] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail(""); setAchado(undefined); setPapeis(["caixa"]);
    setFiliais(lojas.length === 1 ? [lojas[0].id] : []);
  }, [open, lojas]);

  const buscar = async () => {
    if (!email.includes("@")) { toast.error("Digite o e-mail completo do login."); return; }
    setBuscando(true);
    const { data, error } = await supabase.rpc("usuario_crm_por_email", { p_email: email });
    setBuscando(false);
    if (error) { toast.error(`Não foi possível buscar: ${error.message}`); return; }
    setAchado(((data ?? []) as UsuarioCrm[])[0] ?? null);
  };

  const importar = async () => {
    if (!achado) return;
    if (!filiais.length) { toast.error("Marque ao menos uma filial."); return; }
    setSalvando(true);
    try {
      const { error } = await supabase.from("erp_usuarios").insert({
        id: achado.id, email: achado.email, nome: achado.nome,
        role: papelPrincipal(papeis), papeis, ativo: true, loja_default_id: filiais[0],
      });
      if (error) throw error;
      // sem filial o login não abre caixa nem vê dados
      const { error: eL } = await supabase.from("erp_usuario_lojas")
        .insert(filiais.map((loja_id) => ({ usuario_id: achado.id, loja_id })));
      if (eL) throw new Error(`perfil criado, mas as filiais não: ${eL.message}`);
      toast.success(`${achado.nome} agora entra no ERP como ${papeis.map((p) => roleLabels[p]).join(", ")}.`);
      onImportado();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao importar: ${e.message ?? e}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Importar usuário do CRM</DialogTitle>
          <DialogClose />
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Para quem já tem login no CRM: digite o e-mail dele. A senha continua a mesma do CRM — nenhum e-mail é enviado.
        </p>
        <div className="flex gap-2">
          <Input placeholder="email@exemplo.com" value={email} onChange={(e) => { setEmail(e.target.value); setAchado(undefined); }}
            onKeyDown={(e) => { if (e.key === "Enter") void buscar(); }} />
          <Button variant="outline" onClick={() => void buscar()} disabled={buscando}>
            {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />} Buscar
          </Button>
        </div>
        {achado === null && (
          <p className="rounded-md border p-3 text-sm text-muted-foreground">
            Nenhum login do CRM com esse e-mail sem perfil no ERP. Confira o e-mail ou crie o usuário em "Novo Usuário".
          </p>
        )}
        {achado && (
          <div className="space-y-3 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">{achado.nome}</p>
              <p className="text-xs text-muted-foreground">{achado.email} · login criado em {new Date(achado.criado_em).toLocaleDateString("pt-BR")}</p>
              <p className="mt-1 text-[11px] text-amber-700">Confira se é a pessoa certa antes de adicionar.</p>
            </div>
            <div>
              <Label className="text-xs">Funções</Label>
              <div className="mt-1 flex flex-wrap gap-3">
                {ROLES.map((p) => (
                  <label key={p} className="flex cursor-pointer items-center gap-1 text-xs">
                    <input type="checkbox" className="h-3.5 w-3.5" checked={papeis.includes(p)}
                      onChange={() => {
                        const novo = papeis.includes(p) ? papeis.filter((x) => x !== p) : [...papeis, p];
                        setPapeis(novo.length ? novo : papeis);
                      }} />
                    {roleLabels[p]}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Filiais em que trabalha</Label>
              <div className="mt-1 flex flex-wrap gap-3">
                {lojas.map((l: any) => (
                  <label key={l.id} className="flex cursor-pointer items-center gap-1 text-xs">
                    <input type="checkbox" className="h-3.5 w-3.5" checked={filiais.includes(l.id)}
                      onChange={(e) => setFiliais(e.target.checked ? [...filiais, l.id] : filiais.filter((x) => x !== l.id))} />
                    {l.apelido ?? l.nome}
                  </label>
                ))}
              </div>
            </div>
            <Button size="sm" onClick={() => void importar()} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />} Adicionar ao ERP
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function UsuariosPage() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const { data: usuarios = [], isLoading, refetch } = useUsuarios();
  const { data: lojas = [] } = useLojas();
  const updateUsuario = useUpdateUsuario();
  const desbloquearUsuario = useDesbloquearUsuario();
  const updatePermissoes = useUpdatePermissoesUsuario();
  const { data: papelPermissoesRows = [] } = usePapelPermissoes();
  // O usuário é o cadastro-mestre: daqui ele pode nascer já como funcionário.
  const { data: funcionarios = [] } = useFuncionarios();
  const createFunc = useCreateFuncionario();
  const updateFunc = useUpdateFuncionario();
  const funcionarioDe = (userId?: string | null) => funcionarios.find((f: any) => f.usuario_id === userId);

  // permissões padrão de cada papel: tabela por cima do mapa do código
  const mapaPapeis = useMemo(() => {
    const m: Record<Role, string[]> = { ...ROLE_PERMISSIONS };
    for (const l of papelPermissoesRows) m[l.papel as Role] = l.permissoes;
    return m;
  }, [papelPermissoesRows]);
  const papeisDe = (u: any): Role[] => (u?.papeis?.length ? u.papeis : [u?.role ?? "caixa"]);
  const permissoesDosPapeis = (ps: Role[]) => Array.from(new Set(ps.flatMap((p) => mapaPapeis[p] ?? [])));
  const nomesDosPapeis = (ps: Role[]) => ps.map((p) => roleLabels[p]).join(", ");
  /** O que o usuário pode hoje: permissões próprias (objeto não vazio) ou a união das funções. */
  const permissoesEfetivasDe = (u: any): Record<string, boolean> => {
    const proprias = (u?.permissoes ?? {}) as Record<string, boolean>;
    if (Object.keys(proprias).length > 0) return proprias;
    return Object.fromEntries(permissoesDosPapeis(papeisDe(u)).map((p) => [p, true]));
  };

  const [search, setSearch] = useState("");
  const [modalImportarCrm, setModalImportarCrm] = useState(false);
  const [aba, setAba] = useState("usuarios");
  const [roleFilter, setRoleFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  // Modais
  const [modalUsuario, setModalUsuario] = useState(false);
  const [modalPermissoes, setModalPermissoes] = useState(false);
  // Caixas que a conta pode abrir (migration 092). Lista vazia = todos.
  const [caixasDaConta, setCaixasDaConta] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [permissoesUsuarioId, setPermissoesUsuarioId] = useState<string | null>(null);

  // Form
  const [formUsuario, setFormUsuario] = useState({
    nome: "",
    email: "",
    papeis: ["caixa"] as Role[],
    ativo: true,
    loja_default_id: "",
    /** filiais em que trabalha (erp_usuario_lojas); o dono trabalha em todas */
    filiais: [] as string[],
    telefone: "",
    senha: "",
    definirSenha: false,
    // funcionário: criado/atualizado junto com o usuário
    funcionario: false, cargo: "", departamento: "", cpf: "",
    data_admissao: new Date().toLocaleDateString("sv-SE"), funcionarioAtivo: true,
  });
  const [showPasswordUsuario, setShowPasswordUsuario] = useState(false);
  // Vendedor: o que pode fazer e em quais caixas — decidido no próprio formulário
  const [funcoesVendedor, setFuncoesVendedor] = useState<Record<string, boolean>>({});
  const [caixasVendedor, setCaixasVendedor] = useState<string[]>([]);
  const [permissoesCustom, setPermissoesCustom] = useState<Record<string, boolean>>({});
  const [usarPermissoesCustom, setUsarPermissoesCustom] = useState(false);

  const isAdmin = currentUser?.role === "admin";
  // O banco recusa (migration 106): ninguém muda o próprio papel/situação,
  // e só o dono mexe na conta do dono. A tela trava antes, para não deixar
  // marcar e só ver o erro depois.
  const travaAcessoDe = (alvo: any): string | null => {
    if (!alvo) return null;
    if (alvo.id === currentUser?.id) return "Ninguém altera o próprio papel ou situação";
    if (alvo.admin_principal && !currentUser?.admin_principal) return "Só o administrador principal altera a conta dele";
    return null;
  };

  const lojaMap = Object.fromEntries(lojas.map((l) => [l.id, l.apelido || l.nome]));
  // Em quais filiais cada usuário trabalha. Fora o dono, ninguém alterna
  // entre as lojas se não estiver em mais de uma (migration 095).
  const { data: vinculos = [] } = useUsuarioLojas();
  const definirFiliais = useDefinirLojasDoUsuario();
  const { lojaId: lojaIdAtual } = useAutoSelectLoja();
  const filiaisDe = (id: string) => vinculos.filter((v) => v.usuario_id === id).map((v) => v.loja_id);

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
      lista = lista.filter((u) => papeisDe(u).includes(roleFilter as Role));
    }
    if (statusFilter === "ativos") lista = lista.filter((u) => u.ativo && !u.bloqueado);
    if (statusFilter === "inativos") lista = lista.filter((u) => !u.ativo);
    if (statusFilter === "bloqueados") lista = lista.filter((u) => u.bloqueado);
    return lista;
  }, [usuarios, search, roleFilter, statusFilter]);

  // Depois de TODOS os hooks — ver comentário equivalente em produtos.

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
      papeis: ["caixa"] as Role[],
      ativo: true,
      loja_default_id: "",
      // usuário novo começa na filial que está no topo
      filiais: lojaIdAtual ? [lojaIdAtual] : [],
      telefone: "",
      senha: "",
      // sem convite por e-mail: o link cairia na tela do CRM (SITE_URL é
      // compartilhada). Quem já tem login no CRM entra por "Importar do CRM".
      definirSenha: true,
      funcionario: false, cargo: "", departamento: "", cpf: "",
      data_admissao: new Date().toLocaleDateString("sv-SE"), funcionarioAtivo: true,
    });
    const padraoVendedor = mapaPapeis.vendedor ?? [];
    setFuncoesVendedor(Object.fromEntries(FUNCOES_DO_VENDEDOR.map((f) => [f.perm, padraoVendedor.includes(f.perm)])));
    setCaixasVendedor([]);
    setShowPasswordUsuario(false);
    setModalUsuario(true);
  };

  const abrirEdicaoUsuario = (u: any) => {
    setEditId(u.id);
    const efetivas = permissoesEfetivasDe(u);
    setFuncoesVendedor(Object.fromEntries(FUNCOES_DO_VENDEDOR.map((f) => [f.perm, efetivas[f.perm] === true])));
    setFormUsuario({
      nome: u.nome ?? "",
      email: u.email ?? "",
      papeis: papeisDe(u),
      ativo: u.ativo ?? true,
      loja_default_id: u.loja_default_id ?? "",
      filiais: vinculos.filter((v) => v.usuario_id === u.id).map((v) => v.loja_id),
      telefone: u.telefone ?? "",
      senha: "",
      definirSenha: false,
      funcionario: !!funcionarioDe(u.id),
      cargo: funcionarioDe(u.id)?.cargo ?? "",
      departamento: funcionarioDe(u.id)?.departamento ?? "",
      cpf: funcionarioDe(u.id)?.cpf ?? u.cpf ?? "",
      data_admissao: funcionarioDe(u.id)?.data_admissao ?? new Date().toLocaleDateString("sv-SE"),
      funcionarioAtivo: !funcionarioDe(u.id)?.data_demissao,
    });
    setShowPasswordUsuario(false);
    setModalUsuario(true);
  };

  /**
   * Cria ou atualiza o funcionário deste usuário, conforme o formulário.
   * Desmarcar "É funcionário" não apaga nada (histórico de comissões);
   * para desligar, use "Funcionário ativo".
   */
  const sincronizarFuncionario = async (userId: string) => {
    if (!formUsuario.funcionario) return;
    const hoje = new Date().toLocaleDateString("sv-SE");
    const cpf = formUsuario.cpf.replace(/\D/g, "") || null;
    const existente = funcionarioDe(userId);
    if (existente) {
      await updateFunc.mutateAsync({
        id: existente.id,
        cargo: formUsuario.cargo || null,
        departamento: formUsuario.departamento || null,
        data_admissao: formUsuario.data_admissao || null,
        data_demissao: formUsuario.funcionarioAtivo ? null : (existente.data_demissao ?? hoje),
      });
      return;
    }
    // pessoa: reaproveita pelo CPF (cliente que virou funcionário), senão cria
    let pessoaId: string | null = null;
    if (cpf) {
      const { data } = await supabase.from("erp_pessoas").select("id").eq("cpf_cnpj", cpf).maybeSingle();
      pessoaId = data?.id ?? null;
    }
    if (!pessoaId) {
      const { data, error } = await supabase.from("erp_pessoas").insert({
        tipo: "fisica", nome_razao: formUsuario.nome, email: formUsuario.email || null,
        telefone: formUsuario.telefone || null, cpf_cnpj: cpf,
      }).select("id").single();
      if (error) throw new Error(`pessoa: ${error.message}`);
      pessoaId = data.id;
    }
    await createFunc.mutateAsync({
      pessoa_id: pessoaId, usuario_id: userId,
      cargo: formUsuario.cargo || null, departamento: formUsuario.departamento || null,
      data_admissao: formUsuario.data_admissao || null, cpf,
      comissao_percentual: 0, gerente: false,
      data_demissao: formUsuario.funcionarioAtivo ? null : hoje,
    });
    invalidarDominios(qc, "pessoas");
  };

  /**
   * Vendedor: grava o que ele pode fazer (permissões próprias) e os caixas
   * que opera. Os caixas são trava de banco (abrir e vender no turno de quem
   * está acima, migration 113); as funções controlam botões e menu.
   */
  const gravarDoVendedor = async (userId: string, existente: any | null) => {
    try {
      const proprias = (existente?.permissoes ?? {}) as Record<string, boolean>;
      const base = Object.keys(proprias).length > 0
        ? proprias
        : Object.fromEntries(permissoesDosPapeis(formUsuario.papeis).map((p) => [p, true]));
      await updatePermissoes.mutateAsync({ id: userId, permissoes: { ...base, ...funcoesVendedor } });
      await definirCaixas.mutateAsync({ usuarioId: userId, pontos: caixasVendedor });
    } catch (e: any) {
      toast.warning(`Usuário salvo, mas as funções e os caixas do vendedor não: ${e.message ?? e}`, { duration: 10000 });
    }
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
    if ((!editId || formUsuario.senha) && formUsuario.senha.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    const editandoDono = !!editId && !!(usuarios.find((x: any) => x.id === editId) as any)?.admin_principal;
    if (!editandoDono && formUsuario.filiais.length === 0) {
      toast.error("Marque ao menos uma filial em que o usuário trabalha.");
      return;
    }
    const ehVendedor = formUsuario.papeis.includes("vendedor");
    // nenhum caixa marcado no banco quer dizer "todos": para o vendedor o
    // master escolhe de propósito, então a tela pede ao menos um
    if (ehVendedor && caixasDasFiliais.length > 0 && caixasVendedor.length === 0) {
      toast.error("Marque ao menos um caixa que o vendedor pode operar.");
      return;
    }
    // a filial padrão tem de ser uma das dele; senão, a primeira marcada
    const lojaPadrao = formUsuario.filiais.includes(formUsuario.loja_default_id)
      ? formUsuario.loja_default_id
      : (formUsuario.filiais[0] ?? "");
    try {
      if (editId) {
        // Edição: atualiza via hook normal
        await updateUsuario.mutateAsync({
          id: editId,
          nome: formUsuario.nome,
          email: formUsuario.email,
          role: papelPrincipal(formUsuario.papeis),
          papeis: formUsuario.papeis,
          ativo: formUsuario.ativo,
          loja_default_id: lojaPadrao || null,
          telefone: formUsuario.telefone || null,
        });
        if (!editandoDono) {
          await definirFiliais.mutateAsync({ usuarioId: editId, lojas: formUsuario.filiais });
        }

        // Senha nova digitada: troca na hora (antes só prometia um e-mail,
        // que nem era enviado, e o link cairia na tela do CRM)
        if (formUsuario.senha) {
          const { data, error } = await supabase.functions.invoke("erp-reset-password", {
            body: { user_id: editId, nova_senha: formUsuario.senha },
          });
          const r = await corpoDaEdge(data, error);
          if (!r.success) throw new Error(`usuário salvo, mas a senha não foi trocada: ${r.error}`);
          toast.success("Usuário atualizado e senha trocada.");
        } else {
          toast.success("Usuário atualizado");
        }
        try { await sincronizarFuncionario(editId); }
        catch (e: any) { toast.warning(`Usuário salvo, mas o funcionário não: ${e.message ?? e}`, { duration: 10000 }); }
        if (ehVendedor) await gravarDoVendedor(editId, usuarios.find((x: any) => x.id === editId));
      } else {
        // Criação: usa Edge Function create-user
        const { data, error } = await supabase.functions.invoke<{
          success: boolean;
          user_id?: string;
          error?: string;
          invite_sent?: boolean;
          invite_error?: string;
        }>("erp-create-user", {
          body: {
            email: formUsuario.email,
            nome: formUsuario.nome,
            role: papelPrincipal(formUsuario.papeis),
            papeis: formUsuario.papeis,
            loja_default_id: lojaPadrao || null,
            telefone: formUsuario.telefone || null,
            senha: formUsuario.senha,
            send_invite: false,
            // filiais gravadas pela própria edge: o login não nasce sem filial
            lojas: formUsuario.filiais,
          },
        });
        const r = await corpoDaEdge(data, error);
        if (!r.success) throw new Error(r.error ?? "Erro desconhecido ao criar usuário");
        toast.success(`Usuário criado. Já pode entrar com ${formUsuario.email} e a senha definida.`);
        if (r.user_id) {
          try { await sincronizarFuncionario(r.user_id); }
          catch (e: any) { toast.warning(`Usuário criado, mas o funcionário não: ${e.message ?? e}`, { duration: 10000 }); }
          if (ehVendedor) await gravarDoVendedor(r.user_id, null);
        }
      }
      void qc.invalidateQueries({ queryKey: ["erp_usuario_lojas"] });
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
      }>("erp-reset-password", {
        // o link vem para o ERP (SITE_URL do servidor é a do CRM)
        body: { user_id: id, redirect_base: window.location.origin },
      });
      const r = await corpoDaEdge(data, error);
      if (!r.success) throw new Error(r.error);
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
      }>("erp-delete-user", {
        body: { user_id: u.id, hard_delete: true },
      });
      const r = await corpoDaEdge(data, error);
      if (!r.success) {
        if (r.tem_historico && u.ativo && confirm(`${r.error}\n\nDesativar "${u.nome}" agora?`)) {
          await toggleAtivo(u);
          return;
        }
        throw new Error(r.error);
      }
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

  const aplicarPermissoesDosPapeis = () => {
    setPermissoesCustom(Object.fromEntries(permissoesPadrao.map((p) => [p, true])));
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
      // Esta parte é trava de verdade: o gatilho de abertura no banco recusa
      // caixa fora da lista, venha a chamada de onde vier.
      await definirCaixas.mutateAsync({
        usuarioId: permissoesUsuarioId,
        pontos: caixasDaConta,
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

  const { data: todosPontosVenda = [] } = useTodosPontosVenda();
  const { data: caixasSalvos = [] } = useCaixasPermitidos(permissoesUsuarioId ?? undefined);
  const definirCaixas = useDefinirCaixasPermitidos();

  // Recarrega a lista sempre que o diálogo abre para outra conta.
  useEffect(() => {
    setCaixasDaConta(caixasSalvos);
  }, [permissoesUsuarioId, caixasSalvos.join(",")]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Formulário do usuário: caixas do vendedor, só os das filiais marcadas
  const caixasDasFiliais = (todosPontosVenda as any[]).filter((pv) => formUsuario.filiais.includes(pv.loja_id));
  const { data: caixasDoEditado = [] } = useCaixasPermitidos(editId ?? undefined);
  useEffect(() => {
    if (editId) setCaixasVendedor(caixasDoEditado);
  }, [editId, caixasDoEditado.join(",")]);   // eslint-disable-line react-hooks/exhaustive-deps

  const usuarioSelecionado = usuarios.find((u) => u.id === permissoesUsuarioId);
  const papeisSelecionados = papeisDe(usuarioSelecionado);
  const permissoesPadrao = permissoesDosPapeis(papeisSelecionados);

  // depois de todos os hooks: return antes de hook quebra a ordem deles
  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Gestão de Usuários" />;
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
          <Button variant="outline" size="sm" onClick={() => setModalImportarCrm(true)} disabled={!isAdmin}
            title="Quem já tem login no CRM entra no ERP sem convite">
            <Download className="h-4 w-4 mr-1" />
            Importar do CRM
          </Button>
          <Button size="sm" onClick={abrirNovoUsuario} disabled={!isAdmin}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Usuário
          </Button>
        </div>
      </div>

      <Tabs value={aba} onValueChange={setAba} className="space-y-4">
      <TabsList>
        <TabsTrigger value="usuarios"><Users className="h-3.5 w-3.5 mr-1.5" /> Usuários</TabsTrigger>
        <TabsTrigger value="papeis"><Layers className="h-3.5 w-3.5 mr-1.5" /> Funções e permissões padrão</TabsTrigger>
      </TabsList>
      <TabsContent value="usuarios" className="space-y-4">

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
              <Label className="text-xs">Função</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {ROLES.map((p) => <SelectItem key={p} value={p}>{roleLabels[p]}</SelectItem>)}
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
                    <th className="text-center p-2">Função</th>
                    <th className="text-left p-2">Filiais</th>
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
                              {funcionarioDe(u.id) && (
                                <Badge variant="outline" className={`mt-1 text-[10px] ${funcionarioDe(u.id)?.data_demissao ? "text-orange-600 border-orange-400" : ""}`}>
                                  <Briefcase className="h-2.5 w-2.5 mr-0.5" />
                                  {funcionarioDe(u.id)?.cargo || "Funcionário"}{funcionarioDe(u.id)?.data_demissao ? " · desligado" : ""}
                                </Badge>
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
                          <div className="flex flex-wrap justify-center gap-1">
                            {papeisDe(u).map((p) => (
                              <Badge key={p} variant={p === u.role ? "default" : "outline"}
                                title={p === u.role ? "Função principal — governa o acesso ao banco" : undefined}>
                                {roleLabels[p] ?? p}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-2 text-sm">
                          {(u as any).admin_principal
                            ? <span className="text-muted-foreground">todas (dono)</span>
                            : filiaisDe(u.id).length === 0
                              ? <span className="text-destructive">nenhuma</span>
                              : filiaisDe(u.id).map((id) => lojaMap[id] ?? "—").join(", ")}
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
                              title={travaAcessoDe(u) ?? (u.ativo ? "Desativar" : "Ativar")}
                              disabled={!isAdmin || !!travaAcessoDe(u)}
                            >
                              {u.ativo ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive"
                              onClick={() => excluirUsuario(u)}
                              title={(u as any).admin_principal ? "O administrador principal não pode ser excluído" : "Excluir usuário"}
                              disabled={!isAdmin || isCurrentUser || !!(u as any).admin_principal}
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

      </TabsContent>
      <TabsContent value="papeis">
        <PapeisPanel isAdmin={isAdmin} userId={currentUser?.id} />
      </TabsContent>
      </Tabs>

      <ImportarDoCrmDialog open={modalImportarCrm} onOpenChange={setModalImportarCrm} onImportado={() => refetch()} lojas={lojas as any[]} />

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
                <Label>Funções</Label>
                <div className="mt-1 space-y-1 rounded-md border p-2">
                  {ROLES.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" className="h-4 w-4"
                        disabled={!!travaAcessoDe(editId ? usuarios.find((x: any) => x.id === editId) : null)}
                        title={travaAcessoDe(editId ? usuarios.find((x: any) => x.id === editId) : null) ?? undefined}
                        checked={formUsuario.papeis.includes(p)}
                        onChange={(e) => {
                          const papeis = e.target.checked
                            ? [...formUsuario.papeis, p]
                            : formUsuario.papeis.filter((x) => x !== p);
                          // sem papel nenhum o usuário não vê nada — mantém o último
                          setFormUsuario({ ...formUsuario, papeis: papeis.length ? papeis : formUsuario.papeis });
                        }} />
                      {roleLabels[p]}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Vê a união das funções. Acesso ao banco pela principal:{" "}
                  <b>{roleLabels[papelPrincipal(formUsuario.papeis)]}</b>.
                </p>
              </div>
              <div className="col-span-2">
                <Label>Filiais em que trabalha</Label>
                {editId && (usuarios.find((x: any) => x.id === editId) as any)?.admin_principal ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Dono do sistema: trabalha em todas as filiais e alterna entre elas no topo.
                  </p>
                ) : (
                  <>
                    <div className="mt-1 flex flex-wrap gap-3">
                      {lojas.map((l) => {
                        const marcada = formUsuario.filiais.includes(l.id);
                        return (
                          <label key={l.id} className="flex cursor-pointer items-center gap-2 text-sm">
                            <input type="checkbox" className="h-4 w-4" checked={marcada}
                              onChange={(e) => setFormUsuario({
                                ...formUsuario,
                                filiais: e.target.checked
                                  ? [...formUsuario.filiais, l.id]
                                  : formUsuario.filiais.filter((x) => x !== l.id),
                              })} />
                            {l.apelido || l.nome}
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Com uma filial, o usuário não vê o seletor de loja. Com duas ou mais, alterna
                      entre elas no topo. O banco recusa abrir caixa em filial que não é dele.
                    </p>
                    {formUsuario.filiais.length > 1 && (
                      <div className="mt-2 max-w-xs">
                        <Label className="text-xs">Filial que abre primeiro</Label>
                        <Select
                          value={formUsuario.filiais.includes(formUsuario.loja_default_id) ? formUsuario.loja_default_id : formUsuario.filiais[0]}
                          onValueChange={(v) => setFormUsuario({ ...formUsuario, loja_default_id: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {lojas.filter((l) => formUsuario.filiais.includes(l.id)).map((l) => (
                              <SelectItem key={l.id} value={l.id}>{l.apelido || l.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Vendedor: o master decide aqui o que ele faz e em quais caixas. */}
            {formUsuario.papeis.includes("vendedor") && (
              <div className="space-y-3 rounded-md border p-3">
                <div>
                  <Label>O que este vendedor pode fazer</Label>
                  <div className="mt-1 grid gap-1 sm:grid-cols-2">
                    {FUNCOES_DO_VENDEDOR.map((f) => (
                      <label key={f.perm} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input type="checkbox" className="h-4 w-4"
                          checked={funcoesVendedor[f.perm] === true}
                          onChange={(e) => setFuncoesVendedor({ ...funcoesVendedor, [f.perm]: e.target.checked })} />
                        {f.rotulo}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Vender e receber sempre ficam liberados. Isto controla os botões e o menu dele.
                  </p>
                </div>
                <div>
                  <Label>Caixas que pode operar</Label>
                  {caixasDasFiliais.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nenhum caixa cadastrado nas filiais marcadas. Cadastre em PDV › Configurações.
                    </p>
                  ) : (
                    <div className="mt-1 grid gap-1 sm:grid-cols-2">
                      {caixasDasFiliais.map((pv: any) => (
                        <label key={pv.id} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input type="checkbox" className="h-4 w-4"
                            checked={caixasVendedor.includes(pv.id)}
                            onChange={(e) => setCaixasVendedor((prev) =>
                              e.target.checked ? [...prev, pv.id] : prev.filter((id) => id !== pv.id))} />
                          {pv.nome}
                          <span className="text-xs text-muted-foreground">{pv.loja?.apelido ?? pv.loja?.nome ?? ""}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Ele abre só estes caixas e vende só neles — no turno dele ou de quem está acima. O banco recusa os outros.
                  </p>
                </div>
              </div>
            )}

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
                    disabled={!!travaAcessoDe(editId ? usuarios.find((x: any) => x.id === editId) : null)}
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

            {/* Funcionário: o usuário é o cadastro-mestre; daqui ele já nasce
                como funcionário (pessoa + vínculo), com o status editável. */}
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" className="h-4 w-4" checked={formUsuario.funcionario}
                  disabled={!!editId && !!funcionarioDe(editId)}
                  onChange={(e) => setFormUsuario({ ...formUsuario, funcionario: e.target.checked })} />
                <Briefcase className="h-4 w-4" /> É funcionário
                {!!editId && !!funcionarioDe(editId) && (
                  <span className="text-[11px] font-normal text-muted-foreground">(vínculo existente — para desligar, desmarque "ativo" abaixo)</span>
                )}
              </label>
              {formUsuario.funcionario && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Cargo</Label><Input value={formUsuario.cargo} onChange={(e) => setFormUsuario({ ...formUsuario, cargo: e.target.value })} /></div>
                    <div><Label>Departamento</Label><Input value={formUsuario.departamento} onChange={(e) => setFormUsuario({ ...formUsuario, departamento: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>CPF</Label><Input value={formUsuario.cpf} onChange={(e) => setFormUsuario({ ...formUsuario, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
                    <div><Label>Admissão</Label><Input type="date" value={formUsuario.data_admissao} onChange={(e) => setFormUsuario({ ...formUsuario, data_admissao: e.target.value })} /></div>
                    <div>
                      <Label>Status</Label>
                      <label className="mt-2 flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" className="h-4 w-4" checked={formUsuario.funcionarioAtivo}
                          onChange={(e) => setFormUsuario({ ...formUsuario, funcionarioAtivo: e.target.checked })} />
                        Funcionário ativo
                      </label>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Salário e comissão se ajustam em Funcionários. Desmarcar "ativo" registra a demissão na data de hoje; o histórico é preservado.
                  </p>
                </>
              )}
            </div>

            {/* Senha — obrigatória na criação. Não há convite por e-mail: o
                link cairia na tela do CRM. Quem já tem login no CRM entra por
                "Importar do CRM". */}
            {(!editId || !travaAcessoDe(usuarios.find((x: any) => x.id === editId)) || editId === currentUser?.id) && (
              <div className="space-y-2 border rounded-md p-3 bg-muted/30">
                {(
                  <div>
                    <Label>{editId ? "Nova senha (deixe em branco para manter a atual)" : "Senha (mínimo 6 caracteres)"}</Label>
                    <div className="relative">
                      <Input
                        type={showPasswordUsuario ? "text" : "password"}
                        value={formUsuario.senha}
                        onChange={(e) =>
                          setFormUsuario({ ...formUsuario, senha: e.target.value })
                        }
                        placeholder={editId ? "Só se for trocar" : "Digite a senha"}
                        minLength={6}
                        required={!editId}
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

            {!editId && (
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

          {/* O que estas permissões realmente controlam. Até agora elas eram
              gravadas e nunca lidas: a tela confirmava "salvas" e nada mudava.
              Agora o can() as respeita — mas o alcance é a navegação, e dizer
              isso evita a ilusão de que são barreira de banco. */}
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/20">
            <p className="font-medium">O que isto controla</p>
            <p className="mt-1 text-muted-foreground">
              Quais itens de menu e botões o usuário vê. O acesso ao banco é governado pelo
              <b> papel principal</b> ({roleLabels[papelPrincipal(papeisSelecionados)]}) nas regras do Supabase — tirar um item
              daqui esconde o caminho, não vira uma trava de servidor. Para restringir de verdade
              o que alguém pode gravar, mude o cargo.
            </p>
          </div>

          {/* Caixas que a conta pode abrir.
              Ao contrário do resto deste diálogo, esta parte é trava de
              banco: o gatilho de abertura recusa caixa fora da lista, venha
              a chamada da tela ou da API. */}
          <div className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Caixas que esta conta pode abrir e operar</p>
                <p className="text-xs text-muted-foreground">
                  {caixasDaConta.length === 0
                    ? "Nenhum marcado: a conta pode abrir qualquer caixa."
                    : `${caixasDaConta.length} caixa(s) liberado(s) — os demais são recusados pelo banco.`}
                </p>
              </div>
              {caixasDaConta.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setCaixasDaConta([])}>
                  Liberar todos
                </Button>
              )}
            </div>

            {todosPontosVenda.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Nenhum caixa cadastrado ainda. Cadastre em PDV › Configurações.
              </p>
            ) : (
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {todosPontosVenda.map((pv: any) => {
                  const marcado = caixasDaConta.includes(pv.id);
                  return (
                    <label key={pv.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={marcado}
                        onChange={(e) => setCaixasDaConta((prev) =>
                          e.target.checked ? [...prev, pv.id] : prev.filter((id) => id !== pv.id))}
                      />
                      <span>{pv.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {pv.loja?.apelido ?? pv.loja?.nome ?? ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

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
                  : "Usando o padrão das funções: " + nomesDosPapeis(papeisSelecionados)}
              </p>
            </label>
            {usarPermissoesCustom && (
              <Button
                variant="outline"
                size="sm"
                onClick={aplicarPermissoesDosPapeis}
                title="Preencher com o padrão das funções"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Copiar das funções
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
                Permissões padrão das funções <strong>{nomesDosPapeis(papeisSelecionados)}</strong>:
              </p>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {permissoesPadrao.map((p) => (
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
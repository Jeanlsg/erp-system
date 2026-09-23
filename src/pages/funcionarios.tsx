import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { InputMoeda } from "@/components/ui/input-moeda";
import { Label } from "@/components/ui/label";
import { Building2, Plus, Search, Loader2, UserCheck, UserX, Mail, Phone, Pencil, UserMinus, RotateCcw, KeyRound } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useFuncionarios, useCreateFuncionario, useUpdateFuncionario, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";
import { toast } from "sonner";
import { type Role, ROLES, roleLabels, papelPrincipal } from "@/lib/store/auth-store";

export function FuncionariosPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: funcionarios = [], isLoading } = useFuncionarios(lojaId ?? undefined);
  const create = useCreateFuncionario();
  const update = useUpdateFuncionario();
  const qc = useQueryClient();
  // Logins do sistema, para mostrar o vínculo do funcionário. O vínculo é o
  // que faz a venda no PDV sair com o vendedor certo (e a comissão). O login
  // nasce AQUI, no cadastro do funcionário — não numa tela separada.
  const { data: usuarios = [] } = useQuery<any[]>({
    queryKey: ["erp_usuarios_vinculo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("erp_usuarios").select("id, nome, email, telefone, ativo, role, papeis").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const papeisDe = (u: any): Role[] => (u?.papeis?.length ? u.papeis : [u?.role ?? "caixa"]);
  const [search, setSearch] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  // Manter o funcionário estava morto: não havia Editar nem Demitir, e os
  // hooks existiam sem consumidor. Três becos sem saída: comissão errada
  // virava dinheiro errado sem como corrigir; o card "Inativos" e a coluna
  // Status dependem de data_demissao, que nenhum caminho de tela preenchia;
  // e demitir só por acesso ao banco.
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    cargo: "",
    departamento: "",
    salario: "",
    data_admissao: new Date().toISOString().slice(0, 10),
    email: "",
    telefone: "",
    comissao: "0", usuario_id: "",
    nome_pai: "", nome_mae: "", naturalidade: "", nacionalidade: "Brasileira",
    estado_civil: "", grau_instrucao: "", quantidade_filhos: "",
    banco: "", agencia: "", conta: "", tipo_conta_bancaria: "", chave_pix: "",
    comissao_servico: "",
    // acesso ao sistema: criado junto com o funcionário
    acesso: false, senha: "", papeis: ["caixa"] as Role[],
  });
  const FORM_VAZIO = {
    nome: "", cpf: "", cargo: "", departamento: "", salario: "",
    data_admissao: new Date().toISOString().slice(0, 10), email: "", telefone: "",
    comissao: "0", usuario_id: "",
    nome_pai: "", nome_mae: "", naturalidade: "", nacionalidade: "Brasileira",
    estado_civil: "", grau_instrucao: "", quantidade_filhos: "",
    banco: "", agencia: "", conta: "", tipo_conta_bancaria: "", chave_pix: "",
    comissao_servico: "",
    acesso: false, senha: "", papeis: ["caixa"] as Role[],
  };

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Funcionários" />;

  const filtrados = funcionarios.filter((f: any) => {
    const nome = f.pessoa?.nome_razao ?? "";
    if (!search) return true;
    const s = search.toLowerCase();
    return nome.toLowerCase().includes(s) || (f.cargo ?? "").toLowerCase().includes(s);
  });

  const ativos = funcionarios.filter((f: any) => !f.data_demissao);
  const inativos = funcionarios.filter((f: any) => f.data_demissao);

  /**
   * Ficha e dados bancários.
   *
   * Campo vazio grava null, não string vazia: "" passaria por preenchido em
   * qualquer relatório de admissão e em qualquer conferência de pagamento.
   */
  const camposDaFicha = () => ({
    nome_pai: form.nome_pai || null,
    nome_mae: form.nome_mae || null,
    naturalidade: form.naturalidade || null,
    nacionalidade: form.nacionalidade || null,
    estado_civil: form.estado_civil || null,
    grau_instrucao: form.grau_instrucao || null,
    quantidade_filhos: form.quantidade_filhos === "" ? null : Number(form.quantidade_filhos),
    banco: form.banco || null,
    agencia: form.agencia || null,
    conta: form.conta || null,
    tipo_conta_bancaria: form.tipo_conta_bancaria || null,
    chave_pix: form.chave_pix || null,
    comissao_percentual_servico: form.comissao_servico === "" ? null : Number(form.comissao_servico),
  });

  const abrirEdicao = (f: any) => {
    setEditando(f);
    setForm({
      nome: f.pessoa?.nome_razao ?? "",
      cpf: f.cpf ?? f.pessoa?.cpf_cnpj ?? "",
      cargo: f.cargo ?? "",
      departamento: f.departamento ?? "",
      salario: f.salario != null ? String(f.salario) : "",
      data_admissao: f.data_admissao ?? new Date().toISOString().slice(0, 10),
      email: f.pessoa?.email ?? "",
      telefone: f.pessoa?.telefone ?? "",
      comissao: String(f.comissao_percentual ?? 0),
      usuario_id: f.usuario_id ?? "",
      nome_pai: f.nome_pai ?? "",
      nome_mae: f.nome_mae ?? "",
      naturalidade: f.naturalidade ?? "",
      nacionalidade: f.nacionalidade ?? "Brasileira",
      estado_civil: f.estado_civil ?? "",
      grau_instrucao: f.grau_instrucao ?? "",
      quantidade_filhos: f.quantidade_filhos != null ? String(f.quantidade_filhos) : "",
      banco: f.banco ?? "",
      agencia: f.agencia ?? "",
      conta: f.conta ?? "",
      tipo_conta_bancaria: f.tipo_conta_bancaria ?? "",
      chave_pix: f.chave_pix ?? "",
      comissao_servico: f.comissao_percentual_servico != null ? String(f.comissao_percentual_servico) : "",
      acesso: !!f.usuario_id,
      senha: "",
      papeis: papeisDe(usuarios.find((u: any) => u.id === f.usuario_id)),
    });
    setModalAberto(true);
  };

  /**
   * Garante o login do funcionário e devolve o id em erp_usuarios (ou null
   * se ele não deve ter acesso). Já vinculado → só atualiza os papéis.
   *
   * Se o e-mail já tem login (é o mesmo Supabase do CRM), o login é
   * aproveitado com a senha que a pessoa já usa — sem convite por e-mail,
   * que cairia na tela do CRM.
   */
  const garantirAcesso = async (): Promise<string | null> => {
    if (!form.acesso) return form.usuario_id || null;
    const email = form.email.trim().toLowerCase();
    const papeis = form.papeis.length ? form.papeis : (["caixa"] as Role[]);
    const role = papelPrincipal(papeis);

    if (form.usuario_id) {
      const atual = usuarios.find((u: any) => u.id === form.usuario_id);
      const mudou = JSON.stringify([...papeisDe(atual)].sort()) !== JSON.stringify([...papeis].sort());
      if (mudou) {
        const { error } = await supabase.from("erp_usuarios").update({ role, papeis }).eq("id", form.usuario_id);
        if (error) throw new Error(`papéis: ${error.message}`);
      }
      return form.usuario_id;
    }

    if (!email.includes("@")) throw new Error("Informe o e-mail do funcionário para criar o acesso.");

    // 1) cria login + perfil no ERP
    const { data, error } = await supabase.functions.invoke<{ success: boolean; user_id?: string; error?: string }>(
      "erp-create-user",
      { body: { email, nome: form.nome, role, papeis, senha: form.senha || null, telefone: form.telefone || null, send_invite: false } },
    );
    if (data?.success && data.user_id) return data.user_id;

    // a function devolve o motivo no corpo mesmo em 4xx; o supabase-js
    // esconde isso atrás de "non-2xx" — vamos buscar o texto de verdade
    let motivo = data?.error ?? "";
    if (!motivo && error && (error as any).context?.json) {
      const corpo = await (error as any).context.json().catch(() => null);
      motivo = corpo?.error ?? "";
    }
    if (!motivo) motivo = error?.message ?? "falha desconhecida";

    // 2) e-mail já tem login (CRM): aproveita, com a mesma senha
    if (/já existe|already/i.test(motivo)) {
      const { data: crm, error: eCrm } = await supabase.rpc("usuarios_crm_disponiveis");
      if (eCrm) throw new Error(eCrm.message);
      const achado = ((crm ?? []) as any[]).find((u) => String(u.email).toLowerCase() === email);
      if (!achado) throw new Error("Este e-mail já tem login e já está no ERP como outro usuário.");
      const { error: eI } = await supabase.from("erp_usuarios").insert({
        id: achado.id, email, nome: form.nome, role, papeis, ativo: true, telefone: form.telefone || null,
      });
      if (eI) throw new Error(eI.message);
      toast.info("Este e-mail já tinha login no CRM — aproveitado, com a mesma senha.");
      return achado.id;
    }
    throw new Error(motivo);
  };

  const validarAcesso = (): boolean => {
    if (!form.acesso || form.usuario_id) return true;
    if (!form.email.trim().includes("@")) { toast.error("Informe o e-mail para criar o acesso."); return false; }
    if (form.senha.length < 6) { toast.error("A senha do acesso precisa de pelo menos 6 caracteres."); return false; }
    return true;
  };

  const handleSalvarEdicao = async () => {
    if (!editando) return;
    if (!form.nome) { toast.error("Informe o nome do funcionário."); return; }
    if (!validarAcesso()) return;
    try {
      const usuarioId = await garantirAcesso();
      // só os campos que vivem em erp_funcionarios; nome, e-mail e telefone
      // pertencem a erp_pessoas e se editam na tela de Clientes
      await update.mutateAsync({
        id: editando.id,
        cargo: form.cargo || null,
        departamento: form.departamento || null,
        salario: form.salario ? Number(form.salario) : null,
        data_admissao: form.data_admissao || null,
        comissao_percentual: Number(form.comissao) || 0,
        ...camposDaFicha(),
        usuario_id: usuarioId,
      });
      void qc.invalidateQueries({ queryKey: ["erp_usuarios_vinculo"] });
      void qc.invalidateQueries({ queryKey: ["erp_usuarios"] });
      toast.success(usuarioId && !editando.usuario_id ? "Funcionário atualizado e acesso criado." : "Funcionário atualizado.");
      setModalAberto(false);
      setEditando(null);
    } catch (e: any) {
      toast.error(`Não foi possível salvar: ${e.message ?? e}`);
    }
  };

  const handleDemitir = async (f: any) => {
    const hoje = new Date().toISOString().slice(0, 10);
    const data = prompt(
      `Registrar demissão de "${f.pessoa?.nome_razao ?? "funcionário"}".\n\n` +
      "Data da demissão (aaaa-mm-dd). O cadastro e o histórico de comissões são preservados;\n" +
      "ele só deixa de contar como ativo e sai da lista de vendedores do PDV.",
      hoje,
    );
    if (data === null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.trim())) {
      toast.error("Data inválida — use o formato aaaa-mm-dd.");
      return;
    }
    try {
      await update.mutateAsync({ id: f.id, data_demissao: data.trim() });
      toast.success("Demissão registrada.");
    } catch (e: any) {
      toast.error(`Não foi possível registrar: ${e.message ?? e}`);
    }
  };

  const handleReadmitir = async (f: any) => {
    if (!confirm(`Reverter a demissão de "${f.pessoa?.nome_razao ?? "funcionário"}"?`)) return;
    try {
      await update.mutateAsync({ id: f.id, data_demissao: null });
      toast.success("Demissão revertida — funcionário ativo novamente.");
    } catch (e: any) {
      toast.error(`Não foi possível reverter: ${e.message ?? e}`);
    }
  };

  const handleCriar = async () => {
    if (!form.nome) {
      toast.error("Informe o nome do funcionário.");
      return;
    }
    if (!validarAcesso()) return;

    // Sem CPF o cadastro é aceito, mas o funcionário fica incompleto para
    // folha, comissão e documentos — melhor avisar na hora do que descobrir
    // no fechamento do mês.
    if (!form.cpf.trim()) {
      const seguir = confirm(
        "Este funcionário está sendo cadastrado SEM CPF.\n\n" +
        "O cadastro funciona, mas o CPF é necessário para folha de pagamento, " +
        "recibo de comissão e documentos. Também é ele que evita cadastrar a " +
        "mesma pessoa duas vezes.\n\nCadastrar assim mesmo?"
      );
      if (!seguir) return;
    }

    // 1) cria pessoa
    // cpf_cnpj aceita nulo. O marcador "sem-cpf-<timestamp>" que existia aqui
    // tinha 21 caracteres numa coluna varchar(18): todo cadastro sem CPF
    // falhava com o erro cru do Postgres.
    const pessoaInsert: any = {
      tipo: "fisica",
      cpf_cnpj: form.cpf.trim() || null,
      nome_razao: form.nome,
      email: form.email || null,
      telefone: form.telefone || null,
    };
    const { data: pessoa, error: eP } = await (await import("@/lib/supabase")).supabase
      .from("erp_pessoas").insert(pessoaInsert).select().single();
    if (eP) {
      // Erro do banco não é mensagem para o usuário final.
      const amigavel = /duplicate key|unique/i.test(eP.message)
        ? "Já existe um cadastro com este CPF."
        : `Não foi possível cadastrar: ${eP.message}`;
      return toast.error(amigavel);
    }

    const criado = await create.mutateAsync({
      pessoa_id: pessoa.id,
      cargo: form.cargo || null,
      departamento: form.departamento || null,
      salario: form.salario ? parseFloat(form.salario) : null,
      data_admissao: form.data_admissao || null,
      cpf: form.cpf || null,
      comissao_percentual: parseFloat(form.comissao) || 0,
      ...camposDaFicha(),
      usuario_id: null,
      gerente: false,
    });

    // 3) acesso ao sistema — depois do funcionário existir, para uma falha
    // aqui não deixar a pessoa sem cadastro: ele fica salvo e o acesso pode
    // ser criado depois pelo Editar.
    if (form.acesso) {
      try {
        const usuarioId = await garantirAcesso();
        if (usuarioId && criado?.id) {
          await update.mutateAsync({ id: criado.id, usuario_id: usuarioId });
        }
        void qc.invalidateQueries({ queryKey: ["erp_usuarios_vinculo"] });
        void qc.invalidateQueries({ queryKey: ["erp_usuarios"] });
        toast.success(`${form.nome} cadastrado(a) com acesso ao sistema (${form.papeis.map((p) => roleLabels[p]).join(", ")}).`);
      } catch (e: any) {
        toast.warning(`${form.nome} cadastrado(a), mas o acesso não foi criado: ${e.message ?? e}. Abra o cadastro e tente de novo.`, { duration: 12000 });
      }
    } else {
      toast.success(`${form.nome} cadastrado(a).`);
    }
    setModalAberto(false);
    setForm(FORM_VAZIO);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Funcionários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {funcionarios.length} funcionário(s) · {ativos.length} ativos
          </p>
        </div>
        <Button onClick={() => { setEditando(null); setModalAberto(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Funcionário
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <UserCheck className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-xs uppercase text-muted-foreground">Ativos</p>
              <p className="text-2xl font-semibold">{ativos.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <UserX className="h-8 w-8 text-gray-500" />
            <div>
              <p className="text-xs uppercase text-muted-foreground">Inativos</p>
              <p className="text-2xl font-semibold">{inativos.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Folha Mensal (estimada)</p>
            <p className="text-2xl font-semibold">
              {brl(ativos.reduce((s: number, f: any) => s + (Number(f.salario) || 0), 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou cargo..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Equipe</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : filtrados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum funcionário encontrado</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Cargo</th>
                  <th className="text-left p-3">Departamento</th>
                  <th className="text-left p-3">Contato</th>
                  <th className="text-right p-3">Salário</th>
                  <th className="text-left p-3">Admissão</th>
                  <th className="text-center p-3">Comissão</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((f: any) => (
                  <tr key={f.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{f.pessoa?.nome_razao ?? "—"}</td>
                    <td className="p-3 text-sm">{f.cargo ?? "—"}</td>
                    <td className="p-3 text-sm">{f.departamento ?? "—"}</td>
                    <td className="p-3 text-xs">
                      <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{f.pessoa?.email ?? "—"}</div>
                      <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{f.pessoa?.telefone ?? "—"}</div>
                    </td>
                    <td className="p-3 text-right tabular-nums">{f.salario ? brl(f.salario) : "—"}</td>
                    <td className="p-3 text-sm">{f.data_admissao ? date(f.data_admissao) : "—"}</td>
                    <td className="p-3 text-center tabular-nums text-sm">
                      {Number(f.comissao_percentual ?? 0) > 0 ? `${Number(f.comissao_percentual)}%` : "—"}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={f.data_demissao ? "outline" : "default"}>
                        {f.data_demissao ? `Demitido em ${date(f.data_demissao)}` : "Ativo"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" title="Editar"
                          onClick={() => abrirEdicao(f)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {f.data_demissao ? (
                          <Button variant="ghost" size="icon" title="Reverter demissão"
                            onClick={() => void handleReadmitir(f)}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" title="Registrar demissão"
                            onClick={() => void handleDemitir(f)}>
                            <UserMinus className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalAberto} onOpenChange={(v) => { setModalAberto(v); if (!v) setEditando(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editando ? `Editar ${editando.pessoa?.nome_razao ?? "funcionário"}` : "Novo Funcionário"}</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
              <div><Label>Departamento</Label><Input value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Salário</Label><InputMoeda value={form.salario} onChange={(v) => setForm({ ...form, salario: String(v) })} /></div>
              <div><Label>Comissão %</Label><Input type="number" step="0.01" value={form.comissao} onChange={(e) => setForm({ ...form, comissao: e.target.value })} /></div>
              <div><Label>Admissão</Label><Input type="date" value={form.data_admissao} onChange={(e) => setForm({ ...form, data_admissao: e.target.value })} /></div>
            </div>

            {/* Ficha de admissão — o que a contabilidade pede e a tela não tinha */}
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Ficha de admissão
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  filiação, naturalidade, estado civil, instrução
                </span>
              </summary>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nome do pai</Label><Input value={form.nome_pai} onChange={(e) => setForm({ ...form, nome_pai: e.target.value })} /></div>
                  <div><Label>Nome da mãe</Label><Input value={form.nome_mae} onChange={(e) => setForm({ ...form, nome_mae: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Naturalidade</Label><Input value={form.naturalidade} onChange={(e) => setForm({ ...form, naturalidade: e.target.value })} placeholder="Cidade / UF" /></div>
                  <div><Label>Nacionalidade</Label><Input value={form.nacionalidade} onChange={(e) => setForm({ ...form, nacionalidade: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Estado civil</Label>
                    <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={form.estado_civil} onChange={(e) => setForm({ ...form, estado_civil: e.target.value })}>
                      <option value="">—</option>
                      <option value="solteiro">Solteiro(a)</option>
                      <option value="casado">Casado(a)</option>
                      <option value="divorciado">Divorciado(a)</option>
                      <option value="viuvo">Viúvo(a)</option>
                      <option value="uniao_estavel">União estável</option>
                    </select>
                  </div>
                  <div>
                    <Label>Grau de instrução</Label>
                    <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={form.grau_instrucao} onChange={(e) => setForm({ ...form, grau_instrucao: e.target.value })}>
                      <option value="">—</option>
                      <option value="fundamental_incompleto">Fundamental incompleto</option>
                      <option value="fundamental">Fundamental</option>
                      <option value="medio_incompleto">Médio incompleto</option>
                      <option value="medio">Médio</option>
                      <option value="superior_incompleto">Superior incompleto</option>
                      <option value="superior">Superior</option>
                      <option value="pos">Pós-graduação</option>
                    </select>
                  </div>
                  <div><Label>Filhos</Label><Input type="number" min="0" value={form.quantidade_filhos} onChange={(e) => setForm({ ...form, quantidade_filhos: e.target.value })} /></div>
                </div>
              </div>
            </details>

            {/* Confidencial: banco e comissão.

                A tabela inteira já só é legível por admin e gerente desde a
                078 — o aviso existe para quem está com a tela aberta no
                balcão saber que ali tem dado de pagamento. */}
            <details className="rounded-md border border-amber-300 bg-amber-50/50 p-3 dark:bg-amber-950/10">
              <summary className="cursor-pointer text-sm font-medium">
                Informações confidenciais
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  dados bancários e comissão — visível só a administrador e gerente
                </span>
              </summary>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Banco</Label><Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} placeholder="Nome ou número" /></div>
                  <div><Label>Agência</Label><Input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} /></div>
                  <div><Label>Conta</Label><Input value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo de conta</Label>
                    <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={form.tipo_conta_bancaria} onChange={(e) => setForm({ ...form, tipo_conta_bancaria: e.target.value })}>
                      <option value="">—</option>
                      <option value="corrente">Corrente</option>
                      <option value="poupanca">Poupança</option>
                      <option value="salario">Salário</option>
                    </select>
                  </div>
                  <div><Label>Chave PIX</Label><Input value={form.chave_pix} onChange={(e) => setForm({ ...form, chave_pix: e.target.value })} /></div>
                </div>
                <div>
                  <Label>Comissão sobre serviço %</Label>
                  <Input type="number" step="0.01" min="0" value={form.comissao_servico}
                    onChange={(e) => setForm({ ...form, comissao_servico: e.target.value })} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Serviço comissiona diferente de produto: mão de obra não tem custo de
                    mercadoria. Em branco, vale o percentual geral acima.
                  </p>
                </div>
              </div>
            </details>

            {/* Acesso ao sistema: nasce junto com o funcionário. Sem login ele
                não vende no PDV e não gera comissão. */}
            <div className="rounded-md border p-3 space-y-2 bg-muted/30">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" className="h-4 w-4" checked={form.acesso}
                  disabled={!!form.usuario_id}
                  onChange={(e) => setForm({ ...form, acesso: e.target.checked })} />
                <KeyRound className="h-4 w-4" /> Acesso ao sistema
                {form.usuario_id && (
                  <Badge variant="outline" className="ml-1 text-[10px]">
                    login: {usuarios.find((u: any) => u.id === form.usuario_id)?.email ?? "vinculado"}
                  </Badge>
                )}
              </label>
              {form.acesso && (
                <>
                  {!form.usuario_id && (
                    <div>
                      <Label>Vincular a um login que já existe</Label>
                      <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                        value="" onChange={(e) => {
                          const u = usuarios.find((x: any) => x.id === e.target.value);
                          if (!u) return;
                          // puxa os dados do login; o que já foi digitado prevalece
                          setForm({
                            ...form, usuario_id: u.id, acesso: true,
                            nome: form.nome || u.nome || "", email: u.email ?? form.email,
                            telefone: form.telefone || u.telefone || "", papeis: papeisDe(u),
                          });
                        }}>
                        <option value="">— ou crie um novo login abaixo —</option>
                        {usuarios
                          .filter((u: any) => !funcionarios.some((f: any) => f.usuario_id === u.id && f.id !== editando?.id))
                          .map((u: any) => <option key={u.id} value={u.id}>{u.nome ?? u.email} · {u.email}{u.ativo ? "" : " (inativo)"}</option>)}
                      </select>
                    </div>
                  )}
                  {!form.usuario_id && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>E-mail do login</Label>
                        <Input value={form.email} readOnly className="bg-muted" placeholder="preencha o e-mail acima" />
                      </div>
                      <div>
                        <Label>Senha (mín. 6)</Label>
                        <Input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
                      </div>
                    </div>
                  )}
                  <div>
                    <Label>Papéis</Label>
                    <div className="mt-1 flex flex-wrap gap-3">
                      {ROLES.map((p) => (
                        <label key={p} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <input type="checkbox" className="h-4 w-4" checked={form.papeis.includes(p)}
                            onChange={(e) => {
                              const papeis = e.target.checked ? [...form.papeis, p] : form.papeis.filter((x) => x !== p);
                              setForm({ ...form, papeis: papeis.length ? papeis : form.papeis });
                            }} />
                          {roleLabels[p]}
                        </label>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Vê a união dos papéis; acesso ao banco pelo principal: <b>{roleLabels[papelPrincipal(form.papeis)]}</b>.
                      {!form.usuario_id && " Se o e-mail já tiver login no CRM, ele é aproveitado com a mesma senha."}
                    </p>
                  </div>
                  {form.usuario_id && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive"
                      onClick={() => setForm({ ...form, usuario_id: "", acesso: false })}>
                      Desvincular login (o login continua existindo em Usuários e Permissões)
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button
              onClick={() => void (editando ? handleSalvarEdicao() : handleCriar())}
              disabled={create.isPending || update.isPending || !form.nome}>
              {create.isPending || update.isPending
                ? "Salvando..."
                : editando ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
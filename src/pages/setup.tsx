// ============================================================
// Página: Setup Inicial / Onboarding
// Exibida quando não há nenhuma loja cadastrada.
// APENAS ADMIN pode criar a primeira empresa.
// ============================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Loader2, Sparkles, ArrowRight, CheckCircle2,
  Store, MapPin, Phone, Mail, FileText, Hash, ShieldX, LogIn,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { useAuth } from "@/lib/store/auth-store";
import { toast } from "sonner";

const REGIMES_TRIBUTARIOS = [
  { value: "simples", label: "Simples Nacional" },
  { value: "presumido", label: "Lucro Presumido" },
  { value: "real", label: "Lucro Real" },
  { value: "mei", label: "MEI" },
];

export function SetupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [criado, setCriado] = useState(false);
  const [verificandoAuth, setVerificandoAuth] = useState(true);
  const [authUser, setAuthUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [form, setForm] = useState({
    // Empresa
    nome: "",
    nome_fantasia: "",
    cnpj: "",
    inscricao_estadual: "",
    regime_tributario: "simples",
    // Endereço
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    // Contato
    telefone: "",
    email: "",
    // Loja (filial)
    apelido: "Matriz",
    tipo_loja: "matriz" as "matriz" | "filial" | "deposito",
  });

  if (!isSupabaseConfigured()) {
    return <SupabaseNotConfigured title="Configuração Inicial" />;
  }

  // Verificar permissão de admin via Supabase Auth + erp_usuarios
  useEffect(() => {
    async function checkAdmin() {
      setVerificandoAuth(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          setAuthUser(null);
          setIsAdmin(false);
          setVerificandoAuth(false);
          return;
        }
        setAuthUser(auth.user);

        // Buscar role no schema erp
        const { data: perfil } = await supabase
          .from("erp_usuarios")
          .select("id, role, ativo")
          .eq("id", auth.user.id)
          .maybeSingle();

        setIsAdmin(perfil?.role === "admin" && perfil?.ativo === true);
      } catch (err) {
        console.error("Erro ao verificar admin:", err);
        setIsAdmin(false);
      } finally {
        setVerificandoAuth(false);
      }
    }
    checkAdmin();
  }, []);

  // Tela de carregamento
  if (verificandoAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Bloqueio: não-admin não pode criar empresa
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldX className="h-6 w-6 text-destructive" />
              <CardTitle>Acesso Restrito</CardTitle>
            </div>
            <CardDescription>
              Apenas usuários com permissão de administrador podem criar a primeira empresa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {authUser ? (
              <>
                <div className="bg-muted p-3 rounded text-sm">
                  <p className="font-medium">Usuário logado:</p>
                  <p className="text-muted-foreground">{authUser.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sua role atual não permite criar empresas.
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Solicite ao administrador do sistema que faça a configuração inicial ou que eleve
                  seu usuário para o perfil <strong>admin</strong> no banco de dados.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Você não está autenticado. Faça login como administrador para continuar.
                </p>
                <Button onClick={() => navigate("/login")} className="w-full">
                  <LogIn className="mr-2 h-4 w-4" /> Ir para Login
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => navigate("/")} className="w-full">
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Helpers de máscara
  const formatCNPJ = (v: string) =>
    v.replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5").slice(0, 18);

  const formatCEP = (v: string) =>
    v.replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2").slice(0, 9);

  const formatPhone = (v: string) =>
    v.replace(/\D/g, "").replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3").slice(0, 15);

  const buscarCEP = async () => {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) {
      toast.error("CEP deve ter 8 dígitos");
      return;
    }
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error("CEP não encontrado");
        return;
      }
      setForm((f) => ({
        ...f,
        logradouro: data.logradouro ?? f.logradouro,
        bairro: data.bairro ?? f.bairro,
        cidade: data.localidade ?? f.cidade,
        uf: data.uf ?? f.uf,
      }));
      toast.success("Endereço preenchido!");
    } catch (err) {
      toast.error("Erro ao buscar CEP");
    }
  };

  const validarStep1 = () => {
    if (!form.nome || !form.cnpj) {
      toast.error("Preencha Razão Social e CNPJ");
      return false;
    }
    const cnpjDigits = form.cnpj.replace(/\D/g, "");
    if (cnpjDigits.length !== 14) {
      toast.error("CNPJ inválido (deve ter 14 dígitos)");
      return false;
    }
    return true;
  };

  const validarStep2 = () => {
    if (!form.cep || !form.cidade || !form.uf) {
      toast.error("Preencha CEP, cidade e UF");
      return false;
    }
    return true;
  };

  const criarEmpresa = async () => {
    if (!validarStep1() || !validarStep2()) return;

    setLoading(true);
    try {
      // 1. Criar loja (matriz)
      const { data: loja, error: lojaErr } = await supabase
        .from("erp_lojas")
        .insert({
          nome: form.nome,
          apelido: form.apelido || "Matriz",
          cnpj: form.cnpj,
          matriz: form.tipo_loja === "matriz",
          ativo: true,
          telefone: form.telefone || null,
          email: form.email || null,
          cep: form.cep,
          logradouro: form.logradouro,
          numero: form.numero,
          complemento: form.complemento || null,
          bairro: form.bairro,
          cidade: form.cidade,
          uf: form.uf,
          inscricao_estadual: form.inscricao_estadual || null,
          tipo_loja: form.tipo_loja,
          endereco: {
            cep: form.cep,
            logradouro: form.logradouro,
            numero: form.numero,
            complemento: form.complemento,
            bairro: form.bairro,
            cidade: form.cidade,
            uf: form.uf,
          },
          contato: {
            telefone: form.telefone,
            email: form.email,
          },
        })
        .select()
        .single();

      if (lojaErr) throw lojaErr;

      // 2. Criar dados empresariais
      const { error: dadosErr } = await supabase
        .from("erp_dados_empresariais")
        .insert({
          loja_id: loja.id,
          razao_social: form.nome,
          nome_fantasia: form.nome_fantasia || form.nome,
          cnpj: form.cnpj,
          inscricao_estadual: form.inscricao_estadual || null,
          cep: form.cep,
          logradouro: form.logradouro,
          numero: form.numero,
          complemento: form.complemento || null,
          bairro: form.bairro,
          cidade: form.cidade,
          uf: form.uf,
          telefone: form.telefone || null,
          email: form.email || null,
          regime_tributario: form.regime_tributario,
        });

      if (dadosErr) throw dadosErr;

      // 3. Criar configuração SEFAZ padrão (homologação)
      const { error: sefazErr } = await supabase
        .from("erp_configuracoes_sefaz")
        .insert({
          loja_id: loja.id,
          ambiente: "homologacao",
          uf: form.uf,
          serie_nfe: 1,
          serie_nfce: 1,
          numeracao_atual_nfe: 1,
          numeracao_atual_nfce: 1,
          timezone: "America/Sao_Paulo",
          timeout_segundos: 30,
          ativo: true,
        });

      if (sefazErr) throw sefazErr;

      // 4. Vincular loja padrão ao usuário atual (se existir)
      if (user?.id) {
        await supabase
          .from("erp_usuarios")
          .update({ loja_default_id: loja.id })
          .eq("id", user.id);
      }

      setCriado(true);
      toast.success("Empresa criada com sucesso!");

      // Recarregar após 2s
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (err: any) {
      console.error("Erro ao criar empresa:", err);
      toast.error(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (criado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-950 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-20 w-20 mx-auto text-green-600" />
            <h1 className="text-2xl font-bold">Empresa criada!</h1>
            <p className="text-muted-foreground">
              A empresa <strong>{form.nome}</strong> foi cadastrada com sucesso.
            </p>
            <p className="text-sm text-muted-foreground">Redirecionando para o dashboard...</p>
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      <div className="mx-auto max-w-3xl py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
            <Badge variant="outline">Configuração Inicial</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Bem-vindo ao ERP
          </h1>
          <p className="text-muted-foreground mt-2">
            Vamos cadastrar sua primeira empresa para começar
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Badge variant={step >= 1 ? "default" : "outline"} className="h-8">
            <Store className="h-3 w-3 mr-1" /> 1. Empresa
          </Badge>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant={step >= 2 ? "default" : "outline"} className="h-8">
            <MapPin className="h-3 w-3 mr-1" /> 2. Endereço
          </Badge>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant={step >= 3 ? "default" : "outline"} className="h-8">
            <CheckCircle2 className="h-3 w-3 mr-1" /> 3. Confirmar
          </Badge>
        </div>

        {/* Step 1: Dados da Empresa */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> Dados da Empresa
              </CardTitle>
              <CardDescription>
                Informações fiscais e razão social
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Razão Social *</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex: Empresa XYZ Ltda"
                  />
                </div>
                <div>
                  <Label>Nome Fantasia</Label>
                  <Input
                    value={form.nome_fantasia}
                    onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
                    placeholder="Ex: XYZ Suplementos"
                  />
                </div>
                <div>
                  <Label>Apelido da Loja</Label>
                  <Input
                    value={form.apelido}
                    onChange={(e) => setForm({ ...form, apelido: e.target.value })}
                    placeholder="Matriz"
                  />
                </div>
                <div>
                  <Label>CNPJ *</Label>
                  <Input
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div>
                  <Label>Inscrição Estadual</Label>
                  <Input
                    value={form.inscricao_estadual}
                    onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })}
                    placeholder="000.000.000.000"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Regime Tributário</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    value={form.regime_tributario}
                    onChange={(e) => setForm({ ...form, regime_tributario: e.target.value })}
                  >
                    {REGIMES_TRIBUTARIOS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => validarStep1() && setStep(2)}>
                  Próximo <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Endereço */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" /> Endereço
              </CardTitle>
              <CardDescription>
                Localização da empresa (preencha o CEP para autopreenchimento)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>CEP *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.cep}
                      onChange={(e) => setForm({ ...form, cep: formatCEP(e.target.value) })}
                      onBlur={buscarCEP}
                      placeholder="00000-000"
                    />
                    <Button variant="outline" size="sm" onClick={buscarCEP}>
                      <Hash className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label>Logradouro</Label>
                  <Input
                    value={form.logradouro}
                    onChange={(e) => setForm({ ...form, logradouro: e.target.value })}
                    placeholder="Rua / Av."
                  />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input
                    value={form.numero}
                    onChange={(e) => setForm({ ...form, numero: e.target.value })}
                    placeholder="000"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Complemento</Label>
                  <Input
                    value={form.complemento}
                    onChange={(e) => setForm({ ...form, complemento: e.target.value })}
                    placeholder="Sala, Galpão, etc."
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Bairro</Label>
                  <Input
                    value={form.bairro}
                    onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cidade *</Label>
                  <Input
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  />
                </div>
                <div>
                  <Label>UF *</Label>
                  <Input
                    value={form.uf}
                    onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
                    maxLength={2}
                    placeholder="SP"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Telefone
                  </Label>
                  <Input
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: formatPhone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="contato@empresa.com"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Voltar
                </Button>
                <Button onClick={() => validarStep2() && setStep(3)}>
                  Próximo <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Confirmação */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Confirmar Dados
              </CardTitle>
              <CardDescription>
                Revise os dados antes de criar a empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Razão Social:</span>
                  <span className="font-medium">{form.nome}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Nome Fantasia:</span>
                  <span className="font-medium">{form.nome_fantasia || "—"}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">CNPJ:</span>
                  <span className="font-mono font-medium">{form.cnpj}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Regime:</span>
                  <span className="font-medium">
                    {REGIMES_TRIBUTARIOS.find((r) => r.value === form.regime_tributario)?.label}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Endereço:</span>
                  <span className="font-medium text-right">
                    {form.logradouro}, {form.numero}
                    <br />
                    {form.bairro} - {form.cidade}/{form.uf}
                    <br />
                    CEP: {form.cep}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Apelido da Loja:</span>
                  <span className="font-medium">{form.apelido}</span>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-500 rounded p-3">
                <p className="text-sm font-medium">📌 Próximos passos:</p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                  <li>Você poderá adicionar filiais depois em "Configurações → Lojas"</li>
                  <li>Cadastre usuários e permissões</li>
                  <li>Configure certificados digitais para emitir NFe</li>
                </ul>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setStep(2)} disabled={loading}>
                  Voltar
                </Button>
                <Button onClick={criarEmpresa} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" /> Criar Empresa
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
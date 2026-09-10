import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Loader2, Lock, Eye, EyeOff, Check, LinkIcon, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  // Sem sessão de recuperação não há o que redefinir: mostrar o formulário
  // assim mesmo fazia o usuário digitar a senha duas vezes para receber
  // "Auth session missing!" em inglês. Agora o estado é decidido antes.
  const [estado, setEstado] = useState<"verificando" | "valido" | "invalido">("verificando");
  const [emailNovoLink, setEmailNovoLink] = useState("");
  const [enviandoLink, setEnviandoLink] = useState(false);

  useEffect(() => {
    let vivo = true;
    const { data: sub } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (!vivo) return;
      if (evento === "PASSWORD_RECOVERY" || (evento === "SIGNED_IN" && sessao)) setEstado("valido");
    });

    (async () => {
      // O link do e-mail traz o token no hash (#access_token=…&type=recovery)
      // ou como ?code=; o cliente do Supabase troca isso por sessão sozinho,
      // mas leva alguns milissegundos — daí a espera curta antes de desistir.
      const temToken = /access_token|type=recovery|[?&]code=/.test(
        window.location.hash + window.location.search,
      );
      const ate = Date.now() + (temToken ? 6000 : 1200);
      while (vivo && Date.now() < ate) {
        const { data } = await supabase.auth.getSession();
        if (!vivo) return;
        if (data.session) { setEstado("valido"); return; }
        await new Promise((r) => setTimeout(r, 250));
      }
      if (vivo) setEstado((e) => (e === "verificando" ? "invalido" : e));
    })();

    return () => { vivo = false; sub.subscription.unsubscribe(); };
  }, []);

  const pedirNovoLink = async () => {
    const email = emailNovoLink.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setEnviandoLink(true);
    try {
      // Mesmo destino usado na tela de login: o próprio domínio de onde a
      // pessoa está acessando. Nenhuma configuração do Supabase muda.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/redefinir-senha`,
      });
      if (error) throw error;
      toast.success("Link enviado. Confira a caixa de entrada — e também o spam.");
    } catch (err: any) {
      toast.error(`Não foi possível enviar: ${err.message}`);
    } finally {
      setEnviandoLink(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (senha !== confirmar) {
      toast.error("As senhas não conferem");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: senha,
      });
      if (error) throw error;
      setSucesso(true);
      toast.success("Senha redefinida com sucesso!");
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (err: any) {
      const semSessao = /auth session missing|session_not_found|invalid claim/i.test(err?.message ?? "");
      if (semSessao) {
        setEstado("invalido");
        toast.error("O link de redefinição expirou. Peça um novo abaixo.");
      } else {
        toast.error(`Não foi possível redefinir: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (sucesso) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">Senha redefinida!</h2>
            <p className="text-muted-foreground">
              Você será redirecionado para a tela de login em instantes...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (estado === "verificando") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Conferindo o link de redefinição…</p>
        </div>
      </div>
    );
  }

  if (estado === "invalido") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-amber-600" />
              Link inválido ou expirado
            </CardTitle>
            <CardDescription>
              O link de redefinição vale por pouco tempo e só pode ser usado uma vez.
              Peça um novo abaixo — ele chega no e-mail em instantes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email-novo-link">Seu e-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email-novo-link"
                  type="email"
                  placeholder="seu@email.com"
                  className="pl-9"
                  value={emailNovoLink}
                  onChange={(e) => setEmailNovoLink(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void pedirNovoLink(); }}
                />
              </div>
            </div>
            <Button className="w-full" onClick={() => void pedirNovoLink()} disabled={enviandoLink}>
              {enviandoLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Enviar novo link
            </Button>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              Voltar para o login
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Redefinir Senha
          </CardTitle>
          <CardDescription>
            Digite sua nova senha abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="senha">Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="senha"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  className="pl-9 pr-10"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmar">Confirmar Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmar"
                  type={showPassword ? "text" : "password"}
                  className="pl-9"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              Redefinir Senha
            </Button>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              Voltar para o login
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
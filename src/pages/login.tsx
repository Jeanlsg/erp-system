import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { login, useAuth, ehOperadorDeBalcao } from "@/lib/store/auth-store";
import { supabase } from "@/lib/supabase";
import { formatarCpf, tipoDoLogin } from "@/lib/cpf";

export function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  // e-mail ou CPF (03/11/2026): tem "@" é e-mail, o resto é CPF
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate(ehOperadorDeBalcao() ? "/pdv" : "/", { replace: true });
  }, [isAuthenticated, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await login(email.trim(), senha);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Bem-vindo, ${res.user.nome}`);
    // quem só opera o balcão entra direto na venda
    navigate(ehOperadorDeBalcao() ? "/pdv" : "/", { replace: true });
  };

  const handleForgotPassword = async () => {
    // o link vai por e-mail: com o CPF a tela não sabe para onde mandar (e
    // não deve contar qual é o e-mail daquele CPF)
    if (!email || tipoDoLogin(email.trim()) !== "email") {
      toast.error("Para redefinir a senha, digite o seu e-mail (não o CPF). Sem acesso ao e-mail, peça ao administrador.");
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/redefinir-senha`,
      });
      if (error) throw error;
      toast.success("Email de redefinição enviado! Verifique sua caixa de entrada.");
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
        <div className="hidden flex-col justify-between rounded-xl border bg-sidebar p-8 text-sidebar-foreground md:flex">
          <img src="/logo-xlife.png" alt="X-Life Suplementos" className="h-16 w-16 rounded-full" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">ERP X-Life</h2>
            <p className="mt-2 text-sm text-sidebar-foreground/70">
              Acesse o sistema para operar o PDV, gerir estoque, emitir notas fiscais e acompanhar os resultados da loja.
            </p>
          </div>
          <div className="rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs text-sidebar-foreground/70">
            Use seu e-mail ou CPF e a senha para acessar.
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Use seu e-mail ou CPF e a senha.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail ou CPF</Label>
                <Input
                  id="email"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="seu@email.com ou 000.000.000-00"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => { if (tipoDoLogin(email) === "cpf") setEmail(formatarCpf(email)); }}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <LogIn className="mr-2 h-4 w-4" /> {loading ? "Entrando..." : "Entrar"}
              </Button>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="w-full text-xs text-muted-foreground hover:text-primary hover:underline transition-colors flex items-center justify-center gap-1"
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-3 w-3" />
                    Esqueci minha senha
                  </>
                )}
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
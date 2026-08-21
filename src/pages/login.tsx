import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { login, useAuth } from "@/lib/store/auth-store";
import { supabase } from "@/lib/supabase";

export function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
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
    navigate("/", { replace: true });
  };

  const handleForgotPassword = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Digite seu e-mail primeiro para redefinir a senha");
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
            Use seu e-mail corporativo e senha para acessar.
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Use seu e-mail corporativo e senha.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
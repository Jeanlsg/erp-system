import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { login, useAuth } from "@/lib/store/auth-store";

const demoUsers = [
  { label: "Admin", email: "admin@lojaxlife.com.br", senha: "Admin@2026" },
  { label: "Gerente", email: "gerente@lojaxlife.com.br", senha: "Ger@2026" },
  { label: "Caixa", email: "caixa@lojaxlife.com.br", senha: "Caixa@2026" },
  { label: "Estoquista", email: "estoque@lojaxlife.com.br", senha: "Estoque@2026" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

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

  const usarDemo = (u: { email: string; senha: string }) => {
    setEmail(u.email);
    setSenha(u.senha);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
        <div className="hidden flex-col justify-between rounded-xl border bg-sidebar p-8 text-sidebar-foreground md:flex">
          <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-2xl font-bold">ERP</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Power ERP</h2>
            <p className="mt-2 text-sm text-sidebar-foreground/70">
              Acesse o sistema para operar o PDV, gerir estoque, emitir notas fiscais e acompanhar os resultados da loja.
            </p>
          </div>
          <div className="rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs text-sidebar-foreground/70">
            Versão de demonstração. Use os atalhos ao lado para entrar com perfis pré-configurados.
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
            </form>

            <div className="mt-6 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Acesso rápido (demo)</p>
              <div className="grid grid-cols-2 gap-2">
                {demoUsers.map((u) => (
                  <Button key={u.email} type="button" variant="outline" size="sm" onClick={() => usarDemo(u)}>
                    {u.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
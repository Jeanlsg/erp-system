/**
 * Primeiro acesso com senha temporária (03/11/2026, como no CRM): o admin
 * criou o login (ou deu uma senha nova) e passou a senha à pessoa. Antes de
 * usar o sistema ela define a própria — a janela não fecha; dá para sair.
 *
 * A marca é auth user_metadata.senha_provisoria (gravada pelas edges
 * erp-create-user e erp-reset-password). A senha nova e a marca saem na mesma
 * chamada: não fica senha trocada com a marca de pé, nem o contrário.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { DICA_SENHA, problemaDaSenha } from "@/lib/senha";
import { logout, podeSair, useAuth, useAuthStore } from "@/lib/store/auth-store";

export function TrocaDeSenhaObrigatoria() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [ver, setVer] = useState(false);
  const [salvando, setSalvando] = useState(false);

  if (!user?.senha_provisoria) return null;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const problema = problemaDaSenha(senha);
    if (problema) { toast.error(problema); return; }
    if (senha !== confirmar) { toast.error("As senhas não conferem."); return; }
    setSalvando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha, data: { senha_provisoria: false } });
      if (error) {
        const mesma = (error as any).code === "same_password" || /different from the old/i.test(error.message);
        toast.error(mesma ? "A senha nova precisa ser diferente da temporária." : `Não foi possível trocar a senha: ${error.message}`);
        return;
      }
      // quem conhecia a temporária (e entrou com ela em outro aparelho) sai; este navegador continua
      await supabase.auth.signOut({ scope: "others" }).catch(() => {});
      const atual = useAuthStore.getState().user;
      if (atual) useAuthStore.getState().setUser({ ...atual, senha_provisoria: false });
      toast.success("Senha definida. Use a nova senha a partir de agora.");
    } finally {
      setSalvando(false);
    }
  };

  const sair = async () => {
    if (!(await podeSair())) return;
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <Dialog open onOpenChange={() => { /* não fecha: só salvando ou saindo */ }}>
      <DialogContent className="sm:max-w-md [&>button:last-child]:hidden" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Defina a sua senha</DialogTitle>
          <DialogDescription>
            Você entrou com uma senha temporária. Por segurança, crie a sua antes de continuar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="senha-nova">Nova senha</Label>
            <div className="relative">
              <Input
                id="senha-nova"
                type={ver ? "text" : "password"}
                autoComplete="new-password"
                placeholder={DICA_SENHA}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setVer(!ver)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={ver ? "Esconder a senha" : "Mostrar a senha"}
              >
                {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="senha-confirmar">Confirmar a nova senha</Label>
            <Input
              id="senha-confirmar"
              type={ver ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repita a senha"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              required
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={sair} disabled={salvando}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Salvar e continuar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

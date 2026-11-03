/**
 * Login criado ou senha dada pelo admin (03/11/2026, como no CRM): mostra
 * e-mail, CPF e senha para copiar e passar à pessoa. A senha não fica
 * guardada em lugar nenhum da tela: fechou, não aparece de novo.
 */
import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatarCpf } from "@/lib/cpf";

export interface Credenciais {
  nome: string;
  email: string;
  /** CPF de acesso, só os dígitos; vazio = entra só pelo e-mail */
  cpf: string;
  senha: string;
  /** a pessoa troca no primeiro acesso */
  provisoria: boolean;
  /** login novo (senão, senha trocada de um login que já existia) */
  nova: boolean;
}

export function CredenciaisDeAcesso({ credenciais, aoFechar }: { credenciais: Credenciais | null; aoFechar: () => void }) {
  const linhas: [string, string][] = credenciais
    ? [
        ["E-mail", credenciais.email],
        ...(credenciais.cpf ? [["CPF", formatarCpf(credenciais.cpf)] as [string, string]] : []),
        [credenciais.provisoria ? "Senha temporária" : "Senha", credenciais.senha],
      ]
    : [];
  const copiar = (texto: string, aviso: string) =>
    navigator.clipboard.writeText(texto).then(
      () => toast.success(aviso),
      () => toast.error("Não deu para copiar; selecione e copie à mão."),
    );
  const tudo = () =>
    [
      `Acesso ao ERP: ${window.location.origin}`,
      ...linhas.map(([r, v]) => `${r}: ${v}`),
      ...(credenciais?.provisoria ? ["No primeiro acesso, o sistema pede que você crie a sua senha."] : []),
    ].join("\n");

  return (
    <Dialog open={!!credenciais} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {credenciais?.nova ? "Acesso criado" : "Senha trocada"}
          </DialogTitle>
        </DialogHeader>
        {credenciais && (
          <>
            <p className="text-sm text-muted-foreground">
              Passe estes dados a {credenciais.nome} por um canal seguro (pessoalmente ou mensagem direta).{" "}
              {credenciais.provisoria
                ? "No primeiro acesso, o sistema pede uma senha nova e a temporária deixa de valer."
                : "A pessoa continua com esta senha."}
              {" "}Depois de fechar, a senha não aparece de novo.
            </p>
            <div className="space-y-3">
              {linhas.map(([rotulo, valor]) => (
                <div key={rotulo} className="space-y-1">
                  <Label>{rotulo}</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={valor}
                      className={rotulo.startsWith("Senha") ? "font-mono" : ""}
                      onFocus={(e) => e.target.select()}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Copiar ${rotulo.toLowerCase()}`}
                      onClick={() => copiar(valor, `${rotulo} copiado`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Entra em {window.location.origin} com o {credenciais.cpf ? "e-mail ou o CPF" : "e-mail"} e a senha.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={aoFechar}>Fechar</Button>
              <Button type="button" onClick={() => copiar(tudo(), "Dados de acesso copiados")}>
                <Copy className="h-4 w-4 mr-1" /> Copiar tudo
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

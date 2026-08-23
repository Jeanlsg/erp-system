// ============================================================
// E-mail Marketing — campanhas reais via Resend.
//
// A campanha nasce como rascunho e o disparo é a edge function
// erp-email-campanha, que envia para todos os cadastros ativos com
// e-mail válido e grava os totais na própria campanha.
// ============================================================

import { useMemo, useState } from "react";
import { Mail, Loader2, Plus, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  useEmailMarketing, useCreateEmailMarketing, useClientes,
  isSupabaseConfigured, supabase,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { date } from "@/lib/format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailMarketingPage() {
  const { lojaId } = useAutoSelectLoja();
  const qc = useQueryClient();
  const { data: campanhas = [], isLoading } = useEmailMarketing(lojaId ?? undefined);
  const { data: clientes = [] } = useClientes();
  const criar = useCreateEmailMarketing();

  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [enviandoId, setEnviandoId] = useState<string | null>(null);

  const comEmail = useMemo(
    () => clientes.filter((c: any) => !c.bloqueado && EMAIL_RE.test((c.email ?? "").trim())).length,
    [clientes],
  );

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="E-mail Marketing" />;

  const salvarRascunho = async (): Promise<any | null> => {
    if (!nome.trim() || !assunto.trim() || !corpo.trim()) {
      toast.error("Preencha nome, assunto e corpo.");
      return null;
    }
    const data = await criar.mutateAsync({
      loja_id: lojaId ?? null,
      nome: nome.trim(),
      assunto: assunto.trim(),
      template: corpo,
      status: "rascunho",
      publico_alvo: { descricao: "cadastros ativos com e-mail válido" },
    });
    setAberto(false);
    setNome(""); setAssunto(""); setCorpo("");
    return data;
  };

  const enviar = async (campanhaId: string) => {
    setEnviandoId(campanhaId);
    try {
      const { data, error } = await supabase.functions.invoke("erp-email-campanha", {
        body: { campanha_id: campanhaId },
      });
      if (error) throw new Error((await (error as any).context?.json?.())?.erro ?? error.message);
      if (data?.erro) throw new Error(data.erro);
      toast.success(`Campanha enviada: ${data.enviados}/${data.total_destinatarios} e-mail(s)${data.erros ? `, ${data.erros} falha(s)` : ""}.`);
      if (data.falhas?.length) console.warn("Falhas de envio:", data.falhas);
    } catch (e: any) {
      toast.error(`Falha no envio: ${e.message ?? e}`);
    } finally {
      setEnviandoId(null);
      void qc.invalidateQueries({ queryKey: ["erp_email_marketing"] });
    }
  };

  const salvarEEnviar = async () => {
    const rascunho = await salvarRascunho().catch((e) => { toast.error(String(e.message ?? e)); return null; });
    if (rascunho?.id) await enviar(rascunho.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Mail className="h-6 w-6" /> E-mail Marketing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {campanhas.length} campanha(s) · {comEmail} cadastro(s) com e-mail válido
          </p>
        </div>
        <Button onClick={() => setAberto(true)}><Plus className="mr-2 h-4 w-4" /> Nova Campanha</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Campanhas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : campanhas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma campanha cadastrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Assunto</th>
                  <th className="text-left p-3">Enviada em</th>
                  <th className="text-right p-3">Enviados</th>
                  <th className="text-right p-3">Falhas</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {campanhas.map((c: any) => (
                  <tr key={c.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{c.nome}</td>
                    <td className="p-3 text-sm">{c.assunto ?? "—"}</td>
                    <td className="p-3 text-sm">{c.data_enviada ? date(c.data_enviada) : "—"}</td>
                    <td className="p-3 text-right tabular-nums">{c.total_enviados ?? 0}{c.total_destinatarios ? `/${c.total_destinatarios}` : ""}</td>
                    <td className="p-3 text-right tabular-nums">{c.total_erros ?? 0}</td>
                    <td className="p-3 text-center">
                      <Badge variant={c.status === "enviada" ? "default" : c.status === "erro" ? "destructive" : "outline"}>{c.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {["rascunho", "agendada", "erro"].includes(c.status) && (
                        <Button variant="ghost" size="sm" disabled={enviandoId !== null}
                          onClick={() => void enviar(c.id)} title="Enviar agora">
                          {enviandoId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Campanha de E-mail</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome da campanha (interno)</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Promoção de setembro" />
            </div>
            <div className="space-y-1.5">
              <Label>Assunto do e-mail</Label>
              <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Ex.: Whey com 20% OFF esta semana" />
            </div>
            <div className="space-y-1.5">
              <Label>Corpo do e-mail</Label>
              <Textarea rows={8} value={corpo} onChange={(e) => setCorpo(e.target.value)}
                placeholder={"Olá!\n\nEscreva aqui a mensagem. Quebras de linha são mantidas no e-mail."} />
            </div>
            <p className="text-xs text-muted-foreground">
              Será enviada para <b>{comEmail}</b> cadastro(s) ativo(s) com e-mail válido, com rodapé
              de identificação e opção de remoção.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button variant="secondary" disabled={criar.isPending}
              onClick={() => void salvarRascunho().catch((e) => toast.error(String(e.message ?? e)))}>
              Salvar rascunho
            </Button>
            <Button disabled={criar.isPending || enviandoId !== null} onClick={() => void salvarEEnviar()}>
              <Send className="mr-2 h-4 w-4" /> Salvar e enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Plus, Loader2 } from "lucide-react";
import { useEmailMarketing, useCreateEmailMarketing, useConfiguracoesGerais, useUpsertConfiguracao, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";

export function EmailInteligentePage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: campanhas = [], isLoading } = useEmailMarketing(lojaId ?? undefined);
  const create = useCreateEmailMarketing();
  const { data: configs = [] } = useConfiguracoesGerais();
  const upsertConfig = useUpsertConfiguracao();
  const [modalAberto, setModalAberto] = useState(false);
  const [configurando, setConfigurando] = useState<{ tipo: string; descricao: string } | null>(null);
  const [autoAtiva, setAutoAtiva] = useState(false);
  const [autoTemplate, setAutoTemplate] = useState("");
  const [form, setForm] = useState({
    nome: "",
    assunto: "",
    remetente: "",
    template: "",
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Email Inteligente" />;

  const AUTOMACOES = [
    { tipo: "Boas-vindas", descricao: "Enviado ao novo cliente", icone: "👋" },
    { tipo: "Aniversariantes", descricao: "Mensagem automática no dia do aniversário", icone: "🎂" },
    { tipo: "Inatividade", descricao: "Reativar clientes sem compras há 60+ dias", icone: "⏰" },
    { tipo: "Pós-venda", descricao: "Agradecimento 7 dias após a compra", icone: "🛍️" },
    { tipo: "Carrinho Abandonado", descricao: "Lembrete de carrinho não finalizado", icone: "🛒" },
    { tipo: "Avaliação", descricao: "Solicitar avaliação 15 dias após entrega", icone: "⭐" },
  ];

  const chaveAuto = (tipo: string) => `email_auto_${tipo.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").replace(/ /g, "_")}`;
  const configAuto = (tipo: string) => {
    const raw = (configs as any[]).find((c) => c.chave === chaveAuto(tipo))?.valor;
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  };

  const abrirConfig = (a: { tipo: string; descricao: string }) => {
    const atual = configAuto(a.tipo);
    setAutoAtiva(atual?.ativa ?? false);
    setAutoTemplate(atual?.template ?? "");
    setConfigurando(a);
  };

  const salvarConfig = async () => {
    if (!configurando) return;
    await upsertConfig.mutateAsync({
      chave: chaveAuto(configurando.tipo),
      valor: JSON.stringify({ ativa: autoAtiva, template: autoTemplate }),
      categoria: "email_inteligente",
      descricao: `Automação: ${configurando.tipo}`,
    } as any);
    setConfigurando(null);
  };

  const rascunhos = campanhas.filter((c) => c.status === "rascunho").length;
  const agendadas = campanhas.filter((c) => c.status === "agendada").length;
  const enviadas = campanhas.filter((c) => c.status === "enviada").length;

  const handleCriar = async () => {
    if (!form.nome) return;
    await create.mutateAsync({
      loja_id: lojaId ?? null,
      nome: form.nome,
      assunto: form.assunto,
      remetente: form.remetente || null,
      template: form.template || null,
      status: "rascunho",
    });
    setModalAberto(false);
    setForm({ nome: "", assunto: "", remetente: "", template: "" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Mail className="h-6 w-6" /> Email Inteligente
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Automações de email marketing</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Rascunhos</p><p className="text-2xl font-semibold">{rascunhos}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Agendadas</p><p className="text-2xl font-semibold">{agendadas}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Enviadas</p><p className="text-2xl font-semibold">{enviadas}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Automações Disponíveis</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AUTOMACOES.map((a) => (
            <Card key={a.tipo}>
              <CardContent className="p-4">
                <div className="text-2xl mb-2">{a.icone}</div>
                <p className="font-semibold flex items-center gap-2">
                  {a.tipo}
                  {configAuto(a.tipo)?.ativa && <Badge className="text-[10px]">Ativa</Badge>}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{a.descricao}</p>
                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => abrirConfig(a)}>
                  Configurar
                </Button>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Campanhas</CardTitle>
            <Button onClick={() => setModalAberto(true)} size="sm"><Plus className="mr-2 h-3 w-3" /> Nova</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : campanhas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma campanha cadastrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Assunto</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {campanhas.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{c.nome}</td>
                    <td className="p-3 text-sm">{c.assunto ?? "—"}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{c.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Campanha</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Assunto</Label><Input value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} /></div>
            <div><Label>Remetente</Label><Input value={form.remetente} onChange={(e) => setForm({ ...form, remetente: e.target.value })} placeholder="empresa@dominio.com" /></div>
            <div><Label>Template (HTML opcional)</Label><Input value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={create.isPending || !form.nome}>{create.isPending ? "Salvando..." : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!configurando} onOpenChange={(o) => !o && setConfigurando(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configurar — {configurando?.tipo}</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{configurando?.descricao}</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoAtiva} onChange={(e) => setAutoAtiva(e.target.checked)} />
              Automação ativa
            </label>
            <div>
              <Label>Mensagem / template do email</Label>
              <textarea
                className="w-full min-h-24 rounded-md border bg-background p-2 text-sm"
                value={autoTemplate}
                onChange={(e) => setAutoTemplate(e.target.value)}
                placeholder="Olá {{nome}}, ..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigurando(null)}>Cancelar</Button>
            <Button onClick={salvarConfig} disabled={upsertConfig.isPending}>
              {upsertConfig.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
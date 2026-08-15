// ============================================================
// Páginas extras de Gestão Empresarial (parte 2)
// ============================================================

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Star, Loader2, Plus, ThumbsUp, MessageSquare,
  Bell, Trash2, CheckCircle, Lock, Settings, Briefcase,
} from "lucide-react";

// Componente local para ThumbsDown (não vem do lucide-react direto)
const ThumbsDown = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 14V2" />
    <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17v12l-3.34 7A2 2 0 0 1 11.84 22c-.55 0-1.07-.22-1.45-.62-.39-.39-.6-.93-.55-1.48L10.3 18.12Z" />
  </svg>
);
import {
  useAvaliacoes, useRecomendacoes, useCreateParceria,
  useNotificacoes, useMarcarNotificacaoLida,
  useCertificados, useCreateCertificado, useDeleteCertificado,
  useConfiguracoesSefaz, useUpsertConfiguracaoSefaz,
  useConfiguracoesGerais, useUpsertConfiguracao,
  useOcorrencias, useCreateOcorrencia, useUpdateOcorrencia,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { useAuth } from "@/lib/store/auth-store";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { date, dateTime, brl } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

// ====================================================================
// AVALIAÇÕES
// ====================================================================
export function AvaliacoesPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: avaliacoes = [], isLoading } = useAvaliacoes(lojaId ?? undefined);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Avaliações" />;

  const notaMedia = avaliacoes.length > 0
    ? avaliacoes.reduce((s: number, a: any) => s + Number(a.nota ?? 0), 0) / avaliacoes.length
    : 0;

  const estrelas = (n: number) => "⭐".repeat(n) + "☆".repeat(5 - n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Star className="h-6 w-6" /> Avaliações de Clientes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{avaliacoes.length} avaliações · média {notaMedia.toFixed(1)} ⭐</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        {[5, 4, 3, 2, 1].map((n) => {
          const count = avaliacoes.filter((a: any) => Number(a.nota) === n).length;
          return (
            <Card key={n}>
              <CardContent className="p-4 text-center">
                <p className="text-xs">{estrelas(n)}</p>
                <p className="text-2xl font-bold mt-1">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Avaliações</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : avaliacoes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma avaliação</div>
          ) : (
            <div className="divide-y">
              {avaliacoes.map((a: any) => (
                <div key={a.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{a.cliente?.nome_razao ?? "Anônimo"}</p>
                        <Badge variant="outline">{a.tipo}</Badge>
                        {a.verificado && <Badge variant="default" className="text-[10px]">✓ Verificado</Badge>}
                      </div>
                      <p className="text-sm">{estrelas(Number(a.nota))}</p>
                      <p className="text-sm text-muted-foreground mt-1">{a.comentario}</p>
                      {a.resposta && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">
                          <p className="text-xs font-semibold">Resposta:</p>
                          <p>{a.resposta}</p>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{dateTime(a.data_avaliacao)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ====================================================================
// RECOMENDAÇÕES
// ====================================================================
export function RecomendacoesPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: recomendacoes = [], isLoading } = useRecomendacoes(lojaId ?? undefined);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Recomendações" />;

  const recomendo = recomendacoes.filter((r: any) => r.tipo === "recomendo").length;
  naoRecomendo: { /* */ }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ThumbsUp className="h-6 w-6" /> Recomendações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{recomendacoes.length} recomendações · {recomendo} positivas</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Lista de Recomendações</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : recomendacoes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma recomendação</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-center p-3">Tipo</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Pessoa Recomendada</th>
                  <th className="text-left p-3">Motivo</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-left p-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {recomendacoes.map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-accent">
                    <td className="p-3 text-center">
                      {r.tipo === "recomendo" ? (
                        <Badge variant="default"><ThumbsUp className="h-3 w-3 mr-1" /> Recomendo</Badge>
                      ) : (
                        <Badge variant="destructive"><ThumbsDown className="h-3 w-3 mr-1" /> Não Recomendo</Badge>
                      )}
                    </td>
                    <td className="p-3 text-sm">{r.cliente?.nome_razao ?? "—"}</td>
                    <td className="p-3 text-sm">{r.recomendado?.nome_razao ?? "—"}</td>
                    <td className="p-3 text-sm">{r.motivo ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{r.valor_envolvido ? brl(r.valor_envolvido) : "—"}</td>
                    <td className="p-3 text-sm">{r.data_ocorrencia ? date(r.data_ocorrencia) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ====================================================================
// NOTIFICAÇÕES
// ====================================================================
export function NotificacoesPage() {
  const { user } = useAuth();
  const { data: notificacoes = [], isLoading } = useNotificacoes(user?.id);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Notificações" />;

  const naoLidas = notificacoes.filter((n: any) => !n.lida).length;
  const marcar = useMarcarNotificacaoLida();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Bell className="h-6 w-6" /> Notificações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{naoLidas} não lida(s) de {notificacoes.length} total</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : notificacoes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma notificação</div>
          ) : (
            <div className="divide-y">
              {notificacoes.map((n: any) => (
                <div key={n.id} className={`p-4 flex items-start gap-3 ${!n.lida ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                  <div className={`mt-1 h-2 w-2 rounded-full ${!n.lida ? "bg-red-600" : "bg-transparent"}`} />
                  <div className="flex-1">
                    <p className="font-medium">{n.titulo}</p>
                    <p className="text-sm text-muted-foreground">{n.mensagem}</p>
                    <p className="text-xs text-muted-foreground mt-1">{dateTime(n.created_at)}</p>
                  </div>
                  {!n.lida && (
                    <Button size="sm" variant="ghost" onClick={() => marcar.mutate(n.id)}>
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ====================================================================
// SOLICITAÇÃO DE PARCERIA
// ====================================================================
export function SolicitacaoParceriaPage() {
  const { lojaId } = useAutoSelectLoja();
  const create = useCreateParceria();

  const [form, setForm] = useState({
    tipo_parceria: "fornecedor", nome_empresa: "", cnpj: "",
    contato_nome: "", contato_email: "", contato_telefone: "",
    mensagem: "",
  });
  const [enviado, setEnviado] = useState(false);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Solicitação de Parceria" />;

  const handleEnviar = async () => {
    await create.mutateAsync({
      loja_id: lojaId ?? null,
      ...form,
      status: "pendente",
    });
    setEnviado(true);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Briefcase className="h-6 w-6" /> Solicitação de Parceria
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Envie sua proposta de parceria comercial</p>
      </div>

      {enviado ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
            <p className="font-semibold">Solicitação enviada com sucesso!</p>
            <p className="text-sm text-muted-foreground mt-2">Entraremos em contato em até 5 dias úteis.</p>
            <Button className="mt-4" variant="outline" onClick={() => { setEnviado(false); setForm({ tipo_parceria: "fornecedor", nome_empresa: "", cnpj: "", contato_nome: "", contato_email: "", contato_telefone: "", mensagem: "" }); }}>
              Enviar outra
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div>
              <Label>Tipo de Parceria *</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.tipo_parceria} onChange={(e) => setForm({ ...form, tipo_parceria: e.target.value })}>
                <option value="fornecedor">Fornecedor</option>
                <option value="revenda">Revenda</option>
                <option value="franquia">Franquia</option>
                <option value="distrito">Distrito</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome da Empresa *</Label><Input value={form.nome_empresa} onChange={(e) => setForm({ ...form, nome_empresa: e.target.value })} /></div>
              <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></div>
            </div>
            <div><Label>Contato (Nome) *</Label><Input value={form.contato_nome} onChange={(e) => setForm({ ...form, contato_nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.contato_email} onChange={(e) => setForm({ ...form, contato_email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.contato_telefone} onChange={(e) => setForm({ ...form, contato_telefone: e.target.value })} /></div>
            </div>
            <div>
              <Label>Mensagem</Label>
              <textarea
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[120px]"
                value={form.mensagem}
                onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
                placeholder="Descreva sua proposta..."
              />
            </div>
            <Button onClick={handleEnviar} disabled={create.isPending || !form.nome_empresa || !form.contato_nome}>
              {create.isPending ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ====================================================================
// OCORRÊNCIAS / PENDÊNCIAS
// ====================================================================
export function OcorrenciasPage() {
  const { user } = useAuth();
  const { lojaId } = useAutoSelectLoja();
  const { data: ocorrencias = [], isLoading } = useOcorrencias(lojaId ?? undefined);
  const create = useCreateOcorrencia();
  const update = useUpdateOcorrencia();

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tipo: "duvida", titulo: "", descricao: "", prioridade: "media" });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Ocorrências / Pendências" />;

  const abertas = ocorrencias.filter((o: any) => o.status === "aberto").length;
  const emAndamento = ocorrencias.filter((o: any) => o.status === "em_andamento").length;
  const resolvidas = ocorrencias.filter((o: any) => o.status === "resolvido" || o.status === "fechado").length;

  const PRIORIDADE_VARIANT: Record<string, any> = {
    baixa: "outline", media: "default", alta: "destructive", urgente: "destructive",
  };

  const handleCriar = async () => {
    if (!form.titulo || !form.descricao) return;
    await create.mutateAsync({
      loja_id: lojaId ?? null,
      usuario_id: user?.id ?? null,
      tipo: form.tipo,
      titulo: form.titulo,
      descricao: form.descricao,
      prioridade: form.prioridade,
      status: "aberto",
    });
    setModal(false);
    setForm({ tipo: "duvida", titulo: "", descricao: "", prioridade: "media" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6" /> Ocorrências / Pendências
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{ocorrencias.length} ocorrência(s) registrada(s)</p>
        </div>
        <Button onClick={() => setModal(true)}><Plus className="mr-2 h-4 w-4" /> Nova</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Abertas</p><p className="text-2xl font-semibold text-red-600">{abertas}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Em Andamento</p><p className="text-2xl font-semibold text-orange-600">{emAndamento}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Resolvidas</p><p className="text-2xl font-semibold text-green-600">{resolvidas}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : ocorrencias.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma ocorrência</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Título</th>
                  <th className="text-center p-3">Tipo</th>
                  <th className="text-center p-3">Prioridade</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ocorrencias.map((o: any) => (
                  <tr key={o.id} className="border-b hover:bg-accent">
                    <td className="p-3">
                      <p className="font-medium">{o.titulo}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{o.descricao}</p>
                    </td>
                    <td className="p-3 text-center"><Badge variant="outline">{o.tipo}</Badge></td>
                    <td className="p-3 text-center"><Badge variant={PRIORIDADE_VARIANT[o.prioridade]}>{o.prioridade}</Badge></td>
                    <td className="p-3 text-center"><Badge variant={o.status === "aberto" ? "destructive" : o.status === "em_andamento" ? "outline" : "default"}>{o.status}</Badge></td>
                    <td className="p-3 text-xs">{date(o.created_at)}</td>
                    <td className="p-3 text-center">
                      {o.status === "aberto" && (
                        <Button size="sm" variant="outline" onClick={() => update.mutate({ id: o.id, status: "em_andamento" })}>
                          Assumir
                        </Button>
                      )}
                      {(o.status === "aberto" || o.status === "em_andamento") && (
                        <Button size="sm" variant="ghost" className="ml-1" onClick={() => update.mutate({ id: o.id, status: "resolvido", data_resolucao: new Date().toISOString() })}>
                          <CheckCircle className="h-3 w-3" />
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

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Ocorrência</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
            <div>
              <Label>Tipo</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="suporte">Suporte</option>
                <option value="duvida">Dúvida</option>
                <option value="problema">Problema</option>
                <option value="sugestao">Sugestão</option>
              </select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <Label>Descrição *</Label>
              <textarea className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[100px]" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={!form.titulo || !form.descricao}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====================================================================
// CONFIGURAÇÕES GERAIS
// ====================================================================
export function ConfiguracoesGeraisPage() {
  const { data: configs = [], isLoading } = useConfiguracoesGerais();
  const upsert = useUpsertConfiguracao();

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Configurações Gerais" />;

  const categorias = Array.from(new Set(configs.map((c: any) => c.categoria ?? "Outros")));

  const handleSalvar = async (c: any, novoValor: string) => {
    if (novoValor === c.valor) return;
    await upsert.mutateAsync({ id: c.id, chave: c.chave, valor: novoValor, categoria: c.categoria });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" /> Configurações Gerais
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Parâmetros gerais do sistema</p>
      </div>

      {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : categorias.map((cat) => (
        <Card key={String(cat)}>
          <CardHeader><CardTitle>{String(cat)}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {configs.filter((c: any) => (c.categoria ?? "Outros") === cat).map((c: any) => (
              <div key={c.id} className="grid grid-cols-3 gap-3 items-end border-b pb-3">
                <div>
                  <Label className="text-xs font-mono">{c.chave}</Label>
                  {c.descricao && <p className="text-xs text-muted-foreground">{c.descricao}</p>}
                </div>
                <Input
                  defaultValue={c.valor ?? ""}
                  onBlur={(e) => handleSalvar(c, e.target.value)}
                />
                <span className="text-xs text-muted-foreground">{c.tipo}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ====================================================================
// CONFIGURAÇÕES SEFAZ
// ====================================================================
export function ConfiguracoesSefazPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: dados } = useConfiguracoesSefaz(lojaId ?? undefined);
  const upsert = useUpsertConfiguracaoSefaz();

  const [form, setForm] = useState<any>(null);

  if (dados && !form) setForm(dados);
  if (!dados && !form && lojaId) {
    setForm({ loja_id: lojaId, ambiente: "homologacao", uf: "SP", serie_nfe: 1, serie_nfce: 1, numeracao_atual_nfe: 1, numeracao_atual_nfce: 1, timezone: "America/Sao_Paulo", timeout_segundos: 30 });
  }

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Configurações SEFAZ" />;

  const handleSalvar = async () => {
    if (!form) return;
    await upsert.mutateAsync(form);
    alert("Configurações SEFAZ salvas!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" /> Configurações SEFAZ
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Integração para NF-e/NFC-e</p>
      </div>

      {form && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ambiente</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.ambiente} onChange={(e) => setForm({ ...form, ambiente: e.target.value })}>
                  <option value="homologacao">Homologação</option>
                  <option value="producao">Produção</option>
                </select>
              </div>
              <div><Label>UF</Label><Input maxLength={2} value={form.uf ?? ""} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Série NF-e</Label><Input type="number" value={form.serie_nfe ?? 1} onChange={(e) => setForm({ ...form, serie_nfe: parseInt(e.target.value) })} /></div>
              <div><Label>Série NFC-e</Label><Input type="number" value={form.serie_nfce ?? 1} onChange={(e) => setForm({ ...form, serie_nfce: parseInt(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Numeração Atual NF-e</Label><Input type="number" value={form.numeracao_atual_nfe ?? 1} onChange={(e) => setForm({ ...form, numeracao_atual_nfe: parseInt(e.target.value) })} /></div>
              <div><Label>Numeração Atual NFC-e</Label><Input type="number" value={form.numeracao_atual_nfce ?? 1} onChange={(e) => setForm({ ...form, numeracao_atual_nfce: parseInt(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CSC ID</Label><Input value={form.csc_id ?? ""} onChange={(e) => setForm({ ...form, csc_id: e.target.value })} /></div>
              <div><Label>CSC Token</Label><Input type="password" value={form.csc_token ?? ""} onChange={(e) => setForm({ ...form, csc_token: e.target.value })} /></div>
            </div>
            <Button onClick={handleSalvar} disabled={upsert.isPending}>
              {upsert.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ====================================================================
// CERTIFICADO DIGITAL (NF-e)
// ====================================================================
export function NfeCertificadoPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: certificados = [], isLoading } = useCertificados(lojaId ?? undefined);
  const create = useCreateCertificado();
  const del = useDeleteCertificado();

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    tipo: "A1", nome: "", titular: "", cnpj_cpf: "",
    data_validade: "", emissor: "", numero_serie: "",
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Certificado Digital" />;

  const ativos = certificados.filter((c: any) => c.ativo).length;
  const vencendo = certificados.filter((c: any) => {
    if (!c.data_validade) return false;
    const dias = Math.floor((new Date(c.data_validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return dias >= 0 && dias <= 30;
  });

  const handleCriar = async () => {
    if (!lojaId || !form.titular || !form.cnpj_cpf || !form.data_validade) return;
    await create.mutateAsync({
      loja_id: lojaId,
      ...form,
      ativo: true,
    });
    setModal(false);
    setForm({ tipo: "A1", nome: "", titular: "", cnpj_cpf: "", data_validade: "", emissor: "", numero_serie: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Lock className="h-6 w-6" /> Certificado Digital
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de certificados A1/A3</p>
        </div>
        <Button onClick={() => setModal(true)}><Plus className="mr-2 h-4 w-4" /> Novo Certificado</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Ativos</p><p className="text-2xl font-semibold">{ativos}</p></CardContent></Card>
        <Card className={vencendo.length > 0 ? "border-orange-500" : ""}>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Vencendo (30 dias)</p>
            <p className={`text-2xl font-semibold ${vencendo.length > 0 ? "text-orange-600" : ""}`}>{vencendo.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : certificados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum certificado cadastrado</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-center p-3">Tipo</th>
                  <th className="text-left p-3">Titular</th>
                  <th className="text-left p-3">CNPJ/CPF</th>
                  <th className="text-left p-3">Emissor</th>
                  <th className="text-left p-3">Validade</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {certificados.map((c: any) => (
                  <tr key={c.id} className="border-b hover:bg-accent">
                    <td className="p-3 text-center"><Badge variant="outline">{c.tipo}</Badge></td>
                    <td className="p-3 font-medium">{c.titular}</td>
                    <td className="p-3 font-mono text-xs">{c.cnpj_cpf}</td>
                    <td className="p-3 text-sm">{c.emissor ?? "—"}</td>
                    <td className="p-3 text-sm">{date(c.data_validade)}</td>
                    <td className="p-3 text-center"><Badge variant={c.ativo ? "default" : "outline"}>{c.ativo ? "Ativo" : "Inativo"}</Badge></td>
                    <td className="p-3 text-center">
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(c.id); }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Certificado</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                  <option value="A1">A1 (Arquivo)</option>
                  <option value="A3">A3 (Token/Cartão)</option>
                </select>
              </div>
              <div><Label>Nome (Apelido)</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            </div>
            <div><Label>Titular *</Label><Input value={form.titular} onChange={(e) => setForm({ ...form, titular: e.target.value })} /></div>
            <div><Label>CNPJ/CPF *</Label><Input value={form.cnpj_cpf} onChange={(e) => setForm({ ...form, cnpj_cpf: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Emissor</Label><Input value={form.emissor} onChange={(e) => setForm({ ...form, emissor: e.target.value })} /></div>
              <div><Label>Nº Série</Label><Input value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} /></div>
            </div>
            <div><Label>Data Validade *</Label><Input type="date" value={form.data_validade} onChange={(e) => setForm({ ...form, data_validade: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={create.isPending || !form.titular || !form.cnpj_cpf || !form.data_validade}>{create.isPending ? "Salvando..." : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
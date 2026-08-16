// ============================================================
// Página: Notas Fiscais (NF-e / NFC-e)
// Lista NFs emitidas, mostra vínculo com certificado digital,
// permite visualizar detalhes e fazer download do XML/PDF.
// ============================================================

import { useState } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Loader2, Filter, Download, Eye,
  CheckCircle2, Clock, XCircle, Shield,
} from "lucide-react";
import {
  useNotasFiscais, useNotasFiscaisVendaIds, useVendas, useEmitirNFeVenda, isSupabaseConfigured, supabase,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date, dateTime } from "@/lib/format";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

export function NotasFiscaisPage() {
  const { lojaId } = useAutoSelectLoja();
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const { data: notas = [], isLoading } = useNotasFiscais({
    lojaId: lojaId ?? undefined,
    tipo: filtroTipo || undefined,
    status: filtroStatus || undefined,
  });

  const [modalDetalhes, setModalDetalhes] = useState<any | null>(null);
  const [modalEmitir, setModalEmitir] = useState(false);
  const [vendaSelecionada, setVendaSelecionada] = useState("");
  const emitir = useEmitirNFeVenda();
  const { data: vendas = [] } = useVendas({ lojaId: lojaId ?? undefined });
  // TODAS as notas com venda vinculada (sem filtro de status/tipo, sem limit):
  // a lista filtrada acima não serve para saber quais vendas já têm NF-e
  const { data: todasNotasVendaIds = [] } = useNotasFiscaisVendaIds(lojaId ?? undefined);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Notas Fiscais" />;

  // Vendas finalizadas que ainda não têm NF-e vinculada
  const notasVendaIds = new Set(todasNotasVendaIds);
  const vendasSemNota = vendas.filter((v: any) => v.status === "finalizada" && !notasVendaIds.has(v.id));

  const handleEmitir = async (tipo: "nfe" | "nfce" = "nfe") => {
    if (!vendaSelecionada || !lojaId) return;
    const rotulo = tipo === "nfce" ? "NFC-e" : "NF-e";
    try {
      const r = await emitir.mutateAsync({ venda_id: vendaSelecionada, loja_id: lojaId, tipo });
      toast.success(`${rotulo} nº ${r.numero} autorizada! Protocolo ${r.protocolo}${r.ambiente !== "producao" ? " (HOMOLOGAÇÃO — sem valor fiscal)" : ""}`);
      setModalEmitir(false);
      setVendaSelecionada("");
    } catch (e: any) {
      toast.error(e.message, { duration: 10000 });
    }
  };

  const STATUS_VARIANT: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
    autorizada: "default",
    cancelada: "destructive",
    denegada: "destructive",
    rejeitada: "destructive",
    pendente: "outline",
    processando: "secondary",
  };

  const STATUS_ICON: Record<string, any> = {
    autorizada: CheckCircle2,
    cancelada: XCircle,
    denegada: XCircle,
    rejeitada: XCircle,
    pendente: Clock,
    processando: Loader2,
  };

  const total = notas.reduce((s, n: any) => s + Number(n.valor_total ?? 0), 0);
  const autorizadas = notas.filter((n: any) => n.status === "autorizada").length;
  const pendentes = notas.filter((n: any) => ["pendente", "processando"].includes(n.status)).length;

  const handleDownloadXML = async (nota: any) => {
    // Notas novas: XML autorizado no bucket fiscal
    if (nota.xml_path) {
      const { data, error } = await supabase.storage.from("fiscal").download(nota.xml_path);
      if (error || !data) { toast.error("Falha ao baixar XML do storage"); return; }
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NFe_${nota.chave_acesso ?? nota.numero}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (!nota.xml_assinado) {
      toast.error("XML não disponível");
      return;
    }
    const blob = new Blob([nota.xml_assinado], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NFe_${nota.numero}_${nota.serie}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = async (nota: any) => {
    // Notas novas: DANFE no bucket fiscal
    if (nota.danfe_path) {
      const { data, error } = await supabase.storage.from("fiscal").download(nota.danfe_path);
      if (error || !data) { toast.error("Falha ao baixar DANFE"); return; }
      const url = URL.createObjectURL(data);
      window.open(url, "_blank");
      return;
    }
    if (!nota.pdf_url) {
      toast.error("PDF não disponível");
      return;
    }
    // Se for URL do storage, baixar; senão, abrir em nova aba
    if (nota.pdf_url.startsWith("http")) {
      window.open(nota.pdf_url, "_blank");
    } else {
      toast.info("DANFE em desenvolvimento");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6" /> Notas Fiscais
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {notas.length} nota(s) emitida(s) pela loja atual
          </p>
        </div>
        <Button onClick={() => setModalEmitir(true)}>
          <FileText className="mr-2 h-4 w-4" /> Emitir NF-e
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Total Emitidas</p>
            <p className="text-2xl font-semibold">{notas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Autorizadas</p>
            <p className="text-2xl font-semibold text-green-600">{autorizadas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Pendentes</p>
            <p className="text-2xl font-semibold text-orange-600">{pendentes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Valor Total</p>
            <p className="text-2xl font-semibold">{brl(total)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Notas Emitidas</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                className="h-9 rounded border border-input bg-transparent px-2 text-sm"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
              >
                <option value="">Todos tipos</option>
                <option value="nfe">NF-e (modelo 55)</option>
                <option value="nfce">NFC-e (modelo 65)</option>
                <option value="cfe">CF-e</option>
              </select>
              <select
                className="h-9 rounded border border-input bg-transparent px-2 text-sm"
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
              >
                <option value="">Todos status</option>
                <option value="autorizada">Autorizada</option>
                <option value="cancelada">Cancelada</option>
                <option value="denegada">Denegada</option>
                <option value="rejeitada">Rejeitada</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : notas.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Nenhuma nota fiscal emitida ainda</p>
              <p className="text-xs text-muted-foreground">
                As notas serão geradas automaticamente ao concluir vendas no PDV
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notas.map((n: any) => {
                const StatusIcon = STATUS_ICON[n.status] ?? FileText;
                return (
                  <div key={n.id} className="p-4 hover:bg-accent">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          n.status === "autorizada" ? "bg-green-100 text-green-700" :
                          n.status === "cancelada" || n.status === "denegada" || n.status === "rejeitada" ? "bg-red-100 text-red-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          <StatusIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-mono font-semibold">#{n.numero}/{n.serie}</p>
                            <Badge variant="outline">{n.tipo?.toUpperCase()}</Badge>
                            <Badge variant={n.ambiente === "producao" ? "default" : "secondary"}>
                              {n.ambiente === "producao" ? "Produção" : "Homologação"}
                            </Badge>
                            <Badge variant={STATUS_VARIANT[n.status]}>{n.status}</Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Data Emissão</p>
                              <p>{dateTime(n.data_emissao)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Valor</p>
                              <p className="font-semibold">{brl(n.valor_total)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Protocolo</p>
                              <p className="font-mono text-xs">{n.protocolo ?? "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Chave</p>
                              <p className="font-mono text-xs truncate" title={n.chave_acesso}>
                                {n.chave_acesso ? `${n.chave_acesso.slice(0, 20)}...` : "—"}
                              </p>
                            </div>
                          </div>
                          {n.consumidor_nome && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Destinatário: {n.consumidor_nome} {n.consumidor_cpf_cnpj && `(${n.consumidor_cpf_cnpj})`}
                            </p>
                          )}
                          {n.certificado_id && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              <Shield className="h-3 w-3" /> Assinada com certificado digital
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setModalDetalhes(n)} title="Ver detalhes">
                          <Eye className="h-3 w-3" />
                        </Button>
                        {(n.xml_assinado || n.xml_path) && (
                          <Button size="sm" variant="ghost" onClick={() => handleDownloadXML(n)} title="Baixar XML">
                            <Download className="h-3 w-3" />
                          </Button>
                        )}
                        {(n.pdf_url || n.danfe_path) && (
                          <Button size="sm" variant="ghost" onClick={() => handleDownloadPDF(n)} title="Ver DANFE">
                            <FileText className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Emissão */}
      <Dialog open={modalEmitir} onOpenChange={setModalEmitir}>
        <DialogContent>
          <DialogHeader><DialogTitle>Emitir documento fiscal da venda</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-sm mb-1 font-medium">Venda finalizada (sem nota) *</p>
              <select
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                value={vendaSelecionada}
                onChange={(e) => setVendaSelecionada(e.target.value)}
              >
                <option value="">Selecione...</option>
                {vendasSemNota.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    #{v.numero_pedido ?? v.id.slice(0, 8)} — {date(v.data_venda)} — {brl(v.total)}
                    {v.cliente?.nome_razao ? ` — ${v.cliente.nome_razao}` : ""}
                  </option>
                ))}
              </select>
              {vendasSemNota.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Nenhuma venda finalizada sem nota.</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              A emissão é <strong>real</strong>: a nota é transmitida à SEFAZ no ambiente configurado
              ({"homologação"} até a virada de produção). Requisitos: certificado A1 ativo, SEFAZ
              configurada e NCM em todos os produtos da venda.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>NFC-e (modelo 65)</strong> é o cupom do varejo presencial: dispensa endereço e
            aceita consumidor não identificado, mas exige o CSC cadastrado em Configurações SEFAZ.
            <strong> NF-e (modelo 55)</strong> exige CPF/CNPJ e endereço completo do cliente.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setModalEmitir(false)}>Cancelar</Button>
            <Button
              variant="secondary"
              onClick={() => handleEmitir("nfce")}
              disabled={emitir.isPending || !vendaSelecionada}
            >
              {emitir.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Transmitindo...</> : "Emitir NFC-e"}
            </Button>
            <Button onClick={() => handleEmitir("nfe")} disabled={emitir.isPending || !vendaSelecionada}>
              {emitir.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Transmitindo...</> : "Emitir NF-e"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes */}
      <Dialog open={!!modalDetalhes} onOpenChange={(open) => !open && setModalDetalhes(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {modalDetalhes && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  NF-e #{modalDetalhes.numero}/{modalDetalhes.serie}
                </DialogTitle>
                <DialogClose />
              </DialogHeader>
              <div className="space-y-4 text-sm">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[modalDetalhes.status]}>
                    {STATUS_ICON[modalDetalhes.status] && (
                      <span className="mr-1">●</span>
                    )}
                    {modalDetalhes.status}
                  </Badge>
                  <Badge variant="outline">{modalDetalhes.tipo?.toUpperCase()}</Badge>
                  <Badge variant={modalDetalhes.ambiente === "producao" ? "default" : "secondary"}>
                    {modalDetalhes.ambiente}
                  </Badge>
                </div>

                {/* Dados */}
                <div className="grid grid-cols-2 gap-3 bg-muted p-3 rounded">
                  <div>
                    <p className="text-xs text-muted-foreground">Data Emissão</p>
                    <p className="font-medium">{dateTime(modalDetalhes.data_emissao)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor Total</p>
                    <p className="font-medium text-lg">{brl(modalDetalhes.valor_total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Protocolo</p>
                    <p className="font-mono text-xs">{modalDetalhes.protocolo ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo Emissão</p>
                    <p className="font-mono text-xs">{modalDetalhes.tipo_emissao ?? 1}</p>
                  </div>
                </div>

                {/* Chave de Acesso */}
                <div>
                  <p className="text-xs text-muted-foreground">Chave de Acesso</p>
                  <p className="font-mono text-xs break-all bg-muted p-2 rounded">{modalDetalhes.chave_acesso}</p>
                </div>

                {/* Destinatário */}
                {modalDetalhes.consumidor_nome && (
                  <div>
                    <p className="text-xs text-muted-foreground">Destinatário</p>
                    <p className="font-medium">{modalDetalhes.consumidor_nome}</p>
                    {modalDetalhes.consumidor_cpf_cnpj && (
                      <p className="text-xs text-muted-foreground font-mono">{modalDetalhes.consumidor_cpf_cnpj}</p>
                    )}
                    {modalDetalhes.consumidor_email && (
                      <p className="text-xs text-muted-foreground">{modalDetalhes.consumidor_email}</p>
                    )}
                  </div>
                )}

                {/* Valores detalhados */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-muted p-2 rounded">
                    <p className="text-muted-foreground">Desconto</p>
                    <p className="font-semibold">{brl(modalDetalhes.valor_desconto ?? 0)}</p>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <p className="text-muted-foreground">Frete</p>
                    <p className="font-semibold">{brl(modalDetalhes.valor_frete ?? 0)}</p>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <p className="text-muted-foreground">Seguro</p>
                    <p className="font-semibold">{brl(modalDetalhes.valor_seguro ?? 0)}</p>
                  </div>
                </div>

                {/* Certificado */}
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-semibold text-green-900 dark:text-green-200">
                      Assinada com Certificado Digital
                    </p>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    {modalDetalhes.certificado_id
                      ? `Certificado ID: ${modalDetalhes.certificado_id.slice(0, 8)}...`
                      : "Certificado vinculado a esta nota fiscal"}
                  </p>
                </div>

                {/* Cancelamento */}
                {modalDetalhes.status === "cancelada" && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded p-3">
                    <p className="text-sm font-semibold text-red-900 dark:text-red-200">Cancelada</p>
                    {modalDetalhes.data_cancelamento && (
                      <p className="text-xs">Data: {dateTime(modalDetalhes.data_cancelamento)}</p>
                    )}
                    {modalDetalhes.motivo_cancelamento && (
                      <p className="text-xs">Motivo: {modalDetalhes.motivo_cancelamento}</p>
                    )}
                  </div>
                )}

                {/* Observações */}
                {modalDetalhes.observacoes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Observações</p>
                    <p className="text-xs bg-muted p-2 rounded">{modalDetalhes.observacoes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
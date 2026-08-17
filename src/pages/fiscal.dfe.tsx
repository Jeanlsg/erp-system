// ============================================================
// Página: Distribuição DF-e — notas emitidas contra o nosso CNPJ
//
// A SEFAZ guarda toda NF-e que um fornecedor emitiu para a gente, mesmo que
// ele nunca mande o XML. Esta tela é o outro lado do importador manual:
// em vez de esperar o arquivo chegar, busca no canal oficial.
//
// O detalhe que muda tudo na operação: sem manifestar, a SEFAZ entrega só o
// RESUMO (cabeçalho e valor). Os itens — e portanto o custo real de cada
// produto — só vêm depois da ciência da operação.
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, CheckCircle2, Download, FileSearch, Loader2,
  RefreshCw, Radio, ShieldQuestion, XCircle,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {
  useLojas, useDfePendentes, useDfeStatus, useDfeConsultas,
  useSincronizarDfe, useManifestarDfe, useBaixarNfePorChave,
} from "@/lib/supabase-queries";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, dateTime } from "@/lib/format";
import { toast } from "sonner";

type TipoManifestacao = "ciencia" | "confirmacao" | "desconhecimento" | "nao_realizada";

const MANIFESTACOES: Record<TipoManifestacao, { label: string; ajuda: string; destrutivo?: boolean }> = {
  ciencia: {
    label: "Ciência da operação",
    ajuda: "Diz apenas que você viu a nota. É o passo que libera o XML completo com os itens, e não compromete nada.",
  },
  confirmacao: {
    label: "Confirmar operação",
    ajuda: "Declara que a mercadoria foi recebida e a operação ocorreu como descrita. É definitivo e não pode ser desfeito.",
  },
  desconhecimento: {
    label: "Desconhecer operação",
    ajuda: "Declara à SEFAZ que a empresa não reconhece esta nota — use quando emitiram contra o seu CNPJ indevidamente.",
    destrutivo: true,
  },
  nao_realizada: {
    label: "Operação não realizada",
    ajuda: "A nota é sua, mas a operação não aconteceu (recusa de mercadoria, devolução na entrega). Exige justificativa.",
    destrutivo: true,
  },
};

export function FiscalDfePage() {
  const navigate = useNavigate();
  const { data: lojas = [] } = useLojas();
  const [lojaId, setLojaId] = useState<string>("");
  const lojaAtual = lojaId || lojas[0]?.id || "";

  const { data: pendentes = [], isLoading } = useDfePendentes(lojaAtual || undefined);
  const { data: statusNsu = [] } = useDfeStatus();
  const { data: consultas = [] } = useDfeConsultas(lojaAtual || undefined, 10);

  const sincronizar = useSincronizarDfe();
  const manifestar = useManifestarDfe();
  const baixarChave = useBaixarNfePorChave();

  const [chave, setChave] = useState("");
  const [alvo, setAlvo] = useState<{ nota: any; tipo: TipoManifestacao } | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [abrindo, setAbrindo] = useState<string | null>(null);

  // O XML fica fora da listagem de propósito — são dezenas de KB por nota, e
  // só a que vai ser conferida precisa dele.
  async function abrirConferencia(nota: any) {
    setAbrindo(nota.id);
    try {
      const { data, error } = await supabase
        .schema("erp")
        .from("erp_nfe_entrada")
        .select("xml_original")
        .eq("id", nota.id)
        .single();
      if (error) throw error;
      if (!data?.xml_original) {
        toast.error("esta nota ainda não tem o XML completo");
        return;
      }
      navigate("/compras/importar-nfe", {
        state: { xmlDfe: data.xml_original, nfeEntradaId: nota.id },
      });
    } catch (e: any) {
      toast.error(`falha ao abrir o XML: ${e.message}`);
    } finally {
      setAbrindo(null);
    }
  }

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured />;

  const ctrl = statusNsu.find((s: any) => s.loja_id === lojaAtual);
  const bloqueadoAte = ctrl?.proxima_consulta_em ? new Date(ctrl.proxima_consulta_em) : null;
  const bloqueado = !!bloqueadoAte && bloqueadoAte > new Date();
  const semItens = pendentes.filter((n: any) => n.resumo).length;

  async function handleSincronizar() {
    try {
      const r: any = await sincronizar.mutateAsync({ loja_id: lojaAtual });
      if (r?.ok === false) {
        toast.error(r.erro ?? "a SEFAZ recusou a consulta", { description: r.cstat ? `cStat ${r.cstat}` : undefined });
        return;
      }
      toast.success(
        r.novos > 0 ? `${r.novos} nota(s) nova(s)` : "nenhuma nota nova",
        {
          description: r.aguardando_manifestacao
            ? `${r.aguardando_manifestacao} aguardando manifestação para liberar os itens`
            : `NSU ${r.ult_nsu} de ${r.max_nsu}`,
        },
      );
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleBaixarChave() {
    const limpa = chave.replace(/\D/g, "");
    if (limpa.length !== 44) {
      toast.error("a chave de acesso tem 44 dígitos");
      return;
    }
    try {
      const r: any = await baixarChave.mutateAsync({ loja_id: lojaAtual, chave: limpa });
      if (r?.ok === false) {
        toast.error(r.erro, { description: r.dica ?? undefined });
        return;
      }
      toast.success(r.novos > 0 ? "nota importada" : "nota já estava no ERP");
      setChave("");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function confirmarManifestacao() {
    if (!alvo) return;
    try {
      const r: any = await manifestar.mutateAsync({
        nfe_entrada_id: alvo.nota.id,
        tipo: alvo.tipo,
        justificativa: justificativa || undefined,
      });
      toast.success(
        r.ja_existia ? "manifestação já constava na SEFAZ" : "manifestação registrada",
        { description: r.xml_completo ? "XML completo recebido — a nota já pode ser conferida" : r.aviso ?? undefined },
      );
      setAlvo(null);
      setJustificativa("");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notas recebidas da SEFAZ</h1>
        <p className="text-sm text-muted-foreground">
          Toda NF-e emitida contra o CNPJ da loja, direto do canal oficial — sem depender de o fornecedor mandar o XML.
        </p>
      </div>

      {lojas.length > 1 && (
        <div className="w-72">
          <Label className="text-xs">Loja</Label>
          <Select value={lojaAtual} onValueChange={setLojaId}>
            <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
            <SelectContent>
              {lojas.map((l: any) => (
                <SelectItem key={l.id} value={l.id}>{l.nome} — {l.uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Estado do canal. O NSU é a memória da varredura: sem ele, ou se
          reprocessa tudo ou se pula documento. */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Radio className="h-4 w-4" /> Canal da SEFAZ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="text-muted-foreground">
              NSU lido <span className="font-medium text-foreground">{ctrl?.ult_nsu ?? 0}</span>
              {" de "}
              <span className="font-medium text-foreground">{ctrl?.max_nsu ?? 0}</span>
            </div>
            <div className="text-muted-foreground">
              Última consulta: {ctrl?.ultima_consulta_em ? dateTime(ctrl.ultima_consulta_em) : "nunca"}
            </div>
            {ctrl?.ultimo_motivo && (
              <div className="text-xs text-muted-foreground">
                {ctrl.ultimo_cstat} — {ctrl.ultimo_motivo}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aguardando manifestação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{semItens}</div>
            <p className="text-xs text-muted-foreground">
              Chegaram só com cabeçalho e valor. Os itens vêm depois da ciência.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Prontas para conferir</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{pendentes.length - semItens}</div>
            <p className="text-xs text-muted-foreground">Com XML completo e ainda sem compra vinculada.</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Button onClick={handleSincronizar} disabled={!lojaAtual || sincronizar.isPending}>
          {sincronizar.isPending
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <RefreshCw className="mr-2 h-4 w-4" />}
          Buscar novas notas
        </Button>

        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Ou baixe uma nota pela chave</Label>
            <Input
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              placeholder="44 dígitos da chave de acesso"
              className="w-96 font-mono text-xs"
            />
          </div>
          <Button variant="outline" onClick={handleBaixarChave} disabled={!lojaAtual || baixarChave.isPending}>
            {baixarChave.isPending
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Download className="mr-2 h-4 w-4" />}
            Baixar
          </Button>
        </div>
      </div>

      {/* O limite é da SEFAZ, não nosso: consulta sem novidade só é aceita
          uma vez por hora, e insistir devolve "consumo indevido". */}
      {bloqueado && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium">A SEFAZ limita este canal a uma consulta por hora sem novidade.</p>
              <p className="text-muted-foreground">
                Próxima liberada em {dateTime(bloqueadoAte!.toISOString())}. Buscar antes disso devolve
                “consumo indevido” e prolonga o bloqueio.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notas pendentes de conferência</CardTitle>
          <CardDescription>
            Já chegaram da SEFAZ e ainda não viraram compra no ERP.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> carregando…
            </div>
          ) : pendentes.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma nota pendente. Use “Buscar novas notas” para varrer o canal.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Emitente</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentes.map((n: any) => (
                  <TableRow key={n.id}>
                    <TableCell>
                      <div className="font-medium">{n.emitente_nome || "—"}</div>
                      <div className="font-mono text-xs text-muted-foreground">{n.emitente_cnpj}</div>
                      {!n.fornecedor_id && (
                        <span className="text-xs text-amber-600">fornecedor não cadastrado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>nº {n.numero} / série {n.serie}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{n.chave_acesso}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{dateTime(n.data_emissao)}</TableCell>
                    <TableCell className="text-right font-medium">{brl(n.valor_total)}</TableCell>
                    <TableCell>
                      {n.resumo ? (
                        <Badge variant="outline" className="border-amber-400 text-amber-700">
                          só resumo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-400 text-emerald-700">
                          XML completo
                        </Badge>
                      )}
                      {n.tipo_manifestacao && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {MANIFESTACOES[n.tipo_manifestacao as TipoManifestacao]?.label ?? n.tipo_manifestacao}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="space-x-2 text-right whitespace-nowrap">
                      {n.resumo && n.tipo_manifestacao !== "ciencia" && (
                        <Button size="sm" variant="secondary"
                          onClick={() => setAlvo({ nota: n, tipo: "ciencia" })}>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Dar ciência
                        </Button>
                      )}
                      {n.tem_xml_completo && (
                        <Button size="sm" disabled={abrindo === n.id} onClick={() => abrirConferencia(n)}>
                          {abrindo === n.id
                            ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            : <FileSearch className="mr-1 h-3.5 w-3.5" />}
                          Conferir
                        </Button>
                      )}
                      <Button size="sm" variant="ghost"
                        onClick={() => setAlvo({ nota: n, tipo: "desconhecimento" })}
                        title="Não reconheço esta nota">
                        <ShieldQuestion className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => setAlvo({ nota: n, tipo: "nao_realizada" })}
                        title="Operação não realizada">
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {consultas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas varreduras</CardTitle>
            <CardDescription>
              “Não veio nada” e “deu erro” são coisas diferentes — o log guarda a resposta da SEFAZ.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Resposta</TableHead>
                  <TableHead className="text-right">Docs</TableHead>
                  <TableHead className="text-right">Novos</TableHead>
                  <TableHead className="text-right">NSU</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultas.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap">{dateTime(c.created_at)}</TableCell>
                    <TableCell>{c.origem}</TableCell>
                    <TableCell className="text-xs">{c.cstat} — {c.motivo}</TableCell>
                    <TableCell className="text-right">{c.documentos}</TableCell>
                    <TableCell className="text-right">{c.novos}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{c.ult_nsu}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Manifestar é declarar algo à SEFAZ. Confirmação, desconhecimento e
          "não realizada" não têm volta, então cada uma explica o que significa
          antes de ser enviada. */}
      <Dialog open={!!alvo} onOpenChange={(o) => { if (!o) { setAlvo(null); setJustificativa(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{alvo ? MANIFESTACOES[alvo.tipo].label : ""}</DialogTitle>
            <DialogDescription>{alvo ? MANIFESTACOES[alvo.tipo].ajuda : ""}</DialogDescription>
          </DialogHeader>

          {alvo && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-muted p-3">
                <div className="font-medium">{alvo.nota.emitente_nome}</div>
                <div className="text-muted-foreground">
                  nota {alvo.nota.numero} · {brl(alvo.nota.valor_total)}
                </div>
              </div>

              {alvo.tipo === "nao_realizada" && (
                <div>
                  <Label className="text-xs">Justificativa (mínimo 15 caracteres, exigido pela SEFAZ)</Label>
                  <Textarea
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    rows={3}
                    placeholder="Ex.: mercadoria recusada no recebimento por avaria na embalagem"
                  />
                </div>
              )}

              {MANIFESTACOES[alvo.tipo].destrutivo && (
                <p className="flex items-start gap-2 text-xs text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Esta declaração fica registrada na SEFAZ e não pode ser desfeita.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAlvo(null); setJustificativa(""); }}>
              Cancelar
            </Button>
            <Button
              variant={alvo && MANIFESTACOES[alvo.tipo].destrutivo ? "destructive" : "default"}
              onClick={confirmarManifestacao}
              disabled={manifestar.isPending
                || (alvo?.tipo === "nao_realizada" && justificativa.trim().length < 15)}
            >
              {manifestar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar à SEFAZ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

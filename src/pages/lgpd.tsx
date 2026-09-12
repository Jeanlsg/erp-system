// ============================================================
// Exclusão de Informações (LGPD Art. 18) — fila de verdade.
//
// A tela anterior fazia `confirm()` e em seguida um toast verde dizendo
// "Solicitação de exclusão registrada, prazo de 15 dias" — sem gravar
// nada. Nenhuma fila, nenhum status, nenhum rastro ao recarregar. Numa
// obrigação legal com prazo isso é pior que a tela não existir.
//
// POR QUE ANONIMIZA EM VEZ DE APAGAR: apagar a pessoa é impossível e
// seria ilegal. Impossível porque erp_vendas e erp_contas apontam para
// erp_pessoas com ON DELETE RESTRICT — justamente o titular que comprou
// é o que o banco recusa apagar (verificado: o DELETE volta com erro de
// chave estrangeira). Ilegal porque a nota fiscal tem guarda obrigatória
// de 5 anos, e o Art. 16, I da própria LGPD ressalva o cumprimento de
// obrigação legal. Anonimizar atende os dois lados: o fisco mantém a
// venda, o dado pessoal desaparece.
// ============================================================

import { useMemo, useState } from "react";
import {
  Shield, Search, Loader2, ShieldCheck, ShieldX, Clock, TriangleAlert, UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useClientes, useSolicitacoesLgpd, useRegistrarSolicitacaoLgpd,
  useAtenderSolicitacaoLgpd, useRecusarSolicitacaoLgpd, isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { date as fmtData, dateTime } from "@/lib/format";

function diasRestantes(prazo: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const p = new Date(`${prazo}T00:00:00`);
  return Math.round((p.getTime() - hoje.getTime()) / 86400000);
}

export function ExclusaoInformacoesPage() {
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState("pendentes");
  const { data: pessoas = [], isLoading: carregandoPessoas } = useClientes();
  const { data: solicitacoes = [], isLoading: carregandoPedidos } = useSolicitacoesLgpd();
  const registrar = useRegistrarSolicitacaoLgpd();
  const atender = useAtenderSolicitacaoLgpd();
  const recusar = useRecusarSolicitacaoLgpd();

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Exclusão de Informações" />;

  const pendentes = solicitacoes.filter((s: any) => s.status === "pendente");
  const encerradas = solicitacoes.filter((s: any) => s.status !== "pendente");
  const vencidas = pendentes.filter((s: any) => diasRestantes(s.prazo_em) < 0);

  // quem já tem pedido pendente não pode receber outro (índice único no banco)
  const comPedidoPendente = useMemo(
    () => new Set(pendentes.map((s: any) => s.pessoa_id)),
    [pendentes],
  );

  const filtradas = pessoas.filter((p: any) =>
    !busca ||
    p.nome_razao?.toLowerCase().includes(busca.toLowerCase()) ||
    (p.cpf_cnpj ?? "").includes(busca),
  );

  const handleRegistrar = async (pessoa: any) => {
    const ok = confirm(
      `Registrar pedido de exclusão dos dados de "${pessoa.nome_razao}"?\n\n` +
      "Isto ABRE um pedido com prazo de 15 dias (LGPD Art. 18) e não apaga nada agora.\n" +
      "A anonimização só acontece quando alguém clicar em “Atender” na aba Pendentes."
    );
    if (!ok) return;
    try {
      const r: any = await registrar.mutateAsync(pessoa.id);
      if (r?.ok === false) toast.warning(r.mensagem ?? "Já existe pedido pendente para este titular.");
      else toast.success(`Pedido registrado. Prazo para atender: ${fmtData(r.prazo_em)}.`);
    } catch (e: any) {
      toast.error(`Não foi possível registrar: ${e.message ?? e}`);
    }
  };

  const handleAtender = async (s: any) => {
    const ok = confirm(
      `ATENDER o pedido de "${s.nome_titular}"?\n\n` +
      "O que acontece, e é IRREVERSÍVEL:\n" +
      "• nome, CPF/CNPJ, e-mail, telefones, endereço e data de nascimento são apagados\n" +
      "• o cadastro passa a se chamar “Titular anonimizado (LGPD)” e fica inativo\n" +
      "• a agenda telefônica do titular é apagada\n\n" +
      "O que é PRESERVADO, por obrigação fiscal de 5 anos:\n" +
      "• as vendas, as notas fiscais e as contas continuam existindo, sem o dado pessoal\n\n" +
      "Confirmar?"
    );
    if (!ok) return;
    try {
      const r: any = await atender.mutateAsync(s.id);
      toast.success(
        `Pedido atendido por anonimização. Preservados para o fisco: ` +
        `${r.vendas_preservadas} venda(s), ${r.notas_preservadas} nota(s), ${r.contas_preservadas} conta(s).`,
      );
    } catch (e: any) {
      toast.error(`Não foi possível atender: ${e.message ?? e}`);
    }
  };

  const handleRecusar = async (s: any) => {
    const motivo = prompt(
      `Recusar o pedido de "${s.nome_titular}".\n\n` +
      "O titular tem direito à justificativa, então o motivo é obrigatório.\n" +
      "Ex.: “dados necessários para cumprimento de obrigação fiscal (LGPD Art. 16, I)”.",
    );
    if (motivo === null) return;
    if (!motivo.trim()) { toast.error("A recusa exige motivo."); return; }
    try {
      await recusar.mutateAsync({ id: s.id, motivo: motivo.trim() });
      toast.success("Pedido recusado, com o motivo registrado.");
    } catch (e: any) {
      toast.error(`Não foi possível recusar: ${e.message ?? e}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6" /> Exclusão de Informações (LGPD)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fila de pedidos de eliminação de dados pessoais — Lei 13.709/2018, Art. 18
        </p>
      </div>

      {vencidas.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">
                {vencidas.length} pedido(s) com prazo VENCIDO
              </p>
              <p className="text-muted-foreground">
                O prazo legal de 15 dias já passou. Atenda ou recuse com justificativa.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="py-4 text-sm">
          <p className="font-medium">Atender significa anonimizar, não apagar.</p>
          <p className="mt-1 text-muted-foreground">
            A nota fiscal emitida tem guarda obrigatória de 5 anos, e o próprio Art. 16, I da LGPD
            ressalva o cumprimento de obrigação legal. Por isso o atendimento apaga o dado pessoal
            e mantém a venda: o titular deixa de ser identificável e o fisco continua atendido.
          </p>
        </CardContent>
      </Card>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="pendentes">
            Pendentes {pendentes.length > 0 && `(${pendentes.length})`}
          </TabsTrigger>
          <TabsTrigger value="encerradas">
            Histórico {encerradas.length > 0 && `(${encerradas.length})`}
          </TabsTrigger>
          <TabsTrigger value="novo">Registrar pedido</TabsTrigger>
        </TabsList>

        {/* ===== PENDENTES ===== */}
        <TabsContent value="pendentes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pedidos aguardando atendimento</CardTitle>
              <CardDescription>
                Contados da data do pedido; o prazo legal é de 15 dias.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {carregandoPedidos ? (
                <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
              ) : pendentes.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhum pedido pendente. Abra um na aba “Registrar pedido”.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left p-3">Titular</th>
                        <th className="text-left p-3">Documento</th>
                        <th className="text-left p-3">Pedido em</th>
                        <th className="text-left p-3">Prazo</th>
                        <th className="text-left p-3">Registrado por</th>
                        <th className="text-center p-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendentes.map((s: any) => {
                        const dias = diasRestantes(s.prazo_em);
                        return (
                          <tr key={s.id} className="border-b hover:bg-accent/50">
                            <td className="p-3 font-medium">{s.nome_titular}</td>
                            <td className="p-3 font-mono text-xs">{s.documento_titular ?? "—"}</td>
                            <td className="p-3 text-sm">{dateTime(s.solicitado_em)}</td>
                            <td className="p-3 text-sm">
                              <span className={dias < 0 ? "font-medium text-destructive" : dias <= 3 ? "font-medium text-amber-600" : ""}>
                                {fmtData(s.prazo_em)}
                                {dias < 0
                                  ? ` · ${Math.abs(dias)} dia(s) em atraso`
                                  : dias === 0 ? " · vence hoje" : ` · ${dias} dia(s)`}
                              </span>
                            </td>
                            <td className="p-3 text-sm">{s.solicitante?.nome ?? "—"}</td>
                            <td className="p-3">
                              <div className="flex justify-center gap-2">
                                <Button size="sm" variant="destructive"
                                  disabled={atender.isPending}
                                  onClick={() => void handleAtender(s)}>
                                  <UserX className="mr-1 h-3 w-3" /> Atender
                                </Button>
                                <Button size="sm" variant="outline"
                                  disabled={recusar.isPending}
                                  onClick={() => void handleRecusar(s)}>
                                  <ShieldX className="mr-1 h-3 w-3" /> Recusar
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== HISTÓRICO ===== */}
        <TabsContent value="encerradas">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pedidos encerrados</CardTitle>
              <CardDescription>
                O que foi atendido ou recusado, com quem decidiu e quando — é esta a prova a
                apresentar se o titular ou a ANPD questionar.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {encerradas.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhum pedido encerrado ainda.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left p-3">Titular</th>
                        <th className="text-center p-3">Situação</th>
                        <th className="text-left p-3">Decidido em</th>
                        <th className="text-left p-3">Por</th>
                        <th className="text-left p-3">Detalhe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {encerradas.map((s: any) => (
                        <tr key={s.id} className="border-b hover:bg-accent/50">
                          <td className="p-3 font-medium">{s.nome_titular}</td>
                          <td className="p-3 text-center">
                            {s.status === "atendida" ? (
                              <Badge className="gap-1"><ShieldCheck className="h-3 w-3" /> Atendida</Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1"><ShieldX className="h-3 w-3" /> Recusada</Badge>
                            )}
                          </td>
                          <td className="p-3 text-sm">{s.atendido_em ? dateTime(s.atendido_em) : "—"}</td>
                          <td className="p-3 text-sm">{s.atendente?.nome ?? "—"}</td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {s.status === "atendida" && s.resultado
                              ? `anonimizado · preservados ${s.resultado.vendas_preservadas ?? 0} venda(s), ` +
                                `${s.resultado.notas_preservadas ?? 0} nota(s), ${s.resultado.contas_preservadas ?? 0} conta(s)`
                              : s.observacoes ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== REGISTRAR ===== */}
        <TabsContent value="novo">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registrar pedido de um titular</CardTitle>
              <CardDescription>
                Abre o pedido com prazo de 15 dias. Nada é apagado neste passo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou CPF/CNPJ…" className="pl-9"
                  value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>

              {carregandoPessoas ? (
                <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left p-3">Nome</th>
                        <th className="text-left p-3">CPF/CNPJ</th>
                        <th className="text-left p-3">E-mail</th>
                        <th className="text-center p-3">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtradas.length === 0 ? (
                        <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">
                          {busca ? `Nenhum titular encontrado para "${busca}".` : "Nenhum cadastro."}
                        </td></tr>
                      ) : filtradas.slice(0, 50).map((p: any) => (
                        <tr key={p.id} className="border-b hover:bg-accent/50">
                          <td className="p-3 font-medium">{p.nome_razao}</td>
                          <td className="p-3 font-mono text-xs">{p.cpf_cnpj ?? "—"}</td>
                          <td className="p-3 text-sm">{p.email ?? "—"}</td>
                          <td className="p-3 text-center">
                            {comPedidoPendente.has(p.id) ? (
                              <Badge variant="outline" className="gap-1">
                                <Clock className="h-3 w-3" /> pedido pendente
                              </Badge>
                            ) : (
                              <Button size="sm" variant="outline"
                                disabled={registrar.isPending}
                                onClick={() => void handleRegistrar(p)}>
                                Registrar pedido
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtradas.length > 50 && (
                    <p className="p-3 text-xs text-muted-foreground">
                      Mostrando 50 de {filtradas.length} cadastros — use a busca para achar o titular.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

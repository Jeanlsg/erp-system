// ============================================================
// Página: Cartão fidelidade
//
// Os pontos são creditados por gatilho na venda finalizada, não por ação da
// tela: ponto que depende de alguém lembrar de clicar não é programa de
// fidelidade, é promessa quebrada na frente do cliente.
//
// Ponto é passivo — vale dinheiro no resgate. Por isso o acúmulo é uma vez
// por venda, e o extrato guarda cada movimento.
// ============================================================

import { useState } from "react";
import { Award, Gift, Loader2, Sparkles, Star } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

import {
  useCartoesFidelidade, useEmitirCartaoFidelidade, useResgatarPontos,
  useMovimentacoesFidelidade, useClientes, useConfiguracoesGerais,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { isSupabaseConfigured } from "@/lib/supabase";
import { brl, date, dateTime } from "@/lib/format";
import { toast } from "sonner";

const NIVEL: Record<string, { rotulo: string; classe: string; Icone: typeof Star }> = {
  bronze: { rotulo: "Bronze", classe: "border-amber-600/50 text-amber-700", Icone: Star },
  prata:  { rotulo: "Prata",  classe: "border-slate-400 text-slate-600",   Icone: Award },
  ouro:   { rotulo: "Ouro",   classe: "border-yellow-500 text-yellow-700", Icone: Sparkles },
};

export function CartaoFidelidadePage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: cartoes = [], isLoading } = useCartoesFidelidade(lojaId ?? undefined);
  const { data: clientes = [] } = useClientes();
  const { data: config = [] } = useConfiguracoesGerais();

  const emitir = useEmitirCartaoFidelidade();
  const resgatar = useResgatarPontos();

  const [modalEmitir, setModalEmitir] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [alvo, setAlvo] = useState<any>(null);
  const [pontos, setPontos] = useState("");
  const [extrato, setExtrato] = useState<string | null>(null);

  const { data: movimentos = [] } = useMovimentacoesFidelidade(extrato ?? undefined);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Cartão Fidelidade" />;

  const cfg = (chave: string, padrao: string) =>
    config.find((c: any) => c.chave === chave)?.valor ?? padrao;
  const valorPonto = Number(cfg("fidelidade_valor_ponto", "0.05"));
  const porReal = Number(cfg("fidelidade_pontos_por_real", "1"));

  const comCartao = new Set(cartoes.map((c: any) => c.cliente_id));
  const semCartao = clientes.filter((c: any) => !comCartao.has(c.id));

  const saldoTotal = cartoes.reduce((s: number, c: any) => s + Number(c.saldo_pontos || 0), 0);

  async function handleEmitir() {
    if (!lojaId) { toast.error("selecione uma loja"); return; }
    try {
      const r: any = await emitir.mutateAsync({ clienteId, lojaId });
      toast.success(r.ja_existia ? "Cliente já tinha cartão" : `Cartão ${r.numero} emitido`);
      setModalEmitir(false);
      setClienteId("");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleResgatar() {
    try {
      const r: any = await resgatar.mutateAsync({ cartaoId: alvo.id, pontos: Number(pontos) });
      toast.success(`${r.pontos} pontos resgatados`, {
        description: `Desconto de ${brl(r.desconto)} · restam ${r.saldo_restante} pontos`,
      });
      setAlvo(null);
      setPontos("");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Gift className="h-6 w-6" /> Cartão fidelidade
          </h1>
          <p className="text-muted-foreground">
            {porReal} ponto por real gasto · cada ponto vale {brl(valorPonto)} no resgate.
            Ajustável em Configurações do sistema.
          </p>
        </div>
        <Button onClick={() => setModalEmitir(true)} disabled={semCartao.length === 0}>
          <Star className="mr-2 h-4 w-4" /> Emitir cartão
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Cartões ativos</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{cartoes.filter((c: any) => c.ativo).length}</div>
            <p className="text-xs text-muted-foreground">{semCartao.length} cliente(s) sem cartão</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pontos em circulação</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{saldoTotal.toLocaleString("pt-BR")}</div>
            {/* Ponto é passivo: vale dinheiro quando o cliente resgatar. */}
            <p className="text-xs text-muted-foreground">
              equivalem a {brl(saldoTotal * valorPonto)} em desconto futuro
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Clientes ouro</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {cartoes.filter((c: any) => c.nivel === "ouro").length}
            </div>
            <p className="text-xs text-muted-foreground">nível sai do acumulado, não do saldo</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cartões emitidos</CardTitle>
          <CardDescription>
            Os pontos entram sozinhos quando a venda é finalizada — não há passo manual.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> carregando…
            </div>
          ) : cartoes.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum cartão emitido ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cartão</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Acumulado</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cartoes.map((c: any) => {
                  const n = NIVEL[c.nivel] ?? NIVEL.bronze;
                  const vencido = c.data_validade && new Date(c.data_validade) < new Date();
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm">{c.numero_cartao}</TableCell>
                      <TableCell>
                        <div className="font-medium">{c.cliente?.nome_razao ?? "—"}</div>
                        <div className="font-mono text-xs text-muted-foreground">{c.cliente?.cpf_cnpj}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={n.classe}>
                          <n.Icone className="mr-1 h-3 w-3" />{n.rotulo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(c.saldo_pontos || 0).toLocaleString("pt-BR")}
                        <div className="text-xs font-normal text-muted-foreground">
                          {brl(Number(c.saldo_pontos || 0) * valorPonto)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {Number(c.total_pontos_acumulados || 0).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className={vencido ? "text-red-600" : ""}>
                        {c.data_validade ? date(c.data_validade) : "—"}
                        {vencido && <div className="text-xs">vencido</div>}
                      </TableCell>
                      <TableCell className="space-x-2 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost"
                          onClick={() => setExtrato(extrato === c.id ? null : c.id)}>
                          Extrato
                        </Button>
                        <Button size="sm" variant="outline"
                          disabled={!c.saldo_pontos || vencido}
                          onClick={() => { setAlvo(c); setPontos(String(c.saldo_pontos)); }}>
                          Resgatar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {extrato && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Extrato do cartão</CardTitle>
            <CardDescription>Cada movimento fica registrado — ponto vale dinheiro.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {movimentos.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum movimento neste cartão.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Pontos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentos.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap">{dateTime(m.data_movimentacao)}</TableCell>
                      <TableCell>{m.tipo === "acumulo" ? "Acúmulo" : "Resgate"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.motivo}</TableCell>
                      <TableCell className={`text-right font-medium ${Number(m.pontos) < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {Number(m.pontos) > 0 ? "+" : ""}{m.pontos}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={modalEmitir} onOpenChange={setModalEmitir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir cartão fidelidade</DialogTitle>
            <DialogDescription>
              A partir da emissão, as compras do cliente passam a acumular pontos sozinhas.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {semCartao.slice(0, 100).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome_razao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEmitir(false)}>Cancelar</Button>
            <Button onClick={handleEmitir} disabled={!clienteId || emitir.isPending}>
              {emitir.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Emitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!alvo} onOpenChange={(o) => { if (!o) { setAlvo(null); setPontos(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resgatar pontos</DialogTitle>
            <DialogDescription>
              {alvo?.cliente?.nome_razao} · saldo de {alvo?.saldo_pontos} pontos
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Pontos a resgatar</Label>
            <Input type="number" min={1} max={alvo?.saldo_pontos ?? 0} value={pontos}
              onChange={(e) => setPontos(e.target.value)} />
            <p className="mt-2 text-sm text-muted-foreground">
              Vale {brl((Number(pontos) || 0) * valorPonto)} de desconto.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAlvo(null); setPontos(""); }}>Cancelar</Button>
            <Button onClick={handleResgatar}
              disabled={resgatar.isPending || !pontos || Number(pontos) < 1
                || Number(pontos) > Number(alvo?.saldo_pontos ?? 0)}>
              {resgatar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Resgatar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

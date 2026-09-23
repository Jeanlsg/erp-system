// ============================================================
// Detalhes de um turno de caixa.
//
// O histórico de caixas listava os turnos e não abria nenhum: a linha
// mudava de cor no hover e não acontecia nada. Quem precisava conferir um
// fechamento — a diferença de ontem, quem sangrou quanto — não tinha por
// onde. O hook useCaixaPorId já existia e nunca tinha sido usado.
//
// Mostra o turno inteiro e reimprime o comprovante térmico, que é o mesmo
// do fechamento: conferir depois tem de dar no mesmo papel de antes.
// ============================================================

import { useMemo, useState } from "react";
import { Loader2, Printer, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  useCaixaPorId, useSangrias, useEntradasExtras,
  useVendas, useVendedores,
} from "@/lib/supabase-queries";
import { imprimirComprovante } from "@/lib/comprovante-fechamento";
import { montarDadosFechamento } from "@/lib/dados-fechamento";
import { brl, dateTime } from "@/lib/format";

const NOME_FORMA: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", cartao_credito: "Cartão crédito",
  cartao_debito: "Cartão débito", crediario: "Crediário", boleto: "Boleto",
};

function Linha({ rotulo, valor, forte, tom }: {
  rotulo: string; valor: string; forte?: boolean; tom?: "bom" | "ruim";
}) {
  return (
    <div className={`flex justify-between gap-3 ${forte ? "font-semibold" : ""}`}>
      <span className={forte ? "" : "text-muted-foreground"}>{rotulo}</span>
      <span className={`tabular-nums ${tom === "bom" ? "text-green-600" : tom === "ruim" ? "text-red-600" : ""}`}>
        {valor}
      </span>
    </div>
  );
}

export function DetalhesCaixaDialog({
  caixaId, onOpenChange,
}: { caixaId: string | null; onOpenChange: (v: boolean) => void }) {
  const { data: caixa, isLoading } = useCaixaPorId(caixaId ?? undefined);
  const { data: sangrias = [] } = useSangrias(caixaId ?? undefined);
  const { data: entradas = [] } = useEntradasExtras(caixaId ?? undefined);
  const { data: vendedores = [] } = useVendedores();
  // as vendas deste turno; o filtro por caixa é feito aqui porque o hook
  // de vendas é por loja e período
  const { data: vendas = [] } = useVendas({ lojaId: (caixa as any)?.loja_id });

  const c = caixa as any;

  const vendasDoCaixa = useMemo(
    () => (vendas as any[]).filter((v) => v.caixa_id === caixaId && v.status === "finalizada"),
    [vendas, caixaId],
  );

  const nomeDe = (usuarioId?: string) =>
    (vendedores as any[]).find((v) => v.usuario_id === usuarioId)?.nome;

  if (!caixaId) return null;

  const aberto = c?.status === "aberto";
  const informado = Number(c?.valor_final ?? 0);
  const esperado = Number(c?.valor_esperado_gaveta ?? 0);
  const diferenca = informado - esperado;

  const [imprimindo, setImprimindo] = useState(false);
  const reimprimir = async () => {
    if (!caixaId) return;
    setImprimindo(true);
    try {
      // MESMA função do fechamento: o papel de hoje e o de amanhã têm de
      // sair iguais, senão conferir depois não prova nada
      const dados = await montarDadosFechamento(caixaId);
      if (!imprimirComprovante(dados)) {
        toast.error("O comprovante não abriu — libere pop-ups deste site.");
      }
    } catch (e: any) {
      toast.error(`Não foi possível montar o comprovante: ${e.message ?? e}`);
    } finally {
      setImprimindo(false);
    }
  };

  return (
    <Dialog open={!!caixaId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {c?.ponto?.nome ?? (c?.numero_caixa != null ? `Caixa ${c.numero_caixa}` : "Caixa")}
            {aberto
              ? <Badge className="bg-green-600">aberto</Badge>
              : <Badge variant="outline">fechado</Badge>}
          </DialogTitle>
          <DialogClose />
        </DialogHeader>

        {isLoading || !c ? (
          <div className="p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto pr-1 text-sm">
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <Linha rotulo="Loja" valor={c.loja?.apelido ?? c.loja?.nome ?? "—"} />
              <Linha rotulo="Abertura" valor={dateTime(c.data_abertura)} />
              <Linha rotulo="Abriu" valor={c.usuario?.nome ?? nomeDe(c.usuario_id) ?? "—"} />
              <Linha rotulo="Fechamento" valor={c.data_fechamento ? dateTime(c.data_fechamento) : "—"} />
              <Linha rotulo="Fechou" valor={nomeDe(c.encerrado_por) ?? "—"} />
            </div>

            <div className="rounded-md border p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Dinheiro na gaveta</p>
              <div className="space-y-1">
                <Linha rotulo="Saldo inicial (troco)" valor={brl(Number(c.valor_inicial ?? 0))} />
                <Linha rotulo="Vendas em dinheiro" valor={"+ " + brl(Number(c.vendas_dinheiro ?? 0))} />
                <Linha rotulo="Entradas extras" valor={"+ " + brl(Number(c.entradas_dinheiro ?? 0))} />
                <Linha rotulo="Sangrias" valor={"- " + brl(Number(c.sangrias_dinheiro ?? 0))} />
                <div className="border-t pt-1">
                  <Linha rotulo="Esperado" valor={brl(esperado)} forte />
                </div>
                {!aberto && (
                  <>
                    <Linha rotulo="Informado pelo operador" valor={brl(informado)} forte />
                    <Linha rotulo="Diferença" valor={(diferenca > 0 ? "+ " : "") + brl(diferenca)} forte
                      tom={Math.abs(diferenca) < 0.01 ? "bom" : "ruim"} />
                  </>
                )}
              </div>
            </div>

            <div className="rounded-md border p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Não passa pela gaveta
              </p>
              <div className="space-y-1">
                <Linha rotulo="PIX" valor={brl(Number(c.vendas_pix ?? 0))} />
                <Linha rotulo="Cartão crédito" valor={brl(Number(c.vendas_cartao_credito ?? 0))} />
                <Linha rotulo="Cartão débito" valor={brl(Number(c.vendas_cartao_debito ?? 0))} />
                <Linha rotulo="Outras formas" valor={brl(Number(c.vendas_outras ?? 0))} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Confira no extrato e na maquininha.</p>
            </div>

            {(sangrias.length > 0 || entradas.length > 0) && (
              <div className="rounded-md border p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Movimentos</p>
                <div className="space-y-1">
                  {(sangrias as any[]).map((s) => (
                    <Linha key={s.id} rotulo={`− ${s.motivo ?? "sangria"}${s.forma_pagamento && s.forma_pagamento !== "dinheiro" ? ` (${NOME_FORMA[s.forma_pagamento] ?? s.forma_pagamento})` : ""}`}
                      valor={brl(Number(s.valor))} />
                  ))}
                  {(entradas as any[]).map((e) => (
                    <Linha key={e.id} rotulo={`+ ${e.motivo ?? "entrada"}`} valor={brl(Number(e.valor))} />
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-md border">
              <p className="border-b p-3 text-xs font-semibold uppercase text-muted-foreground">
                Vendas do turno · {vendasDoCaixa.length}
              </p>
              {vendasDoCaixa.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">Nenhuma venda neste turno.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="border-b text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Hora</th>
                      <th className="p-2 text-left">Cliente</th>
                      <th className="p-2 text-left">Forma</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendasDoCaixa.map((v: any) => (
                      <tr key={v.id} className="border-b last:border-0">
                        <td className="p-2">{new Date(v.data_venda).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="p-2">{v.cliente?.nome_razao ?? v.consumidor_nome ?? "Consumidor final"}</td>
                        <td className="p-2">{NOME_FORMA[v.forma_pagamento] ?? v.forma_pagamento}</td>
                        <td className="p-2 text-right tabular-nums">{brl(Number(v.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {!aberto && c && (
            <Button onClick={() => void reimprimir()} disabled={imprimindo}>
              {imprimindo ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Printer className="mr-1 h-4 w-4" />}
              Reimprimir comprovante
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

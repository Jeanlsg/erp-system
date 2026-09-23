// ============================================================
// Pagamentos da venda (F10).
//
// O PDV aceitava UMA forma por venda. Cliente que paga metade no cartão e
// metade em dinheiro era registrado como se tivesse pago tudo de uma —
// e o erro não parava aí: a conta da gaveta soma as vendas em dinheiro,
// então a venda mista lançada como dinheiro fazia o fechamento esperar
// dinheiro que nunca entrou.
//
// Aqui o operador lança quantas formas precisar. O botão de finalizar só
// libera quando a soma cobre o total — e o banco confere de novo, porque
// a tela é a conveniência e a regra é do banco.
// ============================================================

import { useMemo, useState } from "react";
import { Banknote, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputMoeda } from "@/components/ui/input-moeda";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { brl } from "@/lib/format";

export type FormaPagamento =
  | "dinheiro" | "pix" | "cartao_credito" | "cartao_debito"
  | "crediario" | "boleto" | "promissoria" | "cheque" | "transferencia"
  // Sinal já recebido no pedido (Ctrl+A). A venda é registrada pelo valor
  // cheio e o adiantamento entra como linha de pagamento, senão o
  // faturamento sairia menor do que a mercadoria que saiu da loja. Não toca
  // na gaveta: esse dinheiro entrou no dia em que o sinal foi pago.
  | "adiantamento";

export interface Pagamento {
  forma: FormaPagamento;
  valor: number;
  /** o que o cliente entregou; só difere do valor em dinheiro */
  valor_recebido?: number;
  troco?: number;
  bandeira?: string;
  parcelas?: number;
}

export const NOME_FORMA: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro", pix: "PIX",
  cartao_credito: "Cartão de crédito", cartao_debito: "Cartão de débito",
  crediario: "Crediário", boleto: "Boleto", promissoria: "Promissória",
  cheque: "Cheque", transferencia: "Transferência",
  adiantamento: "Entrada/adiantamento já pago",
};

/** Quanto ainda falta cobrir. Negativo não existe: o excedente é troco. */
export function faltaPagar(total: number, pagamentos: Pagamento[]): number {
  const pago = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  return Math.max(0, Math.round((total - pago) * 100) / 100);
}

/** Troco: o que foi entregue em dinheiro além do que essa linha cobre. */
export function trocoDe(pagamentos: Pagamento[]): number {
  return pagamentos.reduce((s, p) => {
    if (p.forma !== "dinheiro") return s;
    const recebido = Number(p.valor_recebido ?? p.valor) || 0;
    return s + Math.max(0, recebido - (Number(p.valor) || 0));
  }, 0);
}

interface Props {
  total: number;
  pagamentos: Pagamento[];
  aoMudar: (p: Pagamento[]) => void;
}

export function PagamentosVenda({ total, pagamentos, aoMudar }: Props) {
  const [forma, setForma] = useState<FormaPagamento>("dinheiro");
  const [valor, setValor] = useState("");
  const [recebido, setRecebido] = useState("");
  const [parcelas, setParcelas] = useState("1");

  const falta = useMemo(() => faltaPagar(total, pagamentos), [total, pagamentos]);
  const troco = useMemo(() => trocoDe(pagamentos), [pagamentos]);
  const ehCartaoCredito = forma === "cartao_credito";

  const adicionar = () => {
    // o campo vazio significa "o que falta": é o caso mais comum, e digitar
    // o valor restante à mão é onde o operador erra
    const v = Number(valor) > 0 ? Number(valor) : falta;
    if (v <= 0) return;
    const rec = forma === "dinheiro" && Number(recebido) > 0 ? Number(recebido) : undefined;
    aoMudar([...pagamentos, {
      forma, valor: Math.round(v * 100) / 100,
      ...(rec ? { valor_recebido: rec, troco: Math.max(0, rec - v) } : {}),
      ...(ehCartaoCredito && Number(parcelas) > 1 ? { parcelas: Number(parcelas) } : {}),
    }]);
    setValor(""); setRecebido(""); setParcelas("1");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
        <span className="text-sm font-medium">Total da venda</span>
        <span className="text-lg font-semibold tabular-nums">{brl(total)}</span>
      </div>

      {pagamentos.length > 0 && (
        <div className="space-y-1">
          {pagamentos.map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{NOME_FORMA[p.forma]}</span>
                {p.parcelas && p.parcelas > 1 && (
                  <Badge variant="outline" className="ml-2 text-[10px]">{p.parcelas}x</Badge>
                )}
                {p.troco ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    recebeu {brl(p.valor_recebido ?? 0)} · troco {brl(p.troco)}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">{brl(p.valor)}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                  onClick={() => aoMudar(pagamentos.filter((_, k) => k !== i))}
                  title="Remover este pagamento">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {falta > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="font-medium">Falta receber</span>
            <span className="text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {brl(falta)}
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm dark:bg-green-950/20">
          <div className="flex items-center justify-between">
            <span className="font-medium">Pagamento completo</span>
            {troco > 0 && (
              <span className="tabular-nums">troco <b>{brl(troco)}</b></span>
            )}
          </div>
        </div>
      )}

      {falta > 0 && (
        <div className="flex flex-wrap items-end gap-2 border-t pt-3">
          <div className="min-w-[10rem] flex-1">
            <Label className="text-xs">Forma</Label>
            <Select value={forma} onValueChange={(v) => setForma(v as FormaPagamento)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(NOME_FORMA) as FormaPagamento[]).map((f) => (
                  <SelectItem key={f} value={f}>{NOME_FORMA[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Label className="text-xs">Valor</Label>
            <InputMoeda value={valor} onChange={(v) => setValor(String(v))} placeholder={brl(falta)} />
          </div>
          {forma === "dinheiro" && (
            <div className="w-32">
              <Label className="text-xs">Recebido</Label>
              <InputMoeda value={recebido} onChange={(v) => setRecebido(String(v))} placeholder="para troco" />
            </div>
          )}
          {ehCartaoCredito && (
            <div className="w-24">
              <Label className="text-xs">Parcelas</Label>
              <Input type="number" min="1" max="12" className="mt-1" value={parcelas}
                onChange={(e) => setParcelas(e.target.value)} />
            </div>
          )}
          <Button onClick={adicionar}>
            <Plus className="mr-1 h-4 w-4" /> Lançar
          </Button>
        </div>
      )}

      {pagamentos.length === 0 && (
        <p className="text-xs text-muted-foreground">
          <Banknote className="mr-1 inline h-3.5 w-3.5" />
          Deixe o valor em branco para lançar tudo numa forma só.
        </p>
      )}
    </div>
  );
}

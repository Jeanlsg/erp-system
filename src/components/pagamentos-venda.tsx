// ============================================================
// Pagamentos da venda (F10).
//
// O PDV aceitava UMA forma por venda. Cliente que paga metade no cartão e
// metade em dinheiro era registrado como se tivesse pago tudo de uma —
// e o erro não parava aí: a conta da gaveta soma as vendas em dinheiro,
// então a venda mista lançada como dinheiro fazia o fechamento esperar
// dinheiro que nunca entrou.
//
// Aqui o operador lança quantas formas precisar, no mesmo lugar em que
// escolhe a forma: digita quanto o cliente dá nesta forma, o sistema lança e
// já pede o que falta, até bater o total. Uma forma só é o mesmo caminho com
// um passo — campo em branco lança o total inteiro na forma escolhida.
//
// O botão de finalizar só libera quando a soma cobre o total, e o banco
// confere de novo, porque a tela é a conveniência e a regra é do banco.
// ============================================================

import type { Ref } from "react";
import { Banknote, CreditCard, Plus, QrCode, Receipt, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputMoeda, paraNumero } from "@/components/ui/input-moeda";
import { Label } from "@/components/ui/label";
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

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Lança um valor numa forma, do jeito do balcão: digita-se quanto o cliente
 * está dando NESTA forma, e o sistema diz quanto ainda falta.
 *
 *   Total 89, "20 no dinheiro"  → linha de 20 em dinheiro, falta 69
 *   Falta 69, "100 no dinheiro" → linha de 69, recebeu 100, troco 31
 *   Falta 69, "100 no cartão"   → recusado: cartão e PIX não dão troco
 *
 * Só o dinheiro aceita valor acima do que falta, porque só nele o excedente
 * volta como troco. Em qualquer outra forma o excedente seria cobrança a mais
 * na maquininha — erro de digitação que o cliente só descobre no extrato.
 */
export function lancarPagamento(
  total: number,
  pagamentos: Pagamento[],
  forma: FormaPagamento,
  digitado: number,
  extras: { parcelas?: number } = {},
): { ok: true; linha: Pagamento } | { ok: false; erro: string } {
  const falta = faltaPagar(total, pagamentos);
  if (falta <= 0) return { ok: false, erro: "O pagamento já está completo." };

  const v = r2(Number(digitado));
  if (!Number.isFinite(v) || v <= 0) return { ok: false, erro: "Informe o valor." };

  if (forma === "dinheiro") {
    if (v > falta) {
      return { ok: true, linha: { forma, valor: falta, valor_recebido: v, troco: r2(v - falta) } };
    }
    return { ok: true, linha: { forma, valor: v } };
  }

  // meio centavo de folga: 33,33 + 33,33 + 33,34 não pode ser recusado
  if (v > falta + 0.005) {
    return {
      ok: false,
      erro: `Em ${NOME_FORMA[forma].toLowerCase()} não há troco: o máximo é ${brl(falta)}.`,
    };
  }
  return {
    ok: true,
    linha: {
      forma, valor: Math.min(v, falta),
      ...(forma === "cartao_credito" && (extras.parcelas ?? 1) > 1 ? { parcelas: extras.parcelas } : {}),
    },
  };
}

/**
 * Aplica o que está digitado no campo de valor. Campo vazio não lança nada.
 * Usada no Enter do campo e no Finalizar — os dois caminhos têm de dar o
 * mesmo resultado, senão o operador aprende a desconfiar de um deles.
 */
export function aplicarDigitado(
  total: number,
  pagamentos: Pagamento[],
  forma: FormaPagamento,
  valorTexto: string,
  parcelas = 1,
): { ok: true; pagamentos: Pagamento[]; lancou: boolean } | { ok: false; erro: string } {
  const n = paraNumero(valorTexto);
  if (n === "") return { ok: true, pagamentos, lancou: false };
  const r = lancarPagamento(total, pagamentos, forma, n, { parcelas });
  if (!r.ok) return r;
  return { ok: true, pagamentos: [...pagamentos, r.linha], lancou: true };
}

/**
 * O que acontece ao apertar Finalizar.
 *
 *   - valor digitado e ainda não lançado → lança;
 *   - nada lançado e nada digitado → uma forma só, no valor total;
 *   - pagamentos que passam do total → recusa. Só acontece quando um item sai
 *     do cupom depois do pagamento lançado, e aí o excedente seria cobrança a
 *     mais no cartão ou PIX.
 *
 * Devolve quanto falta: acima de zero, a tela pede o resto em vez de abrir a
 * confirmação.
 */
export function prepararFinalizacao(
  total: number,
  pagamentos: Pagamento[],
  forma: FormaPagamento,
  valorTexto: string,
  parcelas = 1,
): { ok: true; pagamentos: Pagamento[]; falta: number } | { ok: false; erro: string } {
  const a = aplicarDigitado(total, pagamentos, forma, valorTexto, parcelas);
  if (!a.ok) return a;
  let pags = a.pagamentos;
  if (pags.length === 0) {
    pags = [{
      forma, valor: r2(total),
      ...(forma === "cartao_credito" && parcelas > 1 ? { parcelas } : {}),
    }];
  }
  const excedente = r2(pags.reduce((t, p) => t + (Number(p.valor) || 0), 0) - total);
  if (excedente > 0.005) {
    return {
      ok: false,
      erro: `Os pagamentos passam do total em ${brl(excedente)}. Remova um pagamento e lance de novo.`,
    };
  }
  return { ok: true, pagamentos: pags, falta: faltaPagar(total, pags) };
}

/** As seis formas do balcão, em botão; as demais ficam na lista "Outras". */
const FORMAS_PRINCIPAIS: { forma: FormaPagamento; rotulo: string; Icone: typeof Banknote }[] = [
  { forma: "dinheiro", rotulo: "Dinheiro", Icone: Banknote },
  { forma: "pix", rotulo: "PIX", Icone: QrCode },
  { forma: "cartao_credito", rotulo: "Crédito", Icone: CreditCard },
  { forma: "cartao_debito", rotulo: "Débito", Icone: CreditCard },
  { forma: "crediario", rotulo: "Crediário", Icone: Receipt },
  { forma: "boleto", rotulo: "Boleto", Icone: Receipt },
];
const FORMAS_OUTRAS: FormaPagamento[] = ["transferencia", "cheque", "promissoria", "adiantamento"];

interface Props {
  total: number;
  pagamentos: Pagamento[];
  aoMudar: (p: Pagamento[]) => void;
  forma: FormaPagamento;
  aoMudarForma: (f: FormaPagamento) => void;
  /** o que está no campo de valor, como texto */
  valor: string;
  aoMudarValor: (v: string) => void;
  parcelas: string;
  aoMudarParcelas: (v: string) => void;
  /** Enter no campo, ou o botão ao lado: lança o valor digitado */
  aoLancar: () => void;
  campoValorRef?: Ref<HTMLInputElement>;
}

export function PagamentosVenda({
  total, pagamentos, aoMudar, forma, aoMudarForma,
  valor, aoMudarValor, parcelas, aoMudarParcelas, aoLancar, campoValorRef,
}: Props) {
  const falta = faltaPagar(total, pagamentos);
  const troco = trocoDe(pagamentos);
  const pago = pagamentos.reduce((t, p) => t + (Number(p.valor) || 0), 0);
  const excedente = r2(pago - total) > 0.005 ? r2(pago - total) : 0;
  const temLinhas = pagamentos.length > 0;
  const completo = temLinhas && falta <= 0 && excedente === 0;
  // InputMoeda compara número com número; passar texto faria a vírgula sumir
  // no meio da digitação de "20,50"
  const valorNumero = valor === "" ? "" : Number(valor);

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Forma de pagamento</Label>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {FORMAS_PRINCIPAIS.map(({ forma: f, rotulo, Icone }) => (
            <Button
              key={f}
              type="button"
              variant={forma === f ? "default" : "outline"}
              size="sm"
              className="h-auto flex-col gap-1 py-2"
              disabled={completo}
              onClick={() => aoMudarForma(f)}
            >
              <Icone className="h-4 w-4" />
              <span className="text-xs">{rotulo}</span>
            </Button>
          ))}
        </div>
        <select
          className="mt-2 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          value={FORMAS_OUTRAS.includes(forma) ? forma : ""}
          disabled={completo}
          onChange={(e) => { if (e.target.value) aoMudarForma(e.target.value as FormaPagamento); }}
        >
          <option value="">Outras formas…</option>
          {FORMAS_OUTRAS.map((f) => <option key={f} value={f}>{NOME_FORMA[f]}</option>)}
        </select>
      </div>

      {!completo && (
        <div>
          <Label className="text-xs">
            Valor em {NOME_FORMA[forma].toLowerCase()}
          </Label>
          <div className="mt-1 flex gap-2">
            <InputMoeda
              ref={campoValorRef}
              className="h-9 text-base"
              value={valorNumero}
              placeholder={brl(falta)}
              onChange={(v) => aoMudarValor(v === "" ? "" : String(v))}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); aoLancar(); }
              }}
            />
            {forma === "cartao_credito" && (
              <Input type="number" min="1" max="12" className="h-9 w-16" title="Parcelas"
                value={parcelas} onChange={(e) => aoMudarParcelas(e.target.value)} />
            )}
            <Button type="button" variant="outline" className="h-9" onClick={aoLancar}
              disabled={valor === ""} title="Lançar este valor (Enter)">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {!temLinhas && valor === ""
              ? <>Em branco, o total vai todo em {NOME_FORMA[forma].toLowerCase()}.</>
              : <>Enter lança. O que faltar é pedido em seguida, em qualquer forma.</>}
          </p>
        </div>
      )}

      {temLinhas && (
        <div className="space-y-1">
          {pagamentos.map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{NOME_FORMA[p.forma]}</span>
                {p.parcelas && p.parcelas > 1 && (
                  <Badge variant="outline" className="ml-2 text-[10px]">{p.parcelas}x</Badge>
                )}
                {p.troco ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    recebeu {brl(p.valor_recebido ?? 0)}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
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

      {temLinhas && (
        excedente > 0 ? (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/20">
            Os pagamentos passam do total em <b>{brl(excedente)}</b>. Remova um e lance de novo.
          </div>
        ) : falta > 0 ? (
          <div className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/20">
            <span className="font-medium">Falta receber</span>
            <span className="text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {brl(falta)}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm dark:bg-green-950/20">
            <span className="font-medium">Pagamento completo</span>
            {troco > 0 && (
              <span className="tabular-nums">troco <b className="text-orange-600">{brl(troco)}</b></span>
            )}
          </div>
        )
      )}
    </div>
  );
}

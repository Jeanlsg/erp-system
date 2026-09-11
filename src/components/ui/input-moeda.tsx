// ============================================================
// Campo de valor em reais.
//
// `<input type="number">` descarta a vírgula: quem digita 149,90 — o
// natural no Brasil — vê "14990" no campo, e o sistema grava
// R$ 14.990,00 sem reclamar. Preço de produto, salário, taxa, juros:
// todos multiplicados por cem em silêncio, sem erro para o operador
// perceber.
//
// Aqui o campo é texto com teclado decimal: aceita vírgula e ponto,
// recusa letra, e devolve número ao formulário. O valor exibido fica
// como a pessoa digitou enquanto ela digita, e só normaliza ao sair —
// campo que reescreve o que você está escrevendo é pior que a doença.
// ============================================================

import { forwardRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface Props extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> {
  /** Valor em número; string vazia quando em branco. */
  value: number | string | null | undefined;
  /** Recebe o número já convertido (ou "" quando o campo fica vazio). */
  onChange: (valor: number | "") => void;
}

/** "1.234,56" ou "1234.56" → 1234.56 */
export function paraNumero(texto: string): number | "" {
  const limpo = String(texto).trim().replace(/[R$\s]/gi, "");
  if (!limpo) return "";
  // Com vírgula, ela é o separador decimal e o ponto é milhar (padrão BR).
  const normal = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const n = Number(normal);
  return Number.isFinite(n) ? n : "";
}

const exibir = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === "" ? "" : String(v).replace(".", ",");

export const InputMoeda = forwardRef<HTMLInputElement, Props>(function InputMoeda(
  { value, onChange, onBlur, ...resto }, ref,
) {
  const [texto, setTexto] = useState(() => exibir(value));

  // Atualização vinda de fora (limpar formulário, carregar registro) precisa
  // aparecer; digitação em andamento, não — por isso compara o valor.
  useEffect(() => {
    if (paraNumero(texto) !== (value ?? "")) setTexto(exibir(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      {...resto}
      ref={ref}
      type="text"
      inputMode="decimal"
      value={texto}
      onChange={(e) => {
        // só dígitos, vírgula, ponto e sinal — letra não entra em valor
        const t = e.target.value.replace(/[^\d.,-]/g, "");
        setTexto(t);
        onChange(paraNumero(t));
      }}
      onBlur={(e) => {
        const n = paraNumero(texto);
        setTexto(n === "" ? "" : String(n).replace(".", ","));
        onBlur?.(e);
      }}
    />
  );
});

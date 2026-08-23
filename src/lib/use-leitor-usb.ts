// ============================================================
// Leitor de código de barras USB ("keyboard wedge").
//
// Leitores como Bematech BR-310/400, Elgin BS-313 e Kaiomy HBS-310
// funcionam como teclado: digitam o código inteiro em milissegundos
// e terminam com Enter. Este hook escuta a página toda e separa o
// bipe da digitação humana pela VELOCIDADE: rajada de 6+ caracteres
// com intervalos curtos terminada em Enter é leitura, não digitação.
//
// Nenhuma configuração ou driver especial: qualquer leitor em modo
// emulação de teclado (padrão de fábrica) funciona.
// ============================================================

import { useEffect, useRef } from "react";

const INTERVALO_MAX_MS = 60;   // humano raramente digita abaixo de ~120ms/tecla
const TAMANHO_MIN = 6;         // EAN-8 é o menor código comum em loja

export function useLeitorUsb(aoLer: (codigo: string) => void, ativo = true) {
  const aoLerRef = useRef(aoLer);
  aoLerRef.current = aoLer;

  useEffect(() => {
    if (!ativo) return;
    let buffer = "";
    let ultimo = 0;

    const teclou = (e: KeyboardEvent) => {
      const agora = performance.now();
      if (agora - ultimo > INTERVALO_MAX_MS) buffer = "";
      ultimo = agora;

      if (e.key === "Enter") {
        if (buffer.length >= TAMANHO_MIN) {
          const codigo = buffer;
          buffer = "";
          // Se a rajada caiu dentro de um campo de texto, limpa o que o
          // leitor "digitou" ali — o código não é busca, é item lido.
          const alvo = document.activeElement as HTMLInputElement | null;
          if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA") && alvo.value.endsWith(codigo)) {
            const setter = Object.getOwnPropertyDescriptor(
              alvo.tagName === "INPUT" ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype,
              "value",
            )?.set;
            setter?.call(alvo, alvo.value.slice(0, -codigo.length));
            alvo.dispatchEvent(new Event("input", { bubbles: true }));
          }
          e.preventDefault();
          e.stopPropagation();
          aoLerRef.current(codigo);
        }
        buffer = "";
        return;
      }
      if (e.key.length === 1) buffer += e.key;
      else if (e.key !== "Shift") buffer = "";
    };

    // capture: chega antes dos handlers dos componentes (ex.: submit de form)
    window.addEventListener("keydown", teclou, true);
    return () => window.removeEventListener("keydown", teclou, true);
  }, [ativo]);
}

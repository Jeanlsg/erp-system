// ============================================================
// Atalhos de teclado do PDV.
//
// Balcão se opera com as duas mãos ocupadas: uma no produto, outra no
// teclado. O sistema anterior da loja (Excellent) era assim, e a equipe
// vem de lá com os dedos já treinados — F10 finaliza, F8 cancela item,
// F5 localiza. Repetir os mesmos atalhos poupa retreinamento.
//
// Não dispara quando o foco está num campo de texto, EXCETO as teclas de
// função e os Ctrl+: digitar "5" na quantidade não pode abrir a busca,
// mas F5 tem de funcionar mesmo com o cursor no campo do código.
// ============================================================

import { useEffect, useRef } from "react";

export type Atalho = {
  /** "F10", "Ctrl+S", "Escape" */
  tecla: string;
  rotulo: string;
  acao: () => void;
  /** desligado quando a ação não faz sentido agora (ex.: sem itens) */
  ativo?: boolean;
};

/** Nome do atalho a partir do evento: "F10", "Ctrl+S", "Escape". Exportada para teste. */
export function combinacao(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey">): string {
  const partes: string[] = [];
  if (e.ctrlKey || e.metaKey) partes.push("Ctrl");
  if (e.shiftKey && e.key.length > 1) partes.push("Shift");
  partes.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return partes.join("+");
}

export function useAtalhosPdv(atalhos: Atalho[], ativo = true) {
  const ref = useRef(atalhos);
  ref.current = atalhos;

  useEffect(() => {
    if (!ativo) return;
    const aoTeclar = (e: KeyboardEvent) => {
      const combo = combinacao(e);
      const atalho = ref.current.find((a) => a.tecla === combo);
      if (!atalho || atalho.ativo === false) return;

      // Teclas de função e Ctrl+ valem em qualquer lugar; letra solta, não —
      // senão digitar no campo de busca viraria comando.
      const ehGlobal = /^F\d{1,2}$/.test(e.key) || e.ctrlKey || e.metaKey || e.key === "Escape";
      const alvo = e.target as HTMLElement | null;
      const emCampo = !!alvo && (
        alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable
      );
      if (emCampo && !ehGlobal) return;

      e.preventDefault();
      e.stopPropagation();
      atalho.acao();
    };
    // captura: o navegador reserva alguns F-keys; pegar antes evita o menu
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [ativo]);
}

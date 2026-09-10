// ============================================================
// Modo demonstração — o tour do botão "?".
//
// Escurece a tela, destaca um elemento por vez e explica o que ele faz.
// NADA é executado: o tour desenha um recorte por cima e intercepta o
// clique, então nem o botão mais perigoso da tela dispara enquanto a
// demonstração está aberta.
//
// Os passos NÃO são escritos à mão: saem de content/tutoriais.json, o
// mesmo conteúdo da Central de Tutoriais, gerado a partir da auditoria
// em que cada botão foi clicado e o efeito, observado. Tela nova entra
// no tour assim que entra no arquivo — sem tocar neste componente.
//
// Sem passos para a rota, o "?" continua abrindo a descrição da página
// e oferece o tutorial completo, em vez de sumir.
// ============================================================

import { useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X, ChevronLeft, ChevronRight, BookOpen, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import tutoriaisJson from "@/content/tutoriais.json";

interface Controle { nome: string; tipo: string; faz: string; cuidado: boolean }
interface Tutorial { url: string; titulo: string; objetivo: string; controles: Controle[] }
const TUTORIAIS = tutoriaisJson as Tutorial[];

interface Passo { titulo: string; texto: string; cuidado: boolean; alvo?: DOMRect }

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Acha na tela o elemento cujo texto bate com o nome do controle. */
function acharAlvo(nome: string): Element | null {
  const alvo = semAcento(nome);
  const main = document.querySelector("main") ?? document.body;
  const cands = [...main.querySelectorAll<HTMLElement>(
    "button, a[role=button], [role=tab], [role=combobox], [data-tour]",
  )];
  const visivel = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < window.innerHeight + 600;
  };
  return (
    cands.find((el) => visivel(el) && semAcento(el.getAttribute("data-tour") ?? "") === alvo) ??
    cands.find((el) => visivel(el) && semAcento(el.innerText ?? "") === alvo) ??
    cands.find((el) => visivel(el) && semAcento(el.innerText ?? "").includes(alvo)) ??
    cands.find((el) => visivel(el) && semAcento(el.getAttribute("title") ?? "") === alvo) ??
    null
  );
}

export function ModoDemonstracao({ rota, aoFechar }: { rota: string; aoFechar: () => void }) {
  const tutorial = useMemo(
    () => TUTORIAIS.find((t) => t.url.split("?")[0] === rota),
    [rota],
  );
  const passos = useMemo<Passo[]>(() => {
    if (!tutorial) return [];
    return [
      { titulo: tutorial.titulo, texto: tutorial.objetivo, cuidado: false },
      ...tutorial.controles.map((c) => ({ titulo: c.nome, texto: c.faz, cuidado: c.cuidado })),
    ];
  }, [tutorial]);

  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const passo = passos[i];

  // Recalcula o recorte a cada passo, e também em rolagem/redimensionamento:
  // um destaque parado enquanto a página se move aponta para o lugar errado.
  const posicionar = useCallback(() => {
    if (!passo || i === 0) { setRect(null); return; }
    const el = acharAlvo(passo.titulo);
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => setRect(el.getBoundingClientRect()), 260);
  }, [passo, i]);

  useEffect(() => { posicionar(); }, [posicionar]);
  useEffect(() => {
    const f = () => posicionar();
    window.addEventListener("resize", f);
    window.addEventListener("scroll", f, true);
    return () => { window.removeEventListener("resize", f); window.removeEventListener("scroll", f, true); };
  }, [posicionar]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, passos.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", tecla);
    // trava a rolagem da página: o tour controla o que aparece
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", tecla); document.body.style.overflow = antes; };
  }, [aoFechar, passos.length]);

  if (!passo) return null;

  const M = 8;
  const caixa = rect
    ? { top: rect.top - M, left: rect.left - M, width: rect.width + M * 2, height: rect.height + M * 2 }
    : null;
  // o balão fica abaixo do destaque; se não couber, sobe
  const espacoAbaixo = caixa ? window.innerHeight - (caixa.top + caixa.height) : 0;
  const balaoTop = caixa
    ? (espacoAbaixo > 220 ? caixa.top + caixa.height + 12 : Math.max(12, caixa.top - 200))
    : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Modo demonstração">
      {/* Véu com recorte no elemento destacado. O véu recebe TODOS os cliques,
          inclusive sobre o recorte — por isso nenhuma ação real dispara. */}
      <div
        className="absolute inset-0 bg-black/60 transition-all"
        style={caixa ? {
          clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${caixa.top}px, ${caixa.left}px ${caixa.top}px, ${caixa.left}px ${caixa.top + caixa.height}px, ${caixa.left + caixa.width}px ${caixa.top + caixa.height}px, ${caixa.left + caixa.width}px ${caixa.top}px, 0 ${caixa.top}px)`,
        } : undefined}
        onClick={aoFechar}
      />
      {caixa && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-md ring-2 ring-primary ring-offset-2 ring-offset-background transition-all"
          style={{ top: caixa.top, left: caixa.left, width: caixa.width, height: caixa.height }}
        />
      )}

      <div
        className="absolute w-[22rem] max-w-[calc(100vw-2rem)] rounded-lg border bg-background p-4 shadow-xl"
        style={caixa
          ? { top: balaoTop, left: Math.min(Math.max(12, caixa.left), window.innerWidth - 366) }
          : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold leading-tight">{passo.titulo}</p>
          <button onClick={aoFechar} aria-label="Encerrar demonstração"
            className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{passo.texto}</p>
        {passo.cuidado && (
          <p className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Ação definitiva: confirme antes de usar, porque não dá para desfazer.
          </p>
        )}
        {i > 0 && !rect && (
          <p className="mt-2 text-xs text-muted-foreground">
            Este botão não está visível agora — ele aparece conforme o que estiver em tela.
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">{i + 1}/{passos.length}</span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={aoFechar}>Pular</Button>
            <Button size="sm" variant="outline" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {i < passos.length - 1 ? (
              <Button size="sm" onClick={() => setI((n) => n + 1)}>
                Próximo <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" asChild onClick={aoFechar}>
                <Link to="/tutoriais"><BookOpen className="mr-1.5 h-3.5 w-3.5" /> Tutorial completo</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Há tour para esta rota? */
export function temDemonstracao(rota: string) {
  return TUTORIAIS.some((t) => t.url.split("?")[0] === rota && t.controles.length > 0);
}

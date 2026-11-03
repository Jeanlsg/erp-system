import { afterEach, describe, expect, it, vi } from "vitest";
import { escaparHtml, escreverEImprimir } from "./imprimir";

describe("escaparHtml", () => {
  it("neutraliza tag e atributo vindos do cadastro ou do XML", () => {
    expect(escaparHtml('<img src=x onerror="alert(1)">')).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(escaparHtml("Whey 100% & Cia d'Oeste")).toBe("Whey 100% &amp; Cia d&#39;Oeste");
    expect(escaparHtml(null)).toBe("");
  });
});

function janelaFalsa(estado: DocumentReadyState) {
  const ouvintes: Record<string, () => void> = {};
  const w = {
    closed: false,
    document: { readyState: estado, open: vi.fn(), write: vi.fn(), close: vi.fn() },
    addEventListener: vi.fn((ev: string, fn: () => void) => { ouvintes[ev] = fn; }),
    focus: vi.fn(), print: vi.fn(), close: vi.fn(),
  };
  return { w, carregar: () => ouvintes.load?.() };
}

describe("escreverEImprimir", () => {
  afterEach(() => vi.useRealTimers());

  it("imprime uma vez só, depois do load (sem <script> na página)", () => {
    vi.useFakeTimers();
    const { w, carregar } = janelaFalsa("loading");
    escreverEImprimir(w as unknown as Window, "<p>oi</p>");
    expect(w.document.write).toHaveBeenCalledWith("<p>oi</p>");
    expect(w.print).not.toHaveBeenCalled();
    carregar();
    vi.advanceTimersByTime(5000);
    expect(w.print).toHaveBeenCalledTimes(1);
    expect(w.close).not.toHaveBeenCalled();
  });

  it("documento já carregado imprime; fechar=true fecha a janela", () => {
    vi.useFakeTimers();
    const { w } = janelaFalsa("complete");
    escreverEImprimir(w as unknown as Window, "<p>oi</p>", { fechar: true });
    vi.advanceTimersByTime(300);
    expect(w.print).toHaveBeenCalledTimes(1);
    expect(w.close).toHaveBeenCalledTimes(1);
  });

  it("imagem que não carrega não prende: imprime em 3 s", () => {
    vi.useFakeTimers();
    const { w } = janelaFalsa("loading");
    escreverEImprimir(w as unknown as Window, "<img src=x>");
    vi.advanceTimersByTime(3000);
    expect(w.print).toHaveBeenCalledTimes(1);
  });

  it("janela fechada antes da hora: não imprime", () => {
    vi.useFakeTimers();
    const { w } = janelaFalsa("complete");
    escreverEImprimir(w as unknown as Window, "<p>oi</p>");
    w.closed = true;
    vi.advanceTimersByTime(300);
    expect(w.print).not.toHaveBeenCalled();
  });
});

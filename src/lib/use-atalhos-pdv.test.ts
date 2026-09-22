import { describe, it, expect } from "vitest";
import { combinacao } from "./use-atalhos-pdv";

const ev = (key: string, mod: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {}) =>
  ({ key, ctrlKey: !!mod.ctrl, metaKey: !!mod.meta, shiftKey: !!mod.shift });

describe("combinacao", () => {
  it("tecla de função vai inteira", () => {
    expect(combinacao(ev("F10"))).toBe("F10");
    expect(combinacao(ev("F5"))).toBe("F5");
  });

  it("Ctrl + letra normaliza para maiúscula", () => {
    expect(combinacao(ev("s", { ctrl: true }))).toBe("Ctrl+S");
    expect(combinacao(ev("S", { ctrl: true }))).toBe("Ctrl+S");
  });

  it("Cmd do Mac conta como Ctrl — o balcão pode ser Mac", () => {
    expect(combinacao(ev("x", { meta: true }))).toBe("Ctrl+X");
  });

  it("teclas nomeadas passam como estão", () => {
    expect(combinacao(ev("Escape"))).toBe("Escape");
    expect(combinacao(ev("Enter"))).toBe("Enter");
  });

  it("Shift só entra em tecla nomeada, não em letra", () => {
    // Shift+letra já vem maiúscula do teclado; marcar Shift criaria
    // "Shift+A" e "A" como atalhos diferentes para a mesma tecla
    expect(combinacao(ev("A", { shift: true }))).toBe("A");
    expect(combinacao(ev("Tab", { shift: true }))).toBe("Shift+Tab");
  });
});

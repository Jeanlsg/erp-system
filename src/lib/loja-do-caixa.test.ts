import { describe, it, expect } from "vitest";
import { lojaEfetivaDoPdv, podeTrocarDeLoja } from "./loja-do-caixa";

const JUAZEIRO = "e385d4aa-e724-440b-8336-88daafe06ed4";
const PETROLINA = "7b26a64b-7832-415c-b1c5-641e3f624d54";

describe("lojaEfetivaDoPdv", () => {
  it("caixa aberto vence o seletor do cabeçalho", () => {
    expect(lojaEfetivaDoPdv({ loja_id: JUAZEIRO }, PETROLINA)).toBe(JUAZEIRO);
  });

  it("sem caixa aberto, vale o cabeçalho — é assim que se escolhe onde abrir", () => {
    expect(lojaEfetivaDoPdv(null, PETROLINA)).toBe(PETROLINA);
    expect(lojaEfetivaDoPdv(undefined, PETROLINA)).toBe(PETROLINA);
  });

  it("sem nenhum dos dois devolve null em vez de undefined", () => {
    expect(lojaEfetivaDoPdv(null, null)).toBeNull();
  });

  it("caixa sem loja_id não sobrepõe o cabeçalho", () => {
    expect(lojaEfetivaDoPdv({ loja_id: null }, PETROLINA)).toBe(PETROLINA);
  });
});

describe("podeTrocarDeLoja", () => {
  it("trava com caixa aberto durante a venda", () => {
    expect(podeTrocarDeLoja({ loja_id: JUAZEIRO })).toBe(false);
  });
  it("libera sem caixa aberto", () => {
    expect(podeTrocarDeLoja(null)).toBe(true);
  });
  it("libera fora da frente de venda, mesmo com caixa aberto", () => {
    // é de lá que o admin abre o segundo caixa, quase sempre na outra loja
    expect(podeTrocarDeLoja({ loja_id: JUAZEIRO }, false)).toBe(true);
  });
});

describe("lojaEfetivaDoPdv fora da frente de venda", () => {
  it("volta a seguir o cabeçalho para permitir abrir caixa em outra loja", () => {
    expect(lojaEfetivaDoPdv({ loja_id: JUAZEIRO }, PETROLINA, false)).toBe(PETROLINA);
  });
  it("na frente de venda continua no caixa", () => {
    expect(lojaEfetivaDoPdv({ loja_id: JUAZEIRO }, PETROLINA, true)).toBe(JUAZEIRO);
  });
});

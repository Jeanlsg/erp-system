import { describe, it, expect } from "vitest";
import {
  caixaAtivoNaLoja, caixasEmOutrasLojas, podeTrocarDeLoja, podeAbrirOutroCaixa,
} from "./loja-do-caixa";

const JUAZEIRO = "e385d4aa-e724-440b-8336-88daafe06ed4";
const PETROLINA = "7b26a64b-7832-415c-b1c5-641e3f624d54";
const cxPetrolina = { id: "cx-p", loja_id: PETROLINA };
const cxJuazeiro = { id: "cx-j", loja_id: JUAZEIRO };

describe("caixaAtivoNaLoja — a filial do topo manda", () => {
  it("o defeito: caixa de Petrolina aberto e Juazeiro no topo não opera Petrolina", () => {
    expect(caixaAtivoNaLoja([cxPetrolina], JUAZEIRO, null)).toBeNull();
  });

  it("opera o caixa da filial escolhida", () => {
    expect(caixaAtivoNaLoja([cxPetrolina, cxJuazeiro], JUAZEIRO, null)).toBe(cxJuazeiro);
    expect(caixaAtivoNaLoja([cxPetrolina, cxJuazeiro], PETROLINA, null)).toBe(cxPetrolina);
  });

  it("escolha de caixa de outra filial não vale — venda e caixa nunca ficam em lojas diferentes", () => {
    expect(caixaAtivoNaLoja([cxPetrolina, cxJuazeiro], JUAZEIRO, "cx-p")).toBe(cxJuazeiro);
  });

  it("sem filial ou sem caixa aberto, nenhum", () => {
    expect(caixaAtivoNaLoja([cxPetrolina], null, null)).toBeNull();
    expect(caixaAtivoNaLoja([], PETROLINA, null)).toBeNull();
  });
});

describe("caixasEmOutrasLojas", () => {
  it("lista o que ficou aberto na outra filial", () => {
    expect(caixasEmOutrasLojas([cxPetrolina, cxJuazeiro], JUAZEIRO)).toEqual([cxPetrolina]);
  });
});

describe("podeTrocarDeLoja", () => {
  it("troca livre com o cupom vazio, mesmo com caixa aberto", () => {
    expect(podeTrocarDeLoja(false)).toBe(true);
  });
  it("trava com venda em andamento", () => {
    expect(podeTrocarDeLoja(true)).toBe(false);
  });
});

describe("podeAbrirOutroCaixa", () => {
  it("admin abre outro com um já aberto", () => {
    expect(podeAbrirOutroCaixa([cxPetrolina], true)).toEqual({ ok: true });
  });
  it("quem não pode ter vários é recusado — o banco fecharia o primeiro sem conferência", () => {
    expect(podeAbrirOutroCaixa([cxPetrolina], false)).toEqual({ ok: false, aberto: cxPetrolina });
  });
  it("sem caixa aberto, qualquer um abre", () => {
    expect(podeAbrirOutroCaixa([], false)).toEqual({ ok: true });
  });
});

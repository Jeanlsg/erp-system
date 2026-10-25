import { describe, it, expect } from "vitest";
import {
  caixaAtivoNaLoja, caixasEmOutrasLojas, podeTrocarDeLoja, podeAbrirOutroCaixa,
  caixasParaOperar, caixaDeOutraPessoa, motivoParaNaoFechar,
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

// ---------- vendedor no caixa de quem está acima (migration 113) ----------
const VENDEDOR = "u-vendedor";
const GERENTE = "u-gerente";
const meuJuazeiro = { id: "cx-meu", loja_id: JUAZEIRO, usuario_id: VENDEDOR };
const doGerente = { id: "cx-ger", loja_id: JUAZEIRO, usuario_id: GERENTE };
const doGerentePetrolina = { id: "cx-ger-p", loja_id: PETROLINA, usuario_id: GERENTE };

describe("caixasParaOperar — próprios + liberados pelo banco", () => {
  it("vendedor sem caixa próprio opera o do gerente na filial do topo", () => {
    const todos = caixasParaOperar([], [doGerente]);
    expect(caixaAtivoNaLoja(todos, JUAZEIRO, null)).toBe(doGerente);
  });

  it("com o próprio aberto, é nele que o vendedor cai", () => {
    const todos = caixasParaOperar([meuJuazeiro], [doGerente]);
    expect(caixaAtivoNaLoja(todos, JUAZEIRO, null)).toBe(meuJuazeiro);
  });

  it("escolher o caixa do gerente no seletor vale", () => {
    const todos = caixasParaOperar([meuJuazeiro], [doGerente]);
    expect(caixaAtivoNaLoja(todos, JUAZEIRO, "cx-ger")).toBe(doGerente);
  });

  it("não repete o caixa que vem nas duas listas (o banco também devolve os próprios)", () => {
    const todos = caixasParaOperar([meuJuazeiro], [meuJuazeiro, doGerente]);
    expect(todos.map((c) => c.id)).toEqual(["cx-meu", "cx-ger"]);
  });

  it("caixa liberado de outra filial não entra na frente desta", () => {
    const todos = caixasParaOperar([], [doGerentePetrolina]);
    expect(caixaAtivoNaLoja(todos, JUAZEIRO, "cx-ger-p")).toBeNull();
  });

  it("sem nada liberado, é a regra de sempre: só o próprio", () => {
    expect(caixasParaOperar([cxJuazeiro], undefined)).toEqual([cxJuazeiro]);
    expect(caixasParaOperar(null, null)).toEqual([]);
  });
});

describe("caixaDeOutraPessoa", () => {
  it("o caixa do gerente, para o vendedor, é de outra pessoa", () => {
    expect(caixaDeOutraPessoa(doGerente, VENDEDOR)).toBe(true);
    expect(caixaDeOutraPessoa(meuJuazeiro, VENDEDOR)).toBe(false);
  });
  it("sem caixa ou sem dono conhecido, não", () => {
    expect(caixaDeOutraPessoa(null, VENDEDOR)).toBe(false);
    expect(caixaDeOutraPessoa(cxJuazeiro, VENDEDOR)).toBe(false);
  });
});

describe("motivoParaNaoFechar — só quem abriu, e com a permissão", () => {
  it("quem abriu e tem caixa.fechar fecha", () => {
    expect(motivoParaNaoFechar(meuJuazeiro, VENDEDOR, true)).toBeNull();
  });
  it("vendedor no caixa do gerente vende, mas não fecha", () => {
    expect(motivoParaNaoFechar(doGerente, VENDEDOR, true, "Fulano")).toMatch(/aberto por Fulano/);
  });
  it("sem a permissão, nem o próprio", () => {
    expect(motivoParaNaoFechar(meuJuazeiro, VENDEDOR, false)).toMatch(/permissão/);
  });
  it("sem caixa, não há o que fechar", () => {
    expect(motivoParaNaoFechar(null, VENDEDOR, true)).not.toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { lojaInicial, alternaFiliais, idsDeLojas } from "./lojas-permitidas";

const PETROLINA = { id: "p", matriz: false };
const JUAZEIRO = { id: "j", matriz: true };

describe("lojaInicial", () => {
  it("mantém a filial atual quando ela é permitida", () => {
    expect(lojaInicial([PETROLINA, JUAZEIRO], "p", "j")).toBe("p");
  });

  it("filial guardada no navegador que deixou de ser do usuário é trocada", () => {
    // o administrador tirou o usuário de Petrolina; o navegador lembrava dela
    expect(lojaInicial([JUAZEIRO], "p", null)).toBe("j");
  });

  it("sem atual válida, vai para a loja padrão do usuário", () => {
    expect(lojaInicial([PETROLINA, JUAZEIRO], null, "p")).toBe("p");
  });

  it("loja padrão fora das permitidas não vale", () => {
    expect(lojaInicial([PETROLINA], null, "j")).toBe("p");
  });

  it("sem padrão, a matriz entre as permitidas", () => {
    expect(lojaInicial([PETROLINA, JUAZEIRO], null, null)).toBe("j");
  });

  it("usuário sem filial nenhuma fica sem loja", () => {
    expect(lojaInicial([], "p", "p")).toBeNull();
  });
});

describe("alternaFiliais", () => {
  it("só quem trabalha em mais de uma filial vê o seletor", () => {
    expect(alternaFiliais([JUAZEIRO])).toBe(false);
    expect(alternaFiliais([PETROLINA, JUAZEIRO])).toBe(true);
  });
});

describe("idsDeLojas", () => {
  it("aceita lista de textos e de objetos", () => {
    expect(idsDeLojas(["a", "b"])).toEqual(["a", "b"]);
    expect(idsDeLojas([{ lojas_do_usuario: "a" }])).toEqual(["a"]);
  });
  it("resposta estranha vira lista vazia, não erro", () => {
    expect(idsDeLojas(null)).toEqual([]);
    expect(idsDeLojas({})).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { montarComprovante, type DadosComprovante } from "./comprovante-fechamento";

const base: DadosComprovante = {
  loja: "X-life Petrolina",
  caixaNome: "Caixa 1 — Petrolina",
  aberturaEm: "2026-09-22T09:00:00-03:00",
  fechamentoEm: "2026-09-22T19:00:00-03:00",
  operadorAbertura: "Jean",
  operadorFechamento: "Jean",
  valorInicial: 200,
  vendasDinheiro: 89,
  entradas: 0,
  sangrias: 20,
  esperado: 269,
  informado: 269,
  formas: [{ nome: "Dinheiro (contado)", valor: 269 }, { nome: "Cartão débito", valor: 189 }],
};

describe("comprovante de fechamento", () => {
  it("sai no tamanho da bobina térmica", () => {
    const h = montarComprovante(base);
    expect(h).toContain("size: 80mm auto");   // altura livre: a térmica corta no fim
    expect(h).toContain("width: 72mm");        // útil, com 4mm de margem de cada lado
  });

  it("separa o que se confere na gaveta do que se confere no extrato", () => {
    const h = montarComprovante(base);
    expect(h).toContain("CONTADO NA GAVETA");
    expect(h).toContain("NÃO PASSA PELA GAVETA");
    // o débito de 189 não pode aparecer somado ao dinheiro contado
    expect(h).toContain("Confira no extrato");
  });

  it("gaveta que confere não vira alerta", () => {
    const h = montarComprovante(base);
    expect(h).toContain("Gaveta confere");
    expect(h).not.toContain("Falta de");
  });

  it("falta e sobra saem com o sinal certo", () => {
    expect(montarComprovante({ ...base, informado: 250 })).toContain("Falta de");
    expect(montarComprovante({ ...base, informado: 300 })).toContain("Sobra de");
  });

  it("diferença de centavos não acusa divergência", () => {
    // 269,004 vs 269: arredondamento de float não pode virar "falta"
    expect(montarComprovante({ ...base, informado: 269.004 })).toContain("Gaveta confere");
  });

  it("mostra quem abriu e quem fechou, mesmo sendo pessoas diferentes", () => {
    const h = montarComprovante({ ...base, operadorAbertura: "Ana", operadorFechamento: "Bruno" });
    expect(h).toContain("Ana");
    expect(h).toContain("Bruno");
  });

  it("escapa o que o operador digitou", () => {
    const h = montarComprovante({ ...base, observacoes: '<script>alert("x")</script>' });
    expect(h).not.toContain("<script>alert");
    expect(h).toContain("&lt;script&gt;");
  });

  it("lista os movimentos quando existem", () => {
    const h = montarComprovante({
      ...base,
      movimentos: [{ tipo: "sangria", descricao: "motoboy", valor: 20, forma: "pix" }],
    });
    expect(h).toContain("motoboy");
    expect(h).toContain("(pix)");   // forma diferente de dinheiro fica explícita
  });
});

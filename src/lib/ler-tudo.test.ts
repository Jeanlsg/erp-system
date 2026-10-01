import { describe, it, expect } from "vitest";
import { lerTudo } from "./ler-tudo";

/** Um "servidor" que corta em `limite` linhas por pedido, como o PostgREST. */
function servidor(total: number, limite: number) {
  const pedidos: [number, number][] = [];
  const montar = () => ({
    range: async (de: number, ate: number) => {
      pedidos.push([de, ate]);
      const fim = Math.min(ate + 1, de + limite, total);
      return { data: Array.from({ length: Math.max(0, fim - de) }, (_, i) => de + i), error: null };
    },
  });
  return { montar, pedidos };
}

describe("lerTudo", () => {
  it("junta todas as páginas: 2.500 linhas com corte de 1.000", async () => {
    const s = servidor(2500, 1000);
    const linhas = await lerTudo(s.montar);
    expect(linhas).toHaveLength(2500);
    expect(new Set(linhas).size).toBe(2500);
    expect(s.pedidos).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("múltiplo exato do limite pede uma página vazia e para", async () => {
    const s = servidor(2000, 1000);
    expect(await lerTudo(s.montar)).toHaveLength(2000);
    expect(s.pedidos).toHaveLength(3);
  });

  it("lista pequena: um pedido só", async () => {
    const s = servidor(10, 1000);
    expect(await lerTudo(s.montar)).toHaveLength(10);
    expect(s.pedidos).toHaveLength(1);
  });

  it("erro do servidor sobe, não vira lista parcial", async () => {
    const montar = () => ({ range: async () => ({ data: null, error: new Error("RLS") }) });
    await expect(lerTudo(montar)).rejects.toThrow("RLS");
  });
});

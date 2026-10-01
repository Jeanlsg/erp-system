import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DOMINIOS, chavesDosDominios, invalidarDominios, DOMINIOS_DA_VENDA } from "./dominios-cache";

/** Todas as chaves de leitura (primeiro elemento do queryKey) do código. */
function chavesDoCodigo(): Set<string> {
  const chaves = new Set<string>();
  const varrer = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) { varrer(p); continue; }
      if (!/\.(ts|tsx)$/.test(nome) || nome.includes(".test.")) continue;
      for (const m of readFileSync(p, "utf8").matchAll(/queryKey:\s*\[\s*['"]([a-zA-Z_0-9-]+)['"]/g)) {
        chaves.add(m[1]);
      }
    }
  };
  varrer(join(__dirname, ".."));
  return chaves;
}

describe("domínios do cache", () => {
  it("toda chave listada existe numa leitura de verdade", () => {
    // Uma chave com grafia errada invalida nada, em silêncio — foi assim que
    // "erp_produtos_completo" deixou a lista de produtos velha.
    const existentes = chavesDoCodigo();
    const fantasmas = Object.values(DOMINIOS).flat().filter((k) => !existentes.has(k));
    expect(fantasmas).toEqual([]);
  });

  it("o resumo do caixa aberto está entre o que a venda recarrega", () => {
    expect(chavesDosDominios(...DOMINIOS_DA_VENDA)).toContain("erp_caixa-aberto");
  });

  it("invalida cada chave uma vez só, por prefixo", () => {
    const chamadas: unknown[][] = [];
    invalidarDominios({ invalidateQueries: (f) => chamadas.push(f.queryKey) }, "caixa", "contas");
    const chaves = chamadas.map((c) => c[0]);
    expect(new Set(chaves).size).toBe(chaves.length);
    expect(chaves).toContain("erp_caixa");
    expect(chaves).toContain("erp_fluxo-caixa");
  });
});

import { describe, expect, it } from "vitest";
import { valorDoFiltro } from "./filtro-postgrest";

describe("valorDoFiltro", () => {
  it("põe entre aspas: vírgula e parêntese não partem o .or()", () => {
    expect(valorDoFiltro("%Whey (900g), baunilha%")).toBe('"%Whey (900g), baunilha%"');
  });
  it("escapa aspas e barra do texto", () => {
    expect(valorDoFiltro('%12" \\ x%')).toBe('"%12\\" \\\\ x%"');
  });
});

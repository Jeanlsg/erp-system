import { describe, expect, it } from "vitest";
import { periodosDoMes, variacao } from "./comparar-mes";

describe("periodosDoMes", () => {
  it("compara os mesmos dias do mês anterior", () => {
    expect(periodosDoMes(new Date(2026, 9, 11))).toEqual({
      de: "2026-10-01", ate: "2026-10-11", deAnterior: "2026-09-01", ateAnterior: "2026-09-11",
    });
  });

  it("para no último dia de um mês anterior mais curto", () => {
    expect(periodosDoMes(new Date(2026, 2, 31)).ateAnterior).toBe("2026-02-28");
  });

  it("janeiro compara com dezembro do ano anterior", () => {
    const p = periodosDoMes(new Date(2027, 0, 5));
    expect(p.deAnterior).toBe("2026-12-01");
    expect(p.ateAnterior).toBe("2026-12-05");
  });
});

describe("variacao", () => {
  it("calcula a fração", () => {
    expect(variacao(110, 100)).toBeCloseTo(0.1);
    expect(variacao(50, 100)).toBeCloseTo(-0.5);
  });
  it("sem base não compara", () => {
    expect(variacao(10, 0)).toBeNull();
  });
});

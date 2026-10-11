import { describe, it, expect } from "vitest";
import { date } from "./format";

describe("date (dia do calendário)", () => {
  it("aaaa-mm-dd não volta um dia no fuso do Brasil", () => {
    expect(date("2027-05-08")).toBe("08/05/2027");
    expect(date("2026-10-01")).toBe("01/10/2026");
  });
});

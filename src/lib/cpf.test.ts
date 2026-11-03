import { describe, it, expect } from "vitest";
import { cpfValido, formatarCpf, soDigitos, tipoDoLogin } from "./cpf";

// CPFs gerados só para teste (dígitos verificadores válidos, sem dono)
const VALIDO = "52998224725";

describe("cpfValido", () => {
  it("aceita com e sem máscara", () => {
    expect(cpfValido(VALIDO)).toBe(true);
    expect(cpfValido("529.982.247-25")).toBe(true);
  });
  it("recusa dígito verificador errado", () => {
    expect(cpfValido("52998224724")).toBe(false);
    expect(cpfValido("52998224735")).toBe(false);
  });
  it("recusa tamanho errado e números repetidos", () => {
    expect(cpfValido("5299822472")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("")).toBe(false);
    expect(cpfValido(null)).toBe(false);
  });
  it("aceita CPF com dígito verificador 0", () => {
    // resto 10 vira 0
    expect(cpfValido("12345678909")).toBe(true);
  });
});

describe("formatarCpf / soDigitos", () => {
  it("põe e tira a máscara", () => {
    expect(formatarCpf(VALIDO)).toBe("529.982.247-25");
    expect(soDigitos("529.982.247-25")).toBe(VALIDO);
  });
  it("o que não tem 11 dígitos volta como veio", () => {
    expect(formatarCpf("123")).toBe("123");
  });
});

describe("tipoDoLogin", () => {
  it("com @ é e-mail, sem @ é CPF", () => {
    expect(tipoDoLogin("ana@loja.com")).toBe("email");
    expect(tipoDoLogin("529.982.247-25")).toBe("cpf");
  });
});

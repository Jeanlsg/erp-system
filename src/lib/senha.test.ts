import { describe, expect, it } from "vitest";
import { gerarSenhaTemporaria, problemaDaSenha, SENHA_MINIMA } from "./senha";

describe("problemaDaSenha", () => {
  it("aceita letras e números com o mínimo", () => {
    expect(problemaDaSenha("abcd1234")).toBeNull();
  });
  it("recusa curta, só letras, só números e vazia", () => {
    expect(problemaDaSenha("abc123")).toMatch(String(SENHA_MINIMA));
    expect(problemaDaSenha("abcdefgh")).toMatch(/letras e números/);
    expect(problemaDaSenha("12345678")).toMatch(/letras e números/);
    expect(problemaDaSenha("")).toBe("Digite a senha.");
    expect(problemaDaSenha(undefined)).toBe("Digite a senha.");
  });
  it("recusa acima de 72 bytes (o bcrypt ignora o resto)", () => {
    expect(problemaDaSenha("a1" + "é".repeat(36))).toMatch(/72/);
  });
});

describe("gerarSenhaTemporaria", () => {
  it("12 caracteres, passa na regra e não usa os que confundem", () => {
    for (let i = 0; i < 200; i++) {
      const s = gerarSenhaTemporaria();
      expect(s).toHaveLength(12);
      expect(problemaDaSenha(s)).toBeNull();
      expect(s).not.toMatch(/[0O1lI]/);
    }
  });
  it("não repete", () => {
    const vistas = new Set(Array.from({ length: 50 }, gerarSenhaTemporaria));
    expect(vistas.size).toBe(50);
  });
});

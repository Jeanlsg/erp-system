import { describe, it, expect } from "vitest";
import { permissaoDaRota } from "./app-sidebar";

describe("permissaoDaRota", () => {
  it("protege as telas sensíveis", () => {
    expect(permissaoDaRota("/financeiro")).toBe("financeiro.ver");
    expect(permissaoDaRota("/gestao/funcionarios")).toBe("usuario.ver");
    expect(permissaoDaRota("/gestao/usuarios")).toBe("usuario.ver");
    expect(permissaoDaRota("/config/sistema")).toBe("config.ver");
    expect(permissaoDaRota("/produtos-estoque-lotes")).toBe("produto.ver");
    expect(permissaoDaRota("/gestao/dados-empresariais")).toBe("config.ver");
    expect(permissaoDaRota("/gestao/consulta-pessoa-fisica")).toBe("financeiro.ver");
    expect(permissaoDaRota("/relatorios")).toBe("relatorio.ver");
  });
  it("deixa o PDV e o caixa para quem opera", () => {
    expect(permissaoDaRota("/pdv")).toBe("pdv.usar");
    expect(permissaoDaRota("/caixa")).toBe("caixa.abrir");
  });
  it("mantém abertas as telas de todo mundo", () => {
    expect(permissaoDaRota("/")).toBeNull();
    expect(permissaoDaRota("/ajuda")).toBeNull();
    expect(permissaoDaRota("/tutoriais")).toBeNull();
  });
  it("prefere a rota mais específica", () => {
    // /gestao/clientes não pode herdar de um prefixo mais curto
    expect(permissaoDaRota("/gestao/clientes")).toBe("cliente.editar");
  });
  it("as telas de relatório financeiro herdam a permissão de /relatorios", () => {
    // /relatorios/financeiro/sangrias não tem item de menu próprio; quem
    // protege é o prefixo. Sem isso, qualquer usuário abriria o financeiro
    // pela URL do relatório.
    expect(permissaoDaRota("/relatorios/financeiro/sangrias")).toBe("relatorio.ver");
    expect(permissaoDaRota("/relatorios/financeiro/fechamentos")).toBe("relatorio.ver");
  });

  it("rota desconhecida não trava o sistema", () => {
    expect(permissaoDaRota("/rota-que-nao-existe")).toBeNull();
  });
});

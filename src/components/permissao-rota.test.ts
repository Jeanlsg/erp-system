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
  it("as telas de relatório financeiro herdam a permissão do financeiro", () => {
    // não têm item de menu próprio; quem protege é o prefixo /financeiro.
    // Sem isso, qualquer usuário abriria o financeiro pela URL do relatório —
    // foi o que aconteceu quando o item "Relatórios" saiu do menu.
    expect(permissaoDaRota("/financeiro/relatorio/sangrias")).toBe("financeiro.ver");
    expect(permissaoDaRota("/financeiro/relatorio/fechamentos")).toBe("financeiro.ver");
  });

  it("as abas do financeiro continuam sob financeiro.ver", () => {
    expect(permissaoDaRota("/financeiro")).toBe("financeiro.ver");
  });

  it("rota desconhecida não trava o sistema", () => {
    expect(permissaoDaRota("/rota-que-nao-existe")).toBeNull();
  });
});

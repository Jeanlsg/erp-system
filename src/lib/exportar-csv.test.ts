import { describe, it, expect } from "vitest";
import { gerarCSV, nomeArquivoRelatorio, type Coluna } from "./exportar-csv";

type L = { nome: string; qtd: number; valor: number; obs: string | null };
const cols: Coluna<L>[] = [
  { chave: "nome", titulo: "Produto" },
  { chave: "qtd", titulo: "Qtd", tipo: "numero" },
  { chave: "valor", titulo: "Valor", tipo: "dinheiro" },
  { chave: "obs", titulo: "Observação" },
  { chave: "acoes", titulo: "Ações", semExport: true },
];

describe("gerarCSV", () => {
  it("usa ; e vírgula decimal (o que o Excel pt-BR entende)", () => {
    const csv = gerarCSV([{ nome: "Whey", qtd: 3, valor: 1234.5, obs: null }], cols);
    const [cab, linha] = csv.trim().split("\r\n");
    expect(cab).toBe("Produto;Qtd;Valor;Observação");   // coluna semExport fora
    expect(linha).toBe("Whey;3;1234,50;");
  });

  it("protege campo que contém ponto e vírgula, aspas ou quebra", () => {
    const csv = gerarCSV([{ nome: 'Whey "Gold"; 900g', qtd: 1, valor: 0, obs: "linha1\nlinha2" }], cols);
    const linha = csv.trim().split("\r\n")[1];
    expect(linha).toContain('"Whey ""Gold""; 900g"');
    expect(linha).toContain('"linha1\nlinha2"');
  });

  it("valor calculado entra pela função da coluna", () => {
    const c: Coluna<L>[] = [{ chave: "dobro", titulo: "Dobro", tipo: "numero", valor: (l) => l.qtd * 2 }];
    expect(gerarCSV([{ nome: "x", qtd: 4, valor: 0, obs: null }], c).trim().split("\r\n")[1]).toBe("8");
  });

  it("nome do arquivo carrega o período", () => {
    expect(nomeArquivoRelatorio("Fechamentos de caixa", "2026-09-01", "2026-09-22"))
      .toBe("fechamentos-de-caixa_2026-09-01_a_2026-09-22.csv");
  });
});

import { describe, it, expect, vi } from "vitest";
import { cancelarVendaEmOrdem, resumoCancelamento, type NotaDaVenda } from "./cancelar-venda";

function passos(notas: NotaDaVenda[], opts: { simularFalha?: string; notaFalha?: string } = {}) {
  const ordem: string[] = [];
  return {
    ordem,
    p: {
      simular: vi.fn(async () => { ordem.push("simular"); if (opts.simularFalha) throw new Error(opts.simularFalha); }),
      notas: vi.fn(async () => notas),
      cancelarNota: vi.fn(async (id: string) => { ordem.push(`nota:${id}`); if (opts.notaFalha) throw new Error(opts.notaFalha); }),
      cancelar: vi.fn(async () => { ordem.push("venda"); return { cancelada: true, itens_ao_estoque: 2, contas_canceladas: 1 }; }),
    },
  };
}

describe("cancelarVendaEmOrdem", () => {
  it("simula, cancela a nota autorizada e só então a venda", async () => {
    const { p, ordem } = passos([
      { id: "n1", numero: 5, tipo: "nfce", status: "autorizada" },
      { id: "n0", numero: 4, tipo: "nfce", status: "rejeitada" },
    ]);
    const r = await cancelarVendaEmOrdem(p);
    expect(ordem).toEqual(["simular", "nota:n1", "venda"]);
    expect(r.notasCanceladas).toEqual(["NFC-e nº 5"]);
  });

  it("recusa do banco na simulação não toca na SEFAZ", async () => {
    const { p, ordem } = passos([{ id: "n1", numero: 5, tipo: "nfce", status: "autorizada" }], { simularFalha: "caixa fechado" });
    await expect(cancelarVendaEmOrdem(p)).rejects.toThrow("caixa fechado");
    expect(ordem).toEqual(["simular"]);
  });

  it("SEFAZ recusando o cancelamento da nota deixa a venda como está", async () => {
    const { p, ordem } = passos([{ id: "n1", numero: 5, tipo: "nfce", status: "autorizada" }], { notaFalha: "prazo expirado" });
    await expect(cancelarVendaEmOrdem(p)).rejects.toThrow(/NÃO foi cancelada/);
    expect(ordem).not.toContain("venda");
  });

  it("nota ainda não transmitida recusa antes de qualquer cancelamento", async () => {
    const { p, ordem } = passos([{ id: "n1", numero: 7, tipo: "nfce", status: "pendente_transmissao" }]);
    await expect(cancelarVendaEmOrdem(p)).rejects.toThrow(/não foi transmitida/);
    expect(ordem).toEqual(["simular"]);
  });

  it("venda sem nota vai direto", async () => {
    const { p, ordem } = passos([]);
    await cancelarVendaEmOrdem(p);
    expect(ordem).toEqual(["simular", "venda"]);
  });
});

describe("resumoCancelamento", () => {
  it("diz o que foi desfeito", () => {
    expect(resumoCancelamento({ cancelada: true, itens_ao_estoque: 2, contas_canceladas: 1, pontos_estornados: 10 }, ["NFC-e nº 5"]))
      .toBe("NFC-e nº 5 cancelada(s) na SEFAZ · 2 item(ns) de volta ao estoque · 1 conta(s) a receber cancelada(s) · 10 ponto(s) de fidelidade estornado(s)");
  });
});

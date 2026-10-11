import { describe, it, expect } from "vitest";
import {
  intervaloDoMes, notasDoRelatorio, resumoDasNotas, caminhoNoZip, nomeDoZip, htmlRelatorioContadora, vendasSemNota, type NotaRel,
} from "./relatorio-contadora";

const nota = (o: Partial<NotaRel>): NotaRel => ({
  id: "x", tipo: "nfce", numero: 1, serie: 1, status: "autorizada", ambiente: "producao",
  finalidade: 1, valor_total: 10, chave_acesso: "2626", xml_path: "p.xml", ...o,
});

describe("intervaloDoMes", () => {
  it("vai do dia 1 ao dia 1 do mês seguinte", () => {
    const { de, ate } = intervaloDoMes("2026-12");
    expect(new Date(de).getMonth()).toBe(11);
    expect(new Date(ate).getFullYear()).toBe(2027);
    expect(new Date(ate).getMonth()).toBe(0);
  });
});

describe("notasDoRelatorio", () => {
  const notas = [
    nota({ id: "a" }), nota({ id: "b", status: "cancelada" }), nota({ id: "c", status: "rejeitada" }),
    nota({ id: "d", ambiente: "homologacao" }),
  ];
  it("só autorizada e cancelada de produção", () => {
    expect(notasDoRelatorio(notas).map((n) => n.id)).toEqual(["a", "b"]);
  });
  it("homologação entra só se pedido", () => {
    expect(notasDoRelatorio(notas, true).map((n) => n.id)).toEqual(["a", "b", "d"]);
  });
});

describe("resumoDasNotas", () => {
  it("soma só as autorizadas, por tipo", () => {
    const r = resumoDasNotas([
      nota({ valor_total: 100 }), nota({ tipo: "nfe", valor_total: 50.5 }),
      nota({ finalidade: 4, tipo: "nfe", valor_total: 20 }), nota({ status: "cancelada", valor_total: 999 }),
    ]);
    expect(r.autorizadas).toBe(3);
    expect(r.canceladas).toBe(1);
    expect(r.valorAutorizado).toBe(170.5);
    expect(r.porTipo.find((t) => t.rotulo === "Devolução")?.valor).toBe(20);
  });
});

describe("ZIP", () => {
  it("pastas por situação e tipo", () => {
    expect(caminhoNoZip(nota({ chave_acesso: "K1" }))).toBe("nfce/K1.xml");
    expect(caminhoNoZip(nota({ tipo: "nfe", chave_acesso: "K2" }))).toBe("nfe/K2.xml");
    expect(caminhoNoZip(nota({ finalidade: 4, chave_acesso: "K3" }))).toBe("devolucoes/K3.xml");
    expect(caminhoNoZip(nota({ status: "cancelada", chave_acesso: "K4" }))).toBe("canceladas/K4.xml");
  });
  it("nome do arquivo sem acento nem espaço", () => {
    expect(nomeDoZip("2026-10", "Juazeiro ★")).toBe("notas-2026-10-Juazeiro.zip");
  });
});

describe("htmlRelatorioContadora", () => {
  it("marca quando inclui homologação e lista vazios", () => {
    const h = htmlRelatorioContadora({ mes: "2026-10", loja: "Petrolina", notas: [], entradas: [], inutilizacoes: [], homologacao: true });
    expect(h).toContain("INCLUI NOTAS DE HOMOLOGAÇÃO");
    expect(h).toContain("10/2026");
    expect(h).toContain("Nenhuma nota no mês");
  });
});

describe("vendasSemNota", () => {
  const vendas = [
    { id: "v1", total: 100, status: "finalizada" },
    { id: "v2", total: 50, status: "finalizada" },
    { id: "v3", total: 30, status: "cancelada" },
    { id: "v4", total: 20, status: "finalizada" },
  ];
  const notas = [
    { venda_id: "v1", status: "autorizada", ambiente: "producao" },
    { venda_id: "v2", status: "autorizada", ambiente: "homologacao" },
    { venda_id: "v4", status: "rejeitada", ambiente: "producao" },
  ];
  it("conta só finalizadas sem nota autorizada; homologação só se pedido", () => {
    expect(vendasSemNota(vendas, notas)).toEqual({ quantidade: 2, valor: 70 });
    expect(vendasSemNota(vendas, notas, true)).toEqual({ quantidade: 1, valor: 20 });
  });
});

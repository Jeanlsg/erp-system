import { describe, it, expect } from "vitest";
import {
  sugerirRegiao, totalComEntrega, faltaNaEntrega, avisoValorMinimo,
  aplicarViaCep, entregaVazia, entregaParaPayload, ENDERECO_VAZIO, type RegiaoEntrega,
} from "./entrega-venda";

const REGIOES: RegiaoEntrega[] = [
  { id: "a", nome: "Centro", taxa: 5, bairros: ["Centro", "Vila Eduardo"] },
  { id: "b", nome: "Faixa sul", taxa: 8, cep_inicio: "56300-000", cep_fim: "56309-999" },
  { id: "c", nome: "Condomínio", taxa: 12, ceps: ["56310-123"], valor_minimo: 50 },
  { id: "d", nome: "José e Maria", taxa: 7 },
];

describe("sugerirRegiao", () => {
  it("CEP da lista vence faixa e bairro", () => {
    expect(sugerirRegiao(REGIOES, { cep: "56310123", bairro: "Centro" })?.id).toBe("c");
  });
  it("CEP dentro da faixa", () => {
    expect(sugerirRegiao(REGIOES, { cep: "56305-010", bairro: "" })?.id).toBe("b");
  });
  it("bairro sem acento e em minúsculas casa com a lista", () => {
    expect(sugerirRegiao(REGIOES, { cep: "", bairro: "  vila  eduardo " })?.id).toBe("a");
  });
  it("bairro igual ao nome da região", () => {
    expect(sugerirRegiao(REGIOES, { cep: "", bairro: "JOSE E MARIA" })?.id).toBe("d");
  });
  it("sem nada que case não chuta", () => {
    expect(sugerirRegiao(REGIOES, { cep: "01001000", bairro: "Sé" })).toBeNull();
  });
});

describe("totalComEntrega", () => {
  it("soma a taxa ao total", () => {
    expect(totalComEntrega(100, 10, 0, 7.5)).toBe(97.5);
  });
  it("desconto não come a taxa", () => {
    expect(totalComEntrega(50, 80, 0, 6)).toBe(6);
  });
  it("taxa negativa vira zero", () => {
    expect(totalComEntrega(10, 0, 0, -3)).toBe(10);
  });
});

describe("faltaNaEntrega", () => {
  const completa = () => ({
    ...entregaVazia(),
    endereco: { ...ENDERECO_VAZIO, logradouro: "Rua A", numero: "10", bairro: "Centro", cidade: "Petrolina", uf: "PE" },
  });
  it("sem cliente recusa", () => {
    expect(faltaNaEntrega(completa(), "")).toMatch(/cliente/);
  });
  it("aponta o que falta no endereço", () => {
    const e = completa(); e.endereco.numero = ""; e.endereco.bairro = " ";
    expect(faltaNaEntrega(e, "x")).toBe("Endereço de entrega incompleto: falta número, bairro.");
  });
  it("completa passa", () => {
    expect(faltaNaEntrega(completa(), "x")).toBeNull();
  });
});

describe("avisoValorMinimo", () => {
  it("avisa abaixo do mínimo e cala acima", () => {
    expect(avisoValorMinimo(REGIOES[2], 30)).toMatch(/mínimo/);
    expect(avisoValorMinimo(REGIOES[2], 60)).toBeNull();
    expect(avisoValorMinimo(REGIOES[0], 1)).toBeNull();
  });
});

describe("aplicarViaCep", () => {
  it("preenche rua, bairro, cidade, UF e IBGE e mantém o número", () => {
    const atual = { ...ENDERECO_VAZIO, numero: "45" };
    const r = aplicarViaCep(atual, { cep: "56304-000", logradouro: "Av. X", bairro: "Centro", localidade: "Petrolina", uf: "PE", ibge: "2611101" });
    expect(r).toMatchObject({ numero: "45", logradouro: "Av. X", cidade: "Petrolina", uf: "PE", codigo_municipio: "2611101" });
  });
  it("CEP inexistente não apaga o que foi digitado", () => {
    const atual = { ...ENDERECO_VAZIO, logradouro: "Rua A" };
    expect(aplicarViaCep(atual, { erro: true })).toBe(atual);
  });
});

describe("entregaParaPayload", () => {
  it("arredonda a taxa e limpa campos vazios", () => {
    const e = entregaVazia();
    e.taxa = 5.555;
    e.endereco = { ...ENDERECO_VAZIO, logradouro: " Rua A ", numero: "1", uf: "pe", codigo_municipio: "26.11101" };
    const p = entregaParaPayload(e, "Centro");
    expect(p.taxa).toBe(5.56);
    expect(p.endereco).toMatchObject({ logradouro: "Rua A", uf: "PE", complemento: null, codigo_municipio: "2611101" });
    expect(p.previsao_entrega).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { assinaturaDoCupom, reacaoAoCupom } from "./estado-venda";

const creatina = { produto_id: "creatina", quantidade: 1, preco_unitario: 79 };
const coqueteleira = { produto_id: "coqueteleira", quantidade: 1, preco_unitario: 15 };

describe("assinaturaDoCupom", () => {
  it("não depende da ordem dos itens", () => {
    expect(assinaturaDoCupom([creatina, coqueteleira])).toBe(assinaturaDoCupom([coqueteleira, creatina]));
  });
  it("muda com quantidade, preço e desconto do item", () => {
    const base = assinaturaDoCupom([creatina]);
    expect(assinaturaDoCupom([{ ...creatina, quantidade: 2 }])).not.toBe(base);
    expect(assinaturaDoCupom([{ ...creatina, preco_unitario: 70 }])).not.toBe(base);
    expect(assinaturaDoCupom([{ ...creatina, desconto: 5 }])).not.toBe(base);
  });
});

describe("reacaoAoCupom", () => {
  const s1 = assinaturaDoCupom([creatina]);
  const s2 = assinaturaDoCupom([coqueteleira]);
  it("cupom esvaziado zera a venda (o caso do desconto que ficava)", () => {
    expect(reacaoAoCupom(s1, "", false)).toBe("zerar_venda");
    expect(reacaoAoCupom(s1, "", true)).toBe("zerar_venda");
  });
  it("trocar os itens com pagamento lançado descarta os pagamentos (o caso da coqueteleira)", () => {
    expect(reacaoAoCupom(s1, s2, true)).toBe("descartar_pagamentos");
  });
  it("sem pagamento, trocar itens não mexe em nada", () => {
    expect(reacaoAoCupom(s1, s2, false)).toBe("nada");
  });
  it("sem mudança, nada", () => {
    expect(reacaoAoCupom(s1, s1, true)).toBe("nada");
  });
});

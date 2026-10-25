// Como a loja aparece nos DOCUMENTOS FISCAIS (NF-e/NFC-e).
//
// Desde 10/2026 o `apelido` da loja é só de tela: a pedido da loja, as duas
// unidades passaram a aparecer no sistema como "Matriz" e "Filial"
// (migration 114). Fora do sistema esse rótulo não identifica ninguém — o
// nome fantasia (xFant) da nota viraria "Matriz" e a remessa diria
// "Remessa para filial Filial". A nota usa o `nome` do cadastro, que é o
// nome comercial ("X-life Suplementos Juazeiro"), e a cidade, que continua
// a real (Juazeiro-BA / Petrolina-PE).

export type LojaFiscal = { nome?: string | null; cidade?: string | null; uf?: string | null };

const limpo = (s: string | null | undefined) => (s ?? "").trim();
const comparavel = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** Nome fantasia do emitente (xFant): o nome comercial, nunca o apelido de tela. */
export function nomeFantasiaFiscal(loja: LojaFiscal): string | undefined {
  return limpo(loja.nome) || undefined;
}

/**
 * Loja citada num texto livre da nota (infCpl), por exemplo o destino de uma
 * remessa: nome comercial + cidade/UF. As duas lojas podem ter o mesmo nome
 * de empresa; a cidade é o que as separa. Quando o nome já traz a cidade
 * ("X-life Suplementos Petrolina"), ela não é repetida.
 */
export function lojaNoTextoFiscal(loja: LojaFiscal): string {
  const nome = limpo(loja.nome);
  const cidade = limpo(loja.cidade);
  const local = [cidade, limpo(loja.uf).toUpperCase()].filter(Boolean).join("/");
  if (!local) return nome;
  if (!nome) return local;
  if (cidade && comparavel(nome).includes(comparavel(cidade))) return nome;
  return `${nome} - ${local}`;
}

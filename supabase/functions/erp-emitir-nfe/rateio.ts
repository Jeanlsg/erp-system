// ============================================================================
// Rateio dos valores da venda pelos itens da nota.
//
// A SEFAZ soma o total da nota a partir dos itens: vNF = Σ vProd − Σ vDesc +
// Σ vFrete + Σ vOutro. Desconto geral, acréscimo e taxa de entrega existem
// na VENDA, não em um item — então são distribuídos pelos itens na proporção
// do valor de cada um, em centavos, com a sobra de arredondamento indo para
// os maiores restos (a soma bate centavo a centavo).
//
// ⚠️ Antes nada disso ia para a nota: os itens saíam pelo preço cheio e o
// pagamento pelo total da venda. Venda com desconto dava vNF maior que o
// pago; venda com entrega, menor. Uma rejeição na primeira venda real.
//
// O desconto é DERIVADO do total gravado (Σ vProd + frete + acréscimo −
// total), não somado de campos: o total da venda é o que o cliente pagou, e
// é ele que a nota tem de mostrar, venha a venda do PDV, de orçamento ou de
// pedido.
//
// Arquivo sem dependências: testado pelo vitest (rateio.test.ts) e
// importado pelo index.ts da edge.
// ============================================================================

const cent = (v: number) => Math.round((Number(v) || 0) * 100);

/** Divide `valor` pelos `pesos` em centavos; a soma do resultado é exatamente `valor`. */
export function ratear(valor: number, pesos: number[]): number[] {
  const totalCent = cent(valor);
  const n = pesos.length;
  if (n === 0) return [];
  if (totalCent === 0) return pesos.map(() => 0);
  const p = pesos.map((x) => Math.max(0, Number(x) || 0));
  const soma = p.reduce((s, x) => s + x, 0);
  // sem base (itens a zero): divide por igual
  const base = soma > 0 ? p : p.map(() => 1);
  const somaBase = soma > 0 ? soma : n;
  const exatos = base.map((x) => (totalCent * x) / somaBase);
  const inteiros = exatos.map(Math.floor);
  let sobra = totalCent - inteiros.reduce((s, x) => s + x, 0);
  const ordem = exatos
    .map((x, i) => ({ i, resto: x - Math.floor(x) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (let k = 0; sobra > 0; k = (k + 1) % n, sobra--) inteiros[ordem[k].i]++;
  return inteiros.map((c) => c / 100);
}

export interface ItemNota {
  quantidade: number;
  valor_unitario: number;
  [k: string]: unknown;
}

export interface ValoresVenda {
  /** total gravado na venda: é o que a nota tem de fechar */
  total: number;
  /** taxa de entrega (vira vFrete, ou vOutro quando a nota não pode ter frete) */
  frete: number;
  acrescimo: number;
  /** true = taxa vai como frete; false = como outras despesas (NFC-e sem entrega a domicílio) */
  freteComoFrete: boolean;
}

export interface ItemRateado extends ItemNota {
  valor_desconto?: number;
  valor_frete?: number;
  valor_outro?: number;
}

/** vProd do item como a nota calcula (2 casas). */
const vProd = (i: ItemNota) => Math.round(i.quantidade * i.valor_unitario * 100) / 100;

export function ratearValoresDaVenda(itens: ItemNota[], v: ValoresVenda): ItemRateado[] {
  const prods = itens.map(vProd);
  const somaProd = prods.reduce((s, x) => s + x, 0);
  const frete = Math.max(0, cent(v.frete)) / 100;
  const outro = Math.max(0, cent(v.acrescimo)) / 100;
  // desconto = o que falta para os itens + frete + acréscimo chegarem ao total.
  // ⚠️ Negativo quer dizer que a venda tem valor que não está nos itens da
  // nota (kit, serviço): NÃO vira "outras despesas" — esconderia mercadoria
  // num campo de despesa. Fica sem desconto e o totalDaNota não fecha, e a
  // edge recusa com a explicação.
  // desconto nunca passa do valor dos produtos (vDesc ≤ vProd por item)
  const desconto = Math.min(Math.max(0, (cent(somaProd) + cent(frete) + cent(outro) - cent(v.total)) / 100), somaProd);

  const descs = ratear(desconto, prods);
  const fretes = ratear(frete, prods);
  const outrosDaEntrega = v.freteComoFrete ? prods.map(() => 0) : fretes;
  const outros = ratear(outro, prods).map((x, k) => Math.round((x + outrosDaEntrega[k]) * 100) / 100);

  return itens.map((item, k) => {
    const r: ItemRateado = { ...item };
    if (descs[k] > 0) r.valor_desconto = descs[k];
    if (v.freteComoFrete && fretes[k] > 0) r.valor_frete = fretes[k];
    if (outros[k] > 0) r.valor_outro = outros[k];
    return r;
  });
}

/** vNF que a SEFAZ vai calcular a partir dos itens rateados (para conferir antes de enviar). */
export function totalDaNota(itens: ItemRateado[]): number {
  const c = itens.reduce(
    (s, i) => s + cent(vProd(i)) - cent(i.valor_desconto ?? 0) + cent(i.valor_frete ?? 0) + cent(i.valor_outro ?? 0),
    0,
  );
  return c / 100;
}

export interface EnderecoEntregaNota {
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  codigo_municipio?: string | null;
  complemento?: string | null;
}

/**
 * A NFC-e só aceita frete como "entrega a domicílio" (indPres=4), e aí exige
 * destinatário identificado e com endereço (rejeições 753, 787, 788). Devolve
 * o que falta, ou null se a nota pode sair como entrega.
 */
export function faltaParaEntregaNfce(docDestinatario: string | null | undefined, e: EnderecoEntregaNota | null): string | null {
  const doc = String(docDestinatario ?? "").replace(/\D/g, "");
  if (doc.length !== 11 && doc.length !== 14) return "cliente sem CPF/CNPJ";
  if (!e) return "venda sem endereço de entrega";
  const faltas = [
    !e.logradouro && "rua", !e.numero && "número", !e.bairro && "bairro",
    !e.cidade && "cidade", !e.uf && "UF",
    String(e.codigo_municipio ?? "").replace(/\D/g, "").length !== 7 && "código IBGE do município (busque pelo CEP)",
  ].filter(Boolean);
  return faltas.length ? `endereço sem ${faltas.join(", ")}` : null;
}

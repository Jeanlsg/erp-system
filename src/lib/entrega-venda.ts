// ============================================================
// Entrega na finalização da venda do PDV.
//
// O sistema anterior da loja perguntava "Precisa de entrega?" no fechamento
// da venda: com "Sim", pedia transportadora, região (que define a taxa),
// frete e endereço, e o frete passava a fazer parte do total a pagar. Aqui
// é a mesma conta, em funções puras para a tela e o teste concordarem.
//
// A taxa é parte do que o cliente paga: entra no total, no "falta pagar" e
// no troco. Fica fora do desconto — desconto é sobre mercadoria.
// ============================================================

export interface EnderecoEntrega {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  referencia: string;
  /** IBGE do município. Sem ele a NFC-e não pode sair como entrega a domicílio. */
  codigo_municipio: string;
}

export interface EntregaVenda {
  regiao_id: string | null;
  transportadora_id: string | null;
  taxa: number;
  entrega_futura: boolean;
  /** "AAAA-MM-DDTHH:mm" do campo datetime-local, ou vazio */
  previsao: string;
  endereco: EnderecoEntrega;
  /** endereço salvo do cliente que foi carregado (para atualizar em vez de duplicar) */
  endereco_id: string | null;
  salvar_endereco: boolean;
}

export const ENDERECO_VAZIO: EnderecoEntrega = {
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "",
  cidade: "", uf: "", referencia: "", codigo_municipio: "",
};

export const entregaVazia = (): EntregaVenda => ({
  regiao_id: null, transportadora_id: null, taxa: 0, entrega_futura: false,
  previsao: "", endereco: { ...ENDERECO_VAZIO }, endereco_id: null, salvar_endereco: true,
});

export interface RegiaoEntrega {
  id: string;
  nome: string;
  taxa?: number | string | null;
  ceps?: string[] | null;
  cep_inicio?: string | null;
  cep_fim?: string | null;
  bairros?: string[] | null;
  valor_minimo?: number | string | null;
}

const soDigitos = (s: string | null | undefined) => String(s ?? "").replace(/\D/g, "");

/** Compara bairro como o entregador fala: sem acento, sem caixa, sem espaço sobrando. */
export function normalizarTexto(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * Região que atende o endereço, para a taxa vir sozinha. Ordem: CEP na lista
 * da região, CEP dentro da faixa, bairro na lista, bairro com o nome da
 * região. Sem nada que case, devolve null e o operador escolhe — chutar a
 * região errada cobraria a taxa errada sem ninguém ver.
 */
export function sugerirRegiao(
  regioes: RegiaoEntrega[],
  endereco: Pick<EnderecoEntrega, "cep" | "bairro">,
): RegiaoEntrega | null {
  const cep = soDigitos(endereco.cep);
  const bairro = normalizarTexto(endereco.bairro);

  if (cep.length === 8) {
    const naLista = regioes.find((r) => (r.ceps ?? []).some((c) => soDigitos(c) === cep));
    if (naLista) return naLista;
    const naFaixa = regioes.find((r) => {
      const ini = soDigitos(r.cep_inicio), fim = soDigitos(r.cep_fim);
      return ini.length === 8 && fim.length === 8 && cep >= ini && cep <= fim;
    });
    if (naFaixa) return naFaixa;
  }
  if (bairro) {
    const porLista = regioes.find((r) => (r.bairros ?? []).some((b) => normalizarTexto(b) === bairro));
    if (porLista) return porLista;
    const porNome = regioes.find((r) => normalizarTexto(r.nome) === bairro);
    if (porNome) return porNome;
  }
  return null;
}

export const taxaDaRegiao = (r: RegiaoEntrega | null | undefined) => Math.max(0, Number(r?.taxa) || 0);

/**
 * Total a pagar com a entrega. O desconto não come a taxa: um desconto de
 * 100% na mercadoria ainda cobra o frete.
 */
export function totalComEntrega(subtotal: number, desconto: number, acrescimo: number, taxa: number): number {
  const mercadoria = Math.max(0, subtotal - desconto + acrescimo);
  return Math.round((mercadoria + Math.max(0, taxa || 0)) * 100) / 100;
}

/**
 * O que impede a venda de sair com entrega, ou null. Pedido de entrega
 * precisa de cliente (o entregador precisa de nome e telefone, e o pedido
 * entra no Ciclo de pedidos ligado a ele) e de endereço que dê para achar.
 */
export function faltaNaEntrega(entrega: EntregaVenda, clienteId: string | null | undefined): string | null {
  if (!clienteId) return "Entrega precisa de cliente: escolha ou cadastre o cliente (F2) — o entregador precisa do nome e do telefone.";
  const e = entrega.endereco;
  const faltando = [
    !e.logradouro.trim() && "rua",
    !e.numero.trim() && "número",
    !e.bairro.trim() && "bairro",
    !e.cidade.trim() && "cidade",
    !e.uf.trim() && "UF",
  ].filter(Boolean);
  if (faltando.length) return `Endereço de entrega incompleto: falta ${faltando.join(", ")}.`;
  if (!(entrega.taxa >= 0)) return "Taxa de entrega inválida.";
  return null;
}

/** Aviso (não bloqueia) quando a compra não chega ao mínimo da região. */
export function avisoValorMinimo(regiao: RegiaoEntrega | null | undefined, valorMercadoria: number): string | null {
  const min = Number(regiao?.valor_minimo) || 0;
  if (min > 0 && valorMercadoria < min) {
    return `A região ${regiao!.nome} tem pedido mínimo de R$ ${min.toFixed(2).replace(".", ",")} para entrega.`;
  }
  return null;
}

/** Endereço salvo do cliente (erp_pessoa_enderecos) → campos da entrega. */
export function enderecoDoCadastro(e: Record<string, any>): EnderecoEntrega {
  return {
    cep: e.cep ?? "", logradouro: e.logradouro ?? "", numero: e.numero ?? "",
    complemento: e.complemento ?? "", bairro: e.bairro ?? "", cidade: e.cidade ?? "",
    uf: e.uf ?? "", referencia: e.referencia ?? "", codigo_municipio: e.codigo_municipio_ibge ?? "",
  };
}

/** Resposta do ViaCEP → campos do endereço (mantém número e complemento digitados). */
export function aplicarViaCep(atual: EnderecoEntrega, r: Record<string, any>): EnderecoEntrega {
  if (!r || r.erro) return atual;
  return {
    ...atual,
    cep: r.cep ?? atual.cep,
    logradouro: r.logradouro || atual.logradouro,
    bairro: r.bairro || atual.bairro,
    cidade: r.localidade || atual.cidade,
    uf: r.uf || atual.uf,
    codigo_municipio: r.ibge || atual.codigo_municipio,
  };
}

/** O que vai para o banco (registrar_venda_pdv → erp_pedidos). */
export function entregaParaPayload(entrega: EntregaVenda, regiaoNome: string | null) {
  const e = entrega.endereco;
  const limpo = (s: string) => s.trim() || null;
  return {
    taxa: Math.round((entrega.taxa || 0) * 100) / 100,
    regiao_id: entrega.regiao_id,
    regiao_nome: regiaoNome,
    transportadora_id: entrega.transportadora_id,
    entrega_futura: entrega.entrega_futura,
    previsao_entrega: entrega.previsao ? new Date(entrega.previsao).toISOString() : null,
    endereco_id: entrega.endereco_id,
    salvar_endereco: entrega.salvar_endereco,
    endereco: {
      cep: limpo(e.cep), logradouro: e.logradouro.trim(), numero: e.numero.trim(),
      complemento: limpo(e.complemento), bairro: limpo(e.bairro), cidade: limpo(e.cidade),
      uf: limpo(e.uf.toUpperCase()), referencia: limpo(e.referencia),
      codigo_municipio: limpo(soDigitos(e.codigo_municipio)),
    },
  };
}

// ============================================================
// Reúne tudo que o comprovante de fechamento mostra.
//
// Uma função só, usada no fechamento e na reimpressão: o papel de hoje e o
// de amanhã têm de sair iguais. Segue o comprovante do sistema anterior
// (Fechamento Caixa - 3931810), que a loja já sabe ler.
//
// Uma diferença proposital: lá o "Saldo" compara o informado com o VALOR
// NO CAIXA, que inclui cartão e PIX. No comprovante real da X-Life isso
// deu "Saldo: -R$ 5.684,00" num caixa que bateu certinho — o operador
// contou R$ 76,95 e o esperado em espécie era exatamente R$ 76,95. Aqui a
// diferença é contra o dinheiro em espécie; o valor no caixa aparece como
// informação, sem ser chamado de saldo.
// ============================================================

import { supabase } from "@/lib/supabase";

export interface DadosFechamento {
  loja: { nome: string; endereco: string; cidadeUf: string };
  caixaNome: string;
  operadorAbertura: string;
  operadorFechamento: string;
  aberturaEm: string | null;
  fechamentoEm: string | null;
  identificacao: string;

  valorInicial: number;
  entradasExtras: { forma: string; valor: number }[];
  vendasPorForma: { forma: string; valor: number }[];

  vendasCanceladas: { quantidade: number; valor: number };
  devolucoes: { quantidade: number; valor: number };
  sangrias: { quantidade: number; valor: number; emDinheiro: number };
  descontoTotal: number;
  taxaEntrega: number;

  /** esperado em espécie: (dinheiro + extras em dinheiro + inicial) − sangria em dinheiro */
  valorEmEspecie: number;
  /** tudo que passou pelo caixa, em qualquer forma */
  valorNoCaixa: number;
  informado: number;
  observacoes?: string | null;
}

const NOME_FORMA: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX",
  cartao_credito: "Cartão de crédito", cartao_debito: "Cartão de débito",
  crediario: "Crediário", boleto: "Boleto", promissoria: "Promissória",
  cheque: "Cheque", transferencia: "Transferência",
};
const nomeForma = (f?: string) => NOME_FORMA[f ?? ""] ?? (f ?? "Outros");

function agrupar(linhas: any[], campoValor = "valor"): { forma: string; valor: number }[] {
  const m = new Map<string, number>();
  for (const l of linhas) {
    const f = nomeForma(l.forma_pagamento);
    m.set(f, (m.get(f) ?? 0) + Number(l[campoValor] ?? 0));
  }
  return [...m.entries()]
    .map(([forma, valor]) => ({ forma, valor }))
    .filter((x) => x.valor !== 0)
    .sort((a, b) => b.valor - a.valor);
}

/** Monta o comprovante de um turno, fechado ou em fechamento. */
export async function montarDadosFechamento(
  caixaId: string,
  opcoes?: { informado?: number; fechamentoEm?: string; operadorFechamento?: string },
): Promise<DadosFechamento> {
  const [resumo, vendas, sangrias, entradas, devolucoes, fechamento] = await Promise.all([
    supabase.from("vw_caixa_resumo")
      .select("*, loja:erp_lojas(*), ponto:erp_pontos_venda(nome), usuario:erp_usuarios!erp_caixa_usuario_id_fkey(nome)")
      .eq("id", caixaId).single(),
    supabase.from("erp_vendas")
      // os pagamentos vêm junto: a venda mista conta em cada forma pelo que
      // foi pago nela, e não inteira na forma "principal"
      .select("id, total, desconto, taxa_entrega, forma_pagamento, status, pagamentos:erp_venda_pagamentos(forma, valor)")
      .eq("caixa_id", caixaId),
    supabase.from("erp_sangrias").select("valor, forma_pagamento").eq("caixa_id", caixaId),
    supabase.from("erp_entradas_extras").select("valor, forma_pagamento").eq("caixa_id", caixaId),
    supabase.from("erp_devolucoes")
      .select("valor_devolvido, venda:erp_vendas!inner(caixa_id)")
      .eq("venda.caixa_id", caixaId),
    supabase.from("erp_fechamentos_caixa").select("*").eq("caixa_id", caixaId).maybeSingle(),
  ]);

  const c: any = resumo.data ?? {};
  const todasVendas = (vendas.data ?? []) as any[];
  const finalizadas = todasVendas.filter((v) => v.status === "finalizada");
  const canceladas = todasVendas.filter((v) => v.status === "cancelada");
  const listaSangrias = (sangrias.data ?? []) as any[];
  const listaEntradas = (entradas.data ?? []) as any[];
  const listaDevolucoes = (devolucoes.data ?? []) as any[];

  const soma = (l: any[], campo: string) => l.reduce((t, x) => t + Number(x[campo] ?? 0), 0);

  const emDinheiro = (l: any[]) =>
    l.filter((x) => (x.forma_pagamento ?? "dinheiro") === "dinheiro")
      .reduce((t, x) => t + Number(x.valor ?? 0), 0);

  /** Quanto das vendas entrou em cada forma, respeitando a venda mista. */
  const porForma = () => {
    const m = new Map<string, number>();
    for (const v of finalizadas) {
      const detalhe = (v.pagamentos ?? []) as any[];
      if (detalhe.length) {
        for (const p of detalhe) m.set(p.forma, (m.get(p.forma) ?? 0) + Number(p.valor ?? 0));
      } else {
        // venda anterior à migration 085: forma única, como sempre foi
        const f = v.forma_pagamento ?? "dinheiro";
        m.set(f, (m.get(f) ?? 0) + Number(v.total ?? 0));
      }
    }
    return m;
  };
  const formas = porForma();
  const vendasDinheiro = formas.get("dinheiro") ?? 0;

  const sangriaDinheiro = emDinheiro(listaSangrias);
  const entradaDinheiro = emDinheiro(listaEntradas);
  const valorInicial = Number(c.valor_inicial ?? 0);

  const l = c.loja ?? {};
  const endereco = [l.logradouro ?? l.endereco, l.numero].filter(Boolean).join(", ");
  const cidadeUf = [l.bairro, [l.cidade, l.uf].filter(Boolean).join(" - ")].filter(Boolean).join(" - ");

  return {
    loja: {
      nome: l.razao_social ?? l.nome ?? l.apelido ?? "",
      endereco: endereco || "",
      cidadeUf: cidadeUf || "",
    },
    caixaNome: [String(c.numero_caixa ?? "").padStart(3, "0"),
                c.usuario?.nome].filter(Boolean).join(" - "),
    operadorAbertura: c.usuario?.nome ?? "—",
    operadorFechamento: opcoes?.operadorFechamento ?? c.usuario?.nome ?? "—",
    aberturaEm: c.data_abertura ?? null,
    fechamentoEm: opcoes?.fechamentoEm ?? c.data_fechamento ?? null,
    // o número do recibo: id curto, como a "identificação de fechamento"
    identificacao: String(fechamento.data?.id ?? caixaId).replace(/\D/g, "").slice(0, 7)
      || String(caixaId).slice(0, 7),

    valorInicial,
    entradasExtras: agrupar(listaEntradas),
    vendasPorForma: [...formas.entries()]
      .map(([f, valor]) => ({ forma: nomeForma(f), valor }))
      .filter((x) => x.valor !== 0)
      .sort((a, b) => b.valor - a.valor),

    vendasCanceladas: { quantidade: canceladas.length, valor: soma(canceladas, "total") },
    devolucoes: { quantidade: listaDevolucoes.length, valor: soma(listaDevolucoes, "valor_devolvido") },
    sangrias: { quantidade: listaSangrias.length, valor: soma(listaSangrias, "valor"), emDinheiro: sangriaDinheiro },
    descontoTotal: soma(finalizadas, "desconto"),
    taxaEntrega: soma(finalizadas, "taxa_entrega"),

    valorEmEspecie: vendasDinheiro + entradaDinheiro + valorInicial - sangriaDinheiro,
    valorNoCaixa: valorInicial + soma(finalizadas, "total") + soma(listaEntradas, "valor") - soma(listaSangrias, "valor"),
    informado: opcoes?.informado ?? Number(c.valor_final ?? 0),
    observacoes: c.observacoes ?? fechamento.data?.observacoes ?? null,
  };
}

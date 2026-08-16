// ============================================================
// Tipos TypeScript para NFe (Nota Fiscal Eletrônica)
// ============================================================

export interface NFeEmitente {
  cnpj: string;
  cpf?: string;
  nome: string;
  fantasia?: string;
  ie?: string;
  endereco?: {
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };
}

export interface NFeDestinatario {
  cnpj?: string;
  cpf?: string;
  nome?: string;
}

export interface NFeItem {
  numero_item: number;
  codigo_produto: string;
  codigo_ean?: string;
  nome: string;
  ncm?: string;
  cfop?: string;
  unidade?: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  valor_desconto?: number;
  valor_frete?: number;
  icms_origem?: string;
  icms_csosn?: string;
  icms_aliquota?: number;
  icms_valor?: number;
  ipi_aliquota?: number;
  ipi_valor?: number;
  pis_valor?: number;
  cofins_valor?: number;
}

/** Duplicata (fatura) da cobrança da NF-e — vira conta a pagar na entrada. */
export interface NFeDuplicata {
  numero: string;
  vencimento: string;   // yyyy-mm-dd
  valor: number;
}

export interface NFeParsed {
  chave_acesso: string;
  numero: number;
  serie: number;
  tipo: "nfe" | "nfce";
  data_emissao: string;
  emitente: NFeEmitente;
  destinatario?: NFeDestinatario;
  valor_produtos: number;
  valor_frete: number;
  valor_seguro: number;
  valor_desconto: number;
  valor_icms: number;
  valor_ipi: number;
  valor_pis: number;
  valor_cofins: number;
  valor_total: number;
  itens: NFeItem[];
  duplicatas: NFeDuplicata[];
  xml_original: string;
}

export interface NFeItemImportacao extends NFeItem {
  // Controle de processamento
  produto_id?: string | null;
  produto_existente: boolean;
  acao: "manter_existente" | "criar_novo" | "atualizar_estoque";
  preco_custo_atual?: number;
  margem_desejada: number;
  estoque_atualizado?: boolean;
}

// ============================================================
// Tipos para Remessas entre Filiais
// ============================================================

export type RemessaStatus =
  | "rascunho"
  | "nf_emitida"
  | "em_transito"
  | "recebida"
  | "cancelada"
  | "rejeitada";

export type RemessaTipo =
  | "remessa"
  | "retorno"
  | "transferencia_simples"
  | "venda_filial";

export interface Remessa {
  id: string;
  loja_origem_id: string;
  loja_destino_id: string;
  usuario_id: string;
  numero_remessa?: number;
  tipo: RemessaTipo;
  data_remessa: string;
  data_previsao_chegada?: string;
  data_recebimento?: string;
  recebido_por?: string;
  valor_produtos: number;
  valor_frete: number;
  valor_seguro: number;
  valor_total: number;
  cfop?: string;
  natureza_operacao?: string;
  nfe_remessa_id?: string;
  nfe_remessa_numero?: number;
  nfe_remessa_chave?: string;
  nfe_retorno_id?: string;
  venda_id?: string;
  transportadora_id?: string;
  status: RemessaStatus;
  motivo_cancelamento?: string;
  motivo_rejeicao?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  // Relacionamentos
  origem?: {
    id: string;
    nome: string;
    apelido: string;
    cnpj?: string;
    uf?: string;
  };
  destino?: {
    id: string;
    nome: string;
    apelido: string;
    cnpj?: string;
    uf?: string;
  };
  itens?: RemessaItem[];
  nfe?: any;
  total_itens?: number;
  mesma_uf?: boolean;
}

export interface RemessaItem {
  id: string;
  remessa_id: string;
  produto_id: string;
  codigo_produto?: string;
  nome_produto?: string;
  quantidade: number;
  preco_custo: number;
  preco_venda_praticado?: number;
  subtotal: number;
  estoque_origem_baixado: boolean;
  estoque_destino_adicionado: boolean;
  data_baixa_origem?: string;
  data_entrada_destino?: string;
  lote_id?: string;
  observacoes?: string;
  produto?: {
    id: string;
    nome: string;
    sku: string;
    preco_custo: number;
    preco_venda: number;
  };
}

// ============================================================
// Tipos para NFe de Entrada
// ============================================================

export interface NFeEntrada {
  id: string;
  loja_id: string;
  fornecedor_id?: string;
  compra_id?: string;
  chave_acesso: string;
  numero: number;
  serie: number;
  tipo: "nfe" | "nfce" | "cte" | "mdf";
  data_emissao: string;
  data_entrada: string;
  valor_produtos: number;
  valor_frete: number;
  valor_seguro: number;
  valor_desconto: number;
  valor_icms: number;
  valor_ipi: number;
  valor_total: number;
  emitente_cnpj?: string;
  emitente_nome?: string;
  status: "pendente" | "processada" | "cancelada" | "rejeitada" | "manifestada";
  tipo_manifestacao?: string;
  data_manifestacao?: string;
  xml_original?: string;
  total_itens?: number;
  itens_processados?: number;
  fornecedor_nome?: string;
  loja_apelido?: string;
}
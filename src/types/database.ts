// Tipos baseados no schema SQL do Supabase (001_initial_schema.sql)

export type UserRole = "admin" | "gerente" | "caixa" | "estoquista";

export interface Loja {
  id: string;
  nome: string;
  apelido: string;
  cnpj: string | null;
  matriz: boolean;
  ativo: boolean;
  endereco: any | null;
  contato: any | null;
  created_at: string;
  updated_at: string;
}

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
  ativo: boolean;
  loja_default_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pessoa {
  id: string;
  tipo: "fisica" | "juridica";
  cpf_cnpj: string;
  nome_razao: string;
  nome_fantasia: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  endereco: any | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Categoria {
  id: string;
  nome: string;
  descricao: string | null;
  categoria_pai_id: string | null;
  ativo: boolean;
  created_at: string;
}

export interface Produto {
  id: string;
  sku: string;
  nome: string;
  descricao: string | null;
  categoria_id: string | null;
  unidade: string;
  preco_custo: number;
  preco_venda: number;
  estoque_minimo: number;
  estoque_maximo: number | null;
  peso: number | null;
  dimensoes: any | null;
  ncm: string | null;
  cfop: string | null;
  ativo: boolean;
  imagem_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Estoque {
  id: string;
  produto_id: string;
  loja_id: string;
  quantidade: number;
  localizacao: string | null;
  updated_at: string;
}

export type VendaStatus = "pendente" | "finalizada" | "cancelada" | "devolvida";
export type FormaPagamento =
  | "dinheiro"
  | "pix"
  | "cartao_credito"
  | "cartao_debito"
  | "crediario"
  | "boleto"
  | "promissoria"
  | "cheque"
  | "transferencia";

export interface Venda {
  id: string;
  loja_id: string;
  cliente_id: string | null;
  usuario_id: string;
  data_venda: string;
  subtotal: number;
  desconto: number;
  total: number;
  custo_total: number;
  lucro_total: number;
  forma_pagamento: FormaPagamento;
  status: VendaStatus;
  tipo_venda: string;
  observacoes: string | null;
  numero_pedido: number;
  created_at: string;
  updated_at: string;
}

export interface VendaItem {
  id: string;
  venda_id: string;
  produto_id: string | null;
  servico_id: string | null;
  kit_id: string | null;
  nome: string;
  preco_custo: number;
  preco_unitario: number;
  desconto_unitario: number;
  quantidade: number;
  subtotal: number;
}

export interface Conta {
  id: string;
  loja_id: string;
  tipo: "pagar" | "receber";
  pessoa_id: string | null;
  venda_id: string | null;
  descricao: string;
  categoria: string | null;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  valor_pago: number;
  forma_pagamento: FormaPagamento | null;
  status: "pendente" | "pago" | "cancelado" | "vencido";
  parcela_numero: number;
  parcela_total: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

// Tipos auxiliares para queries
export interface VendaCompleta extends Venda {
  itens: VendaItem[];
  cliente?: Pessoa;
  usuario?: Usuario;
  loja?: Loja;
}

export interface ProdutoComEstoque extends Produto {
  categoria?: Categoria;
  estoque_por_loja: Record<string, number>;
}
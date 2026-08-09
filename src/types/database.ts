// Tipos baseados no schema SQL do Supabase

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
  telefone: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  inscricao_estadual: string | null;
  tipo_loja: string | null;
  horario: any | null;
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
  permissoes: any;
  avatar_url: string | null;
  tentativas_login: number;
  bloqueado: boolean;
  ultimo_login: string | null;
  ip_ultimo_login: string | null;
  telefone: string | null;
  cpf: string | null;
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
  data_nascimento: string | null;
  estado_civil: string | null;
  sexo: string | null;
  profissao: string | null;
  limite_credito: number;
  bloqueado: boolean;
  motivo_bloqueio: string | null;
  created_at: string;
  updated_at: string;
}

export interface Funcionario {
  id: string;
  pessoa_id: string;
  cargo: string | null;
  departamento: string | null;
  salario: number | null;
  data_admissao: string | null;
  data_demissao: string | null;
  usuario_id: string | null;
  comissao_percentual: number;
  tipo_contrato: string | null;
  cpf: string | null;
  rg: string | null;
  pis_pasep: string | null;
  ctps: string | null;
  data_nascimento: string | null;
  gerente: boolean;
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
  codigo_barras: string | null;
  marca: string | null;
  modelo: string | null;
  peso_liquido: number | null;
  peso_bruto: number | null;
  volume: number | null;
  orig: string | null;
  icms: number | null;
  ipi: number | null;
  pis: number | null;
  cofins: number | null;
  cest: string | null;
  comissao_percentual: number;
  tipo_produto: string;
  controla_lote: boolean;
  controla_serie: boolean;
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
  | "dinheiro" | "pix" | "cartao_credito" | "cartao_debito"
  | "crediario" | "boleto" | "promissoria" | "cheque" | "transferencia";

export interface Venda {
  id: string;
  loja_id: string;
  cliente_id: string | null;
  usuario_id: string;
  data_venda: string;
  subtotal: number;
  desconto: number;
  desconto_percentual: number;
  acrescimo: number;
  troco: number;
  valor_recebido: number | null;
  total: number;
  custo_total: number;
  lucro_total: number;
  comissao_total: number;
  taxa_entrega: number;
  forma_pagamento: FormaPagamento;
  status: VendaStatus;
  tipo_venda: string;
  observacoes: string | null;
  numero_pedido: number;
  data_cancelamento: string | null;
  motivo_cancelamento: string | null;
  cancelado_por: string | null;
  vendedor_id: string | null;
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
  desconto_percentual: number;
  acrescimo: number;
  valor_total: number | null;
  quantidade: number;
  subtotal: number;
  observacoes: string | null;
}

export interface Conta {
  id: string;
  loja_id: string;
  tipo: "pagar" | "receber";
  pessoa_id: string | null;
  venda_id: string | null;
  descricao: string;
  categoria: string | null;
  numero_documento: string | null;
  banco: string | null;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  valor_pago: number;
  forma_pagamento: FormaPagamento | null;
  status: "pendente" | "pago" | "cancelado" | "vencido";
  parcela_numero: number;
  parcela_total: number;
  centro_custo: string | null;
  plano_conta: string | null;
  recorrente: boolean;
  periodicidade: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

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

// Novos tipos
export interface Veiculo {
  id: string;
  loja_id: string | null;
  placa: string;
  chassi: string | null;
  renavam: string | null;
  marca: string | null;
  modelo: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  cor: string | null;
  km_atual: number;
  tipo_combustivel: string | null;
  capacidade_carga: number | null;
  status: string;
  ipva_valor: number | null;
  ipva_vencimento: string | null;
  seguro_vencimento: string | null;
  licenciamento_vencimento: string | null;
  proxima_revisao_km: number | null;
  proxima_revisao_data: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Cheque {
  id: string;
  loja_id: string;
  tipo: "emitido" | "recebido";
  pessoa_id: string | null;
  banco: string;
  agencia: string | null;
  conta: string | null;
  numero_cheque: string;
  valor: number;
  data_emissao: string;
  data_vencimento: string;
  data_compensacao: string | null;
  status: string;
  motivo_devolucao: string | null;
  venda_id: string | null;
  conta_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Boleto {
  id: string;
  loja_id: string;
  conta_id: string | null;
  pessoa_id: string;
  nosso_numero: string | null;
  codigo_barras: string | null;
  linha_digitavel: string | null;
  valor: number;
  valor_pago: number;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  banco: string | null;
  instrucoes: string | null;
  pdf_url: string | null;
  pix_qrcode: string | null;
  multa_percentual: number;
  juros_mensal: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Promissoria {
  id: string;
  loja_id: string;
  pessoa_id: string;
  tipo: "emitida" | "recebida";
  numero: string | null;
  valor: number;
  valor_extenso: string | null;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  venda_id: string | null;
  conta_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sangria {
  id: string;
  caixa_id: string;
  usuario_id: string;
  data_hora: string;
  motivo: string;
  valor: number;
  observacoes: string | null;
}

export interface EntradaExtra {
  id: string;
  caixa_id: string;
  usuario_id: string;
  data_hora: string;
  motivo: string;
  forma_pagamento: FormaPagamento;
  valor: number;
  observacoes: string | null;
}

export interface Compromisso {
  id: string;
  usuario_id: string;
  loja_id: string | null;
  titulo: string;
  descricao: string | null;
  tipo: string | null;
  data_inicio: string;
  data_fim: string | null;
  dia_inteiro: boolean;
  prioridade: "baixa" | "media" | "alta";
  status: "pendente" | "concluido" | "cancelado";
  recorrencia_tipo: string | null;
  recorrencia_fim: string | null;
  lembrete_minutos: number | null;
  created_at: string;
  updated_at: string;
}

export interface Notificacao {
  id: string;
  usuario_id: string;
  loja_id: string | null;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  data_leitura: string | null;
  linkacao: string | null;
  icone: string | null;
  cor: string | null;
  venda_id: string | null;
  pessoa_id: string | null;
  produto_id: string | null;
  created_at: string;
}

export interface Avaliacao {
  id: string;
  cliente_id: string;
  loja_id: string | null;
  pedido_id: string | null;
  produto_id: string | null;
  nota: number;
  comentario: string | null;
  resposta: string | null;
  data_avaliacao: string;
  tipo: string;
  visivel: boolean;
  verificado: boolean;
  created_at: string;
}

export interface ChavePix {
  id: string;
  loja_id: string;
  tipo: string;
  chave: string;
  titular: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  principal: boolean;
  ativo: boolean;
  created_at: string;
}

export interface ContaBancaria {
  id: string;
  loja_id: string;
  banco: string;
  codigo_banco: string | null;
  agencia: string;
  agencia_digito: string | null;
  conta: string;
  conta_digito: string | null;
  tipo: string;
  titular: string;
  cnpj_cpf: string | null;
  principal: boolean;
  ativo: boolean;
  saldo_inicial: number;
  observacoes: string | null;
  created_at: string;
}

export interface Documento {
  id: string;
  loja_id: string | null;
  pasta_id: string | null;
  usuario_id: string | null;
  nome: string;
  descricao: string | null;
  tipo: string | null;
  extensao: string | null;
  tamanho_bytes: number | null;
  storage_path: string | null;
  publico: boolean;
  tags: string[] | null;
  pessoa_relacionada_id: string | null;
  venda_relacionada_id: string | null;
  data_documento: string | null;
  data_upload: string;
  created_at: string;
}

export interface DadosEmpresariais {
  id: string;
  loja_id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  celular: string | null;
  email: string | null;
  site: string | null;
  regime_tributario: string | null;
  cnae: string | null;
  socio_nome: string | null;
  socio_cpf: string | null;
  logo_url: string | null;
  updated_at: string;
}

export interface ConfiguracoesSefaz {
  id: string;
  loja_id: string;
  ambiente: string;
  uf: string;
  serie_nfe: number;
  serie_nfce: number;
  numeracao_atual_nfe: number;
  numeracao_atual_nfce: number;
  csc_id: string | null;
  csc_token: string | null;
  timezone: string;
  timeout_segundos: number;
  certificado_id: string | null;
  ativo: boolean;
  updated_at: string;
}

// Frota
export interface Veiculo {
  id: string;
  loja_id: string | null;
  placa: string;
  chassi: string | null;
  renavam: string | null;
  marca: string | null;
  modelo: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  cor: string | null;
  km_atual: number;
  tipo_combustivel: string | null;
  capacidade_carga: number | null;
  status: string;
  ipva_valor: number | null;
  ipva_vencimento: string | null;
  seguro_vencimento: string | null;
  licenciamento_vencimento: string | null;
  proxima_revisao_km: number | null;
  proxima_revisao_data: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VeiculoAbastecimento {
  id: string;
  veiculo_id: string;
  data_abastecimento: string;
  km_abastecimento: number;
  litros: number;
  valor_total: number;
  preco_litro: number;
  posto: string | null;
  motorista_id: string | null;
  created_at: string;
}

export interface VeiculoManutencao {
  id: string;
  veiculo_id: string;
  tipo: string | null;
  data_manutencao: string;
  km_manutencao: number | null;
  descricao: string | null;
  valor: number | null;
  oficina: string | null;
  proxima_km: number | null;
  proxima_data: string | null;
  created_at: string;
}

// Regiões de Entrega
export interface RegiaoEntrega {
  id: string;
  loja_id: string | null;
  nome: string;
  cep_inicio: string | null;
  cep_fim: string | null;
  bairros: string[] | null;
  taxa: number;
  prazo_dias: number | null;
  valor_minimo: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Transportadoras
export interface Transportadora {
  id: string;
  loja_id: string | null;
  pessoa_id: string | null;
  nome: string;
  cnpj: string | null;
  prazo_entrega_dias: number | null;
  valor_fixo: number | null;
  valor_kg: number | null;
  regioes_atendidas: string[] | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Categorias de Produto
export interface CategoriaProduto {
  id: string;
  nome: string;
  descricao: string | null;
  categoria_pai_id: string | null;
  ativo: boolean;
  created_at: string;
}

// Kits
export interface Kit {
  id: string;
  loja_id: string | null;
  nome: string;
  descricao: string | null;
  preco_venda: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface KitItem {
  id: string;
  kit_id: string;
  produto_id: string;
  quantidade: number;
}

// Agenda Telefônica
export interface Contato {
  id: string;
  loja_id: string | null;
  usuario_id: string | null;
  pessoa_id: string | null;
  nome: string;
  empresa: string | null;
  cargo: string | null;
  categoria: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  whatsapp: string | null;
  endereco: string | null;
  observacoes: string | null;
  favorito: boolean;
  created_at: string;
  updated_at: string;
}
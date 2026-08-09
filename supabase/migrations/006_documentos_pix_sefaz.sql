-- =====================================================
-- ERP System · Documentos, PIX, SEFAZ, Configurações (prefixo erp_)
-- Migration: 006_documentos_pix_sefaz.sql
-- =====================================================

-- ===== Documentos / Arquivos =====
CREATE TABLE erp_documentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES erp_lojas(id),
  pasta_id UUID REFERENCES erp_documentos(id),
  usuario_id UUID REFERENCES erp_usuarios(id),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50),
  extensao VARCHAR(10),
  tamanho_bytes BIGINT,
  storage_path TEXT,
  publico BOOLEAN DEFAULT false,
  tags TEXT[],
  pessoa_relacionada_id UUID REFERENCES erp_pessoas(id),
  venda_relacionada_id UUID REFERENCES erp_vendas(id),
  data_documento DATE,
  data_upload TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_documentos_pasta ON erp_documentos(pasta_id);
CREATE INDEX idx_erp_documentos_loja ON erp_documentos(loja_id);

-- ===== Downloads =====
CREATE TABLE erp_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES erp_lojas(id),
  categoria VARCHAR(50),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  extensao VARCHAR(10),
  tamanho_bytes BIGINT,
  url_externa TEXT,
  versao VARCHAR(20),
  download_count INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Chaves PIX =====
CREATE TABLE erp_chaves_pix (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  tipo VARCHAR(20) NOT NULL,
  chave VARCHAR(255) NOT NULL,
  titular VARCHAR(255) NOT NULL,
  banco VARCHAR(100),
  agencia VARCHAR(10),
  conta VARCHAR(20),
  principal BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_chaves_pix_loja ON erp_chaves_pix(loja_id);

-- ===== Contas Bancárias =====
CREATE TABLE erp_contas_bancarias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  banco VARCHAR(100) NOT NULL,
  codigo_banco VARCHAR(10),
  agencia VARCHAR(10) NOT NULL,
  agencia_digito VARCHAR(5),
  conta VARCHAR(20) NOT NULL,
  conta_digito VARCHAR(5),
  tipo VARCHAR(20) DEFAULT 'corrente',
  titular VARCHAR(255) NOT NULL,
  cnpj_cpf VARCHAR(18),
  principal BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  saldo_inicial DECIMAL(12,2) DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_contas_bancarias_loja ON erp_contas_bancarias(loja_id);

-- ===== Dados Empresariais =====
CREATE TABLE erp_dados_empresariais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  razao_social VARCHAR(255) NOT NULL,
  nome_fantasia VARCHAR(255),
  cnpj VARCHAR(18) NOT NULL,
  inscricao_estadual VARCHAR(20),
  inscricao_municipal VARCHAR(20),
  cep VARCHAR(10),
  logradouro VARCHAR(255),
  numero VARCHAR(20),
  complemento VARCHAR(100),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  uf VARCHAR(2),
  telefone VARCHAR(20),
  celular VARCHAR(20),
  email VARCHAR(255),
  site VARCHAR(255),
  regime_tributario VARCHAR(30),
  cnae VARCHAR(10),
  socio_nome VARCHAR(255),
  socio_cpf VARCHAR(14),
  logo_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Configurações SEFAZ =====
CREATE TABLE erp_configuracoes_sefaz (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  ambiente VARCHAR(20) DEFAULT 'homologacao',
  uf VARCHAR(2) NOT NULL,
  serie_nfe INTEGER DEFAULT 1,
  serie_nfce INTEGER DEFAULT 1,
  numeracao_atual_nfe INTEGER DEFAULT 1,
  numeracao_atual_nfce INTEGER DEFAULT 1,
  csc_id VARCHAR(20),
  csc_token VARCHAR(100),
  timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  timeout_segundos INTEGER DEFAULT 30,
  certificado_id UUID,
  ativo BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Certificados Digitais =====
CREATE TABLE erp_certificados_digitais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  tipo VARCHAR(10) NOT NULL,
  nome VARCHAR(255),
  titular VARCHAR(255) NOT NULL,
  cnpj_cpf VARCHAR(18) NOT NULL,
  emissor VARCHAR(100),
  numero_serie VARCHAR(100),
  data_validade DATE NOT NULL,
  arquivo_path TEXT,
  senha_armazenada TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_certificados_loja ON erp_certificados_digitais(loja_id);

-- ===== Configurações do Sistema =====
CREATE TABLE erp_configuracoes_sistema (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chave VARCHAR(100) UNIQUE NOT NULL,
  valor TEXT,
  tipo VARCHAR(20) DEFAULT 'texto',
  categoria VARCHAR(50),
  descricao TEXT,
  editavel BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Seed: Configurações padrão =====
INSERT INTO erp_configuracoes_sistema (chave, valor, tipo, categoria, descricao) VALUES
  ('margem_padrao', '30', 'numero', 'vendas', 'Margem de lucro padrão (%)'),
  ('alerta_estoque_baixo', 'true', 'boolean', 'estoque', 'Alertar produtos com estoque baixo'),
  ('dias_alerta_vencimento', '30', 'numero', 'estoque', 'Dias para alertar vencimento'),
  ('imprimir_cupom_automatico', 'false', 'boolean', 'pdv', 'Imprimir cupom automaticamente'),
  ('cfop_padrao_venda', '5102', 'texto', 'fiscal', 'CFOP padrão para vendas'),
  ('ambiente_nfe', 'homologacao', 'texto', 'fiscal', 'Ambiente NF-e (homologacao/producao)'),
  ('permitir_desconto_maximo', '10', 'numero', 'vendas', 'Desconto máximo permitido (%)'),
  ('frete_gratis_acima', '200', 'numero', 'vendas', 'Valor mínimo para frete grátis');
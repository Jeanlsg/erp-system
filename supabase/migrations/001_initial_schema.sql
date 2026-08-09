-- =====================================================
-- ERP System · Schema Base
-- Migration: 001_initial_schema.sql
-- =====================================================

-- ===== Extensões =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== ENUMS =====
CREATE TYPE user_role AS ENUM ('admin', 'gerente', 'caixa', 'estoquista');
CREATE TYPE pessoa_tipo AS ENUM ('fisica', 'juridica');
CREATE TYPE venda_status AS ENUM ('pendente', 'finalizada', 'cancelada', 'devolvida');
CREATE TYPE forma_pagamento AS ENUM (
  'dinheiro', 'pix', 'cartao_credito', 'cartao_debito',
  'crediario', 'boleto', 'promissoria', 'cheque', 'transferencia'
);
CREATE TYPE tipo_conta AS ENUM ('pagar', 'receber');
CREATE TYPE conta_status AS ENUM ('pendente', 'pago', 'cancelado', 'vencido');
CREATE TYPE tipo_movimento AS ENUM ('entrada', 'saida');
CREATE TYPE nota_tipo AS ENUM ('nfe', 'nfce', 'cfe');
CREATE TYPE nota_status AS ENUM ('autorizada', 'cancelada', 'denegada', 'rejeitada');

-- ===== EMPRESAS / LOJAS =====
CREATE TABLE lojas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  apelido VARCHAR(100) NOT NULL,
  cnpj VARCHAR(18) UNIQUE,
  matriz BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  endereco JSONB,
  contato JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== USUÁRIOS =====
CREATE TABLE usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'caixa',
  ativo BOOLEAN DEFAULT true,
  loja_default_id UUID REFERENCES lojas(id),
  permissoes JSONB DEFAULT '{}',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== PESSOAS (clientes, fornecedores, funcionários) =====
CREATE TABLE pessoas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo pessoa_tipo NOT NULL,
  cpf_cnpj VARCHAR(18) UNIQUE NOT NULL,
  nome_razao VARCHAR(255) NOT NULL,
  nome_fantasia VARCHAR(255),
  email VARCHAR(255),
  telefone VARCHAR(20),
  celular VARCHAR(20),
  endereco JSONB,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_pessoas_cpf_cnpj ON pessoas(cpf_cnpj);
CREATE INDEX idx_pessoas_tipo ON pessoas(tipo);
CREATE INDEX idx_pessoas_nome ON pessoas USING gin(to_tsvector('portuguese', nome_razao));

-- ===== FUNCIONÁRIOS (relação usuário + pessoa) =====
CREATE TABLE funcionarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pessoa_id UUID NOT NULL REFERENCES pessoas(id) ON DELETE RESTRICT,
  cargo VARCHAR(100),
  departamento VARCHAR(100),
  salario DECIMAL(12,2),
  data_admissao DATE,
  data_demissao DATE,
  usuario_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== TRANSPORTADORAS =====
CREATE TABLE transportadoras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pessoa_id UUID NOT NULL REFERENCES pessoas(id) ON DELETE RESTRICT,
  prazo_entrega INTEGER, -- em dias
  valor_frete DECIMAL(12,2),
  regiao_atendida TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== REGIÕES DE ENTREGA =====
CREATE TABLE regioes_entrega (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(100) NOT NULL,
  ceps TEXT[], -- lista de CEPs ou faixas
  taxa DECIMAL(12,2) NOT NULL DEFAULT 0,
  prazo_dias INTEGER DEFAULT 1,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== CATEGORIAS DE PRODUTOS =====
CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  categoria_pai_id UUID REFERENCES categorias(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== PRODUTOS =====
CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(50) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  categoria_id UUID REFERENCES categorias(id),
  unidade VARCHAR(10) DEFAULT 'UN',
  preco_custo DECIMAL(12,2) NOT NULL DEFAULT 0,
  preco_venda DECIMAL(12,2) NOT NULL,
  estoque_minimo INTEGER DEFAULT 0,
  estoque_maximo INTEGER,
  peso DECIMAL(10,3),
  dimensoes JSONB, -- {largura, altura, profundidade}
  ncm VARCHAR(10), -- Nomenclatura Comum do Mercosul
  cfop VARCHAR(10),
  ativo BOOLEAN DEFAULT true,
  imagem_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_produtos_sku ON produtos(sku);
CREATE INDEX idx_produtos_nome ON produtos USING gin(to_tsvector('portuguese', nome));
CREATE INDEX idx_produtos_categoria ON produtos(categoria_id);

-- ===== ESTOQUE POR LOJA =====
CREATE TABLE estoque (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 0,
  localizacao VARCHAR(50), -- ex: "Corredor A, Prateleira 3"
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(produto_id, loja_id)
);

CREATE INDEX idx_estoque_produto ON estoque(produto_id);
CREATE INDEX idx_estoque_loja ON estoque(loja_id);

-- ===== LOTES / VALIDADES =====
CREATE TABLE lotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  codigo VARCHAR(50) NOT NULL,
  data_fabricacao DATE,
  data_validade DATE NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lotes_validade ON lotes(data_validade);

-- ===== KITS =====
CREATE TABLE kits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  preco_kit DECIMAL(12,2) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kit_itens (
  kit_id UUID REFERENCES kits(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (kit_id, produto_id)
);

-- ===== SERVIÇOS =====
CREATE TABLE servicos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  valor DECIMAL(12,2) NOT NULL,
  comissao_percentual DECIMAL(5,2) DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== VENDAS =====
CREATE TABLE vendas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
  cliente_id UUID REFERENCES pessoas(id),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  data_venda TIMESTAMPTZ DEFAULT NOW(),
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  desconto DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  custo_total DECIMAL(12,2) DEFAULT 0,
  lucro_total DECIMAL(12,2) DEFAULT 0,
  forma_pagamento forma_pagamento NOT NULL,
  status venda_status DEFAULT 'finalizada',
  tipo_venda VARCHAR(50) DEFAULT 'pdv', -- pdv, pedido, orcamento, os, consignacao, locacao, delivery
  observacoes TEXT,
  numero_pedido SERIAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendas_loja ON vendas(loja_id);
CREATE INDEX idx_vendas_cliente ON vendas(cliente_id);
CREATE INDEX idx_vendas_data ON vendas(data_venda);
CREATE INDEX idx_vendas_status ON vendas(status);

-- ===== ITENS DA VENDA =====
CREATE TABLE venda_itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venda_id UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id),
  servico_id UUID REFERENCES servicos(id),
  kit_id UUID REFERENCES kits(id),
  nome VARCHAR(255) NOT NULL,
  preco_custo DECIMAL(12,2) DEFAULT 0,
  preco_unitario DECIMAL(12,2) NOT NULL,
  desconto_unitario DECIMAL(12,2) DEFAULT 0,
  quantidade DECIMAL(10,3) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  CHECK (
    (produto_id IS NOT NULL)::int +
    (servico_id IS NOT NULL)::int +
    (kit_id IS NOT NULL)::int = 1
  )
);

-- ===== MOVIMENTAÇÕES DE CAIXA =====
CREATE TABLE caixa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  data_abertura TIMESTAMPTZ DEFAULT NOW(),
  data_fechamento TIMESTAMPTZ,
  valor_inicial DECIMAL(12,2) DEFAULT 0,
  valor_final DECIMAL(12,2),
  total_vendas DECIMAL(12,2) DEFAULT 0,
  total_sangrias DECIMAL(12,2) DEFAULT 0,
  total_entradas_extras DECIMAL(12,2) DEFAULT 0,
  observacoes TEXT,
  status VARCHAR(20) DEFAULT 'aberto'
);

-- ===== MOVIMENTAÇÕES DE CAIXA (sangrias/entradas) =====
CREATE TABLE caixa_movimentacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caixa_id UUID NOT NULL REFERENCES caixa(id) ON DELETE CASCADE,
  tipo tipo_movimento NOT NULL,
  motivo VARCHAR(255) NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  forma_pagamento forma_pagamento,
  data_hora TIMESTAMPTZ DEFAULT NOW(),
  observacoes TEXT
);

-- ===== CONTAS A PAGAR / RECEBER =====
CREATE TABLE contas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  tipo tipo_conta NOT NULL,
  pessoa_id UUID REFERENCES pessoas(id),
  venda_id UUID REFERENCES vendas(id),
  descricao VARCHAR(255) NOT NULL,
  categoria VARCHAR(100),
  valor DECIMAL(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  valor_pago DECIMAL(12,2) DEFAULT 0,
  forma_pagamento forma_pagamento,
  status conta_status DEFAULT 'pendente',
  parcela_numero INTEGER DEFAULT 1,
  parcela_total INTEGER DEFAULT 1,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contas_vencimento ON contas(data_vencimento);
CREATE INDEX idx_contas_status ON contas(status);
CREATE INDEX idx_contas_pessoa ON contas(pessoa_id);

-- ===== NOTAS FISCAIS =====
CREATE TABLE notas_fiscais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venda_id UUID REFERENCES vendas(id),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  tipo nota_tipo NOT NULL,
  numero INTEGER NOT NULL,
  serie INTEGER NOT NULL DEFAULT 1,
  chave_acesso VARCHAR(44) UNIQUE,
  protocolo VARCHAR(50),
  status nota_status DEFAULT 'autorizada',
  valor_total DECIMAL(12,2) NOT NULL,
  xml_url TEXT,
  pdf_url TEXT,
  data_emissao TIMESTAMPTZ DEFAULT NOW(),
  data_cancelamento TIMESTAMPTZ,
  motivo_cancelamento TEXT,
  observacoes TEXT
);

CREATE INDEX idx_nf_chave ON notas_fiscais(chave_acesso);
CREATE INDEX idx_nf_status ON notas_fiscais(status);

-- ===== PEDIDOS / DELIVERY =====
CREATE TABLE pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venda_id UUID REFERENCES vendas(id),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  cliente_id UUID NOT NULL REFERENCES pessoas(id),
  endereco_entrega JSONB NOT NULL,
  previsao_entrega TIMESTAMPTZ,
  data_entrega TIMESTAMPTZ,
  transportadora_id UUID REFERENCES transportadoras(id),
  taxa_entrega DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'pendente', -- pendente, em_preparo, saiu, entregue, cancelado
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== COMPRAS =====
CREATE TABLE compras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  fornecedor_id UUID NOT NULL REFERENCES pessoas(id),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  numero_pedido SERIAL,
  data_compra TIMESTAMPTZ DEFAULT NOW(),
  total DECIMAL(12,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'pendente',
  observacoes TEXT
);

CREATE TABLE compra_itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  compra_id UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id),
  preco_custo DECIMAL(12,2) NOT NULL,
  quantidade INTEGER NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL
);

-- ===== TRIGGER PARA UPDATED_AT =====
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lojas_updated_at BEFORE UPDATE ON lojas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pessoas_updated_at BEFORE UPDATE ON pessoas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON produtos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendas_updated_at BEFORE UPDATE ON vendas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contas_updated_at BEFORE UPDATE ON contas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== RLS (Row Level Security) =====
ALTER TABLE lojas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_fiscais ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem ler tudo
CREATE POLICY "Usuários autenticados podem ler lojas" ON lojas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem ler produtos" ON produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem ler pessoas" ON pessoas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem ler vendas" ON vendas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem ler estoque" ON estoque FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem ler contas" ON contas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem ler notas fiscais" ON notas_fiscais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem ler usuarios" ON usuarios FOR SELECT TO authenticated USING (true);

-- Política: usuários podem inserir/atualizar
CREATE POLICY "Usuários podem inserir vendas" ON vendas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários podem atualizar vendas" ON vendas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Usuários podem inserir contas" ON contas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários podem atualizar contas" ON contas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Usuários podem inserir pessoas" ON pessoas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários podem atualizar pessoas" ON pessoas FOR UPDATE TO authenticated USING (true);

-- ===== SEED INICIAL =====
-- Loja padrão
INSERT INTO lojas (id, nome, apelido, cnpj, matriz) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Loja Matriz - Centro', 'Centro', '12.345.678/0001-90', true),
  ('00000000-0000-0000-0000-000000000002', 'Loja Filial - Shopping', 'Shopping', '12.345.678/0002-71', false);

-- Categorias
INSERT INTO categorias (id, nome) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Suplementos'),
  ('00000000-0000-0000-0000-000000000002', 'Aminoácidos'),
  ('00000000-0000-0000-0000-000000000003', 'Pré-Treino'),
  ('00000000-0000-0000-0000-000000000004', 'Vitaminas'),
  ('00000000-0000-0000-0000-000000000005', 'Acessórios');

-- Produtos exemplo
INSERT INTO produtos (sku, nome, categoria_id, preco_custo, preco_venda, estoque_minimo) VALUES
  ('WHEY-1KG', 'Whey Protein 1kg', '00000000-0000-0000-0000-000000000001', 80.00, 149.90, 10),
  ('CREAT-300', 'Creatina 300g', '00000000-0000-0000-0000-000000000001', 35.00, 79.90, 15),
  ('BCAA-60', 'BCAA 2400mg 60 caps', '00000000-0000-0000-0000-000000000002', 25.00, 59.90, 20),
  ('PRE-300', 'Pré-Treino 300g', '00000000-0000-0000-0000-000000000003', 45.00, 99.90, 10),
  ('MULTI-60', 'Multivitamínico 60 caps', '00000000-0000-0000-0000-000000000004', 18.00, 39.90, 25);

-- Estoque inicial
INSERT INTO estoque (produto_id, loja_id, quantidade) VALUES
  ((SELECT id FROM produtos WHERE sku = 'WHEY-1KG'), '00000000-0000-0000-0000-000000000001', 50),
  ((SELECT id FROM produtos WHERE sku = 'CREAT-300'), '00000000-0000-0000-0000-000000000001', 80),
  ((SELECT id FROM produtos WHERE sku = 'BCAA-60'), '00000000-0000-0000-0000-000000000001', 100),
  ((SELECT id FROM produtos WHERE sku = 'PRE-300'), '00000000-0000-0000-0000-000000000001', 35),
  ((SELECT id FROM produtos WHERE sku = 'MULTI-60'), '00000000-0000-0000-0000-000000000001', 60),
  ((SELECT id FROM produtos WHERE sku = 'WHEY-1KG'), '00000000-0000-0000-0000-000000000002', 30),
  ((SELECT id FROM produtos WHERE sku = 'CREAT-300'), '00000000-0000-0000-0000-000000000002', 45),
  ((SELECT id FROM produtos WHERE sku = 'BCAA-60'), '00000000-0000-0000-0000-000000000002', 60),
  ((SELECT id FROM produtos WHERE sku = 'PRE-300'), '00000000-0000-0000-0000-000000000002', 20),
  ((SELECT id FROM produtos WHERE sku = 'MULTI-60'), '00000000-0000-0000-0000-000000000002', 40);

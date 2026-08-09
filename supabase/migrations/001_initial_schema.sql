-- =====================================================
-- ERP System · Schema Base com prefixo erp_
-- Migration: 001_initial_schema.sql
-- =====================================================

-- ===== Extensões =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== ENUMS =====
CREATE TYPE erp_user_role AS ENUM ('admin', 'gerente', 'caixa', 'estoquista');
CREATE TYPE erp_pessoa_tipo AS ENUM ('fisica', 'juridica');
CREATE TYPE erp_venda_status AS ENUM ('pendente', 'finalizada', 'cancelada', 'devolvida');
CREATE TYPE erp_forma_pagamento AS ENUM (
  'dinheiro', 'pix', 'cartao_credito', 'cartao_debito',
  'crediario', 'boleto', 'promissoria', 'cheque', 'transferencia'
);
CREATE TYPE erp_tipo_conta AS ENUM ('pagar', 'receber');
CREATE TYPE erp_conta_status AS ENUM ('pendente', 'pago', 'cancelado', 'vencido');
CREATE TYPE erp_tipo_movimento AS ENUM ('entrada', 'saida');
CREATE TYPE erp_nota_tipo AS ENUM ('nfe', 'nfce', 'cfe');
CREATE TYPE erp_nota_status AS ENUM ('autorizada', 'cancelada', 'denegada', 'rejeitada');

-- ===== EMPRESAS / LOJAS =====
CREATE TABLE erp_lojas (
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
CREATE TABLE erp_usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  role erp_user_role NOT NULL DEFAULT 'caixa',
  ativo BOOLEAN DEFAULT true,
  loja_default_id UUID REFERENCES erp_lojas(id),
  permissoes JSONB DEFAULT '{}',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== PESSOAS (clientes, fornecedores, funcionários) =====
CREATE TABLE erp_pessoas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo erp_pessoa_tipo NOT NULL,
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
CREATE INDEX idx_erp_pessoas_cpf_cnpj ON erp_pessoas(cpf_cnpj);
CREATE INDEX idx_erp_pessoas_tipo ON erp_pessoas(tipo);
CREATE INDEX idx_erp_pessoas_nome ON erp_pessoas USING gin(to_tsvector('portuguese', nome_razao));

-- ===== FUNCIONÁRIOS (relação usuário + pessoa) =====
CREATE TABLE erp_funcionarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pessoa_id UUID NOT NULL REFERENCES erp_pessoas(id) ON DELETE RESTRICT,
  cargo VARCHAR(100),
  departamento VARCHAR(100),
  salario DECIMAL(12,2),
  data_admissao DATE,
  data_demissao DATE,
  usuario_id UUID REFERENCES erp_usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== TRANSPORTADORAS =====
CREATE TABLE erp_transportadoras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pessoa_id UUID NOT NULL REFERENCES erp_pessoas(id) ON DELETE RESTRICT,
  prazo_entrega INTEGER, -- em dias
  valor_frete DECIMAL(12,2),
  regiao_atendida TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== REGIÕES DE ENTREGA =====
CREATE TABLE erp_regioes_entrega (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(100) NOT NULL,
  ceps TEXT[], -- lista de CEPs ou faixas
  taxa DECIMAL(12,2) NOT NULL DEFAULT 0,
  prazo_dias INTEGER DEFAULT 1,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== CATEGORIAS DE PRODUTOS =====
CREATE TABLE erp_categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  categoria_pai_id UUID REFERENCES erp_categorias(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== PRODUTOS =====
CREATE TABLE erp_produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(50) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  categoria_id UUID REFERENCES erp_categorias(id),
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

CREATE INDEX idx_erp_produtos_sku ON erp_produtos(sku);
CREATE INDEX idx_erp_produtos_nome ON erp_produtos USING gin(to_tsvector('portuguese', nome));
CREATE INDEX idx_erp_produtos_categoria ON erp_produtos(categoria_id);

-- ===== ESTOQUE POR LOJA =====
CREATE TABLE erp_estoque (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produto_id UUID NOT NULL REFERENCES erp_produtos(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES erp_lojas(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 0,
  localizacao VARCHAR(50), -- ex: "Corredor A, Prateleira 3"
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(produto_id, loja_id)
);

CREATE INDEX idx_erp_estoque_produto ON erp_estoque(produto_id);
CREATE INDEX idx_erp_estoque_loja ON erp_estoque(loja_id);

-- ===== LOTES / VALIDADES =====
CREATE TABLE erp_lotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produto_id UUID NOT NULL REFERENCES erp_produtos(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES erp_lojas(id) ON DELETE CASCADE,
  codigo VARCHAR(50) NOT NULL,
  data_fabricacao DATE,
  data_validade DATE NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_lotes_validade ON erp_lotes(data_validade);

-- ===== KITS =====
CREATE TABLE erp_kits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  preco_kit DECIMAL(12,2) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE erp_kit_itens (
  kit_id UUID REFERENCES erp_kits(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES erp_produtos(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (kit_id, produto_id)
);

-- ===== SERVIÇOS =====
CREATE TABLE erp_servicos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  valor DECIMAL(12,2) NOT NULL,
  comissao_percentual DECIMAL(5,2) DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== VENDAS =====
CREATE TABLE erp_vendas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id) ON DELETE RESTRICT,
  cliente_id UUID REFERENCES erp_pessoas(id),
  usuario_id UUID NOT NULL REFERENCES erp_usuarios(id),
  data_venda TIMESTAMPTZ DEFAULT NOW(),
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  desconto DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  custo_total DECIMAL(12,2) DEFAULT 0,
  lucro_total DECIMAL(12,2) DEFAULT 0,
  forma_pagamento erp_forma_pagamento NOT NULL,
  status erp_venda_status DEFAULT 'finalizada',
  tipo_venda VARCHAR(50) DEFAULT 'pdv', -- pdv, pedido, orcamento, os, consignacao, locacao, delivery
  observacoes TEXT,
  numero_pedido SERIAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_vendas_loja ON erp_vendas(loja_id);
CREATE INDEX idx_erp_vendas_cliente ON erp_vendas(cliente_id);
CREATE INDEX idx_erp_vendas_data ON erp_vendas(data_venda);
CREATE INDEX idx_erp_vendas_status ON erp_vendas(status);

-- ===== ITENS DA VENDA =====
CREATE TABLE erp_venda_itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venda_id UUID NOT NULL REFERENCES erp_vendas(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES erp_produtos(id),
  servico_id UUID REFERENCES erp_servicos(id),
  kit_id UUID REFERENCES erp_kits(id),
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
CREATE TABLE erp_caixa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES erp_usuarios(id),
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
CREATE TABLE erp_caixa_movimentacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caixa_id UUID NOT NULL REFERENCES erp_caixa(id) ON DELETE CASCADE,
  tipo erp_tipo_movimento NOT NULL,
  motivo VARCHAR(255) NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  forma_pagamento erp_forma_pagamento,
  data_hora TIMESTAMPTZ DEFAULT NOW(),
  observacoes TEXT
);

-- ===== CONTAS A PAGAR / RECEBER =====
CREATE TABLE erp_contas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  tipo erp_tipo_conta NOT NULL,
  pessoa_id UUID REFERENCES erp_pessoas(id),
  venda_id UUID REFERENCES erp_vendas(id),
  descricao VARCHAR(255) NOT NULL,
  categoria VARCHAR(100),
  valor DECIMAL(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  valor_pago DECIMAL(12,2) DEFAULT 0,
  forma_pagamento erp_forma_pagamento,
  status erp_conta_status DEFAULT 'pendente',
  parcela_numero INTEGER DEFAULT 1,
  parcela_total INTEGER DEFAULT 1,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_contas_vencimento ON erp_contas(data_vencimento);
CREATE INDEX idx_erp_contas_status ON erp_contas(status);
CREATE INDEX idx_erp_contas_pessoa ON erp_contas(pessoa_id);

-- ===== NOTAS FISCAIS =====
CREATE TABLE erp_notas_fiscais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venda_id UUID REFERENCES erp_vendas(id),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  tipo erp_nota_tipo NOT NULL,
  numero INTEGER NOT NULL,
  serie INTEGER NOT NULL DEFAULT 1,
  chave_acesso VARCHAR(44) UNIQUE,
  protocolo VARCHAR(50),
  status erp_nota_status DEFAULT 'autorizada',
  valor_total DECIMAL(12,2) NOT NULL,
  xml_url TEXT,
  pdf_url TEXT,
  data_emissao TIMESTAMPTZ DEFAULT NOW(),
  data_cancelamento TIMESTAMPTZ,
  motivo_cancelamento TEXT,
  observacoes TEXT
);

CREATE INDEX idx_erp_nf_chave ON erp_notas_fiscais(chave_acesso);
CREATE INDEX idx_erp_nf_status ON erp_notas_fiscais(status);

-- ===== PEDIDOS / DELIVERY =====
CREATE TABLE erp_pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venda_id UUID REFERENCES erp_vendas(id),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  cliente_id UUID NOT NULL REFERENCES erp_pessoas(id),
  endereco_entrega JSONB NOT NULL,
  previsao_entrega TIMESTAMPTZ,
  data_entrega TIMESTAMPTZ,
  transportadora_id UUID REFERENCES erp_transportadoras(id),
  taxa_entrega DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'pendente', -- pendente, em_preparo, saiu, entregue, cancelado
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== COMPRAS =====
CREATE TABLE erp_compras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  fornecedor_id UUID NOT NULL REFERENCES erp_pessoas(id),
  usuario_id UUID NOT NULL REFERENCES erp_usuarios(id),
  numero_pedido SERIAL,
  data_compra TIMESTAMPTZ DEFAULT NOW(),
  total DECIMAL(12,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'pendente',
  observacoes TEXT
);

CREATE TABLE erp_compra_itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  compra_id UUID NOT NULL REFERENCES erp_compras(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES erp_produtos(id),
  preco_custo DECIMAL(12,2) NOT NULL,
  quantidade INTEGER NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL
);

-- ===== TRIGGER PARA UPDATED_AT =====
CREATE OR REPLACE FUNCTION erp_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_erp_lojas_updated_at BEFORE UPDATE ON erp_lojas FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at_column();
CREATE TRIGGER update_erp_usuarios_updated_at BEFORE UPDATE ON erp_usuarios FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at_column();
CREATE TRIGGER update_erp_pessoas_updated_at BEFORE UPDATE ON erp_pessoas FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at_column();
CREATE TRIGGER update_erp_produtos_updated_at BEFORE UPDATE ON erp_produtos FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at_column();
CREATE TRIGGER update_erp_vendas_updated_at BEFORE UPDATE ON erp_vendas FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at_column();
CREATE TRIGGER update_erp_contas_updated_at BEFORE UPDATE ON erp_contas FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at_column();

-- ===== RLS (Row Level Security) =====
ALTER TABLE erp_lojas ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_notas_fiscais ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem ler tudo
CREATE POLICY "Usuários autenticados podem ler lojas" ON erp_lojas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem ler produtos" ON erp_produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem ler pessoas" ON erp_pessoas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem ler vendas" ON erp_vendas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem ler estoque" ON erp_estoque FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem ler contas" ON erp_contas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem ler notas fiscais" ON erp_notas_fiscais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem ler usuarios" ON erp_usuarios FOR SELECT TO authenticated USING (true);

-- Política: usuários podem inserir/atualizar
CREATE POLICY "Usuários podem inserir vendas" ON erp_vendas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários podem atualizar vendas" ON erp_vendas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Usuários podem inserir contas" ON erp_contas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários podem atualizar contas" ON erp_contas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Usuários podem inserir pessoas" ON erp_pessoas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários podem atualizar pessoas" ON erp_pessoas FOR UPDATE TO authenticated USING (true);

-- ===== SEED INICIAL =====
-- Loja padrão
INSERT INTO erp_lojas (id, nome, apelido, cnpj, matriz) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Loja Matriz - Centro', 'Centro', '12.345.678/0001-90', true),
  ('00000000-0000-0000-0000-000000000002', 'Loja Filial - Shopping', 'Shopping', '12.345.678/0002-71', false);

-- Categorias
INSERT INTO erp_categorias (id, nome) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Suplementos'),
  ('00000000-0000-0000-0000-000000000002', 'Aminoácidos'),
  ('00000000-0000-0000-0000-000000000003', 'Pré-Treino'),
  ('00000000-0000-0000-0000-000000000004', 'Vitaminas'),
  ('00000000-0000-0000-0000-000000000005', 'Acessórios');

-- Produtos exemplo
INSERT INTO erp_produtos (sku, nome, categoria_id, preco_custo, preco_venda, estoque_minimo) VALUES
  ('WHEY-1KG', 'Whey Protein 1kg', '00000000-0000-0000-0000-000000000001', 80.00, 149.90, 10),
  ('CREAT-300', 'Creatina 300g', '00000000-0000-0000-0000-000000000001', 35.00, 79.90, 15),
  ('BCAA-60', 'BCAA 2400mg 60 caps', '00000000-0000-0000-0000-000000000002', 25.00, 59.90, 20),
  ('PRE-300', 'Pré-Treino 300g', '00000000-0000-0000-0000-000000000003', 45.00, 99.90, 10),
  ('MULTI-60', 'Multivitamínico 60 caps', '00000000-0000-0000-0000-000000000004', 18.00, 39.90, 25);

-- Estoque inicial
INSERT INTO erp_estoque (produto_id, loja_id, quantidade) VALUES
  ((SELECT id FROM erp_produtos WHERE sku = 'WHEY-1KG'), '00000000-0000-0000-0000-000000000001', 50),
  ((SELECT id FROM erp_produtos WHERE sku = 'CREAT-300'), '00000000-0000-0000-0000-000000000001', 80),
  ((SELECT id FROM erp_produtos WHERE sku = 'BCAA-60'), '00000000-0000-0000-0000-000000000001', 100),
  ((SELECT id FROM erp_produtos WHERE sku = 'PRE-300'), '00000000-0000-0000-0000-000000000001', 35),
  ((SELECT id FROM erp_produtos WHERE sku = 'MULTI-60'), '00000000-0000-0000-0000-000000000001', 60),
  ((SELECT id FROM erp_produtos WHERE sku = 'WHEY-1KG'), '00000000-0000-0000-0000-000000000002', 30),
  ((SELECT id FROM erp_produtos WHERE sku = 'CREAT-300'), '00000000-0000-0000-0000-000000000002', 45),
  ((SELECT id FROM erp_produtos WHERE sku = 'BCAA-60'), '00000000-0000-0000-0000-000000000002', 60),
  ((SELECT id FROM erp_produtos WHERE sku = 'PRE-300'), '00000000-0000-0000-0000-000000000002', 20),
  ((SELECT id FROM erp_produtos WHERE sku = 'MULTI-60'), '00000000-0000-0000-0000-000000000002', 40);

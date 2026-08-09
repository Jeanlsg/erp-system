-- =====================================================
-- ERP System · Alterações em Tabelas Existentes (prefixo erp_)
-- Migration: 008_alter_tables.sql
-- =====================================================

-- ===== erp_pessoas =====
ALTER TABLE erp_pessoas ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE erp_pessoas ADD COLUMN IF NOT EXISTS estado_civil VARCHAR(20);
ALTER TABLE erp_pessoas ADD COLUMN IF NOT EXISTS sexo VARCHAR(10);
ALTER TABLE erp_pessoas ADD COLUMN IF NOT EXISTS profissao VARCHAR(100);
ALTER TABLE erp_pessoas ADD COLUMN IF NOT EXISTS limite_credito DECIMAL(12,2) DEFAULT 0;
ALTER TABLE erp_pessoas ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT false;
ALTER TABLE erp_pessoas ADD COLUMN IF NOT EXISTS motivo_bloqueio TEXT;

-- ===== erp_funcionarios =====
ALTER TABLE erp_funcionarios ADD COLUMN IF NOT EXISTS comissao_percentual DECIMAL(5,2) DEFAULT 0;
ALTER TABLE erp_funcionarios ADD COLUMN IF NOT EXISTS tipo_contrato VARCHAR(20);
ALTER TABLE erp_funcionarios ADD COLUMN IF NOT EXISTS cpf VARCHAR(14);
ALTER TABLE erp_funcionarios ADD COLUMN IF NOT EXISTS rg VARCHAR(20);
ALTER TABLE erp_funcionarios ADD COLUMN IF NOT EXISTS pis_pasep VARCHAR(20);
ALTER TABLE erp_funcionarios ADD COLUMN IF NOT EXISTS ctps VARCHAR(20);
ALTER TABLE erp_funcionarios ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE erp_funcionarios ADD COLUMN IF NOT EXISTS gerente BOOLEAN DEFAULT false;

-- ===== erp_produtos =====
ALTER TABLE erp_produtos ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(50);
ALTER TABLE erp_produtos ADD COLUMN IF NOT EXISTS marca VARCHAR(100);
ALTER TABLE erp_produtos ADD COLUMN IF NOT EXISTS modelo VARCHAR(100);
ALTER TABLE erp_produtos ADD COLUMN IF NOT EXISTS peso_liquido DECIMAL(10,3);
ALTER TABLE erp_produtos ADD COLUMN IF NOT EXISTS peso_bruto DECIMAL(10,3);
ALTER TABLE erp_produtos ADD COLUMN IF NOT EXISTS volume DECIMAL(10,3);
ALTER TABLE erp_produtos ADD COLUMN IF NOT EXISTS orig VARCHAR(5);
ALTER TABLE erp_produtos ADD COLUMN IF NOT EXISTS icms DECIMAL(5,2);
ALTER TABLE erp_produtos ADD COLUMN IF NOT EXISTS ipi DECIMAL(5,2);
ALTER TABLE erp_produtos ADD COLUMN IF NOT EXISTS pis DECIMAL(5,2);
ALTER TABLE erp_produtos ADD COLUMN IF NOT EXISTS cofins DECIMAL(5,2);
ALTER TABLE erp_produtos ADD COLUMN IF NOT EXISTS cest VARCHAR(10);
ALTER TABLE erp_produtos ADD COLUMN IF NOT EXISTS comissao_percentual DECIMAL(5,2) DEFAULT 0;
ALTER TABLE erp_produtos ADD COLUMN IF NOT EXISTS tipo_produto VARCHAR(20) DEFAULT 'revenda';
ALTER TABLE erp_produtos ADD COLUMN IF NOT EXISTS controla_lote BOOLEAN DEFAULT false;
ALTER TABLE erp_produtos ADD COLUMN IF NOT EXISTS controla_serie BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_erp_produtos_codigo_barras ON erp_produtos(codigo_barras);

-- ===== erp_vendas =====
ALTER TABLE erp_vendas ADD COLUMN IF NOT EXISTS desconto_percentual DECIMAL(5,2) DEFAULT 0;
ALTER TABLE erp_vendas ADD COLUMN IF NOT EXISTS acrescimo DECIMAL(12,2) DEFAULT 0;
ALTER TABLE erp_vendas ADD COLUMN IF NOT EXISTS troco DECIMAL(12,2) DEFAULT 0;
ALTER TABLE erp_vendas ADD COLUMN IF NOT EXISTS valor_recebido DECIMAL(12,2);
ALTER TABLE erp_vendas ADD COLUMN IF NOT EXISTS comissao_total DECIMAL(12,2) DEFAULT 0;
ALTER TABLE erp_vendas ADD COLUMN IF NOT EXISTS taxa_entrega DECIMAL(12,2) DEFAULT 0;
ALTER TABLE erp_vendas ADD COLUMN IF NOT EXISTS data_cancelamento TIMESTAMPTZ;
ALTER TABLE erp_vendas ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;
ALTER TABLE erp_vendas ADD COLUMN IF NOT EXISTS cancelado_por UUID REFERENCES erp_usuarios(id);
ALTER TABLE erp_vendas ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES erp_funcionarios(id);

-- ===== erp_venda_itens =====
ALTER TABLE erp_venda_itens ADD COLUMN IF NOT EXISTS desconto_percentual DECIMAL(5,2) DEFAULT 0;
ALTER TABLE erp_venda_itens ADD COLUMN IF NOT EXISTS acrescimo DECIMAL(12,2) DEFAULT 0;
ALTER TABLE erp_venda_itens ADD COLUMN IF NOT EXISTS valor_total DECIMAL(12,2);
ALTER TABLE erp_venda_itens ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- ===== erp_contas =====
ALTER TABLE erp_contas ADD COLUMN IF NOT EXISTS numero_documento VARCHAR(50);
ALTER TABLE erp_contas ADD COLUMN IF NOT EXISTS banco VARCHAR(100);
ALTER TABLE erp_contas ADD COLUMN IF NOT EXISTS centro_custo VARCHAR(50);
ALTER TABLE erp_contas ADD COLUMN IF NOT EXISTS plano_conta VARCHAR(50);
ALTER TABLE erp_contas ADD COLUMN IF NOT EXISTS recorrente BOOLEAN DEFAULT false;
ALTER TABLE erp_contas ADD COLUMN IF NOT EXISTS periodicidade VARCHAR(20);

-- ===== erp_notas_fiscais =====
ALTER TABLE erp_notas_fiscais ADD COLUMN IF NOT EXISTS consumidor_cpf_cnpj VARCHAR(18);
ALTER TABLE erp_notas_fiscais ADD COLUMN IF NOT EXISTS consumidor_nome VARCHAR(255);
ALTER TABLE erp_notas_fiscais ADD COLUMN IF NOT EXISTS consumidor_email VARCHAR(255);
ALTER TABLE erp_notas_fiscais ADD COLUMN IF NOT EXISTS informacoes_complementares TEXT;
ALTER TABLE erp_notas_fiscais ADD COLUMN IF NOT EXISTS valor_desconto DECIMAL(12,2) DEFAULT 0;
ALTER TABLE erp_notas_fiscais ADD COLUMN IF NOT EXISTS valor_frete DECIMAL(12,2) DEFAULT 0;
ALTER TABLE erp_notas_fiscais ADD COLUMN IF NOT EXISTS valor_seguro DECIMAL(12,2) DEFAULT 0;

-- ===== erp_lojas =====
ALTER TABLE erp_lojas ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);
ALTER TABLE erp_lojas ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE erp_lojas ADD COLUMN IF NOT EXISTS cep VARCHAR(10);
ALTER TABLE erp_lojas ADD COLUMN IF NOT EXISTS logradouro VARCHAR(255);
ALTER TABLE erp_lojas ADD COLUMN IF NOT EXISTS numero VARCHAR(20);
ALTER TABLE erp_lojas ADD COLUMN IF NOT EXISTS complemento VARCHAR(100);
ALTER TABLE erp_lojas ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);
ALTER TABLE erp_lojas ADD COLUMN IF NOT EXISTS cidade VARCHAR(100);
ALTER TABLE erp_lojas ADD COLUMN IF NOT EXISTS uf VARCHAR(2);
ALTER TABLE erp_lojas ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(20);
ALTER TABLE erp_lojas ADD COLUMN IF NOT EXISTS tipo_loja VARCHAR(30) DEFAULT 'loja';
ALTER TABLE erp_lojas ADD COLUMN IF NOT EXISTS horario JSONB;

-- ===== erp_usuarios =====
ALTER TABLE erp_usuarios ADD COLUMN IF NOT EXISTS tentativas_login INTEGER DEFAULT 0;
ALTER TABLE erp_usuarios ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT false;
ALTER TABLE erp_usuarios ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMPTZ;
ALTER TABLE erp_usuarios ADD COLUMN IF NOT EXISTS ip_ultimo_login VARCHAR(50);
ALTER TABLE erp_usuarios ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);
ALTER TABLE erp_usuarios ADD COLUMN IF NOT EXISTS cpf VARCHAR(14);

-- ===== erp_pedidos =====
ALTER TABLE erp_pedidos ADD COLUMN IF NOT EXISTS tipo_pedido VARCHAR(30);
ALTER TABLE erp_pedidos ADD COLUMN IF NOT EXISTS troco_para DECIMAL(12,2);
ALTER TABLE erp_pedidos ADD COLUMN IF NOT EXISTS forma_pagamento erp_forma_pagamento;
ALTER TABLE erp_pedidos ADD COLUMN IF NOT EXISTS observacoes_entrega TEXT;
ALTER TABLE erp_pedidos ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8);
ALTER TABLE erp_pedidos ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8);

-- ===== erp_caixa_movimentacoes (melhorias) =====
ALTER TABLE erp_caixa_movimentacoes ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE erp_caixa_movimentacoes ADD COLUMN IF NOT EXISTS pessoa_id UUID REFERENCES erp_pessoas(id);
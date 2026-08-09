-- =====================================================
-- ERP System · Agenda, Cheques (prefixo erp_)
-- Migration: 011_agenda_cheques.sql
-- =====================================================

-- ===== Agenda Compromissos =====
CREATE TABLE erp_agenda_compromissos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES erp_usuarios(id),
  loja_id UUID REFERENCES erp_lojas(id),
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50),
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ,
  dia_inteiro BOOLEAN DEFAULT false,
  prioridade VARCHAR(20) DEFAULT 'media',
  status VARCHAR(20) DEFAULT 'pendente',
  clientes_relacionados UUID[],
  pedido_relacionado UUID REFERENCES erp_pedidos(id),
  venda_relacionada UUID REFERENCES erp_vendas(id),
  recorrencia_tipo VARCHAR(20),
  recorrencia_fim DATE,
  recorrencia_pai_id UUID REFERENCES erp_agenda_compromissos(id),
  lembrete_minutos INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_agenda_usuario ON erp_agenda_compromissos(usuario_id);
CREATE INDEX idx_erp_agenda_data ON erp_agenda_compromissos(data_inicio);

-- ===== Agenda Telefônica =====
CREATE TABLE erp_agenda_telefonica (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID REFERENCES erp_lojas(id),
  usuario_id UUID REFERENCES erp_usuarios(id),
  pessoa_id UUID REFERENCES erp_pessoas(id),
  nome VARCHAR(255) NOT NULL,
  empresa VARCHAR(255),
  cargo VARCHAR(100),
  categoria VARCHAR(50),
  email VARCHAR(255),
  telefone VARCHAR(20),
  celular VARCHAR(20),
  whatsapp VARCHAR(20),
  endereco TEXT,
  observacoes TEXT,
  favorito BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_agenda_tel_pessoa ON erp_agenda_telefonica(pessoa_id);
CREATE INDEX idx_erp_agenda_tel_nome ON erp_agenda_telefonica USING gin(to_tsvector('portuguese', nome));

-- ===== Cheques =====
CREATE TABLE erp_cheques (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id UUID NOT NULL REFERENCES erp_lojas(id),
  tipo VARCHAR(20) NOT NULL,
  pessoa_id UUID REFERENCES erp_pessoas(id),
  banco VARCHAR(100) NOT NULL,
  agencia VARCHAR(10),
  conta VARCHAR(20),
  numero_cheque VARCHAR(20) NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_compensacao DATE,
  status VARCHAR(30) DEFAULT 'em_carteira',
  motivo_devolucao TEXT,
  venda_id UUID REFERENCES erp_vendas(id),
  conta_id UUID REFERENCES erp_contas(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_cheques_loja ON erp_cheques(loja_id);
CREATE INDEX idx_erp_cheques_status ON erp_cheques(status);
CREATE INDEX idx_erp_cheques_vencimento ON erp_cheques(data_vencimento);

-- ===== Triggers =====
CREATE TRIGGER update_erp_agenda_compromissos_updated_at BEFORE UPDATE ON erp_agenda_compromissos FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at_column();
CREATE TRIGGER update_erp_agenda_telefonica_updated_at BEFORE UPDATE ON erp_agenda_telefonica FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at_column();
CREATE TRIGGER update_erp_cheques_updated_at BEFORE UPDATE ON erp_cheques FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at_column();

-- ===== RLS =====
ALTER TABLE erp_agenda_compromissos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_agenda_telefonica ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_cheques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read erp_agenda_compromissos" ON erp_agenda_compromissos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_agenda_compromissos" ON erp_agenda_compromissos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update erp_agenda_compromissos" ON erp_agenda_compromissos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete erp_agenda_compromissos" ON erp_agenda_compromissos FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_agenda_telefonica" ON erp_agenda_telefonica FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_agenda_telefonica" ON erp_agenda_telefonica FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update erp_agenda_telefonica" ON erp_agenda_telefonica FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_cheques" ON erp_cheques FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_cheques" ON erp_cheques FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update erp_cheques" ON erp_cheques FOR UPDATE TO authenticated USING (true);
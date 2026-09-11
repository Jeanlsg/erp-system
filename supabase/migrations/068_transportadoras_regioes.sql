-- ============================================================
-- 068: Transportadoras e Regiões de Entrega — telas alinhadas ao banco.
--
-- BUG-F5-01 da auditoria. As duas telas nunca listaram nada: filtravam
-- por loja_id, coluna que nenhuma das tabelas tem (são cadastros globais
-- — a mesma transportadora atende as duas lojas). A consulta era
-- rejeitada inteira e a tela mostrava "sem registros" em vez de erro.
--
-- Ao investigar, o desalinhamento era maior: as telas gravam campos que
-- não existiam (faixa de CEP, bairros, valor mínimo, valor por kg), e
-- erp_transportadoras guarda o nome em erp_pessoas via pessoa_id,
-- enquanto a tela manda nome e CNPJ direto. Cadastrar também falharia.
--
-- Como as duas tabelas estão VAZIAS e as telas desligadas, o banco é
-- alinhado à intenção das telas em vez de amputá-las: quem desenhou
-- previu faixa de CEP e frete por peso, e isso é o que uma entrega
-- local precisa.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- ---------- regiões de entrega ----------
ALTER TABLE erp.erp_regioes_entrega
  ADD COLUMN IF NOT EXISTS cep_inicio    varchar(9),
  ADD COLUMN IF NOT EXISTS cep_fim       varchar(9),
  ADD COLUMN IF NOT EXISTS bairros       text[],
  ADD COLUMN IF NOT EXISTS valor_minimo  numeric(12,2),
  ADD COLUMN IF NOT EXISTS updated_at    timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN erp.erp_regioes_entrega.bairros IS
  'Bairros atendidos quando a faixa de CEP não basta — bairro é como o entregador pensa a cidade.';

-- ---------- transportadoras ----------
-- pessoa_id continua sendo a identidade (nome e CNPJ vivem em erp_pessoas,
-- sem duplicar cadastro), mas passa a aceitar nulo: transportadora avulsa
-- não precisa virar cadastro de pessoa para entrar aqui.
ALTER TABLE erp.erp_transportadoras
  ALTER COLUMN pessoa_id DROP NOT NULL;

ALTER TABLE erp.erp_transportadoras
  ADD COLUMN IF NOT EXISTS nome                varchar(120),
  ADD COLUMN IF NOT EXISTS cnpj                varchar(18),
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias  integer,
  ADD COLUMN IF NOT EXISTS valor_fixo          numeric(12,2),
  ADD COLUMN IF NOT EXISTS valor_kg            numeric(12,2);

-- Quem já tem pessoa vinculada herda o nome dela; daqui em diante o nome
-- pode vir direto, e a pessoa é opcional.
UPDATE erp.erp_transportadoras t
   SET nome = COALESCE(t.nome, p.nome_razao),
       cnpj = COALESCE(t.cnpj, p.cpf_cnpj)
  FROM erp.erp_pessoas p
 WHERE p.id = t.pessoa_id AND t.nome IS NULL;

COMMENT ON COLUMN erp.erp_transportadoras.nome IS
  'Nome da transportadora. Quando houver pessoa_id, espelha o cadastro de erp_pessoas.';

SELECT 'regioes: ' || string_agg(column_name, ', ' ORDER BY ordinal_position)
  FROM information_schema.columns WHERE table_schema='erp' AND table_name='erp_regioes_entrega';
SELECT 'transportadoras: ' || string_agg(column_name, ', ' ORDER BY ordinal_position)
  FROM information_schema.columns WHERE table_schema='erp' AND table_name='erp_transportadoras';

-- ============================================================
-- 080 — cada caixa é um caixa, com nome e dono
--
-- Até aqui "caixa" era só um NÚMERO (erp_caixa.numero_caixa), e a
-- quantidade vinha de uma configuração global: "2 caixas" criava Caixa 1 e
-- Caixa 2 em TODAS as lojas. Ou seja, o Caixa 1 de Petrolina e o Caixa 1 de
-- Juazeiro eram o mesmo número em lojas diferentes, sem nada que os
-- distinguisse no relatório além da loja.
--
-- Agora o ponto de venda é um cadastro: pertence a uma loja, tem nome e
-- pode ser desativado. "Caixa Petrolina" e "Caixa 2 Juazeiro" são dois
-- registros distintos, e o turno (erp_caixa) aponta para um deles.
--
-- `numero_caixa` continua na tabela de turnos: é o que aparece no cupom e
-- no histórico antigo, e apagá-lo reescreveria o passado. O ponto de venda
-- é a informação nova, ao lado.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS erp.erp_pontos_venda (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id     uuid NOT NULL REFERENCES erp.erp_lojas(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  numero      integer NOT NULL,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, numero)
);

COMMENT ON TABLE erp.erp_pontos_venda IS
  'Os caixas físicos da rede. Um por loja e número; erp_caixa (o turno) aponta para um deles.';
COMMENT ON COLUMN erp.erp_pontos_venda.numero IS
  'Número dentro da loja — é o que sai no cupom e mantém o histórico legível.';

-- Semeia a partir do que já existe: todo (loja, numero_caixa) que já teve
-- turno vira um ponto de venda. Loja sem turno nenhum ganha o caixa 1, para
-- ninguém abrir o PDV e encontrar lista vazia.
INSERT INTO erp.erp_pontos_venda (loja_id, numero, nome)
SELECT c.loja_id, c.numero_caixa,
       'Caixa ' || c.numero_caixa || ' — ' || coalesce(l.apelido, l.nome)
  FROM (SELECT DISTINCT loja_id, numero_caixa FROM erp.erp_caixa WHERE numero_caixa IS NOT NULL) c
  JOIN erp.erp_lojas l ON l.id = c.loja_id
ON CONFLICT (loja_id, numero) DO NOTHING;

INSERT INTO erp.erp_pontos_venda (loja_id, numero, nome)
SELECT l.id, 1, 'Caixa 1 — ' || coalesce(l.apelido, l.nome)
  FROM erp.erp_lojas l
 WHERE l.ativo
   AND NOT EXISTS (SELECT 1 FROM erp.erp_pontos_venda p WHERE p.loja_id = l.id)
ON CONFLICT (loja_id, numero) DO NOTHING;

-- ---------- turno aponta para o ponto ----------
ALTER TABLE erp.erp_caixa
  ADD COLUMN IF NOT EXISTS ponto_venda_id uuid REFERENCES erp.erp_pontos_venda(id) ON DELETE SET NULL;

UPDATE erp.erp_caixa c
   SET ponto_venda_id = p.id
  FROM erp.erp_pontos_venda p
 WHERE p.loja_id = c.loja_id AND p.numero = c.numero_caixa
   AND c.ponto_venda_id IS NULL;

-- ---------- quem abriu o turno ----------
-- usuario_id já existe e guarda quem abriu. O que faltava era o relatório
-- distinguir o caixa; agora distingue pelo ponto de venda.
COMMENT ON COLUMN erp.erp_caixa.usuario_id IS
  'Quem abriu o turno. A abertura confirma a senha desta pessoa, então o nome no relatório é de quem realmente assumiu o caixa.';

-- ---------- acesso ----------
ALTER TABLE erp.erp_pontos_venda ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON erp.erp_pontos_venda TO authenticated;

DROP POLICY IF EXISTS erp_pontos_venda_select ON erp.erp_pontos_venda;
CREATE POLICY erp_pontos_venda_select ON erp.erp_pontos_venda
  FOR SELECT TO authenticated
  USING ((SELECT erp.current_erp_user_id()) IS NOT NULL);

-- criar e desativar caixa é de admin/gerente
DROP POLICY IF EXISTS erp_pontos_venda_gestao ON erp.erp_pontos_venda;
CREATE POLICY erp_pontos_venda_gestao ON erp.erp_pontos_venda
  FOR ALL TO authenticated
  USING ((SELECT erp.is_erp_admin()))
  WITH CHECK ((SELECT erp.is_erp_admin()));

SELECT 'pontos de venda: ' || count(*) || ' | turnos ligados: '
    || (SELECT count(*) FROM erp.erp_caixa WHERE ponto_venda_id IS NOT NULL)
    || '/' || (SELECT count(*) FROM erp.erp_caixa) AS resultado
  FROM erp.erp_pontos_venda;

COMMIT;

-- ============================================================
-- 072 — uma linha de dados empresariais por loja
--
-- MESMO BUG QUE O 067 CORRIGIU NO SEFAZ, que aqui passou batido.
--
-- A tela Configurações Empresariais hidratava o formulário assim:
--   if (dados && !form) setForm(dados);
--   if (!dados && form === null && lojaId) setForm({ loja_id, razao_social:"", cnpj:"" });
--
-- A segunda linha dispara já no PRIMEIRO render, quando a consulta ainda está
-- em voo (`dados` indefinido) e o lojaId já existe, porque vem de store
-- persistida em localStorage. O formulário nasce vazio e SEM `id`; quando os
-- dados chegam, a primeira linha não dispara mais (form já é truthy). Então:
--   · os dados salvos nunca aparecem nos campos, e
--   · o Salvar faz upsert sem `id` e sem UNIQUE — ou seja, INSERT.
--
-- Aconteceu de verdade: a loja Juazeiro ficou com 2 linhas, uma com 13 campos
-- preenchidos (09/08) e uma completamente vazia criada em 10/09 19:55, durante
-- a auditoria automatizada — o robô abriu a tela e isso bastou.
--
-- Com 2 linhas o estrago cresce sozinho: o hook usa `.maybeSingle()`, que pede
-- `vnd.pgrst.object+json`; o PostgREST responde PGRST116 para mais de uma
-- linha, a consulta falha, o formulário cai no padrão vazio e o próximo Salvar
-- insere a terceira.
--
-- Esta migration mantém a linha mais completa de cada loja (empate: a mais
-- recente), apaga as demais e cria o UNIQUE que impede a repetição.
-- ============================================================

BEGIN;

-- quantos campos não-vazios cada linha tem, para escolher a boa
CREATE OR REPLACE FUNCTION erp.tmp_campos_preenchidos(p jsonb)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::integer FROM jsonb_each_text(p - 'id' - 'loja_id' - 'updated_at')
   WHERE value IS NOT NULL AND btrim(value) <> '';
$$;

WITH ranqueado AS (
  SELECT id, loja_id,
         row_number() OVER (
           PARTITION BY loja_id
           ORDER BY erp.tmp_campos_preenchidos(to_jsonb(d)) DESC, updated_at DESC
         ) AS posicao
    FROM erp.erp_dados_empresariais d
)
DELETE FROM erp.erp_dados_empresariais
 WHERE id IN (SELECT id FROM ranqueado WHERE posicao > 1);

DROP FUNCTION erp.tmp_campos_preenchidos(jsonb);

ALTER TABLE erp.erp_dados_empresariais
  DROP CONSTRAINT IF EXISTS erp_dados_empresariais_loja_id_key;
ALTER TABLE erp.erp_dados_empresariais
  ADD CONSTRAINT erp_dados_empresariais_loja_id_key UNIQUE (loja_id);

COMMENT ON CONSTRAINT erp_dados_empresariais_loja_id_key ON erp.erp_dados_empresariais IS
  'Uma linha por loja. Sem isto, a tela duplicava a cada Salvar e o maybeSingle do hook passava a falhar.';

SELECT 'dados empresariais: ' || count(*) || ' linha(s) para ' || count(DISTINCT loja_id) || ' loja(s)'
  FROM erp.erp_dados_empresariais;

COMMIT;

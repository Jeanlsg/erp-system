-- ============================================================
-- 067: Uma configuração SEFAZ por loja — no banco, não só na tela.
--
-- BUG-06-01 da auditoria: clicar em "Salvar" antes de a tela carregar
-- gravava uma SEGUNDA configuração, com os valores padrão do formulário
-- (inclusive UF "SP" numa loja da Bahia). Com duas linhas, erp-dfe e
-- erp-emitir-nfe — que leem a configuração com .maybeSingle() — passam a
-- responder "configuração SEFAZ da loja ausente": um clique apressado
-- derrubava a emissão de nota da loja inteira.
--
-- A trava vai no banco porque a tela é só um dos caminhos: import,
-- edge function ou SQL manual poderiam duplicar do mesmo jeito.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- Se ainda houver duplicata, mantém a mais recente com a UF da loja
-- (ou simplesmente a mais recente) e descarta o resto.
WITH ranqueadas AS (
  SELECT cs.id,
         row_number() OVER (
           PARTITION BY cs.loja_id
           ORDER BY (cs.uf = l.uf) DESC NULLS LAST, cs.updated_at DESC
         ) AS pos
    FROM erp.erp_configuracoes_sefaz cs
    JOIN erp.erp_lojas l ON l.id = cs.loja_id
)
DELETE FROM erp.erp_configuracoes_sefaz
 WHERE id IN (SELECT id FROM ranqueadas WHERE pos > 1);

ALTER TABLE erp.erp_configuracoes_sefaz
  DROP CONSTRAINT IF EXISTS uq_erp_configuracoes_sefaz_loja;
ALTER TABLE erp.erp_configuracoes_sefaz
  ADD CONSTRAINT uq_erp_configuracoes_sefaz_loja UNIQUE (loja_id);

COMMENT ON CONSTRAINT uq_erp_configuracoes_sefaz_loja ON erp.erp_configuracoes_sefaz IS
  'Uma configuração por loja: duplicata quebra a leitura por .maybeSingle() nas edge functions fiscais.';

SELECT l.apelido || ': ' || count(*) || ' config (UF ' || string_agg(cs.uf, ',') || ')'
  FROM erp.erp_configuracoes_sefaz cs JOIN erp.erp_lojas l ON l.id = cs.loja_id
 GROUP BY l.apelido ORDER BY 1;

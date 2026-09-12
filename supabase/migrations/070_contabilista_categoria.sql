-- ============================================================
-- 070 — as chaves do contabilista passam a ter categoria
--
-- A migration 054 criou as seis chaves `sped_contador_*` sem preencher
-- `categoria`. A lista de Configurações do Sistema agrupa por essa coluna e
-- manda quem está vazio para o grupo "OUTROS" — então os dados do contador
-- apareciam longe de "FISCAL", que é onde quem procura vai olhar.
--
-- O formulário próprio agora vive na tela de Escrituração (SPED), com rótulo
-- em português. Esta migration só conserta o agrupamento para quem chegar pela
-- lista técnica.
-- ============================================================

BEGIN;

UPDATE erp.erp_configuracoes_sistema
   SET categoria = 'fiscal'
 WHERE chave LIKE 'sped_contador_%'
   AND COALESCE(categoria, '') = '';

SELECT 'chaves do contabilista em categoria fiscal: ' || count(*)
  FROM erp.erp_configuracoes_sistema
 WHERE chave LIKE 'sped_contador_%' AND categoria = 'fiscal';

COMMIT;

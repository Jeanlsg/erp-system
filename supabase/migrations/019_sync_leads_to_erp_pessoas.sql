-- =====================================================
-- Sync one-shot: leads do Overdrive (public) → erp.erp_pessoas
-- Mesmo banco! Sem rede, sem dump.
-- Migration: 019_sync_leads_to_erp_pessoas.sql
-- =====================================================

-- Dry-run
DO $$
DECLARE
  total_leads INTEGER;
  total_grupos INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_leads FROM public.leads WHERE remotejid LIKE '%@s.whatsapp.net';
  SELECT COUNT(*) INTO total_grupos FROM public.leads WHERE remotejid LIKE '%@g.us';
  RAISE NOTICE 'DRY-RUN: % leads (pessoas), % grupos serao ignorados', total_leads, total_grupos;
END $$;

-- Sync real (idempotente via UNIQUE INDEX em celular)
-- IMPORTANTE: precisa de indice UNIQUE full (sem WHERE), porque o partial
-- index com WHERE celular IS NOT NULL nao funciona com ON CONFLICT
DROP INDEX IF EXISTS erp.erp_pessoas_celular_uidx;
CREATE UNIQUE INDEX erp_pessoas_celular_uidx ON erp.erp_pessoas (celular);

INSERT INTO erp.erp_pessoas (tipo, nome_razao, celular, observacoes, ativo)
SELECT
  'fisica'::erp.erp_pessoa_tipo,
  COALESCE(NULLIF(name, ''), 'Sem nome') AS nome_razao,
  regexp_replace(remotejid, '@.*$', '') AS celular,
  '[overdrive:' || id || '] importado de leads em 2026-08-09' AS observacoes,
  true
FROM public.leads
WHERE remotejid LIKE '%@s.whatsapp.net'
ON CONFLICT (celular) DO UPDATE
  SET nome_razao = COALESCE(EXCLUDED.nome_razao, erp.erp_pessoas.nome_razao),
      observacoes = erp.erp_pessoas.observacoes || E'\n[overdrive-update:' || EXCLUDED.observacoes || ']',
      updated_at = NOW();

-- Relatorio final
SELECT
  'Pessoas importadas do Overdrive' AS info,
  COUNT(*) FILTER (WHERE observacoes LIKE '[overdrive:% importado de leads em %' AND created_at::date = CURRENT_DATE) AS novos,
  COUNT(*) FILTER (WHERE observacoes LIKE '%overdrive-update%') AS atualizados,
  COUNT(*) AS total_erp_pessoas
FROM erp.erp_pessoas;
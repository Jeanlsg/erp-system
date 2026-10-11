-- ============================================================
-- 104 — views usadas pelo sistema sem GRANT.
--
-- O header lê v_erp_aniversariantes_mes e v_erp_lotes_vencendo; o
-- dashboard/relatórios leem v_erp_estoque_baixo, v_erp_top_produtos,
-- v_erp_vendas_por_dia e v_erp_fluxo_caixa. Nenhuma tinha GRANT: a consulta
-- falhava calada e os ícones/gráficos ficavam vazios (achado em 10/10/2026
-- olhando o header). Antes de liberar, security_invoker: sem ele a view roda
-- como o dono (supabase_admin) e ignora o RLS — uma filial veria a outra.
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['v_erp_aniversariantes_mes', 'v_erp_lotes_vencendo', 'v_erp_estoque_baixo',
                           'v_erp_top_produtos', 'v_erp_vendas_por_dia', 'v_erp_fluxo_caixa'] LOOP
    EXECUTE format('ALTER VIEW erp.%I SET (security_invoker = true)', v);
    EXECUTE format('GRANT SELECT ON erp.%I TO authenticated, service_role', v);
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;

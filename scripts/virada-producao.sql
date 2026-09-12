-- ============================================================
-- VIRADA PARA PRODUÇÃO — limpa dados de teste/exemplo.
--
-- RODAR UMA ÚNICA VEZ, na entrega, DEPOIS de um backup COMPLETO:
--   /opt/backups/backup-diario.sh      # gera o trio globals+postgres+_supabase
--
-- E ENSAIE ANTES, num clone — leva 2 minutos e já pegou erro uma vez:
--   DB=$(docker ps -qf name=supabase-db | head -1)
--   docker exec $DB psql -U supabase_admin -d postgres -qc 'CREATE DATABASE ensaio;'
--   docker exec -i $DB pg_restore -U supabase_admin -d ensaio --no-owner --no-acl \
--     < /opt/backups/postgres-$(date +%Y%m%d).dump
--   docker exec -i $DB psql -U supabase_admin -d ensaio -v ON_ERROR_STOP=1 < virada-producao.sql
--   docker exec $DB psql -U supabase_admin -d postgres -qc 'DROP DATABASE ensaio;'
--   # (restaurar num banco de outro nome dá 6 erros de pg_cron — são esperados)
--
-- Procedimento de restauração: scripts/RESTAURAR-BACKUP.md
--
-- Execução:
--   docker exec -i $(docker ps -qf name=supabase-db) \
--     psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < virada-producao.sql
--
-- O QUE PRESERVA: lojas, usuários, dados empresariais, config
-- SEFAZ, certificados digitais, configurações do sistema,
-- integrações (Resend/CRM/NFe), plano de contas, centros de
-- custo, bandeiras de cartão, regiões de entrega, feature flags,
-- chaves PIX e contas bancárias.
--
-- O QUE APAGA: todo o movimento de teste (vendas, notas, contas,
-- caixa, estoque, compras, devoluções, crediário, fidelidade…), os
-- cadastros de exemplo (produtos, categorias, kits, pessoas,
-- funcionários, serviços) e a conta temporária da auditoria
-- (demo.admin@, já desativada desde 10/09/2026).
-- ============================================================

BEGIN;

-- retrato antes (fica no log de quem executou)
SELECT 'ANTES  vendas='||(SELECT count(*) FROM erp.erp_vendas)
  ||' produtos='||(SELECT count(*) FROM erp.erp_produtos)
  ||' pessoas='||(SELECT count(*) FROM erp.erp_pessoas)
  ||' contas='||(SELECT count(*) FROM erp.erp_contas)
  ||' notas='||(SELECT count(*) FROM erp.erp_notas_fiscais);

-- ---- o que vai ser apagado: UMA lista, usada pela conferência e pelo TRUNCATE ----
-- Manter em dois lugares apodrece. A lista vive aqui, a conferência abaixo usa
-- ela para detectar tabela nova que aponte para alguma destas, e o TRUNCATE é
-- montado a partir dela.
CREATE TEMP TABLE a_truncar(tabela text PRIMARY KEY);
INSERT INTO a_truncar(tabela) VALUES
  ('erp_notas_fiscais'), ('erp_nfe_eventos'), ('erp_nota_envios'), ('erp_inutilizacoes'),
  ('erp_nfe_entrada'), ('erp_nfe_entrada_itens'), ('erp_dfe_consultas'), ('erp_dfe_nsu'),
  ('erp_sped_arquivos'), ('erp_vendas'), ('erp_venda_itens'), ('erp_venda_taxas'),
  ('erp_devolucoes'), ('erp_devolucao_itens'), ('erp_orcamentos'), ('erp_orcamento_itens'),
  ('erp_pedidos'), ('erp_contas'), ('erp_caixa'), ('erp_caixa_movimentacoes'),
  ('erp_sangrias'), ('erp_entradas_extras'), ('erp_fechamentos_caixa'), ('erp_cheques'),
  ('erp_boletos'), ('erp_promissorias'), ('erp_parcelamentos'), ('erp_parcelamento_contas'),
  ('erp_parcelamento_parcelas'), ('erp_crediario_parcelas'), ('erp_crediario_parcela_itens'), ('erp_comissoes'),
  ('erp_negativacoes'), ('erp_protestos'), ('erp_estoque'), ('erp_estoque_movimentacoes'),
  ('erp_lotes'), ('erp_inventarios'), ('erp_inventario_itens'), ('erp_compras'),
  ('erp_compra_itens'), ('erp_consignacoes'), ('erp_consignacao_itens'), ('erp_remessas'),
  ('erp_remessa_itens'), ('erp_cartao_fidelidade'), ('erp_cartao_fidelidade_movimentacoes'), ('erp_crm_sync'),
  ('erp_lgpd_solicitacoes'), ('erp_email_marketing'), ('erp_mala_direta'), ('erp_torpedos'),
  ('erp_ocorrencias'), ('erp_locacoes'), ('erp_ordens_servico'), ('erp_avaliacoes'),
  ('erp_recomendacoes'), ('erp_notificacoes'), ('erp_agenda_compromissos'), ('erp_agenda_telefonica'),
  ('erp_documentos'), ('erp_downloads'), ('erp_auditoria'), ('erp_veiculos'),
  ('erp_veiculo_abastecimentos'), ('erp_veiculo_manutencoes'), ('erp_produtos'), ('erp_categorias'),
  ('erp_kits'), ('erp_kit_itens'), ('erp_pessoas'), ('erp_funcionarios'),
  ('erp_servicos'), ('erp_transportadoras'), ('erp_parcerias'), ('erp_tabelas_preco'),
  ('erp_tabela_preco_itens');

-- ---- pré-voo: alguma tabela de FORA aponta para alguma de DENTRO? ----
-- Se sim, o TRUNCATE falha inteiro com "cannot truncate a table referenced in
-- a foreign key constraint" e o script aborta no meio. Aconteceu de verdade
-- quando a tabela de solicitações LGPD foi criada (migration 071) e ficou fora
-- da lista: a virada parou no TRUNCATE. Esta conferência troca o acidente por
-- uma mensagem que diz exatamente o que acrescentar.
DO $preflight$
DECLARE v_faltando text;
BEGIN
  SELECT string_agg(DISTINCT c.conrelid::regclass::text, ', ')
    INTO v_faltando
    FROM pg_constraint c
   WHERE c.contype = 'f'
     AND c.connamespace = 'erp'::regnamespace
     AND replace(c.confrelid::regclass::text, 'erp.', '') IN (SELECT tabela FROM a_truncar)
     AND replace(c.conrelid::regclass::text,  'erp.', '') NOT IN (SELECT tabela FROM a_truncar);
  IF v_faltando IS NOT NULL THEN
    RAISE EXCEPTION
      'Estas tabelas apontam para tabelas que serão apagadas e não estão na lista: %. Acrescente-as ao INSERT INTO a_truncar acima e rode de novo.',
      v_faltando;
  END IF;
END $preflight$;

-- ---- apaga tudo de uma vez, na ordem que o Postgres resolve sozinho ----
DO $truncar$
BEGIN
  EXECUTE 'TRUNCATE ' || (SELECT string_agg('erp.' || quote_ident(tabela), ', ' ORDER BY tabela) FROM a_truncar)
       || ' RESTART IDENTITY';
END $truncar$;

-- numeração NFC-e: homologação e produção são ambientes independentes;
-- em produção recomeça do 1
UPDATE erp.erp_configuracoes_sefaz SET numeracao_atual_nfce = 1, numeracao_atual_nfe = 1;

-- ---- conta temporária da auditoria ----
-- Já está desativada (ativo=false + ban no GoTrue) desde 10/09/2026, mas foi
-- mantida até aqui porque as vendas e comissões de teste apontavam para ela.
-- O TRUNCATE acima apagou esses registros, então agora ela sai sem arrastar
-- histórico nenhum. Idempotente: se já não existir, não faz nada.
--
-- Antes de apagar, solta as duas referências que NÃO são truncadas acima
-- (feature flags e presets de páginas são preservados de propósito). As duas
-- são ON DELETE NO ACTION: se sobrasse uma linha apontando para a conta, o
-- DELETE abortaria a virada inteira. Hoje estão em zero — isto é garantia.
UPDATE erp.erp_feature_flags SET desativado_por = NULL
 WHERE desativado_por = (SELECT id FROM erp.erp_usuarios
                          WHERE email = 'demo.admin@lojaxlife.com.br');
UPDATE erp.erp_flag_presets SET criado_por = NULL
 WHERE criado_por = (SELECT id FROM erp.erp_usuarios
                      WHERE email = 'demo.admin@lojaxlife.com.br');

DELETE FROM auth.users
 WHERE email = 'demo.admin@lojaxlife.com.br';
DELETE FROM erp.erp_usuarios
 WHERE email = 'demo.admin@lojaxlife.com.br';

-- retrato depois: tudo que era teste deve estar em zero
SELECT 'DEPOIS vendas='||(SELECT count(*) FROM erp.erp_vendas)
  ||' produtos='||(SELECT count(*) FROM erp.erp_produtos)
  ||' pessoas='||(SELECT count(*) FROM erp.erp_pessoas)
  ||' contas='||(SELECT count(*) FROM erp.erp_contas)
  ||' notas='||(SELECT count(*) FROM erp.erp_notas_fiscais);

-- o que FICOU (conferência manual):
SELECT 'mantidos: lojas='||(SELECT count(*) FROM erp.erp_lojas)
  ||' usuarios='||(SELECT count(*) FROM erp.erp_usuarios)
  ||' (conta_auditoria_restante='||(SELECT count(*) FROM erp.erp_usuarios
       WHERE email = 'demo.admin@lojaxlife.com.br')||', deve ser 0)'
  ||' certificados='||(SELECT count(*) FROM erp.erp_certificados_digitais)
  ||' config_sefaz='||(SELECT count(*) FROM erp.erp_configuracoes_sefaz)
  ||' integracoes='||(SELECT count(*) FROM public.integrations);

COMMIT;

-- Pós-virada (manual, quando o cliente estiver credenciado):
-- 1. Cadastrar CSC de produção em Fiscal → Config SEFAZ (cada loja).
-- 2. Mudar ambiente para 'producao' nas duas lojas.
-- 3. Importar produtos reais e conferir NCM/CFOP/CST de cada um.
-- 4. Emitir a primeira NFC-e de produção com venda real de valor baixo.

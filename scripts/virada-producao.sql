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

-- ---- movimento + cadastros de exemplo, numa truncada só ----
-- (tudo que se referencia mutuamente precisa estar na mesma lista)
TRUNCATE
  -- fiscal
  erp.erp_notas_fiscais, erp.erp_nfe_eventos, erp.erp_nota_envios,
  erp.erp_inutilizacoes, erp.erp_nfe_entrada, erp.erp_nfe_entrada_itens,
  erp.erp_dfe_consultas, erp.erp_dfe_nsu, erp.erp_sped_arquivos,
  -- vendas e devoluções
  erp.erp_vendas, erp.erp_venda_itens, erp.erp_venda_taxas,
  erp.erp_devolucoes, erp.erp_devolucao_itens,
  erp.erp_orcamentos, erp.erp_orcamento_itens, erp.erp_pedidos,
  -- financeiro / caixa
  erp.erp_contas, erp.erp_caixa, erp.erp_caixa_movimentacoes,
  erp.erp_sangrias, erp.erp_entradas_extras, erp.erp_fechamentos_caixa,
  erp.erp_cheques, erp.erp_boletos, erp.erp_promissorias,
  erp.erp_parcelamentos, erp.erp_parcelamento_contas, erp.erp_parcelamento_parcelas,
  erp.erp_crediario_parcelas, erp.erp_crediario_parcela_itens,
  erp.erp_comissoes, erp.erp_negativacoes, erp.erp_protestos,
  -- estoque
  erp.erp_estoque, erp.erp_estoque_movimentacoes, erp.erp_lotes,
  erp.erp_inventarios, erp.erp_inventario_itens,
  erp.erp_compras, erp.erp_compra_itens,
  erp.erp_consignacoes, erp.erp_consignacao_itens,
  erp.erp_remessas, erp.erp_remessa_itens,
  -- fidelidade / crm
  erp.erp_cartao_fidelidade, erp.erp_cartao_fidelidade_movimentacoes,
  erp.erp_crm_sync,
  -- marketing / diversos de teste
  erp.erp_email_marketing, erp.erp_mala_direta, erp.erp_torpedos,
  erp.erp_ocorrencias, erp.erp_locacoes, erp.erp_ordens_servico,
  erp.erp_avaliacoes, erp.erp_recomendacoes, erp.erp_notificacoes,
  erp.erp_agenda_compromissos, erp.erp_agenda_telefonica,
  erp.erp_documentos, erp.erp_downloads, erp.erp_auditoria,
  erp.erp_veiculos, erp.erp_veiculo_abastecimentos, erp.erp_veiculo_manutencoes,
  -- cadastros de exemplo
  erp.erp_produtos, erp.erp_categorias, erp.erp_kits, erp.erp_kit_itens,
  erp.erp_pessoas, erp.erp_funcionarios, erp.erp_servicos,
  erp.erp_transportadoras, erp.erp_parcerias,
  erp.erp_tabelas_preco, erp.erp_tabela_preco_itens
RESTART IDENTITY;

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

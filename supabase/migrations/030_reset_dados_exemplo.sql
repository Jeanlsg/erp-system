-- =====================================================
-- ERP System · Reset COMPLETO de Dados de Exemplo
-- Migration: 030_reset_dados_exemplo.sql
--
-- ⚠️ ATENÇÃO: Este script APAGA TODOS os dados de:
--   - Vendas, Compras, Pedidos
--   - Produtos, Categorias, Pessoas, Funcionários
--   - Contas a pagar/receber, Boletos, Cheques
--   - Notas fiscais, Sangrias, Entradas extras
--   - Estoque (zerado, não apagado)
--   - Avaliações, Notificações, Ocorrências
--
-- PRESERVA:
--   - Lojas (Juazeiro/Petrolina)
--   - Dados empresariais
--   - Configurações SEFAZ
--   - Usuários
--   - Bandeiras de cartão
--   - Configurações do sistema (incluindo CFOPs)
--
-- USO: Antes de aplicar em produção, rode:
--   psql ... -f 030_reset_dados_exemplo.sql
-- =====================================================

BEGIN;

-- Desabilitar RLS temporariamente para o reset
ALTER TABLE erp.erp_vendas DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_compra_itens DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_compras DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_pedidos DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_venda_itens DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_venda_taxas DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_notas_fiscais DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_caixa DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_caixa_movimentacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_sangrias DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_entradas_extras DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_contas DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_boletos DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_cheques DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_promissorias DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_crediario_parcelas DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_crediario_parcela_itens DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_parcelamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_parcelamento_parcelas DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_parcelamento_contas DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_negativacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_protestos DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_parcerias DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_avaliacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_recomendacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_notificacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_ocorrencias DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_agenda_compromissos DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_agenda_telefonica DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_email_marketing DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_mala_direta DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_torpedos DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_cartao_fidelidade DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_cartao_fidelidade_movimentacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_documentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_comissoes DISABLE ROW LEVEL SECURITY;

-- Limpar dados de exemplo
DELETE FROM erp.erp_venda_itens;
DELETE FROM erp.erp_venda_taxas;
DELETE FROM erp.erp_vendas;

DELETE FROM erp.erp_compra_itens;
DELETE FROM erp.erp_compras;

DELETE FROM erp.erp_pedidos;
DELETE FROM erp.erp_notas_fiscais;

DELETE FROM erp.erp_lotes;

DELETE FROM erp.erp_caixa_movimentacoes;
DELETE FROM erp.erp_caixa;
DELETE FROM erp.erp_sangrias;
DELETE FROM erp.erp_entradas_extras;

DELETE FROM erp.erp_contas;
DELETE FROM erp.erp_boletos;
DELETE FROM erp.erp_cheques;
DELETE FROM erp.erp_promissorias;

DELETE FROM erp.erp_crediario_parcela_itens;
DELETE FROM erp.erp_crediario_parcelas;
DELETE FROM erp.erp_parcelamento_parcelas;
DELETE FROM erp.erp_parcelamento_contas;
DELETE FROM erp.erp_parcelamentos;

DELETE FROM erp.erp_negativacoes;
DELETE FROM erp.erp_protestos;
DELETE FROM erp.erp_parcerias;
DELETE FROM erp.erp_avaliacoes;
DELETE FROM erp.erp_recomendacoes;
DELETE FROM erp.erp_notificacoes;
DELETE FROM erp.erp_ocorrencias;
DELETE FROM erp.erp_agenda_compromissos;
DELETE FROM erp.erp_agenda_telefonica;
DELETE FROM erp.erp_email_marketing;
DELETE FROM erp.erp_mala_direta;
DELETE FROM erp.erp_torpedos;
DELETE FROM erp.erp_cartao_fidelidade_movimentacoes;
DELETE FROM erp.erp_cartao_fidelidade;
DELETE FROM erp.erp_documentos;
DELETE FROM erp.erp_comissoes;

-- Zerar estoque (preserva produtos)
UPDATE erp.erp_estoque SET quantidade = 0;

-- Limpar produtos, categorias, pessoas, funcionários
DELETE FROM erp.erp_lotes;
DELETE FROM erp.erp_kit_itens;
DELETE FROM erp.erp_kits;
DELETE FROM erp.erp_produtos;
DELETE FROM erp.erp_categorias;
DELETE FROM erp.erp_funcionarios;
DELETE FROM erp.erp_pessoas;

-- Reabilitar RLS
ALTER TABLE erp.erp_vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_compra_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_venda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_venda_taxas ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_caixa_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_sangrias ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_entradas_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_boletos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_cheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_promissorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_crediario_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_crediario_parcela_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_parcelamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_parcelamento_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_parcelamento_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_negativacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_protestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_parcerias ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_recomendacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_agenda_compromissos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_agenda_telefonica ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_email_marketing ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_mala_direta ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_torpedos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_cartao_fidelidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_cartao_fidelidade_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_comissoes ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verificar estado final
SELECT
  (SELECT COUNT(*) FROM erp.erp_lojas) AS lojas,
  (SELECT COUNT(*) FROM erp.erp_pessoas) AS pessoas,
  (SELECT COUNT(*) FROM erp.erp_produtos) AS produtos,
  (SELECT COUNT(*) FROM erp.erp_vendas) AS vendas,
  (SELECT COUNT(*) FROM erp.erp_compras) AS compras,
  (SELECT SUM(quantidade) FROM erp.erp_estoque) AS total_pecas_estoque;

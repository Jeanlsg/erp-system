-- =====================================================
-- ERP System · Dados de Exemplo + Script de Reset
-- Migration: 029_seed_exemplo.sql
--
-- AVISO: Estes dados são FICTÍCIOS para demonstração.
-- Use a migration 030_reset_dados.sql para limpar quando
-- for substituir por dados reais.
-- =====================================================

-- ===== HELPERS: STORAGE DE IDs FIXOS PARA RESET =====

-- Inserir configurações de CFOP (já feito antes, mas garantindo)
INSERT INTO erp.erp_configuracoes_sistema (chave, valor, tipo, categoria, descricao) VALUES
  ('cfop_remessa_mesma_uf', '5152', 'texto', 'fiscal', 'CFOP para remessa entre filiais mesma UF'),
  ('cfop_remessa_outra_uf', '6152', 'texto', 'fiscal', 'CFOP para remessa entre filiais UFs diferentes'),
  ('cfop_retorno_mesma_uf', '5202', 'texto', 'fiscal', 'CFOP para retorno de remessa mesma UF'),
  ('cfop_retorno_outra_uf', '6202', 'texto', 'fiscal', 'CFOP para retorno de remessa UFs diferentes'),
  ('cfop_venda_filial_mesma_uf', '5102', 'texto', 'fiscal', 'CFOP para venda entre filiais mesma UF'),
  ('cfop_venda_filial_outra_uf', '6102', 'texto', 'fiscal', 'CFOP para venda entre filiais UFs diferentes')
ON CONFLICT (chave) DO NOTHING;

-- ===== BANDEIRAS DE CARTÃO PADRÃO =====
INSERT INTO erp.erp_bandeiras_cartao (nome, tipo, taxa_debito, taxa_credito_vista, taxa_credito_parcelado, prazo_recebimento_dias, ativo)
VALUES
  ('Visa', 'credito', 0, 2.50, 3.50, 30, true),
  ('Visa', 'debito', 1.50, 0, 0, 1, true),
  ('Mastercard', 'credito', 0, 2.75, 3.75, 30, true),
  ('Mastercard', 'debito', 1.75, 0, 0, 1, true),
  ('Elo', 'credito', 0, 3.00, 4.00, 30, true),
  ('Elo', 'debito', 2.00, 0, 0, 1, true),
  ('Hipercard', 'credito', 0, 3.25, 4.25, 30, true),
  ('American Express', 'credito', 0, 3.50, 4.50, 30, true)
ON CONFLICT DO NOTHING;

-- ===== CATEGORIAS DE SUPLEMENTOS =====
INSERT INTO erp.erp_categorias (nome, descricao, ativo) VALUES
  ('Whey Protein', 'Proteínas do soro do leite', true),
  ('Albumina', 'Proteína derivada da clara do ovo', true),
  ('Creatina', 'Creatina monohidratada e variações', true),
  ('BCAA', 'Aminoácidos de cadeia ramificada', true),
  ('Pré-Treino', 'Suplementos pré-treino', true),
  ('Pós-Treino', 'Suplementos para recuperação', true),
  ('Vitaminas', 'Multivitamínicos e isolados', true),
  ('Termogênicos', 'Suplementos para emagrecimento', true),
  ('Acessórios', 'Coqueteleiras, porta-cápsulas, etc', true),
  ('Roupas', 'Camisetas e acessórios fitness', true)
ON CONFLICT DO NOTHING;

-- ===== FORNECEDORES E CLIENTES (PESSOAS) =====
-- Fornecedores (PJ)
INSERT INTO erp.erp_pessoas (tipo, cpf_cnpj, nome_razao, nome_fantasia, email, telefone, celular, ativo) VALUES
  ('juridica', '12.345.678/0001-90', 'Nutri Brasil Suplementos Ltda', 'Nutri Brasil', 'vendas@nutribrasil.com.br', '(11) 4002-8922', '(11) 99999-1111', true),
  ('juridica', '23.456.789/0001-12', 'Suprema Importação e Distribuição', 'Suprema Dist.', 'contato@suprema.com.br', '(11) 4002-8923', '(11) 99999-2222', true),
  ('juridica', '34.567.890/0001-34', 'Max Nutrition Indústria', 'Max Nutrition', 'comercial@maxnutrition.com', '(11) 4002-8924', '(11) 99999-3333', true)
ON CONFLICT (cpf_cnpj) DO NOTHING;

-- Clientes PJ
INSERT INTO erp.erp_pessoas (tipo, cpf_cnpj, nome_razao, nome_fantasia, email, telefone, celular, ativo) VALUES
  ('juridica', '45.678.901/0001-56', 'Academia Corpo & Mente Ltda', 'Academia C&M', 'compras@academiacm.com', '(87) 99999-4444', '(87) 99999-4445', true),
  ('juridica', '56.789.012/0001-78', 'Personal Trainer Plus ME', 'PT Plus', 'contato@ptplus.com', '(87) 99999-5555', '(87) 99999-5556', true)
ON CONFLICT (cpf_cnpj) DO NOTHING;

-- Clientes PF
INSERT INTO erp.erp_pessoas (tipo, cpf_cnpj, nome_razao, email, celular, ativo) VALUES
  ('fisica', '111.222.333-44', 'João da Silva Santos', 'joao.santos@email.com', '(87) 99999-6666', true),
  ('fisica', '222.333.444-55', 'Maria Aparecida Oliveira', 'maria.oliveira@email.com', '(87) 99999-7777', true),
  ('fisica', '333.444.555-66', 'Carlos Eduardo Pereira', 'carlos.pereira@email.com', '(87) 99999-8888', true),
  ('fisica', '444.555.666-77', 'Ana Paula Ferreira Lima', 'ana.lima@email.com', '(87) 99999-9999', true),
  ('fisica', '555.666.777-88', 'Pedro Henrique Souza', 'pedro.souza@email.com', '(87) 99999-0000', true)
ON CONFLICT (cpf_cnpj) DO NOTHING;

-- ===== PRODUTOS DE SUPLEMENTOS =====
-- (Inserção feita em script à parte para evitar problemas com sequences)
-- Será populado via 029b_produtos_exemplo.sql se necessário

-- Comentário final: dados de exemplo povoados.
-- Para substituir por dados reais, execute a migration 030_reset_dados.sql
-- ou limpe manualmente com TRUNCATE/DELETE.

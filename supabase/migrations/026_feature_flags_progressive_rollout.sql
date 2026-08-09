-- =====================================================
-- ERP System · Feature Flags · Progressive Rollout
-- Migration: 026_feature_flags_progressive_rollout.sql
-- =====================================================
--
-- Esta migration desativa as páginas que ainda estão como
-- stub/placeholder (lógica mínima, sem CRUD real) ou que ainda
-- não foram implementadas. Conforme cada página for refatorada
-- e ganhar funcionalidade real, basta rodar um UPDATE para
-- reativá-la:
--
--   UPDATE erp_feature_flags SET ativo = true WHERE chave = 'page.foo';
--
-- Não remove nenhuma flag — apenas flipa o `ativo` para false.

-- =====================================================
-- DESATIVAR: placeholders puros (≤ 10 linhas de código)
-- IMPORTANTE: apenas flags com `is_protegida = false` podem ser
-- desativadas aqui. Páginas protegidas (Dashboard, Visão Geral,
-- /gestao, /financeiro, /config/sistema, /config/empresarial,
-- /config/minhas-chaves, /gestao/usuarios, /ajuda) permanecem
-- sempre ativas para garantir que o admin sempre consiga acessar
-- o painel de controle, gerenciar usuários e ver dados financeiros.
-- (As flags protegidas continuam editáveis via SQL — a restrição é
-- apenas na UI do painel admin, onde o switch fica travado.)
-- =====================================================
UPDATE erp_feature_flags SET
  ativo = false,
  motivo_desativacao = 'Página em desenvolvimento — apenas placeholder, aguardando implementação real.',
  updated_at = NOW()
WHERE is_protegida = false
  AND chave IN (
    'page.ajuda',                  -- PlaceholderPage "Ajuda"
    'page.configuracoes',          -- PlaceholderPage "Configurações" legado (substituído por /config/sistema)
    'page.estoque.transferencia',   -- PlaceholderPage "Transferência de Estoque"
    'page.fiscal',                 -- PlaceholderPage "Fiscal" (substituído por /notas-fiscais)
    'page.ifood',                  -- PlaceholderPage "iFood"
    'page.exapp-pedidos',          -- PlaceholderPage "ExApp Pedidos"
    'page.tef-sitef',              -- PlaceholderPage "TEF / SITEF"
    'page.marketplace-ifood',      -- PlaceholderPage "iFood Marketplace"
    'page.treinamento.tutoriais',  -- PlaceholderPage "Tutoriais"
    'page.controle-comercial.pedido',   -- PlaceholderPage "Pedido/Pré-venda"
    'page.controle-comercial.orcamento',-- PlaceholderPage "Orçamento"
    'page.controle-comercial.os',       -- PlaceholderPage "Ordem de Serviço"
    'page.controle-comercial.consignacao',-- PlaceholderPage "Venda Consignada"
    'page.controle-comercial.locacao'   -- PlaceholderPage "Locação"
  );

-- =====================================================
-- DESATIVAR: páginas com lógica mínima (apenas listagem sem CRUD)
-- Estas têm tabela de dados no backend mas a UI é só listagem
-- simples sem criação/edição/exclusão funcional.
-- =====================================================
UPDATE erp_feature_flags SET
  ativo = false,
  motivo_desativacao = 'UI incompleta — apenas listagem básica. Será reativada quando ganhar CRUD completo.',
  updated_at = NOW()
WHERE is_protegida = false
  AND chave IN (
    'page.compras',          -- Lista pedidos de compra sem CRUD
    'page.cartao-fidelidade',-- Lista cartões sem CRUD
    'page.email-marketing',  -- Lista campanhas sem CRUD
    'page.entregas-futuras', -- Lista entregas sem CRUD
    'page.gerador-boletos',  -- Lista boletos sem CRUD
    'page.kits',             -- Lista kits sem CRUD
    'page.lojas',            -- Lista lojas sem CRUD
    'page.mala-direta',      -- Lista mala direta sem CRUD
    'page.promissoria',      -- Lista promissórias sem CRUD
    'page.torpedos',         -- Lista torpedos SMS sem CRUD
    'page.vendas',           -- Lista vendas sem CRUD
    'page.relatorios',       -- Apenas 4 KPIs simples
    'page.faturamento',      -- Alias para notas-fiscais (manter /notas-fiscais ativo)
    'page.dashboard',        -- Visão geral simples
    'page.downloads'         -- Lista arquivos sem CRUD
  );

-- NOTA: páginas com `is_protegida = true` (Dashboard, Visão Geral,
-- /gestao, /financeiro, /gestao/usuarios, /config/sistema, /config/empresarial,
-- /config/minhas-chaves, /ajuda) NÃO foram tocadas — elas permanecem
-- ativas permanentemente para garantir que o admin sempre consiga
-- acessar o painel de controle, gerenciar usuários e ver dados financeiros.

-- =====================================================
-- MANTER ATIVAS (já vêm ativas do seed 025):
-- - Todas as páginas com CRUD real
-- - Páginas que servem como hub / navegação
-- - Configurações funcionais
-- =====================================================

-- /gestao, /gestao/empresarial, /gestao/avaliacoes,
-- /gestao/recomendacoes, /gestao/notificacoes,
-- /gestao/ocorrencias, /gestao/exclusao-informacoes,
-- /gestao/email-inteligente, /gestao/documentos-demonstrativos,
-- /gestao/regioes-entrega, /gestao/consulta-veiculos,
-- /gestao/agenda-telefonica, /gestao/localizar-pessoas,
-- /gestao/funcionarios, /gestao/fornecedores, /gestao/clientes,
-- /gestao/transportadoras, /gestao/estoque,
-- /gestao/consulta-pessoa-fisica, /gestao/consulta-pessoa-juridica,
-- /gestao/dados-empresariais, /gestao/usuarios,
-- /gestao/usuario-permissoes, /gestao/negociar,
-- /gestao/solicitacao-parceria, /gestao/encaminhar-protesto,
-- /gestao/negativar-devedores, /gestao/parcelar-debitos,
-- /gestao/consulta-cheque, /gestao/recebimento-cheque,
-- /gestao/cartao-credito, /gestao/cartao-debito,
-- /gestao/dinheiro, /gestao/gerar-crediario,
-- /gestao/configuracoes-gerais, /gestao/nfe-certificado,
-- /gestao/configuracoes-sefaz, /gestao/painel-contador,
-- /gestao/codigo-barras, /gestao/agenda-compromissos,
-- /gestao/documentos, /gestao/arquivos-pastas,
-- /gestao/entregas-futuras (desativado acima — manter como integração futura)

-- Páginas globais:
-- /financeiro (Relatórios Financeiros completo)
-- /notas-fiscais (CRUD)
-- /pedidos-delivery (CRUD)
-- /pdv (CRUD completo)
-- /caixa (CRUD com sangrias/entradas)
-- /visao-geral
-- /orders, /products (legado)
-- /lotes
-- /config/sistema, /config/empresarial, /config/minhas-chaves

-- =====================================================
-- RELATÓRIO: status atual das flags
-- =====================================================
-- SELECT
--   categoria,
--   COUNT(*) FILTER (WHERE ativo) AS ativas,
--   COUNT(*) FILTER (WHERE NOT ativo) AS desativadas,
--   COUNT(*) AS total
-- FROM erp_feature_flags
-- GROUP BY categoria
-- ORDER BY categoria;

-- =====================================================
-- COMO REATIVAR UMA PÁGINA APÓS IMPLEMENTAÇÃO:
-- =====================================================
-- UPDATE erp_feature_flags SET
--   ativo = true,
--   motivo_desativacao = NULL,
--   updated_at = NOW()
-- WHERE chave = 'page.nome-da-pagina';
-- 026 - Feature Flags Progressive Rollout (apenas UPDATE)
SET search_path TO erp, public;

UPDATE erp_feature_flags SET
  ativo = false,
  motivo_desativacao = 'Pagina em desenvolvimento - apenas placeholder, aguardando implementacao real.',
  updated_at = NOW()
WHERE is_protegida = false
  AND chave IN (
    'page.ajuda',
    'page.configuracoes',
    'page.estoque.transferencia',
    'page.fiscal',
    'page.ifood',
    'page.exapp-pedidos',
    'page.tef-sitef',
    'page.marketplace-ifood',
    'page.treinamento.tutoriais',
    'page.controle-comercial.pedido',
    'page.controle-comercial.orcamento',
    'page.controle-comercial.os',
    'page.controle-comercial.consignacao',
    'page.controle-comercial.locacao'
  );

UPDATE erp_feature_flags SET
  ativo = false,
  motivo_desativacao = 'UI incompleta - apenas listagem basica. Sera reativada quando ganhar CRUD completo.',
  updated_at = NOW()
WHERE is_protegida = false
  AND chave IN (
    'page.compras',
    'page.cartao-fidelidade',
    'page.email-marketing',
    'page.entregas-futuras',
    'page.gerador-boletos',
    'page.kits',
    'page.lojas',
    'page.mala-direta',
    'page.promissoria',
    'page.torpedos',
    'page.vendas',
    'page.relatorios',
    'page.faturamento',
    'page.dashboard',
    'page.downloads'
  );

SELECT
  COUNT(*) FILTER (WHERE ativo = true) AS ativas,
  COUNT(*) FILTER (WHERE ativo = false) AS inativas,
  COUNT(*) FILTER (WHERE is_protegida = true) AS protegidas,
  COUNT(*) AS total
FROM erp_feature_flags;
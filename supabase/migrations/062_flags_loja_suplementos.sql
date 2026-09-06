-- ============================================================
-- 062: Feature flags — sincroniza com o menu real e aplica o
--      conjunto de páginas de uma LOJA DE SUPLEMENTOS.
--
-- Duas correções, nesta ordem:
--
-- 1. FLAGS DESSINCRONIZADAS. O painel governa por `path`, mas vários
--    paths não existiam no menu: "Produtos" tinha flag em /produtos
--    enquanto o menu aponta para /produtos-estoque-lotes — desligar a
--    flag não fazia nada, e o painel mostrava como desativada uma
--    página que estava no ar. Do outro lado, 10 telas (inventário,
--    kardex, remessas, SPED, equipamentos…) não tinham flag nenhuma:
--    ficavam sempre visíveis, fora do controle do admin.
--
-- 2. CONJUNTO ATIVO ERRADO. O seed deixou ligadas telas que uma loja
--    de suplementos nunca abre (locação, ordem de serviço, frota,
--    protesto, TEF, SMS) e desligadas as do balcão (produtos, estoque,
--    compras, kits). Aqui fica só o dia a dia: vender, repor, cobrar,
--    emitir nota. O que sai continua a um clique de voltar.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

-- ---------- 1. flags mortas: path que não existe em lugar nenhum ----------
DELETE FROM erp.erp_feature_flags WHERE path IN (
  '/gestao/consulta-veiculos',   -- sem rota e sem menu
  '/gestao/entregas-futuras',    -- sem rota e sem menu
  '/config/downloads',           -- substituída pela tela Equipamentos
  '/gestao/usuario-permissoes',  -- permissões vivem em /gestao/usuarios
  '/lotes',                      -- lotes ficam dentro de Cadastro e Estoque
  '/gestao/estoque'              -- idem
);

-- ---------- 2. path corrigido para a tela que realmente existe ----------
UPDATE erp.erp_feature_flags
   SET path = '/produtos-estoque-lotes', titulo = 'Cadastro e Estoque'
 WHERE chave = 'page.produtos';

-- ---------- 3. telas que estavam sem flag (não dava para desligar) ----------
INSERT INTO erp.erp_feature_flags (chave, path, titulo, descricao, categoria, ordem, ativo, is_system, is_protegida)
VALUES
  ('page.estoque.movimentacoes', '/estoque/movimentacoes', 'Movimentações (Kardex)',
   'Histórico de entradas e saídas de cada produto.', 'catalogo', 20, true, true, false),
  ('page.estoque.inventario', '/estoque/inventario', 'Inventário / Balanço',
   'Contagem física do estoque com ajuste rastreável.', 'catalogo', 21, true, true, false),
  ('page.compras.importar-nfe', '/compras/importar-nfe', 'Importar NF-e',
   'Entrada de mercadoria pelo XML da nota do fornecedor.', 'catalogo', 22, true, true, false),
  ('page.remessas', '/remessas', 'Remessas entre Filiais',
   'Transferência de mercadoria entre as lojas, com nota.', 'fiscal', 30, true, true, false),
  ('page.fiscal.notas-recebidas', '/fiscal/notas-recebidas', 'Notas Recebidas (SEFAZ)',
   'Notas emitidas contra o CNPJ, baixadas da SEFAZ.', 'fiscal', 31, true, true, false),
  ('page.fiscal.escrituracao', '/fiscal/escrituracao', 'Escrituração (SPED)',
   'Geração do arquivo SPED Fiscal para o contador.', 'fiscal', 32, true, true, false),
  ('page.relatorios.analise', '/relatorios/analise', 'Análise Gerencial',
   'Curva ABC, sugestão de compra, estoque parado e DRE.', 'administracao', 40, true, true, false),
  ('page.gestao.servicos', '/gestao/servicos', 'Serviços',
   'Cadastro de serviços vendidos junto com produtos.', 'cadastros', 41, false, true, false),
  ('page.equipamentos', '/equipamentos', 'Equipamentos',
   'Leitores, impressoras e etiquetadoras homologados.', 'administracao', 42, true, true, false)
ON CONFLICT (chave) DO UPDATE
   SET path = EXCLUDED.path, titulo = EXCLUDED.titulo,
       descricao = EXCLUDED.descricao, categoria = EXCLUDED.categoria;

-- ---------- 4. conjunto do dia a dia da loja de suplementos ----------
-- Tudo que não estiver nesta lista sai do menu (protegidas continuam).
WITH essenciais(path) AS (
  VALUES
    -- balcão
    ('/'), ('/visao-geral'), ('/pdv'), ('/caixa'), ('/vendas'),
    ('/devolucoes'), ('/pedidos-delivery'),
    -- produto e reposição
    ('/produtos-estoque-lotes'), ('/estoque/movimentacoes'), ('/estoque/inventario'),
    ('/estoque.transferencia'), ('/compras'), ('/compras/importar-nfe'),
    ('/kits'), ('/gestao/fornecedores'),
    -- pessoas
    ('/gestao/clientes'), ('/gestao/funcionarios'), ('/lojas'),
    -- dinheiro
    ('/financeiro'), ('/crediario-proprio'), ('/promissoria'),
    -- fiscal
    ('/notas-fiscais'), ('/remessas'), ('/fiscal/notas-recebidas'),
    ('/fiscal/escrituracao'), ('/gestao/nfe-certificado'), ('/gestao/configuracoes-sefaz'),
    -- recompra
    ('/cartao-fidelidade'), ('/email-marketing'),
    -- avisos e obrigação legal
    ('/gestao/notificacoes'), ('/gestao/exclusao-informacoes'),
    -- administração
    ('/gestao'), ('/config/sistema'), ('/config/empresarial'), ('/gestao/usuarios'),
    ('/config/minhas-chaves'), ('/ajuda'), ('/relatorios'), ('/relatorios/analise'),
    ('/treinamento/tutoriais'), ('/equipamentos')
)
UPDATE erp.erp_feature_flags f
   SET ativo = (f.path IN (SELECT path FROM essenciais)) OR f.is_protegida,
       desativado_em = CASE
         WHEN (f.path IN (SELECT path FROM essenciais)) OR f.is_protegida THEN NULL
         ELSE COALESCE(f.desativado_em, now())
       END,
       motivo_desativacao = CASE
         WHEN (f.path IN (SELECT path FROM essenciais)) OR f.is_protegida THEN NULL
         ELSE 'Fora do uso diário de uma loja de suplementos — reative aqui quando precisar'
       END,
       updated_at = now();

-- conferência: o que ficou de pé
SELECT categoria || ': ' || count(*) FILTER (WHERE ativo) || '/' || count(*)
  FROM erp.erp_feature_flags GROUP BY categoria ORDER BY categoria;

COMMIT;

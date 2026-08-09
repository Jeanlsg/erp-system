-- =====================================================
-- ERP System · Feature Flags (controle de páginas)
-- Migration: 025_feature_flags.sql
-- =====================================================
--
-- Permite que o admin ative/desative páginas no sistema
-- para todos os usuários via /config/sistema.
--
-- Cada flag está associada a uma URL/path do app. Quando a
-- flag está com `ativo = false`, a sidebar esconde o item
-- e o FeatureGuard bloqueia o acesso direto pela URL.

CREATE TABLE erp_feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Chave única usada pelo código (ex: "page.pdv", "page.financeiro")
  chave VARCHAR(100) UNIQUE NOT NULL,
  -- Path/URL que esta flag controla (sem / inicial)
  path VARCHAR(255) NOT NULL,
  -- Label exibido para o admin
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  -- Categoria para agrupar na tela de configurações
  categoria VARCHAR(50) NOT NULL, -- 'vendas', 'gestao', 'financeiro', 'fiscal', 'config', 'integracao', 'crm', 'relatorio'
  -- Ícone (nome do lucide-react) usado na tela de configurações
  icone VARCHAR(50),
  -- Ordem de exibição dentro da categoria
  ordem INTEGER DEFAULT 0,
  -- Página requer permissão de admin para acessar
  somente_admin BOOLEAN DEFAULT false,
  -- Flag global (controla visibilidade)
  ativo BOOLEAN DEFAULT true,
  -- Flag do sistema — impede exclusão pela UI
  is_system BOOLEAN DEFAULT true,
  -- Flag protegida — NÃO pode ser desativada pelo admin na UI.
  -- Páginas como /config/sistema, /gestao/usuarios, /financeiro são
  -- essenciais e sempre devem ficar visíveis (ainda que possam ter
  -- seu `ativo` mudado por SQL, o painel admin não permite desativá-las).
  is_protegida BOOLEAN DEFAULT false,
  -- Auditoria
  desativado_por UUID REFERENCES erp_usuarios(id),
  desativado_em TIMESTAMPTZ,
  motivo_desativacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_erp_feature_flags_categoria ON erp_feature_flags(categoria);
CREATE INDEX idx_erp_feature_flags_ativo ON erp_feature_flags(ativo);
CREATE INDEX idx_erp_feature_flags_path ON erp_feature_flags(path);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_erp_feature_flags_updated_at ON erp_feature_flags;
CREATE TRIGGER trg_erp_feature_flags_updated_at
  BEFORE UPDATE ON erp_feature_flags
  FOR EACH ROW EXECUTE FUNCTION erp_set_updated_at();

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE erp_feature_flags ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode LER as flags (precisa para renderizar sidebar)
CREATE POLICY "feature_flags_select_authenticated"
  ON erp_feature_flags FOR SELECT TO authenticated
  USING (true);

-- Apenas admins podem ALTERAR flags
CREATE POLICY "feature_flags_insert_admin"
  ON erp_feature_flags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM erp_usuarios
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- UPDATE policy: admin pode atualizar livremente.
-- As flags protegidas (`is_protegida = true`) continuam
-- restritas apenas na UI do painel admin (switch travado
-- com ícone de cadeado) — a tabela em si aceita qualquer
-- UPDATE feito por admin, inclusive via SQL direto.
CREATE POLICY "feature_flags_update_admin"
  ON erp_feature_flags FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM erp_usuarios
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM erp_usuarios
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "feature_flags_delete_admin"
  ON erp_feature_flags FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM erp_usuarios
      WHERE id = auth.uid() AND role = 'admin' AND is_system = false AND is_protegida = false
    )
  );

-- =====================================================
-- SEED · Popular com todas as páginas do sistema
-- =====================================================
-- IMPORTANTE: páginas com `is_protegida = true` são essenciais
-- e o painel admin NÃO permite desativá-las. Exemplos: o próprio
-- /config/sistema, /gestao/usuarios (gerenciar usuários), /financeiro,
-- /visao-geral e o hub /gestao.
-- =====================================================

INSERT INTO erp_feature_flags (chave, path, titulo, descricao, categoria, icone, ordem, is_protegida) VALUES
  -- ====== PÁGINAS PROTEGIDAS (essenciais, sempre visíveis) ======
  -- Estas 5 páginas não podem ser desativadas pelo admin na UI.
  ('page.dashboard', '/', 'Dashboard', 'Página inicial do sistema', 'operacao', 'LayoutDashboard', 1, true),
  ('page.visao-geral', '/visao-geral', 'Visão Geral', 'Indicadores gerais do negócio', 'operacao', 'Globe', 2, true),
  ('page.gestao', '/gestao', 'Gestão Empresarial', 'Hub central de gestão', 'gestao', 'LayoutDashboard', 30, true),
  ('page.financeiro', '/financeiro', 'Relatórios Financeiros', 'Fluxo de caixa completo', 'financeiro', 'LineChart', 40, true),
  ('page.gestao.usuarios', '/gestao/usuarios', 'Gestão Usuários', 'Usuários do sistema', 'administracao', 'Users', 110, true),
  ('page.config.sistema', '/config/sistema', 'Configurações Sistema', 'Configurações técnicas + Feature Flags', 'administracao', 'Cog', 113, true),
  ('page.config.empresarial', '/config/empresarial', 'Configurações Empresariais', 'Dados cadastrais da empresa', 'administracao', 'Briefcase', 115, true),
  ('page.config.minhas-chaves', '/config/minhas-chaves', 'Minhas Chaves PIX', 'Chaves PIX da empresa', 'administracao', 'Key', 116, true),
  ('page.ajuda', '/ajuda', 'Ajuda', 'Central de ajuda', 'administracao', 'HelpCircle', 121, true),

  -- ====== PÁGINAS OPERACIONAIS ======
  ('page.pdv', '/pdv', 'PDV / Frente de Caixa', 'Ponto de venda', 'operacao', 'ScanBarcode', 3, false),
  ('page.caixa', '/caixa', 'Caixa', 'Gerenciamento de caixa', 'operacao', 'Wallet', 4, false),
  ('page.vendas', '/vendas', 'Vendas', 'Histórico de vendas', 'operacao', 'Receipt', 5, false),
  ('page.pedidos-delivery', '/pedidos-delivery', 'Pedidos Delivery', 'Pedidos de delivery', 'operacao', 'Bike', 6, false),
  ('page.ifood', '/ifood', 'Pedidos iFood', 'Integração com iFood', 'operacao', 'ShoppingCart', 7, false),
  ('page.exapp-pedidos', '/exapp-pedidos', 'ExApp Pedidos', 'Pedidos via ExApp', 'operacao', 'MessageSquare', 8, false),
  ('page.devolucoes', '/devolucoes', 'Devoluções', 'Gestão de devoluções', 'operacao', 'RotateCcw', 9, false),

  -- ====== CATÁLOGO ======
  ('page.produtos', '/produtos', 'Produtos', 'Catálogo de produtos', 'catalogo', 'Package', 10, false),
  ('page.gestao.estoque', '/gestao/estoque', 'Estoque', 'Controle de estoque', 'catalogo', 'Boxes', 11, false),
  ('page.estoque.transferencia', '/estoque.transferencia', 'Transferências', 'Transferência entre lojas', 'catalogo', 'ArrowLeftRight', 12, false),
  ('page.lotes', '/lotes', 'Lotes & Validade', 'Controle de lotes', 'catalogo', 'ScrollText', 13, false),
  ('page.compras', '/compras', 'Compras', 'Pedidos de compra', 'catalogo', 'ShoppingBag', 14, false),
  ('page.kits', '/kits', 'Kits & Combos', 'Combinações de produtos', 'catalogo', 'PackagePlus', 15, false),
  ('page.gestao.fornecedores', '/gestao/fornecedores', 'Fornecedores', 'Cadastro de fornecedores', 'catalogo', 'Truck', 16, false),

  -- ====== CADASTROS ======
  ('page.gestao.clientes', '/gestao/clientes', 'Clientes', 'Cadastro de clientes', 'cadastros', 'Users', 20, false),
  ('page.gestao.consulta-pessoa-fisica', '/gestao/consulta-pessoa-fisica', 'Pessoa Física', 'Consulta de PF', 'cadastros', 'Users', 21, false),
  ('page.gestao.consulta-pessoa-juridica', '/gestao/consulta-pessoa-juridica', 'Pessoa Jurídica', 'Consulta de PJ', 'cadastros', 'Building2', 22, false),
  ('page.gestao.funcionarios', '/gestao/funcionarios', 'Funcionários', 'Cadastro de funcionários', 'cadastros', 'Building2', 23, false),
  ('page.gestao.transportadoras', '/gestao/transportadoras', 'Transportadoras', 'Cadastro de transportadoras', 'cadastros', 'Truck', 24, false),
  ('page.gestao.regioes-entrega', '/gestao/regioes-entrega', 'Regiões de Entrega', 'Zonas de entrega', 'cadastros', 'MapPin', 25, false),
  ('page.gestao.agenda-telefonica', '/gestao/agenda-telefonica', 'Agenda Telefônica', 'Contatos telefônicos', 'cadastros', 'Phone', 26, false),
  ('page.gestao.localizar-pessoas', '/gestao/localizar-pessoas', 'Localizar Pessoas', 'Busca unificada PF/PJ', 'cadastros', 'Search', 27, false),
  ('page.lojas', '/lojas', 'Lojas', 'Cadastro de lojas/filiais', 'cadastros', 'Store', 28, false),

  -- ====== GESTÃO EMPRESARIAL ======
  ('page.gestao.agenda-compromissos', '/gestao/agenda-compromissos', 'Agenda Compromissos', 'Compromissos e tarefas', 'gestao', 'Calendar', 31, false),
  ('page.gestao.documentos', '/gestao/documentos', 'Documentos', 'Documentos administrativos', 'gestao', 'FolderTree', 32, false),
  ('page.gestao.arquivos-pastas', '/gestao/arquivos-pastas', 'Arquivos e Pastas', 'Gerenciador de arquivos', 'gestao', 'FolderTree', 33, false),
  ('page.gestao.consulta-veiculos', '/gestao/consulta-veiculos', 'Veículos / Frota', 'Gestão da frota', 'gestao', 'Car', 34, false),
  ('page.gestao.entregas-futuras', '/gestao/entregas-futuras', 'Entregas Futuras', 'Programação de entregas', 'gestao', 'Truck', 35, false),

  -- ====== FINANCEIRO ======
  ('page.gestao.consulta-cheque', '/gestao/consulta-cheque', 'Cheques', 'Controle de cheques', 'financeiro', 'ScrollText', 41, false),
  ('page.gestao.recebimento-cheque', '/gestao/recebimento-cheque', 'Recebimento Cheque', 'Registro de cheques recebidos', 'financeiro', 'ScrollText', 42, false),
  ('page.gestao.cartao-credito', '/gestao/cartao-credito', 'Cartão de Crédito', 'Recebimentos cartão crédito', 'financeiro', 'CreditCard', 43, false),
  ('page.gestao.cartao-debito', '/gestao/cartao-debito', 'Cartão de Débito', 'Recebimentos cartão débito', 'financeiro', 'CreditCard', 44, false),
  ('page.gestao.dinheiro', '/gestao/dinheiro', 'Dinheiro', 'Movimentações em espécie', 'financeiro', 'DollarSign', 45, false),
  ('page.gerador-boletos', '/gerador-boletos', 'Boletos', 'Geração de boletos', 'financeiro', 'Barcode', 46, false),
  ('page.promissoria', '/promissoria', 'Promissórias', 'Emissão/recebimento', 'financeiro', 'ScrollText', 47, false),
  ('page.crediario-proprio', '/crediario-proprio', 'Crediário Próprio', 'Carnês sem juros', 'financeiro', 'CreditCard', 48, false),
  ('page.gestao.gerar-crediario', '/gestao/gerar-crediario', 'Crediário (com juros)', 'Carnês com juros', 'financeiro', 'CreditCard', 49, false),

  -- ====== COBRANÇA ======
  ('page.gestao.negativar-devedores', '/gestao/negativar-devedores', 'Negativar Devedores', 'Inadimplência', 'cobranca', 'AlertTriangle', 50, false),
  ('page.gestao.parcelar-debitos', '/gestao/parcelar-debitos', 'Parcelar Débitos', 'Negociação de dívidas', 'cobranca', 'ScrollText', 51, false),
  ('page.gestao.encaminhar-protesto', '/gestao/encaminhar-protesto', 'Encaminhar Protesto', 'Títulos para cartório', 'cobranca', 'Send', 52, false),
  ('page.gestao.solicitacao-parceria', '/gestao/solicitacao-parceria', 'Solicitação de Parceria', 'Propostas comerciais', 'cobranca', 'Network', 53, false),

  -- ====== VENDA MAIS (MARKETING) ======
  ('page.mala-direta', '/mala-direta', 'Mala Direta', 'Campanhas de mala direta', 'venda-mais', 'Mail', 60, false),
  ('page.email-marketing', '/email-marketing', 'E-mail Marketing', 'Campanhas de email', 'venda-mais', 'Mail', 61, false),
  ('page.torpedos', '/torpedos', 'Torpedos SMS', 'Campanhas SMS', 'venda-mais', 'Smartphone', 62, false),
  ('page.cartao-fidelidade', '/cartao-fidelidade', 'Cartão Fidelidade', 'Programa de fidelidade', 'venda-mais', 'CreditCard', 63, false),
  ('page.gestao.email-inteligente', '/gestao/email-inteligente', 'Email Inteligente', 'Automações de email', 'venda-mais', 'Mail', 64, false),

  -- ====== FISCAL ======
  ('page.notas-fiscais', '/notas-fiscais', 'Notas Fiscais', 'NF-e/NFC-e/CF-e', 'fiscal', 'FileText', 70, false),
  ('page.faturamento', '/faturamento', 'Faturamento', 'Emissão de NF', 'fiscal', 'FileText', 71, false),
  ('page.gestao.nfe-certificado', '/gestao/nfe-certificado', 'Certificado Digital', 'A1/A3', 'fiscal', 'Lock', 72, false),
  ('page.gestao.configuracoes-sefaz', '/gestao/configuracoes-sefaz', 'Configurações SEFAZ', 'Integração SEFAZ', 'fiscal', 'Settings', 73, false),
  ('page.gestao.painel-contador', '/gestao/painel-contador', 'Painel do Contador', 'Portal do contador', 'fiscal', 'Calculator', 74, false),
  ('page.gestao.documentos-demonstrativos', '/gestao/documentos-demonstrativos', 'Documentos Demonstrativos', 'DRE/Balanço', 'fiscal', 'LineChart', 75, false),

  -- ====== CRM & MARKETING ======
  ('page.gestao.avaliacoes', '/gestao/avaliacoes', 'Avaliações', 'Notas de clientes', 'crm', 'Star', 80, false),
  ('page.gestao.recomendacoes', '/gestao/recomendacoes', 'Recomendações', 'Recomendo/Não Recomendo', 'crm', 'ThumbsUp', 81, false),
  ('page.gestao.notificacoes', '/gestao/notificacoes', 'Notificações', 'Central de notificações', 'crm', 'Bell', 82, false),
  ('page.gestao.ocorrencias', '/gestao/ocorrencias', 'Ocorrências', 'Pendências e suporte', 'crm', 'MessageSquare', 83, false),
  ('page.gestao.exclusao-informacoes', '/gestao/exclusao-informacoes', 'Exclusão LGPD', 'Solicitações LGPD', 'crm', 'Shield', 84, false),

  -- ====== CONTROLE COMERCIAL ======
  ('page.controle-comercial.pedido', '/controle-comercial/pedido', 'Pedido / Pré-venda', 'Pré-vendas', 'controle-comercial', 'ShoppingCart', 90, false),
  ('page.controle-comercial.orcamento', '/controle-comercial/orcamento', 'Orçamento', 'Orçamentos rápidos', 'controle-comercial', 'FileText', 91, false),
  ('page.controle-comercial.os', '/controle-comercial/os', 'Ordem de Serviço', 'Gestão de OS', 'controle-comercial', 'Wrench', 92, false),
  ('page.controle-comercial.consignacao', '/controle-comercial/consignacao', 'Venda Consignada', 'Consignações', 'controle-comercial', 'Truck', 93, false),
  ('page.controle-comercial.locacao', '/controle-comercial/locacao', 'Locação', 'Controle de locações', 'controle-comercial', 'Store', 94, false),
  ('page.tef-sitef', '/tef-sitef', 'TEF / SITEF', 'Integração TEF', 'controle-comercial', 'CreditCard', 95, false),

  -- ====== VENDAS ONLINE ======
  ('page.marketplace-ifood', '/marketplace-ifood', 'iFood Marketplace', 'Marketplace iFood', 'vendas-online', 'ShoppingCart', 100, false),

  -- ====== ADMINISTRAÇÃO ======
  ('page.gestao.usuario-permissoes', '/gestao/usuario-permissoes', 'Permissões', 'Permissões granulares', 'administracao', 'Shield', 111, false),
  ('page.gestao.dados-empresariais', '/gestao/dados-empresariais', 'Dados Empresariais', 'Cadastro da empresa', 'administracao', 'Building2', 112, false),
  ('page.gestao.configuracoes-gerais', '/gestao/configuracoes-gerais', 'Configurações Gerais', 'Parâmetros gerais', 'administracao', 'Settings', 114, false),
  ('page.gestao.codigo-barras', '/gestao/codigo-barras', 'Gerar Código de Barras', 'Geração EAN13', 'administracao', 'Barcode', 117, false),
  ('page.config.downloads', '/config/downloads', 'Downloads', 'Arquivos para download', 'administracao', 'Barcode', 118, false),
  ('page.treinamento.tutoriais', '/treinamento/tutoriais', 'Treinamento', 'Tutoriais do sistema', 'administracao', 'HelpCircle', 119, false),
  ('page.relatorios', '/relatorios', 'Relatórios', 'Relatórios gerais', 'administracao', 'LineChart', 120, false)
ON CONFLICT (chave) DO NOTHING;
-- 025 - Feature Flags (ajustada pra schema erp + RLS consistente)
SET search_path TO erp, public;

CREATE TABLE erp_feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chave VARCHAR(100) UNIQUE NOT NULL,
  path VARCHAR(255) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  categoria VARCHAR(50) NOT NULL,
  icone VARCHAR(50),
  ordem INTEGER DEFAULT 0,
  somente_admin BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT true,
  is_protegida BOOLEAN DEFAULT false,
  desativado_por UUID REFERENCES erp_usuarios(id),
  desativado_em TIMESTAMPTZ,
  motivo_desativacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erp_feature_flags_categoria ON erp_feature_flags(categoria);
CREATE INDEX idx_erp_feature_flags_ativo ON erp_feature_flags(ativo);
CREATE INDEX idx_erp_feature_flags_path ON erp_feature_flags(path);

DROP TRIGGER IF EXISTS trg_erp_feature_flags_updated_at ON erp_feature_flags;
CREATE TRIGGER trg_erp_feature_flags_updated_at
  BEFORE UPDATE ON erp_feature_flags
  FOR EACH ROW EXECUTE FUNCTION erp_set_updated_at();

-- Limpa policies da versao antiga se existirem
DO $$
BEGIN
  DROP POLICY IF EXISTS "feature_flags_select_authenticated" ON erp.erp_feature_flags;
  DROP POLICY IF EXISTS "feature_flags_insert_admin" ON erp.erp_feature_flags;
  DROP POLICY IF EXISTS "feature_flags_update_admin" ON erp.erp_feature_flags;
  DROP POLICY IF EXISTS "feature_flags_delete_admin" ON erp.erp_feature_flags;
END $$;

ALTER TABLE erp.erp_feature_flags ENABLE ROW LEVEL SECURITY;

-- Qualquer usuario do ERP pode ler as flags (precisa pra renderizar sidebar)
-- Admin/gerente pode alterar
CREATE POLICY "erp_user_select" ON erp.erp_feature_flags FOR SELECT TO authenticated USING (erp.current_erp_user_id() IS NOT NULL);
CREATE POLICY "erp_admin_write" ON erp.erp_feature_flags FOR ALL TO authenticated USING (erp.is_erp_admin()) WITH CHECK (erp.is_erp_admin());

-- Seed: popula com todas as paginas
INSERT INTO erp_feature_flags (chave, path, titulo, descricao, categoria, icone, ordem, is_protegida) VALUES
  ('page.dashboard', '/', 'Dashboard', 'Pagina inicial do sistema', 'operacao', 'LayoutDashboard', 1, true),
  ('page.visao-geral', '/visao-geral', 'Visao Geral', 'Indicadores gerais do negocio', 'operacao', 'Globe', 2, true),
  ('page.gestao', '/gestao', 'Gestao Empresarial', 'Hub central de gestao', 'gestao', 'LayoutDashboard', 30, true),
  ('page.financeiro', '/financeiro', 'Relatorios Financeiros', 'Fluxo de caixa completo', 'financeiro', 'LineChart', 40, true),
  ('page.gestao.usuarios', '/gestao/usuarios', 'Gestao Usuarios', 'Usuarios do sistema', 'administracao', 'Users', 110, true),
  ('page.config.sistema', '/config/sistema', 'Configuracoes Sistema', 'Configuracoes tecnicas + Feature Flags', 'administracao', 'Cog', 113, true),
  ('page.config.empresarial', '/config/empresarial', 'Configuracoes Empresariais', 'Dados cadastrais da empresa', 'administracao', 'Briefcase', 115, true),
  ('page.config.minhas-chaves', '/config/minhas-chaves', 'Minhas Chaves PIX', 'Chaves PIX da empresa', 'administracao', 'Key', 116, true),
  ('page.ajuda', '/ajuda', 'Ajuda', 'Central de ajuda', 'administracao', 'HelpCircle', 121, true),
  ('page.pdv', '/pdv', 'PDV / Frente de Caixa', 'Ponto de venda', 'operacao', 'ScanBarcode', 3, false),
  ('page.caixa', '/caixa', 'Caixa', 'Gerenciamento de caixa', 'operacao', 'Wallet', 4, false),
  ('page.vendas', '/vendas', 'Vendas', 'Historico de vendas', 'operacao', 'Receipt', 5, false),
  ('page.pedidos-delivery', '/pedidos-delivery', 'Pedidos Delivery', 'Pedidos de delivery', 'operacao', 'Bike', 6, false),
  ('page.ifood', '/ifood', 'Pedidos iFood', 'Integracao com iFood', 'operacao', 'ShoppingCart', 7, false),
  ('page.exapp-pedidos', '/exapp-pedidos', 'ExApp Pedidos', 'Pedidos via ExApp', 'operacao', 'MessageSquare', 8, false),
  ('page.devolucoes', '/devolucoes', 'Devolucoes', 'Gestao de devolucoes', 'operacao', 'RotateCcw', 9, false),
  ('page.produtos', '/produtos', 'Produtos', 'Catalogo de produtos', 'catalogo', 'Package', 10, false),
  ('page.gestao.estoque', '/gestao/estoque', 'Estoque', 'Controle de estoque', 'catalogo', 'Boxes', 11, false),
  ('page.estoque.transferencia', '/estoque.transferencia', 'Transferencias', 'Transferencia entre lojas', 'catalogo', 'ArrowLeftRight', 12, false),
  ('page.lotes', '/lotes', 'Lotes & Validade', 'Controle de lotes', 'catalogo', 'ScrollText', 13, false),
  ('page.compras', '/compras', 'Compras', 'Pedidos de compra', 'catalogo', 'ShoppingBag', 14, false),
  ('page.kits', '/kits', 'Kits & Combos', 'Combinacoes de produtos', 'catalogo', 'PackagePlus', 15, false),
  ('page.gestao.fornecedores', '/gestao/fornecedores', 'Fornecedores', 'Cadastro de fornecedores', 'catalogo', 'Truck', 16, false),
  ('page.gestao.clientes', '/gestao/clientes', 'Clientes', 'Cadastro de clientes', 'cadastros', 'Users', 20, false),
  ('page.gestao.consulta-pessoa-fisica', '/gestao/consulta-pessoa-fisica', 'Pessoa Fisica', 'Consulta de PF', 'cadastros', 'Users', 21, false),
  ('page.gestao.consulta-pessoa-juridica', '/gestao/consulta-pessoa-juridica', 'Pessoa Juridica', 'Consulta de PJ', 'cadastros', 'Building2', 22, false),
  ('page.gestao.funcionarios', '/gestao/funcionarios', 'Funcionarios', 'Cadastro de funcionarios', 'cadastros', 'Building2', 23, false),
  ('page.gestao.transportadoras', '/gestao/transportadoras', 'Transportadoras', 'Cadastro de transportadoras', 'cadastros', 'Truck', 24, false),
  ('page.gestao.regioes-entrega', '/gestao/regioes-entrega', 'Regioes de Entrega', 'Zonas de entrega', 'cadastros', 'MapPin', 25, false),
  ('page.gestao.agenda-telefonica', '/gestao/agenda-telefonica', 'Agenda Telefonica', 'Contatos telefonicos', 'cadastros', 'Phone', 26, false),
  ('page.gestao.localizar-pessoas', '/gestao/localizar-pessoas', 'Localizar Pessoas', 'Busca unificada PF/PJ', 'cadastros', 'Search', 27, false),
  ('page.lojas', '/lojas', 'Lojas', 'Cadastro de lojas/filiais', 'cadastros', 'Store', 28, false),
  ('page.gestao.agenda-compromissos', '/gestao/agenda-compromissos', 'Agenda Compromissos', 'Compromissos e tarefas', 'gestao', 'Calendar', 31, false),
  ('page.gestao.documentos', '/gestao/documentos', 'Documentos', 'Documentos administrativos', 'gestao', 'FolderTree', 32, false),
  ('page.gestao.arquivos-pastas', '/gestao/arquivos-pastas', 'Arquivos e Pastas', 'Gerenciador de arquivos', 'gestao', 'FolderTree', 33, false),
  ('page.gestao.consulta-veiculos', '/gestao/consulta-veiculos', 'Veiculos / Frota', 'Gestao da frota', 'gestao', 'Car', 34, false),
  ('page.gestao.entregas-futuras', '/gestao/entregas-futuras', 'Entregas Futuras', 'Programacao de entregas', 'gestao', 'Truck', 35, false),
  ('page.gestao.consulta-cheque', '/gestao/consulta-cheque', 'Cheques', 'Controle de cheques', 'financeiro', 'ScrollText', 41, false),
  ('page.gestao.recebimento-cheque', '/gestao/recebimento-cheque', 'Recebimento Cheque', 'Registro de cheques recebidos', 'financeiro', 'ScrollText', 42, false),
  ('page.gestao.cartao-credito', '/gestao/cartao-credito', 'Cartao de Credito', 'Recebimentos cartao credito', 'financeiro', 'CreditCard', 43, false),
  ('page.gestao.cartao-debito', '/gestao/cartao-debito', 'Cartao de Debito', 'Recebimentos cartao debito', 'financeiro', 'CreditCard', 44, false),
  ('page.gestao.dinheiro', '/gestao/dinheiro', 'Dinheiro', 'Movimentacoes em especie', 'financeiro', 'DollarSign', 45, false),
  ('page.gerador-boletos', '/gerador-boletos', 'Boletos', 'Geracao de boletos', 'financeiro', 'Barcode', 46, false),
  ('page.promissoria', '/promissoria', 'Promissorias', 'Emissao/recebimento', 'financeiro', 'ScrollText', 47, false),
  ('page.crediario-proprio', '/crediario-proprio', 'Crediario Proprio', 'Carne sem juros', 'financeiro', 'CreditCard', 48, false),
  ('page.gestao.gerar-crediario', '/gestao/gerar-crediario', 'Crediario (com juros)', 'Carne com juros', 'financeiro', 'CreditCard', 49, false),
  ('page.gestao.negativar-devedores', '/gestao/negativar-devedores', 'Negativar Devedores', 'Inadimplencia', 'cobranca', 'AlertTriangle', 50, false),
  ('page.gestao.parcelar-debitos', '/gestao/parcelar-debitos', 'Parcelar Debitos', 'Negociacao de dividas', 'cobranca', 'ScrollText', 51, false),
  ('page.gestao.encaminhar-protesto', '/gestao/encaminhar-protesto', 'Encaminhar Protesto', 'Titulos para cartorio', 'cobranca', 'Send', 52, false),
  ('page.gestao.solicitacao-parceria', '/gestao/solicitacao-parceria', 'Solicitacao de Parceria', 'Propostas comerciais', 'cobranca', 'Network', 53, false),
  ('page.mala-direta', '/mala-direta', 'Mala Direta', 'Campanhas de mala direta', 'venda-mais', 'Mail', 60, false),
  ('page.email-marketing', '/email-marketing', 'E-mail Marketing', 'Campanhas de email', 'venda-mais', 'Mail', 61, false),
  ('page.torpedos', '/torpedos', 'Torpedos SMS', 'Campanhas SMS', 'venda-mais', 'Smartphone', 62, false),
  ('page.cartao-fidelidade', '/cartao-fidelidade', 'Cartao Fidelidade', 'Programa de fidelidade', 'venda-mais', 'CreditCard', 63, false),
  ('page.gestao.email-inteligente', '/gestao/email-inteligente', 'Email Inteligente', 'Automacoes de email', 'venda-mais', 'Mail', 64, false),
  ('page.notas-fiscais', '/notas-fiscais', 'Notas Fiscais', 'NF-e/NFC-e/CF-e', 'fiscal', 'FileText', 70, false),
  ('page.faturamento', '/faturamento', 'Faturamento', 'Emissao de NF', 'fiscal', 'FileText', 71, false),
  ('page.gestao.nfe-certificado', '/gestao/nfe-certificado', 'Certificado Digital', 'A1/A3', 'fiscal', 'Lock', 72, false),
  ('page.gestao.configuracoes-sefaz', '/gestao/configuracoes-sefaz', 'Configuracoes SEFAZ', 'Integracao SEFAZ', 'fiscal', 'Settings', 73, false),
  ('page.gestao.painel-contador', '/gestao/painel-contador', 'Painel do Contador', 'Portal do contador', 'fiscal', 'Calculator', 74, false),
  ('page.gestao.documentos-demonstrativos', '/gestao/documentos-demonstrativos', 'Documentos Demonstrativos', 'DRE/Balanco', 'fiscal', 'LineChart', 75, false),
  ('page.gestao.avaliacoes', '/gestao/avaliacoes', 'Avaliacoes', 'Notas de clientes', 'crm', 'Star', 80, false),
  ('page.gestao.recomendacoes', '/gestao/recomendacoes', 'Recomendacoes', 'Recomendo/Nao Recomendo', 'crm', 'ThumbsUp', 81, false),
  ('page.gestao.notificacoes', '/gestao/notificacoes', 'Notificacoes', 'Central de notificacoes', 'crm', 'Bell', 82, false),
  ('page.gestao.ocorrencias', '/gestao/ocorrencias', 'Ocorrencias', 'Pendencias e suporte', 'crm', 'MessageSquare', 83, false),
  ('page.gestao.exclusao-informacoes', '/gestao/exclusao-informacoes', 'Exclusao LGPD', 'Solicitacoes LGPD', 'crm', 'Shield', 84, false),
  ('page.controle-comercial.pedido', '/controle-comercial/pedido', 'Pedido / Pre-venda', 'Pre-vendas', 'controle-comercial', 'ShoppingCart', 90, false),
  ('page.controle-comercial.orcamento', '/controle-comercial/orcamento', 'Orcamento', 'Orcamentos rapidos', 'controle-comercial', 'FileText', 91, false),
  ('page.controle-comercial.os', '/controle-comercial/os', 'Ordem de Servico', 'Gestao de OS', 'controle-comercial', 'Wrench', 92, false),
  ('page.controle-comercial.consignacao', '/controle-comercial/consignacao', 'Venda Consignada', 'Consignacoes', 'controle-comercial', 'Truck', 93, false),
  ('page.controle-comercial.locacao', '/controle-comercial/locacao', 'Locacao', 'Controle de locacoes', 'controle-comercial', 'Store', 94, false),
  ('page.tef-sitef', '/tef-sitef', 'TEF / SITEF', 'Integracao TEF', 'controle-comercial', 'CreditCard', 95, false),
  ('page.marketplace-ifood', '/marketplace-ifood', 'iFood Marketplace', 'Marketplace iFood', 'vendas-online', 'ShoppingCart', 100, false),
  ('page.gestao.usuario-permissoes', '/gestao/usuario-permissoes', 'Permissoes', 'Permissoes granulares', 'administracao', 'Shield', 111, false),
  ('page.gestao.dados-empresariais', '/gestao/dados-empresariais', 'Dados Empresariais', 'Cadastro da empresa', 'administracao', 'Building2', 112, false),
  ('page.gestao.configuracoes-gerais', '/gestao/configuracoes-gerais', 'Configuracoes Gerais', 'Parametros gerais', 'administracao', 'Settings', 114, false),
  ('page.gestao.codigo-barras', '/gestao/codigo-barras', 'Gerar Codigo de Barras', 'Geracao EAN13', 'administracao', 'Barcode', 117, false),
  ('page.config.downloads', '/config/downloads', 'Downloads', 'Arquivos para download', 'administracao', 'Barcode', 118, false),
  ('page.treinamento.tutoriais', '/treinamento/tutoriais', 'Treinamento', 'Tutoriais do sistema', 'administracao', 'HelpCircle', 119, false),
  ('page.relatorios', '/relatorios', 'Relatorios', 'Relatorios gerais', 'administracao', 'LineChart', 120, false)
ON CONFLICT (chave) DO NOTHING;

SELECT '025_feature_flags aplicada: ' || COUNT(*) || ' flags' AS status FROM erp_feature_flags;
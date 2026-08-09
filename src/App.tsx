import { Routes, Route, Navigate } from "react-router-dom";

import { RootLayout } from "@/components/root-layout";
import { PlaceholderPage } from "@/components/placeholder-page";

import { LoginPage } from "@/pages/login";
import { DashboardPage } from "@/pages/dashboard";
import { ProductsPage } from "@/pages/products";
import { OrdersPage } from "@/pages/orders";
import { CustomersPage } from "@/pages/customers";
import { VisaoGeralPage } from "@/pages/visao-geral";
import { FinanceiroPage } from "@/pages/financeiro";
import { FornecedoresPage } from "@/pages/fornecedores";
import { AgendaPage } from "@/pages/agenda";
import { FuncionariosPage } from "@/pages/funcionarios";
import { TransportadorasPage } from "@/pages/transportadoras";
import { EstoquePage } from "@/pages/estoque";
import { AgendaTelefonicaPage } from "@/pages/agenda-telefonica";
import { DocumentosPage } from "@/pages/documentos";
import { EmailInteligentePage } from "@/pages/email-inteligente";
import { RegioesEntregaPage } from "@/pages/regioes-entrega";
import { VeiculosPage } from "@/pages/consulta-veiculos";
import { EntregasFuturasPage } from "@/pages/entregas-futuras";
import { UsuariosPage } from "@/pages/usuarios";
import { CaixaPage } from "@/pages/caixa";
import { PDVPage } from "@/pages/pdv";
import { NotasFiscaisPage } from "@/pages/notas-fiscais";
import { PedidosDeliveryPage } from "@/pages/pedidos-delivery";
import { GeradorBoletosPage } from "@/pages/gerador-boletos";
import { PromissoriaPage } from "@/pages/promissoria";
import { CrediarioProprioPage } from "@/pages/crediario-proprio";
import { CartaoFidelidadePage } from "@/pages/cartao-fidelidade";
import { MalaDiretaPage } from "@/pages/mala-direta";
import { TorpedosPage } from "@/pages/torpedos";
import { EmailMarketingPage } from "@/pages/email-marketing";
import { DownloadsPage } from "@/pages/downloads";
import { LojasPage } from "@/pages/lojas";
import { VendasPage } from "@/pages/vendas";
import { KitsPage } from "@/pages/kits";
import { ComprasPage } from "@/pages/compras";
import { RelatoriosPage } from "@/pages/relatorios";
import { DevolucoesPage } from "@/pages/devolucoes";
import { TransferenciaEstoquePage } from "@/pages/estoque.transferencia";
import { FiscalPage } from "@/pages/fiscal";
import { ConfiguracoesPage } from "@/pages/configuracoes";
import { AjudaPage } from "@/pages/ajuda";
import { ConfigSistemaPage } from "@/pages/config.sistema";
import { ConfigEmpresarialPage } from "@/pages/config.empresarial";
import { ConfigChavesPixPage } from "@/pages/config.minhas-chaves";
import { FaturamentoPage } from "@/pages/faturamento";
import { PedidoPage, OrcamentoPage, OrdemServicoPage, ConsignacaoPage, LocacaoPage } from "@/pages/controle-comercial";
import { IFoodPage, ExAppPedidosPage, TEFPage } from "@/pages/integracoes";
import { MarketplaceIFoodPage } from "@/pages/marketplace-ifood";
import { GestaoHubPage } from "@/pages/gestao";
import { TreinamentoPage } from "@/pages/treinamento";

// Helper para gerar Placeholder com ícone padrão
import { Coffee } from "lucide-react";

const P = (title: string, description?: string, icon?: any) => (
  <PlaceholderPage title={title} description={description} icon={icon} />
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={<RootLayout />}>
        <Route index element={<DashboardPage />} />

        {/* ===== VENDAS E PEDIDOS ===== */}
        <Route path="pdv" element={<PDVPage />} />
        <Route path="notas-fiscais" element={<NotasFiscaisPage />} />
        <Route path="pedidos-delivery" element={<PedidosDeliveryPage />} />
        <Route path="ifood" element={<IFoodPage />} />
        <Route path="exapp-pedidos" element={<ExAppPedidosPage />} />
        <Route path="gerador-boletos" element={<GeradorBoletosPage />} />

        {/* Venda Mais */}
        <Route path="mala-direta" element={<MalaDiretaPage />} />
        <Route path="email-marketing" element={<EmailMarketingPage />} />
        <Route path="torpedos" element={<TorpedosPage />} />
        <Route path="cartao-fidelidade" element={<CartaoFidelidadePage />} />
        <Route path="crediario-proprio" element={<CrediarioProprioPage />} />
        <Route path="promissoria" element={<PromissoriaPage />} />

        {/* Controle Comercial */}
        <Route path="controle-comercial/pedido" element={<PedidoPage />} />
        <Route path="controle-comercial/orcamento" element={<OrcamentoPage />} />
        <Route path="controle-comercial/os" element={<OrdemServicoPage />} />
        <Route path="controle-comercial/consignacao" element={<ConsignacaoPage />} />
        <Route path="controle-comercial/locacao" element={<LocacaoPage />} />

        <Route path="tef-sitef" element={<TEFPage />} />

        {/* ===== GESTÃO ===== */}
        {/* Financeiro */}
        <Route path="financeiro" element={<FinanceiroPage />} />
        <Route path="financeiro/relatorios" element={<FinanceiroPage />} />

        {/* Gestão Empresarial */}
        <Route path="gestao" element={<GestaoHubPage />} />
        <Route path="gestao/clientes" element={<CustomersPage />} />
        <Route path="gestao/fornecedores" element={<FornecedoresPage />} />
        <Route path="gestao/funcionarios" element={<FuncionariosPage />} />
        <Route path="gestao/transportadoras" element={<TransportadorasPage />} />
        <Route path="gestao/estoque" element={<EstoquePage />} />
        <Route path="gestao/entregas-futuras" element={<EntregasFuturasPage />} />
        <Route path="gestao/servicos" element={P("Serviços Oferecidos", "Catálogo de serviços", Coffee)} />
        <Route path="gestao/agenda-telefonica" element={<AgendaTelefonicaPage />} />
        <Route path="gestao/documentos" element={<DocumentosPage />} />
        <Route path="gestao/arquivos-pastas" element={<DocumentosPage />} />
        <Route path="gestao/email-inteligente" element={<EmailInteligentePage />} />
        <Route path="gestao/agenda-compromissos" element={<AgendaPage />} />
        <Route path="gestao/regioes-entrega" element={<RegioesEntregaPage />} />
        <Route path="gestao/consulta-veiculos" element={<VeiculosPage />} />

        <Route path="gestao/usuarios" element={<UsuariosPage />} />

        {/* Outros destaques */}
        <Route path="faturamento" element={<FaturamentoPage />} />

        {/* ===== VENDAS PELA INTERNET ===== */}
        <Route path="marketplace-ifood" element={<MarketplaceIFoodPage />} />

        {/* ===== CONFIGURAÇÕES ===== */}
        <Route path="config/sistema" element={<ConfigSistemaPage />} />
        <Route path="config/empresarial" element={<ConfigEmpresarialPage />} />
        <Route path="config/minhas-chaves" element={<ConfigChavesPixPage />} />
        <Route path="config/downloads" element={<DownloadsPage />} />
        <Route path="treinamento/tutoriais" element={<TreinamentoPage />} />

        {/* ===== ROTAS LEGADO (compatibilidade) ===== */}
        <Route path="visao-geral" element={<VisaoGeralPage />} />
        <Route path="caixa" element={<CaixaPage />} />
        <Route path="pedidos" element={<OrdersPage />} />
        <Route path="vendas" element={<VendasPage />} />
        <Route path="devolucoes" element={<DevolucoesPage />} />
        <Route path="kits" element={<KitsPage />} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="estoque" element={<EstoquePage />} />
        <Route path="estoque.transferencia" element={<TransferenciaEstoquePage />} />
        <Route path="compras" element={<ComprasPage />} />
        <Route path="fornecedores" element={<FornecedoresPage />} />
        <Route path="funcionarios" element={<FuncionariosPage />} />
        <Route path="fiscal" element={<FiscalPage />} />
        <Route path="relatorios" element={<RelatoriosPage />} />
        <Route path="lojas" element={<LojasPage />} />
        <Route path="configuracoes" element={<ConfiguracoesPage />} />
        <Route path="ajuda" element={<AjudaPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
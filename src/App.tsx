import { Routes, Route, Navigate } from "react-router-dom";

import { RootLayout } from "@/components/root-layout";
import { PlaceholderPage } from "@/components/placeholder-page";

import { LoginPage } from "@/pages/login";
import { RedefinirSenhaPage } from "@/pages/redefinir-senha";
import { DashboardPage } from "@/pages/dashboard";
import { SetupPage } from "@/pages/setup";
import { OrdersPage } from "@/pages/orders";
import { CustomersPage } from "@/pages/customers";
import { VisaoGeralPage } from "@/pages/visao-geral";
import { FinanceiroPage } from "@/pages/financeiro";
import { FornecedoresPage } from "@/pages/fornecedores";
import { AgendaPage } from "@/pages/agenda";

// Páginas principais implementadas
import { FuncionariosPage } from "@/pages/funcionarios";
import { ProdutosEstoqueLotesPage } from "@/pages/produtos-estoque-lotes";
import { DocumentosPage } from "@/pages/documentos";
import { EmailInteligentePage } from "@/pages/email-inteligente";
import { RegioesEntregaPage } from "@/pages/regioes-entrega";
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
import { ImportarNFePage } from "@/pages/compras.importar-nfe";
import { RemessasPage } from "@/pages/remessas";
import { PedidoPage, OrcamentoPage, OrdemServicoPage, ConsignacaoPage, LocacaoPage } from "@/pages/controle-comercial";
import { IFoodPage, ExAppPedidosPage, TEFPage } from "@/pages/integracoes";
import { MarketplaceIFoodPage } from "@/pages/marketplace-ifood";
import { GestaoHubPage } from "@/pages/gestao";
import { TreinamentoPage } from "@/pages/treinamento";

// ===== Novas páginas do MAPA_GESTAO_EMPRESARIAL.md =====
import {
  ConsultaChequePage, RecebimentoChequePage,
  NegativarDevedoresPage, ParcelarDebitosPage, EncaminharProtestoPage,
} from "@/pages/gestao-cobranca";

import {
  AvaliacoesPage, RecomendacoesPage, NotificacoesPage,
  SolicitacaoParceriaPage, OcorrenciasPage,
  ConfiguracoesGeraisPage, ConfiguracoesSefazPage,
} from "@/pages/gestao-config";
import { NfeCertificadoPage } from "@/pages/nfe-certificado";

import {
  ConsultaPessoaFisicaPage, ConsultaPessoaJuridicaPage, DadosEmpresariaisPage,
  CodigoBarrasPage, CartaoCreditoPage, CartaoDebitoPage, DinheiroPage,
  LocalizarPessoasPage, ExclusaoInformacoesPage, DocumentosDemonstrativosPage,
  PastaPrincipalPage, CadastroProdutosPage, GerarCrediarioPage,
  PainelContadorPage, EmpresarialPage,
} from "@/pages/gesta-final";

// Helper
import { Coffee } from "lucide-react";

const P = (title: string, description?: string, icon?: any) => (
  <PlaceholderPage title={title} description={description} icon={icon} />
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/redefinir-senha" element={<RedefinirSenhaPage />} />
      <Route path="/setup" element={<SetupPage />} />

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
        <Route path="gestao/relatorios-financeiros" element={<FinanceiroPage />} />

        {/* Gestão Empresarial — Hub + Alias */}
        <Route path="gestao" element={<GestaoHubPage />} />
        <Route path="gestao/empresarial" element={<EmpresarialPage />} />

        {/* Clientes / Fornecedores / Funcionários */}
        <Route path="gestao/clientes" element={<CustomersPage />} />
        <Route path="gestao/consulta-pessoa-fisica" element={<ConsultaPessoaFisicaPage />} />
        <Route path="gestao/consulta-pessoa-juridica" element={<ConsultaPessoaJuridicaPage />} />
        <Route path="gestao/fornecedores" element={<FornecedoresPage />} />
        <Route path="gestao/funcionarios" element={<FuncionariosPage />} />
        <Route path="gestao/cadastro-produtos" element={<CadastroProdutosPage />} />
        <Route path="gestao/servicos" element={P("Serviços Oferecidos", "Catálogo de serviços", Coffee)} />

        {/* Agenda / Documentos / Arquivos */}
        <Route path="gestao/documentos" element={<DocumentosPage />} />
        <Route path="gestao/documentos-demonstrativos" element={<DocumentosDemonstrativosPage />} />
        <Route path="gestao/arquivos-pastas" element={<PastaPrincipalPage />} />
        <Route path="gestao/pasta-principal" element={<PastaPrincipalPage />} />

        {/* Email / Agenda */}
        <Route path="gestao/email-inteligente" element={<EmailInteligentePage />} />
        <Route path="gestao/agenda-compromissos" element={<AgendaPage />} />
        <Route path="gestao/regioes-entrega" element={<RegioesEntregaPage />} />

        {/* Usuários */}
        <Route path="gestao/usuarios" element={<UsuariosPage />} />
        <Route path="gestao/administrar-usuarios" element={<UsuariosPage />} />
        <Route path="gestao/usuario-permissoes" element={<UsuariosPage />} />

        {/* Cobrança */}
        <Route path="gestao/negativar-devedores" element={<NegativarDevedoresPage />} />
        <Route path="gestao/parcelar-debitos" element={<ParcelarDebitosPage />} />
        <Route path="gestao/encaminhar-protesto" element={<EncaminharProtestoPage />} />
        <Route path="gestao/solicitacao-parceria" element={<SolicitacaoParceriaPage />} />

        {/* Cheques */}
        <Route path="gestao/consulta-cheque" element={<ConsultaChequePage />} />
        <Route path="gestao/recebimento-cheque" element={<RecebimentoChequePage />} />

        {/* Financeiro Avançado */}
        <Route path="gestao/cartao-credito" element={<CartaoCreditoPage />} />
        <Route path="gestao/cartao-debito" element={<CartaoDebitoPage />} />
        <Route path="gestao/dinheiro" element={<DinheiroPage />} />

        {/* Documentos / Código de Barras / Downloads */}
        <Route path="gestao/codigo-barras" element={<CodigoBarrasPage />} />
        <Route path="gestao/downloads" element={<DownloadsPage />} />

        {/* Localizar / LGPD / Contador / Dados Empresariais */}
        <Route path="gestao/localizar-pessoas" element={<LocalizarPessoasPage />} />
        <Route path="gestao/exclusao-informacoes" element={<ExclusaoInformacoesPage />} />
        <Route path="gestao/painel-contador" element={<PainelContadorPage />} />
        <Route path="gestao/dados-empresariais" element={<DadosEmpresariaisPage />} />
        <Route path="gestao/nfe-certificado" element={<NfeCertificadoPage />} />
        <Route path="gestao/configuracoes-sefaz" element={<ConfiguracoesSefazPage />} />

        {/* CRM / Notificações / Ocorrências */}
        <Route path="gestao/avaliacoes" element={<AvaliacoesPage />} />
        <Route path="gestao/recomendacoes" element={<RecomendacoesPage />} />
        <Route path="gestao/notificacoes" element={<NotificacoesPage />} />
        <Route path="gestao/ocorrencias" element={<OcorrenciasPage />} />

        {/* Crediário com juros */}
        <Route path="gestao/gerar-crediario" element={<GerarCrediarioPage />} />
        <Route path="gestao/gerar-boleto" element={<GeradorBoletosPage />} />
        <Route path="gestao/gerar-crediario-proprio" element={<CrediarioProprioPage />} />
        <Route path="gestao/gerar-promissoria" element={<PromissoriaPage />} />

        {/* Configurações */}
        <Route path="gestao/configuracoes-gerais" element={<ConfiguracoesGeraisPage />} />

        {/* Minhas Chaves (movido para /config) */}
        <Route path="gestao/minhas-chaves" element={<ConfigChavesPixPage />} />

        {/* Faturamento (alias) */}
        <Route path="gestao/faturamento" element={<FaturamentoPage />} />

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
        <Route path="lotes" element={<ProdutosEstoqueLotesPage />} />
        <Route path="gestao/lotes" element={<ProdutosEstoqueLotesPage />} />
        <Route path="produtos" element={<ProdutosEstoqueLotesPage />} />
        <Route path="produtos-estoque-lotes" element={<ProdutosEstoqueLotesPage />} />
        <Route path="estoque" element={<ProdutosEstoqueLotesPage />} />
        <Route path="gestao/estoque" element={<ProdutosEstoqueLotesPage />} />
        <Route path="estoque.transferencia" element={<TransferenciaEstoquePage />} />
        <Route path="compras" element={<ComprasPage />} />
        <Route path="compras/importar-nfe" element={<ImportarNFePage />} />
        <Route path="gestao/compras/importar-nfe" element={<ImportarNFePage />} />

        {/* Remessas entre Filiais */}
        <Route path="remessas" element={<RemessasPage />} />
        <Route path="gestao/remessas" element={<RemessasPage />} />
        <Route path="gestao/transferencia-estoque" element={<RemessasPage />} />
        <Route path="estoque.transferencia" element={<RemessasPage />} />
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
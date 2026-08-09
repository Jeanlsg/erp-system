import { Routes, Route, Navigate } from "react-router-dom";

import { RootLayout } from "@/components/root-layout";
import { PlaceholderPage } from "@/components/placeholder-page";

import { LoginPage } from "@/pages/login";
import { DashboardPage } from "@/pages/dashboard";
import { ProductsPage } from "@/pages/products";
import { OrdersPage } from "@/pages/orders";
import { CustomersPage } from "@/pages/customers";
import { VisaoGeralPage } from "@/pages/visao-geral";

// Helper para gerar Placeholder com ícone padrão
import { Calculator, FileText, Bike, MessageSquare, Coffee, Barcode, DollarSign, CreditCard, Mail, Wrench, ShoppingCart, Briefcase, Users, Building2, Package, Calendar, Send, LineChart, BarChart3, CheckCircle, Search, Truck, Key, Cog, Settings, HelpCircle, Store } from "lucide-react";

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
        <Route path="pdv" element={P("PDV / Frente de Caixa", "Ponto de venda completo", Calculator)} />
        <Route path="notas-fiscais" element={P("Notas Fiscais", "Emissão e gestão de NF", FileText)} />
        <Route path="pedidos-delivery" element={P("Pedidos Delivery", "Pedidos para entrega", Bike)} />
        <Route path="ifood" element={P("Pedidos iFood", "Integração com iFood", ShoppingCart)} />
        <Route path="exapp-pedidos" element={P("ExApp Pedidos", "Pedidos via WhatsApp", MessageSquare)} />
        <Route path="comanda-mesa" element={P("Comanda/Mesa", "Controle de mesas", Coffee)} />
        <Route path="gerador-boletos" element={P("Gerador de Boletos", "Geração de boletos", Barcode)} />
        
        {/* Venda Mais */}
        <Route path="mala-direta" element={P("Mala Direta", "Novos clientes", Mail)} />
        <Route path="email-marketing" element={P("E-mail Marketing", "Campanhas de email", Mail)} />
        <Route path="torpedos" element={P("Torpedos Celular", "SMS marketing", MessageSquare)} />
        <Route path="cartao-fidelidade" element={P("Cartão Fidelidade", "Programa de fidelidade", CreditCard)} />
        <Route path="crediario-proprio" element={P("Crediário Próprio", "Geração de carnês", CreditCard)} />
        <Route path="promissoria" element={P("Promissória", "Emissão de promissórias", FileText)} />
        
        {/* Controle Comercial */}
        <Route path="controle-comercial/pedido" element={P("Pedido/Pré-venda", "Pedidos e pré-vendas", ShoppingCart)} />
        <Route path="controle-comercial/orcamento" element={P("Orçamento", "Orçamentos rápidos", ShoppingCart)} />
        <Route path="controle-comercial/os" element={P("Ordem de Serviço", "Gestão de OS", Wrench)} />
        <Route path="controle-comercial/consignacao" element={P("Venda Consignada", "Vendas consignadas", ShoppingCart)} />
        <Route path="controle-comercial/locacao" element={P("Locação", "Controle de locações", ShoppingCart)} />
        
        <Route path="tef-sitef" element={P("TEF / SITEF", "Integração TEF", CreditCard)} />

        {/* ===== GESTÃO ===== */}
        {/* Financeiro */}
        <Route path="financeiro" element={P("Relatórios Financeiros", "Fluxo de caixa completo", LineChart)} />
        <Route path="financeiro/relatorios" element={P("Relatórios Financeiros", "Fluxo de caixa completo", LineChart)} />
        
        {/* Gestão Empresarial */}
        <Route path="gestao" element={P("Gestão Empresarial", "Hub de cadastros", Briefcase)} />
        <Route path="gestao/clientes" element={<CustomersPage />} />
        <Route path="gestao/fornecedores" element={P("Fornecedores", "Cadastro de fornecedores", Truck)} />
        <Route path="gestao/funcionarios" element={P("Funcionários", "Cadastro de funcionários", Building2)} />
        <Route path="gestao/transportadoras" element={P("Transportadoras", "Cadastro de transportadoras", Truck)} />
        <Route path="gestao/estoque" element={P("Estoque Produtos", "Gestão de estoque", Package)} />
        <Route path="gestao/entregas-futuras" element={P("Entregas Futuras", "Programação de entregas", Truck)} />
        <Route path="gestao/servicos" element={P("Serviços Oferecidos", "Catálogo de serviços", Briefcase)} />
        <Route path="gestao/agenda-telefonica" element={P("Agenda Telefônica", "Contatos corporativos", Calendar)} />
        <Route path="gestao/documentos" element={P("Documentos Administrativos", "Gestão de documentos", FileText)} />
        <Route path="gestao/arquivos-pastas" element={P("Arquivos e Pastas", "Gerenciamento de arquivos", FileText)} />
        <Route path="gestao/email-inteligente" element={P("E-mail Inteligente", "Automação de emails", Mail)} />
        <Route path="gestao/agenda-compromissos" element={P("Agenda de Compromissos", "Tarefas e eventos", Calendar)} />
        <Route path="gestao/regioes-entrega" element={P("Regiões de Entrega", "Zonas de entrega", Truck)} />

        <Route path="gestao/usuarios" element={P("Gestão Usuários", "Administrar usuários", Users)} />

        {/* Outros destaques */}
        <Route path="faturamento" element={P("Faturamento", "Emissão de notas", FileText)} />

        {/* ===== VENDAS PELA INTERNET ===== */}
        <Route path="marketplace-ifood" element={P("iFood", "Marketplace iFood", ShoppingCart)} />

        {/* ===== CONFIGURAÇÕES ===== */}
        <Route path="config/sistema" element={P("Configurações do Sistema", "Configurações técnicas", Cog)} />
        <Route path="config/empresarial" element={P("Configurações Empresariais", "Dados da empresa", Briefcase)} />
        <Route path="config/minhas-chaves" element={P("Minhas Chaves", "Chaves de acesso PIX", Key)} />
        <Route path="config/downloads" element={P("Downloads", "Arquivos disponíveis", Barcode)} />
        <Route path="treinamento/tutoriais" element={P("Tutoriais", "Material de treinamento", HelpCircle)} />

        {/* ===== ROTAS LEGADO (compatibilidade) ===== */}
        <Route path="visao-geral" element={<VisaoGeralPage />} />
        <Route path="caixa" element={P("Caixa", "Abertura e fechamento", DollarSign)} />
        <Route path="pedidos" element={<OrdersPage />} />
        <Route path="vendas" element={P("Vendas", "Histórico completo", Receipt)} />
        <Route path="devolucoes" element={P("Devoluções", "Gestão de devoluções", Send)} />
        <Route path="kits" element={P("Kits", "Kits de produtos", Package)} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="estoque" element={P("Estoque", "Visão geral", Package)} />
        <Route path="estoque.transferencia" element={P("Transferência", "Transferir estoque", Send)} />
        <Route path="compras" element={P("Compras", "Pedidos de compra", ShoppingCart)} />
        <Route path="fornecedores" element={P("Fornecedores", "Cadastro", Truck)} />
        <Route path="funcionarios" element={P("Funcionários", "Cadastro", Building2)} />
        <Route path="fiscal" element={P("Fiscal", "NF-e / NFC-e", FileText)} />
        <Route path="relatorios" element={P("Relatórios", "Relatórios gerais", BarChart3)} />
        <Route path="lojas" element={P("Lojas", "Cadastro de lojas", Store)} />
        <Route path="configuracoes" element={P("Configurações", "Configurações gerais", Settings)} />
        <Route path="ajuda" element={P("Ajuda", "Central de ajuda", HelpCircle)} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
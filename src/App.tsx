import { Routes, Route, Navigate } from "react-router-dom";
import { ScanBarcode, Wallet, Receipt, RotateCcw, KanbanSquare, Boxes, ArrowLeftRight, PackagePlus, Truck, Users, Building2, Banknote, FileText, BarChart3, Store, Settings, HelpCircle } from "lucide-react";

import { RootLayout } from "@/components/root-layout";
import { PlaceholderPage } from "@/components/placeholder-page";

import { LoginPage } from "@/pages/login";
import { DashboardPage } from "@/pages/dashboard";
import { ProductsPage } from "@/pages/products";
import { OrdersPage } from "@/pages/orders";
import { CustomersPage } from "@/pages/customers";
import { VisaoGeralPage } from "@/pages/visao-geral";

export default function App() {
  return (
    <Routes>
      {/* Login sem layout */}
      <Route path="/login" element={<LoginPage />} />

      {/* Rotas autenticadas com layout */}
      <Route path="/" element={<RootLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="visao-geral" element={<VisaoGeralPage />} />

        {/* Operação */}
        <Route path="pdv" element={<PlaceholderPage title="PDV" description="Ponto de Venda" icon={ScanBarcode} />} />
        <Route path="caixa" element={<PlaceholderPage title="Caixa" description="Abertura e fechamento" icon={Wallet} />} />

        {/* Vendas */}
        <Route path="pedidos" element={<OrdersPage />} />
        <Route path="vendas" element={<PlaceholderPage title="Vendas" description="Histórico completo" icon={Receipt} />} />
        <Route path="devolucoes" element={<PlaceholderPage title="Devoluções" icon={RotateCcw} />} />
        <Route path="kits" element={<PlaceholderPage title="Kits" icon={KanbanSquare} />} />

        {/* Catálogo */}
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="estoque" element={<PlaceholderPage title="Estoque" icon={Boxes} />} />
        <Route path="estoque.transferencia" element={<PlaceholderPage title="Transferência de Estoque" icon={ArrowLeftRight} />} />
        <Route path="compras" element={<PlaceholderPage title="Compras" icon={PackagePlus} />} />
        <Route path="fornecedores" element={<PlaceholderPage title="Fornecedores" icon={Truck} />} />

        {/* Pessoas */}
        <Route path="clientes" element={<CustomersPage />} />
        <Route path="funcionarios" element={<PlaceholderPage title="Funcionários" icon={Building2} />} />

        {/* Financeiro & Fiscal */}
        <Route path="financeiro" element={<PlaceholderPage title="Financeiro" icon={Banknote} />} />
        <Route path="fiscal" element={<PlaceholderPage title="Fiscal" description="NF-e / NFC-e" icon={FileText} />} />
        <Route path="relatorios" element={<PlaceholderPage title="Relatórios" icon={BarChart3} />} />

        {/* Configuração */}
        <Route path="lojas" element={<PlaceholderPage title="Lojas" icon={Store} />} />
        <Route path="configuracoes" element={<PlaceholderPage title="Configurações" icon={Settings} />} />
        <Route path="ajuda" element={<PlaceholderPage title="Ajuda" icon={HelpCircle} />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
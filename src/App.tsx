import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { LoginPage } from "@/pages/login";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardPage } from "@/pages/dashboard";
import { ProductsPage } from "@/pages/products";
import { OrdersPage } from "@/pages/orders";
import { CustomersPage } from "@/pages/customers";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="pedidos" element={<OrdersPage />} />
        <Route path="clientes" element={<CustomersPage />} />
      </Route>
    </Routes>
  );
}

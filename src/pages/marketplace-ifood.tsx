import { Navigate } from "react-router-dom";

// A configuração do iFood é única — concentrada em /ifood (integracoes.tsx)
export function MarketplaceIFoodPage() {
  return <Navigate to="/ifood" replace />;
}

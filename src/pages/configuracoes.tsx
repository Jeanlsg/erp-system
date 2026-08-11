import { Navigate } from "react-router-dom";

// Rota legado: as configurações reais vivem em /config/sistema
export function ConfiguracoesPage() {
  return <Navigate to="/config/sistema" replace />;
}

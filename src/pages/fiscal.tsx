import { Navigate } from "react-router-dom";

// Rota legado: o módulo fiscal vive em /notas-fiscais (emissão, certificado e SEFAZ ficam no menu Fiscal)
export function FiscalPage() {
  return <Navigate to="/notas-fiscais" replace />;
}

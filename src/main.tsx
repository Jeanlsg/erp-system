import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";

// Ativar flags v7 do React Router para preparar upgrade futuro
declare module "react-router-dom" {
  interface FutureConfig {
    v7_relativeSplatPath: boolean;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

try {
  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: "erp-query-cache",
    serialize: (data) => {
      try {
        return JSON.stringify(data);
      } catch {
        return JSON.stringify({});
      }
    },
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24,
  });
} catch (err) {
  console.warn("Persistência de cache desabilitada:", err);
  try {
    window.localStorage.removeItem("erp-query-cache");
  } catch {
    // ignore
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
          v7_relativeSplatPath: true,
        }}
      >
        <App />
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
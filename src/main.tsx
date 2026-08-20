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

// PWA: registra o service worker que mantém o app abrindo sem internet.
// Só em produção — em dev o SW cacheando o vite atrapalha mais que ajuda.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(async () => {
      // Na PRIMEIRA visita os assets são baixados antes de o SW assumir a
      // página — sem isto, o cache só teria o shell e um F5 offline abriria
      // um HTML sem JavaScript. Refazer o fetch dos assets referenciados,
      // agora COM o SW ativo, grava cada um no cache imutável.
      const reg = await navigator.serviceWorker.ready;
      const assets = [
        ...document.querySelectorAll<HTMLScriptElement>('script[src^="/assets/"]'),
        ...document.querySelectorAll<HTMLLinkElement>('link[href^="/assets/"]'),
      ].map((el) => ("src" in el ? el.src : el.href));
      reg.active?.postMessage({ tipo: "precache", urls: assets });
    }).catch((err) => {
      console.warn("service worker não registrado:", err);
    });
  });
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
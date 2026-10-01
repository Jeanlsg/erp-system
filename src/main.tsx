import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, ativarPersistencia } from "@/lib/query-client";
import { vigiarSessao } from "@/lib/store/auth-store";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";

// Ativar flags v7 do React Router para preparar upgrade futuro
declare module "react-router-dom" {
  interface FutureConfig {
    v7_relativeSplatPath: boolean;
  }
}

// Cache de consultas: criado em src/lib/query-client.ts para o login e o
// logout conseguirem limpá-lo (troca de usuário no mesmo navegador).
ativarPersistencia();
// a tela sai junto se a sessão do Supabase acabar ou virar de outra pessoa
vigiarSessao();

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
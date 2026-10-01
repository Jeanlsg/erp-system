// ============================================================
// O cache de consultas do app — um só, compartilhado por todas as telas.
//
// Mora num módulo próprio (e não dentro do main.tsx) para o login e o logout
// conseguirem LIMPÁ-LO. Sem isso, entrar como o dono do sistema, sair e entrar
// como operador mostrava as telas de dono: "sou admin principal?", a lista de
// usuários, as páginas desligadas — tudo ficava no cache (e no localStorage,
// por causa da persistência) e o operador herdava o que o dono tinha lido.
// Toda consulta depende de quem está logado, porque a RLS decide o que cada
// um vê; então a troca de usuário apaga TUDO, não uma lista de chaves.
// ============================================================

import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

/** Chave do cache persistido no localStorage. */
export const CHAVE_CACHE_PERSISTIDO = "erp-query-cache";

// ⚠️ Dado de balcão envelhece em segundos, e não só pelo que ESTA aba grava:
// a venda feita no outro caixa, a sangria do gerente, o estoque da outra
// filial. Com 5 minutos de "fresco" e sem reler ao voltar à aba, o caixa
// fechava com o esperado da abertura — e o cache persistido no localStorage
// fazia isso sobreviver até a um F5. Quem precisa de mais tempo (catálogo
// espelhado offline, tabelas de referência) declara o próprio staleTime.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

/** Liga a persistência do cache no localStorage (chamado uma vez, no main.tsx). */
export function ativarPersistencia() {
  try {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: CHAVE_CACHE_PERSISTIDO,
      serialize: (data) => {
        try {
          return JSON.stringify(data);
        } catch {
          return JSON.stringify({});
        }
      },
    });
    persistQueryClient({ queryClient, persister, maxAge: 1000 * 60 * 60 * 24 });
  } catch (err) {
    console.warn("Persistência de cache desabilitada:", err);
    apagarCachePersistido();
  }
}

function apagarCachePersistido() {
  try {
    window.localStorage.removeItem(CHAVE_CACHE_PERSISTIDO);
  } catch {
    // aba anônima / armazenamento bloqueado: não há o que apagar
  }
}

/**
 * Esquece tudo o que foi lido como o usuário anterior: o cache em memória e o
 * persistido. Chamado ao sair e ao entrar — entrar também, porque a pessoa
 * pode ter fechado a aba sem sair e outra ter entrado no mesmo navegador.
 */
export function limparCacheDoUsuario() {
  queryClient.cancelQueries();
  queryClient.clear();
  apagarCachePersistido();
}

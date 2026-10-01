---
name: logout-limpa-sessao
description: Sair e entrar no ERP X-Life zeram tudo o que o navegador guardou como aquele usuário — cache do React Query em memória e persistido no localStorage, filial escolhida, sessionStorage, espelho offline do IndexedDB — sem apagar a fila de vendas não enviadas, a chave do aparelho nem preferências do aparelho. Traz onde isso vive no código (logout, esquecerDadosDoUsuario, vigiarSessao, query-client), o contrato da função de sair, chaves de cache com o id do usuário, o teste de regressão, o roteiro manual (dono → sair → operador no mesmo navegador) e um script de auditoria. Use ao mexer em login, logout, troca de usuário, persistência de cache ou store persistido, ou ao investigar "depois de sair e entrar com outro usuário, ainda aparecem telas/dados do anterior".
---

# Logout limpa a sessão

## No ERP (onde está)

| O quê | Onde |
|---|---|
| Sair | `logout()` em `src/lib/store/auth-store.ts` — `signOut({ scope: "local" })` e depois `esquecerDadosDoUsuario()` |
| A limpeza | `esquecerDadosDoUsuario()` (mesmo arquivo): `limparCacheDoUsuario()` de `src/lib/query-client.ts`, filial (`useLojaAtualStore`), `sessionStorage`, `apagarCacheOffline()` de `src/lib/offline/db.ts` |
| Entrar | `login()` chama a mesma limpeza; a mesma pessoa voltando recupera a filial |
| Sessão que cai sozinha | `vigiarSessao()` (chamado no `main.tsx`) |
| Venda offline pendente | `podeSair()` pergunta antes; a fila (`fila_vendas`) nunca é apagada |
| Chave com o id | `useAdminPrincipal` → `["erp_admin_principal", usuarioId]` |
| Teste | `src/lib/store/logout-limpa-sessao.test.ts` |
| Fica no navegador (de propósito) | `erp-settings` (config do terminal), menu recolhido, documento fiscal padrão do PDV, `erp-senha-caixa-<id>`, IndexedDB `fila_vendas` e `chaves` |

Guardou algo novo no navegador que depende de quem está logado? Entra em
`esquecerDadosDoUsuario()`, ou leva o id do usuário na chave.

**Regra:** tudo o que foi lido com a credencial de alguém é dado dessa pessoa. Ao sair — e ao
entrar outra pessoa — o navegador esquece **tudo** isso. A limpeza é por **exceção**
(lista curta do que fica), nunca por lista do que apagar: lista de chaves esquece a próxima.

## O caso que originou esta skill

ERP com React Query persistido no `localStorage` (24 h) e zustand persistido. O dono do sistema
entrava, saía, e um operador de caixa entrava **no mesmo navegador**: as telas e o menu de dono
continuavam. Três falhas somadas:

1. `logout()` só zerava o usuário do store — **não chamava `signOut()`** e **não limpava o cache**.
2. O cache persistido sobrevivia até a F5 e a fechar o navegador.
3. A consulta "sou admin principal?" tinha a chave `["erp_admin_principal"]`, **sem o id do
   usuário**: o operador recebia, do cache, a resposta dada ao dono.

Nenhum erro na tela, nenhum log. A RLS no banco segurava a gravação, mas a interface mentia —
e mostrava ao operador dados que ele não podia ver.

## Onde o navegador guarda dado de usuário (inventário)

| Lugar | Exemplos | Some no F5? |
|---|---|---|
| Cache de consultas em memória | React Query, SWR, Apollo, RTK Query, urql | sim |
| Cache de consultas **persistido** | `persistQueryClient`, `apollo3-cache-persist`, `redux-persist` | **não** |
| Stores de estado | zustand/Redux/Pinia/Vuex/Context; com `persist` vão para o storage | só os sem persist |
| `localStorage` / `sessionStorage` | chaves soltas gravadas pela tela | não / por aba |
| IndexedDB | espelho offline, filas, `localforage`, Dexie | não |
| Cache Storage (service worker) | respostas de API cacheadas | não |
| Cookies legíveis por JS | preferências, ids | não |
| Singletons de módulo | `let usuarioAtual` num arquivo, clientes HTTP com header fixo | sim |
| bfcache | o botão Voltar devolve a página inteira da sessão anterior | — |
| Mobile | AsyncStorage, MMKV, SecureStore, cache de imagens com URL assinada | não |

## O que **não** se apaga (a lista de exceções — mantenha curta)

- **Dado ainda não enviado** (fila offline de vendas/pedidos, upload pendente). Apagar é perder
  trabalho. Em vez disso, **avise antes de sair** ("há N itens não enviados") e deixe a pessoa
  decidir. Lembre que a fila vai subir com a sessão de quem entrar depois.
- **Preferência do aparelho**, que não é de ninguém: tema, idioma, menu recolhido, impressora,
  nome do caixa/terminal. Se for preferência **da pessoa**, guarde com o id na chave
  (`pref:${userId}`) e ela some sozinha da vista dos outros.
- **Chave criptográfica do aparelho** (a que cifra a fila offline).

Tudo o mais vai embora — inclusive "a filial/empresa escolhida", "último filtro", rascunhos.

## O contrato de `sair()`

Uma função só, chamada por **todo** botão/rota de saída, nesta ordem:

```ts
export async function sair() {
  // 0. dado não enviado? avisar ANTES (não apagar) — ver exceções
  if (!(await podeSair())) return;

  // 1. encerrar a sessão no provedor — com await; falha não impede a limpeza
  try { await supabase.auth.signOut({ scope: "local" }); }   // local: funciona sem internet
  catch (e) { console.warn("signOut falhou; limpando mesmo assim", e); }

  // 2. esquecer o que foi lido como esta pessoa
  await esquecerDadosDoUsuario();

  // 3. só agora, o estado de "logado" e a navegação (replace: Voltar não volta)
  useAuthStore.getState().logout();
  navigate("/login", { replace: true });
}

export async function esquecerDadosDoUsuario() {
  queryClient.cancelQueries();     // resposta em voo repopularia o cache depois da limpeza
  queryClient.clear();             // memória
  localStorage.removeItem(CHAVE_DO_PERSISTER);   // persistido (ou persister.removeClient())
  resetarStoresDeUsuario();        // zustand: setState(inicial) + persist.clearStorage()
  sessionStorage.clear();
  await limparIndexedDBDeUsuario();  // só os stores de cache; NÃO a fila não enviada
  await limparCacheStorageDeApi();   // se o SW guarda API (o ideal é não guardar)
}
```

Equivalentes por biblioteca:

| Biblioteca | Memória | Persistido |
|---|---|---|
| TanStack/React Query | `queryClient.cancelQueries(); queryClient.clear()` | remover a chave do persister / `persister.removeClient()` |
| SWR | `mutate(() => true, undefined, { revalidate: false })` | o `provider` customizado |
| Apollo | `await client.clearStore()` (não `resetStore`: este refaz as consultas ativas com a sessão velha) | `persistor.purge()` |
| RTK Query / Redux | `dispatch(api.util.resetApiState())`; root reducer que volta ao inicial em `LOGOUT` | `persistor.purge()` |
| zustand `persist` | `setState(estadoInicial)` | `useStore.persist.clearStorage()` |
| Pinia | `store.$reset()` em cada store de usuário | plugin de persistência: remover a chave |
| React Native | estado como acima | `AsyncStorage.multiRemove(chavesDeUsuario)` / MMKV `clearAll()` |

**Atalho robusto para memória:** depois de limpar o que é persistido, `window.location.replace("/login")`
(recarrega a página) zera de uma vez todos os singletons e caches em memória. Use quando o app
tem muitos lugares com estado e não precisa abrir o login sem internet.

### Armadilhas da ordem

- **Navegar antes do `await`**: a tela de login (ou a próxima) monta e consulta com o token
  e o cache de quem saiu.
- **Limpar sem cancelar**: uma requisição em voo do usuário anterior chega depois do `clear()`
  e grava de volta no cache.
- **`signOut` que exige rede**: sem internet ele falha e, se a limpeza vier depois dele sem
  `try/catch`, nada é limpo. Limpe sempre; use o escopo local quando houver.
- **Vários botões de sair** (menu, PDV, expiração, "trocar usuário"): todos chamam a mesma `sair()`.

## Entrar também limpa

O logout pode nunca acontecer: aba fechada com o dono logado, sessão expirada, outra pessoa
abre o mesmo navegador. Então o **login** chama `esquecerDadosDoUsuario()` antes de gravar o novo
usuário. Exceção razoável: se é **a mesma pessoa** voltando, devolva as escolhas dela (filial
selecionada) depois da limpeza.

## Chave de cache com o id do usuário

Toda consulta cuja resposta depende de **quem** pergunta e não de **o quê** — "quem sou eu",
"sou admin?", permissões, menu, preferências — leva o id na chave e só roda com ele:

```ts
const userId = useAuthStore((s) => s.user?.id ?? null);
useQuery({ queryKey: ["admin_principal", userId], enabled: !!userId, queryFn });
```

É defesa em profundidade: se uma limpeza falhar, a chave não casa e a pessoa nova não recebe a
resposta da anterior. Não substitui a limpeza (listas comuns também dependem da RLS).

## Vigia de sessão (a sessão pode acabar sem clique)

```ts
supabase.auth.onAuthStateChange((evento, sessao) => {
  const atual = useAuthStore.getState().user;
  if (!atual) return;
  if (evento === "SIGNED_OUT" || (sessao?.user && sessao.user.id !== atual.id)) {
    void esquecerDadosDoUsuario();
    useAuthStore.getState().logout();
  }
});
```

Cobre: refresh token recusado, logout em outra aba, outra pessoa entrando em outra aba.
Outros provedores: Firebase `onAuthStateChanged`, NextAuth `useSession` + evento `storage`,
JWT próprio: `BroadcastChannel("auth")` avisando as abas. Confirme se a biblioteca propaga
entre abas; se não, propague você.

## Lado do servidor

- Respostas autenticadas com `Cache-Control: no-store` (ou `private, no-cache`): sem isso, o
  cache HTTP do navegador pode servir a resposta do usuário anterior.
- Service worker **nunca** cacheia API autenticada. Se cachear, apagar no logout
  (`caches.delete(nome)`), e a chave precisa incluir o usuário.
- `Clear-Site-Data: "cache", "storage"` na resposta do endpoint de logout é o martelo: apaga
  inclusive a fila não enviada e as preferências. Só use se o sistema não tem nada offline.
- **bfcache:** depois do logout, Voltar pode mostrar a página anterior inteira. Guarda de rota
  que também roda em `pageshow` com `event.persisted`, ou `Cache-Control: no-store` no HTML.
- Nada disso substitui autorização no backend (RLS/policy/middleware): o front esconde, o
  servidor proíbe. Ver `rbac-telas-por-cargo`.

## Teste de regressão (obrigatório)

Unitário, com o provedor de auth mockado:

1. Sessão do admin montada (cache com dado de admin, persistido gravado, store com usuário,
   filial escolhida, sessionStorage com algo) → `await sair()` → tudo vazio; `signOut` chamado.
2. `signOut` rejeitando (sem internet) → a limpeza acontece mesmo assim.
3. Preferência do aparelho e a fila não enviada **continuam**.
4. Login de **outra pessoa** sem logout antes → não herda cache nem filial.
5. Login da **mesma pessoa** → limpa o cache, mantém a filial.

**Prove que o teste pega o bug:** comente a linha de limpeza e veja-o falhar; depois restaure.

E2E/manual (DevTools › Application), no **mesmo navegador**:

1. Entrar como admin, abrir telas de admin.
2. Sair. Rodar `scripts/inventario-navegador.js` no console: só a lista de exceções deve aparecer.
3. Entrar como usuário comum: menu e telas do papel dele; Network sem resposta do admin.
4. Voltar do navegador depois do logout: não mostra tela logada.
5. Duas abas: sair numa → a outra vai para o login.

## Auditar

```bash
bash .claude/skills/logout-limpa-sessao/scripts/auditar-logout.sh .
```

Lista (heurística — confirme lendo o código):
- onde se sai (`logout`, `signOut`, `sair`) e se a chamada tem `await`;
- todo lugar que persiste no navegador (persisters, `persist(`, storage, IndexedDB, Cache Storage);
- o que é limpo hoje (`clear`, `purge`, `removeItem`, `clearStorage`…);
- chaves de consulta de identidade **sem variável** (`["me"]`, `["permissoes"]`, `["admin…"]`);
- se o service worker faz `cache.put` de algo que não seja asset.

Resultado esperado de um sistema correto: uma única função de saída, chamada por todos os
botões; nela, `signOut` + limpeza de cada lugar que aparece na seção "persistência"; login
chamando a mesma limpeza; chaves de identidade com o id.

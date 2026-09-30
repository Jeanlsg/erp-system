---
name: rbac-telas-por-cargo
description: Planejamento de telas/visões e ações por CARGO (RBAC) em QUALQUER app — quem vê e pode fazer o quê por papel (ex.: visitante, usuário, admin, super admin) e como generalizar para N níveis. Framework agnóstico de stack: o modelo de papéis (ladder aditivo + escopos/flags ortogonais como multi-tenant e acesso por recurso), as 4 camadas de enforcement (guard de rota, navegação, elementos in-page e AUTORIZAÇÃO no backend), matriz de capacidade papel×tela, checklist pra planejar uma tela nova, e como adicionar um novo cargo. Use ao desenhar visibilidade por cargo, proteger rotas, decidir o que cada papel enxerga, modelar permissões, ou adicionar um nível de permissão — web, mobile ou API, com qualquer backend (RLS, policies, middleware, API gateway).
---

# Planejamento de telas por cargo (RBAC) — guia agnóstico

Como decidir **quem vê e quem pode fazer o quê** por papel, e manter isso coerente.
**Regra de ouro: esconder na UI ≠ segurança.** A trava real é a **autorização no backend**;
esconder no front é só UX. Planeje SEMPRE as duas pontas.

## 1. Modele os papéis em dois eixos

**Eixo A — Ladder (nível), aditivo:** cargos ordenados onde o de cima herda o de baixo.
```
L0 Visitante/anônimo → L1 Usuário → L2 Admin → L3 Super admin/owner
```
Regra: nível k pode tudo que k-1 pode + o seu. (Ex.: super admin é admin também.)

**Eixo B — Escopos e flags ORTOGONAIS** (não cabem no ladder): pertencem a um eixo separado e
**combinam** com o nível:
- **Multi-tenant/escopo**: o usuário pertence a uma ou mais org/workspace/time; pode haver
  modo "ver tudo" (cross-tenant) para papéis altos.
- **Capacidades pontuais**: "ver todos os registros" vs "só os meus", acesso por recurso
  (ex.: por canal/projeto/loja), feature flags/beta.

> Quase todo RBAC real = **ladder aditivo + algumas flags ortogonais**. Tentar enfiar tudo num
> único número de "nível" quebra; separe os dois eixos.

## 2. As 4 camadas de enforcement (planeje TODAS)

| # | Camada | Para quê | Onde (exemplos por stack) |
|---|---|---|---|
| 1 | **Guard de rota** | Bloquear a tela inteira; redirecionar quem não pode | wrapper de rota / route guard / middleware de página |
| 2 | **Navegação** | Não mostrar o caminho a quem não usa | menu/sidebar/tab condicional ao papel |
| 3 | **Elementos in-page** | Esconder/desabilitar botões, seções, colunas | render condicional / `disabled` por papel |
| 4 | **Autorização no backend** | **A trava de verdade** | RLS/row policies, middleware de API, checagem server-side, scopes de token |

⚠️ **Sem a camada 4, as 3 primeiras são cosméticas.** Quem souber a URL ou chamar a API
direto passa por 1–3. Camadas 1–3 = **UX** (não poluir com o que não serve); camada 4 =
**segurança**. As duas precisam existir e **concordar**.

## 3. Matriz de capacidade (papel × tela/ação) — o contrato

Monte uma tabela antes de codar. Cada célula precisa estar coerente nas 4 camadas.

| Tela / Ação | Usuário | Admin | Super admin | Guard | Backend (regra) |
|---|---|---|---|---|---|
| Listagem principal | ✅ (escopo dele) | ✅ | ✅ | autenticado | filtra por dono/tenant |
| Config do workspace | ❌/leitura | ✅ edita | ✅ | admin | tenant do admin |
| Gestão de equipe | ❌ | ✅ | ✅ | admin | — |
| Área administrativa global | ❌ | ❌ | ✅ | super admin | — |
| Ver registros de outros | flag "ver todos" | ✅ | ✅ | autenticado | policy por escopo |

## 4. Generalizando para N níveis (3, 4, 5+)

1. **Defina o ladder** e marque o que é **aditivo** (herda) vs **exclusivo**.
2. Para cada tela/ação, declare **OU** `nivelMinimo` (cargo mais baixo que acessa) **OU** um
   conjunto explícito `cargosPermitidos` (quando não é um ladder limpo).
3. **Inserir um nível no meio** deve ser barato (ex.: "Supervisor" entre Usuário e Admin =
   vê tudo do time mas não edita config) — por isso separe nível de flags.
4. **Default-deny**: na dúvida, **esconder (1–3) E negar (4)**. Liberar depois é aditivo e
   seguro; vazar é o risco.
5. Toda tela/ação nova entra na **matriz** e nas **4 camadas**.

### Checklist — adicionar um novo cargo
- [ ] **Definir o papel** na fonte de verdade (tabela de roles / claim no token), decidindo
      **aditivo vs exclusivo** e a posição no ladder.
- [ ] **Helper/hook** `isX` (e atualizar a herança: papel alto ⊇ baixo).
- [ ] **Guard de rota** `XRoute` (carregando → placeholder; sem permissão → redireciona).
- [ ] **Navegação**: itens de menu/abas condicionais ao novo papel.
- [ ] **In-page**: mostrar/ocultar/desabilitar elementos.
- [ ] **Backend (obrigatório)**: policy/middleware pro novo papel. Se for cross-tenant, a regra
      precisa considerar **pertencimento ao escopo**, não só "tenant primário" do perfil.
- [ ] **QA logado como CADA papel** (inclusive o novo) e nos escopos relevantes.

## 5. Gotchas (valem em qualquer app)

- **UI escondida não protege nada.** Sempre exista a checagem no backend; a UI só evita ruído.
- **Papéis aditivos**: telas que checam só "é admin?" precisam incluir o super admin/owner
  (que é admin também) — senão o topo da hierarquia fica de fora.
- **Multi-tenant é a maior fonte de bug**: autorização que olha só o "tenant primário" do
  perfil **bloqueia** quem opera em vários escopos (ou cujo tenant primário é nulo). Use
  **pertencimento ao escopo** ("o usuário tem acesso a este tenant/recurso?"), não só
  igualdade com um campo fixo do perfil.
- **Modo "ver tudo" / cross-tenant**: telas por-escopo devem **pedir seleção** (ou bloquear)
  quando não há escopo ativo, em vez de cair num default silencioso.
- **Falha de permissão parece bug de tela** (some, vem vazio, erro de policy). Quase sempre é
  **regra de autorização faltando/errada**, não a UI — audite a camada 4 primeiro.
- **Coerência entre camadas**: se a UI mostra um botão que o backend nega (ou esconde algo que
  o backend permite), é bug. A matriz (§3) é o que mantém isso alinhado.
- **Realtime de papel**: se o papel/escopo muda em runtime (promoção, troca de tenant), as
  camadas 1–3 devem reagir sem exigir refresh manual.

## Quando usar / não usar
- **Use** para planejar visibilidade por cargo, criar/proteger telas e rotas, modelar
  permissões ou adicionar níveis — em web, mobile ou API.
- Para a aplicação concreta num projeto específico, veja a skill RBAC daquele projeto (que
  aterrissa estas ideias nos arquivos/guards/policies reais).

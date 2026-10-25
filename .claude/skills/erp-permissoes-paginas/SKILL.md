---
name: erp-permissoes-paginas
description: Quem vê e faz o quê no ERP X-Life — usuários com vários papéis, papel principal (o que a RLS usa), permissões padrão por papel editáveis, permissões próprias, admin principal, usuário × funcionário (cadastro-mestre), criação de login sem convite, e páginas ligadas/desligadas por feature flag com o menu como fonte única. Use ao mexer em Usuários e Permissões, Funcionários, menu lateral, "Páginas do sistema", ou ao investigar "sumiu do menu"/"não consigo acessar".
---

# Permissões, usuários e páginas

Para planejar permissão nova em abstrato, use também `rbac-telas-por-cargo`.

## Duas camadas, que não se confundem

| Camada | Decide | Onde |
|---|---|---|
| **Navegação** | o que aparece no menu e quais botões a tela mostra | `can()` em `src/lib/store/auth-store.ts` |
| **Banco** | o que o usuário pode ler/gravar | RLS pelo **papel principal** (`erp_usuarios.role`) — skill `erp-banco-rls` |

Dar permissão de navegação não libera o banco.

## Usuário

`erp.erp_usuarios`: `role` (papel principal), `papeis[]` (todos), `permissoes` (jsonb próprio),
`admin_principal`, `ativo`, `loja_default_id`.

- **Funções (10/2026):** na tela, "papel" virou **função**, com os rótulos Usuário master
  (`admin` — a chave não mudou no banco nem nas edge functions), Gerente, Estoquista, Operador de
  caixa (`caixa`) e **Vendedor** (`vendedor`, migrations 111/112). Rótulos só em `roleLabels`.
  O vendedor tem no banco os direitos do operador de caixa; vende no próprio caixa ou no de
  alguém acima, nos caixas que o master liberar (`erp.pode_operar_caixa`, 113).
- **Papel principal = o mais alto** de `papeis` (admin > gerente > estoquista > caixa > vendedor).
  Um trigger garante que `role` está em `papeis`.
- **Permissão nova = backfill.** Quem tem `permissoes` próprio só tem o que está no objeto: uma
  permissão nova que passa a travar um botão já existente tira o botão dessa pessoa. A 112 fez
  isso para `caixa.sangria` (dada a quem já tinha `caixa.abrir`). Valor novo de enum: migration
  sozinha, e o uso dele na seguinte.
- **`can(perm)`**, nesta ordem: `admin_principal` → tudo; `permissoes` não vazio → vale só ele
  (`{"all": true}` é curinga); senão, a **união** das permissões padrão de cada papel.
- **Permissões padrão por papel:** `erp.erp_papel_permissoes`, editáveis na aba "Papéis e
  permissões padrão"; `ROLE_PERMISSIONS` no código é a reserva. Mudança vale no próximo login.
- ⚠️ Mudou o formato de `permissoes`? Teste o login do admin: um objeto que o `can()` não
  entende esconde o menu inteiro (aconteceu com `{"all": true}`).
- ⚠️ Teste permissão **trocando de usuário no mesmo navegador** (dono → sair → operador). O
  operador já herdou as telas de dono pelo cache; hoje o logout e o login limpam tudo e
  `useAdminPrincipal` tem o id na chave (skill `logout-limpa-sessao`).

## Usuário × funcionário

- **Usuários e Permissões é o cadastro-mestre**: "É funcionário" cria pessoa + vínculo
  (cargo, departamento, CPF, admissão) e o status "Funcionário ativo" (desmarcar = demissão
  com data; histórico preservado).
- **Funcionários** vincula a um login existente (puxa nome, e-mail, telefone, papéis) ou cria
  login novo. Salário e comissão só aqui. Sem vínculo, a venda sai sem vendedor e sem comissão.
- **Criar login:** edge `erp-create-user` (faz upsert em `erp_usuarios`), sempre **com senha**.
  Não há convite por e-mail: o link cairia na tela do CRM (a URL do site é compartilhada).
  E-mail que já tem login no CRM é aproveitado com a mesma senha.
- "Importar do CRM": logins do CRM sem perfil no ERP (`erp.usuarios_crm_disponiveis`).

## Páginas (feature flags)

- `erp.erp_feature_flags`: `path`, `ativo`, `is_protegida`, `somente_admin`, motivo e autor da desativação.
- **Fonte única do menu:** `sections` em `src/components/app-sidebar.tsx`. A tela "Páginas do
  sistema" (`src/pages/config.sistema.tsx`) é gerada dela: mesma seção › grupo › página.
  Flag sem item no menu cai em "Fora do menu"; item sem flag aparece como "sempre visível".
- Página desligada some do menu para todos; na URL direta, só o admin principal vê (com aviso).
- Tirar uma página: comente o item em `sections`, a rota e o import em `src/App.tsx`, com o motivo
  no comentário (padrão já usado para iFood e `/gestao`).
- Página nova: rota em `App.tsx`, item em `sections` com `perm` quando fizer sentido, e a flag
  (INSERT em `erp_feature_flags`) se ela precisar poder ser desligada.

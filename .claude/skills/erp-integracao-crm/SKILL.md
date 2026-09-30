---
name: erp-integracao-crm
description: Integração entre o ERP X-Life e o CRM da loja (mesmo banco Supabase) — venda/orçamento do ERP vira lead e campos personalizados no CRM e marca ganho, busca de lead e de login do CRM a partir do ERP, contrato da api-leads, fila erp_crm_sync e diagnóstico. Use quando a venda não aparece no CRM, ao mudar campos enviados, ao mexer na api-leads, ou ao ligar ERP e CRM de outra forma.
---

# ERP ↔ CRM

ERP (schema `erp`) e CRM (schema `public`) moram **no mesmo Postgres** e dividem o mesmo
`auth.users` (o mesmo login serve aos dois). O código do CRM está em `$CRM_REPO_DIR`.

## ERP → CRM (venda vira lead)

```
erp_vendas (INSERT finalizada) ─ trigger trg_crm_sync_venda ─▶ erp.erp_crm_sync (fila)
pg_cron "erp_crm_sync" a cada 5 min ─▶ erp.disparar_crm_sync() ─▶ edge erp-crm-sync
erp-crm-sync ─ POST ─▶ api-leads do CRM (URL e chaves em public.integrations, provider 'crm_leads')
```

- O **telefone** identifica o lead (só dígitos, DDI 55). Cliente sem celular/telefone → linha
  `ignorado` na fila.
- A chave de workspace sai do mapa loja → chave da integração; se o lead já existe em outro
  workspace, usa aquele (o telefone é único entre workspaces).
- O corpo leva: nome, etapa de venda (config `etapa_venda`), **`status: "won"` + `valor_ganho`**
  (total gasto pelo telefone, via `resumo_compras_telefone`) e campos personalizados pelo **nome**
  (config `campos`: última compra, produtos, valor, término estimado, compras, total gasto,
  data de nascimento). Campo vazio não é enviado para não apagar o que foi preenchido no CRM.
- O CRM exige `valor_ganho` ao marcar ganho (trigger `enforce_lead_status_rules`).

## CRM → ERP

- `erp.buscar_lead_crm(telefone)` — PDV acha o lead e pré-preenche o cadastro. `SECURITY DEFINER`,
  só para quem tem perfil no ERP; devolve nome, e-mail, CPF, workspace, etapa e status.
- `erp.usuarios_crm_disponiveis()` — logins do CRM sem perfil no ERP (só admin); usado em
  "Importar do CRM" e no cadastro de usuário/funcionário.
- Normalização de telefone: `erp.telefone_normalizado()`.

## Contrato da `api-leads` (repo do CRM)

`supabase/functions/api-leads/index.ts` no `$CRM_REPO_DIR`. POST faz upsert por telefone;
PATCH atualiza. Aceita `nome, email, status, valor_potencial, valor_ganho, funil, etapa`
(id ou nome), `campos` ({nome do campo: valor}) e `atividade`.
Mudar a `api-leads` = commit **no repo do CRM** (que vai para várias VPS), não no ERP.

## Diagnóstico

```sql
SELECT created_at, status, tentativas, left(detalhe, 160)
  FROM erp.erp_crm_sync ORDER BY created_at DESC LIMIT 10;
```

| status | Significa |
|---|---|
| `pendente` | ainda não rodou, ou erro 5xx com retentativa (até 5) |
| `processado` | lead criado/atualizado |
| `ignorado` | sem telefone, ou loja sem chave no mapa |
| `erro` | 4xx ou resposta sem lead — ver `detalhe` |

Teste ponta a ponta: venda em homologação com cliente com celular → em até 5 min o lead na etapa
de venda, ganho e com o valor.

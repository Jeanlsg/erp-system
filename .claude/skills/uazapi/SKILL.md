---
name: uazapi
description: >
  Referência completa da API uazapiGO (uazapi) — integração WhatsApp via HTTP.
  Use para QUALQUER dúvida sobre integração com a UAZAPI: conectar/gerenciar instância
  (QR/pareamento, status, proxy), enviar mensagens (texto, mídia, botões, lista, enquete,
  carrossel, PIX, localização, contato, status/stories), webhooks e SSE, eventos e seu
  payload, CRM/leads, etiquetas, grupos e comunidades, newsletters/canais, contatos,
  chats, respostas rápidas, mensagem em massa (sender), fila async, chamadas, Chatwoot,
  Business/catálogo e endpoints administrativos. O contrato OpenAPI 3.1 completo está em
  reference/uazapi-openapi.yaml. Acione esta skill quando o usuário falar em uazapi,
  uazapiGO, "mandar mensagem pelo whats via API", webhook do whats, instância, token de
  instância, ou debugar envio/recebimento via essa API.
---

# uazapiGO (UAZAPI) — referência de integração

API HTTP para gerenciar instâncias do WhatsApp e enviar/receber mensagens.
O contrato OpenAPI 3.1 completo (todos os endpoints, schemas, exemplos de request/response
e códigos de erro) está bundleado em **[reference/uazapi-openapi.yaml](reference/uazapi-openapi.yaml)**.

> Para qualquer dúvida específica (parâmetros exatos, formato do body, códigos de erro de um
> endpoint), **abra `reference/uazapi-openapi.yaml`** e busque pelo `path` ou `operationId`.
> Este SKILL.md é o índice/atalho; o YAML é a fonte da verdade.

## Como navegar a referência

O YAML é grande (~17k linhas). Para achar um endpoint rápido:
- Busque por `operationId:` (ex.: `sendText`, `connectInstance`, `findChats`).
- Ou pelo `path` literal (ex.: `/send/media`, `/chat/find`).
- Schemas reutilizados ficam em `components.schemas` no topo: `Instance`, `Webhook`, `Chat`,
  `Message`, `Label`, `Attendant`, `MessageQueueFolder`, `QuickReply`, `Group`,
  `GroupParticipant`, `WebhookEvent`.

## Fundamentos

**Base URL**: `https://{subdomain}.uazapi.com` onde `subdomain` é `free` (demo) ou `api` (produção).
Em self-host, é o domínio do seu servidor uazapi.

**Autenticação** (headers):
- `token: <token-da-instância>` — quase todos os endpoints (escopo da instância).
- `admintoken: <admin-token>` — endpoints administrativos (criar/listar instâncias, webhook global, restart, rotacionar token).

**Estados da instância** (`status`): `disconnected` · `connecting` · `connected`.

**Limites**: servidor tem máximo de instâncias conectadas; ao estourar → HTTP `429`.
Restrição do WhatsApp para iniciar conversas novas → erro com `provider_code: 463`;
diagnostique em `GET /instance/wa_messages_limits`.

## Mapa de endpoints (por área)

### Instância (token) — ciclo de vida
- `POST /instance/connect` — conecta; sem `phone` gera **QR code**, com `phone` gera **código de pareamento**. Aceita proxy regional (`proxy_managed_country/state/city`).
- `GET /instance/status` — status + QR/paircode atualizado.
- `POST /instance/disconnect` · `POST /instance/reset` (reinicia runtime preso) · `DELETE /instance` (deleta).
- `POST /instance/updateInstanceName` · `POST /instance/presence` (available/unavailable).
- `GET|POST /instance/privacy` — config. de privacidade da conta.
- `GET /instance/wa_messages_limits` — diagnóstico de limites de novas conversas (erro 463).
- Proxy: `GET|POST /instance/proxy` (modos `custom`/`internal`/`none`, fallback); `GET /proxy-managed/cities`.

### Administração (admintoken)
- `POST /instance/create` — cria instância (retorna token). `GET /instance/all` — lista todas.
- `POST /instance/updateAdminFields` — adminField01/02.
- `GET|POST /globalwebhook` · `GET /globalwebhook/errors` — webhook global de todas as instâncias.
- `POST /admin/restart` — reinicia a aplicação (reconecta todas). `POST /admin/token/rotate` — novo admintoken (1x/24h).

### Perfil (token)
- `POST /profile/name` · `POST /profile/image`.

### Enviar mensagem (token) — `/send/*` e `/message/presence`
Campos opcionais comuns a TODOS: `delay` (ms, mostra "digitando"), `readchat`, `readmessages`,
`replyid`, `mentions` (`"all"` ou números), `forward`, `track_source`, `track_id`, `async`,
`viewOnce` (mídia compatível). Suportam **placeholders** (`{{name}}`, `{{first_name}}`,
`{{lead_email}}`, `{{lead_field01..20}}`, ou nomes definidos em `/instance/updateFieldsMap`).
Envio p/ grupo: `number` terminando em `@g.us`. Envio p/ canal: `number` `@newsletter`.
- `POST /send/text` (com link preview custom) · `POST /send/media` (`image|video|videoplay|document|audio|myaudio|ptt|ptv|sticker`).
- `POST /send/contact` (vCard) · `POST /send/location` · `POST /send/location-button` (solicita localização).
- `POST /send/menu` (button/list/poll/carousel) · `POST /send/carousel` (mesmo carrossel, outro payload).
- `POST /send/status` (stories: text/image/video/audio; audiência por `recipients`/`max_recipients`).
- `POST /send/request-payment` · `POST /send/pix-button`.
- `POST /message/presence` — composing/recording/paused (assíncrono, até 5 min).

### Fila async de envio direto (token) — `async=true`
- `GET /message/async` (status) · `DELETE /message/async` (limpa/cancela backlog) · `POST /instance/updateDelaySettings` (delay entre msgs async).

### Ações na mensagem e busca (token)
- `POST /message/find` — busca por `chatid`/`id`/`track_*`, com paginação (`limit`/`offset`).
- `POST /message/download` — baixa mídia (base64/URL, MP3/OGG, transcrição via OpenAI, `download_quoted`).
- `POST /message/history-sync` — pede histórico antigo (`mode: history|exact`).
- `POST /message/markread` · `POST /message/react` · `POST /message/delete` (p/ todos) · `POST /message/edit` · `POST /message/pin`.

### Chats (token)
- `POST /chat/find` — busca com filtros (operadores `~ !~ != >= > <= <`), sort, paginação. **`wa_label` filtra por ID da label, não pelo nome.**
- `POST /chat/details` — todos os campos do chat + imagem. `POST /chat/check` — verifica se números têm WhatsApp.
- `POST /chat/delete` (DB/WhatsApp) · `POST /chat/archive` · `POST /chat/read` · `POST /chat/mute` · `POST /chat/pin` · `POST /chat/ephemeral`.
- Notas internas: `POST /chat/notes` · `/chat/notes/refresh` · `/chat/notes/edit`.

### CRM / Leads (token)
- `POST /chat/editLead` — edita lead do chat (status, tags, atendente, kanban, `lead_field01..20`, `chatbot_disableUntil`).
- `POST /instance/updateFieldsMap` — nomeia os 20 campos customizados (vira placeholder).

### Contatos (token)
- `GET /contacts` · `POST /contacts/list` (paginado, `contactScope`) · `POST /contact/add` · `POST /contact/remove`.

### Etiquetas (token)
- `GET /labels` · `POST /labels/refresh` (recarrega do WhatsApp) · `POST /label/edit` (criar com `labelid:"new"`, editar, deletar) · `POST /chat/labels` (aplica/add/remove no chat).

### Bloqueios (token)
- `POST /chat/block` · `GET /chat/blocklist`.

### Grupos e Comunidades (token)
- `POST /group/create` · `POST /group/info` · `POST /group/inviteInfo` · `POST /group/join` · `POST /group/leave`.
- `GET /group/list` · `POST /group/list` (paginado/filtros) · `POST /group/resetInviteCode`.
- Config: `/group/updateAnnounce` · `/updateJoinApproval` · `/updateMemberAddMode` · `/updateDescription` · `/updateName` · `/updateImage` · `/updateLocked` · `/ephemeral` · `/updateParticipants` (add/remove/promote/demote/approve/reject).
- Comunidade: `POST /community/create` · `POST /community/editgroups`.

### Newsletters / Canais (token)
- `POST /newsletter/create|info|link|messages|updates|viewed|reaction|follow|unfollow|mute|unmute|delete|picture|name|description|settings|search|subscribe`.
- Admin do canal: `/newsletter/admin/invite|accept|remove|revoke` · `/newsletter/owner/transfer`.
- Editar/apagar post: `/newsletter/messages/edit` · `/newsletter/messages/delete` (NÃO use `/message/edit|delete` em canal).

### Respostas Rápidas (token)
- `POST /quickreply/edit` (criar/atualizar/excluir) · `GET /quickreply/showall`. (Só armazena; a aplicação aplica.)

### Chamadas (token)
- `POST /call/make` (toca, sem áudio real; `call_duration` opcional) · `POST /call/reject`.

### Mensagem em massa / Sender (token)
- `POST /sender/simple` · `POST /sender/advanced` (cria campanha) · `POST /sender/edit` (stop/continue/delete).
- `POST /sender/cleardone` · `DELETE /sender/clearall` · `GET /sender/listfolders` · `POST /sender/listmessages`.

### Webhooks e SSE
- `GET /webhook` — config atual. **Retorna sempre um ARRAY**, mesmo com 1 webhook.
- `POST /webhook` — cria/atualiza. Modo simples (sem `action`/`id`) gerencia 1 webhook; modo avançado usa `action: add|update|delete`.
- `GET /webhook/errors` — últimos 20 erros de entrega (memória).
- `GET /sse` — Server-Sent Events em tempo real (`?token=...&events=chats,messages`).

### Integração Chatwoot (BETA, token)
- `GET|PUT /chatwoot/config`.

### Business / Catálogo (EXPERIMENTAL, token)
- `POST /business/get/profile` · `GET /business/get/categories` · `POST /business/update/profile`.
- Catálogo: `/business/catalog/list|info|delete|show|hide`.

## Webhook — eventos e prevenção de loop

Eventos disponíveis: `connection`, `history`, `messages`, `messages_update`,
`newsletter_messages`, `call`, `contacts`, `presence`, `groups`, `labels`, `chats`,
`chat_labels`, `blocks`, `sender`.

⚠️ **Para evitar loop em automações que enviam via API, sempre inclua**
`"excludeMessages": ["wasSentByApi"]` no webhook. Outros filtros: `wasNotSentByApi`,
`fromMeYes`, `fromMeNo`, `isGroupYes`, `isGroupNo`.

Opções de URL: `addUrlEvents` (acrescenta o evento no path) e `addUrlTypesMessages` (acrescenta o tipo da msg).
Views/reactions de **canal** NÃO vêm por webhook — consulte `POST /newsletter/updates`.

## Armadilhas conhecidas (já vistas em produção)

- `GET /webhook` devolve **array** — trate `[0]`, não objeto direto.
- `/chat/find` com `wa_label`: passe o **ID** da etiqueta (de `/labels`), não o nome.
- Mídia baixada via `/message/download` fica no storage só ~2 dias; depois rebaixa do CDN da Meta (mais lento).
- Mensagens com mais de 7 dias são apagadas na madrugada; histórico antigo via `/message/history-sync`.
- `presence: unavailable` sendo o único device ativo → você não recebe ticks de entrega/leitura (`messages_update`).
- `async=true` responde 200 ao enfileirar; falha real aparece depois em `/message/find` com `status=failed`.
- Newsletters usam rotas próprias; nunca `/message/edit` ou `/message/delete` em canal.

## Contexto no projeto Overdrive

No CRM Overdrive, a recepção é via webhook UAZAPI → tabela `mensagens`, e o envio via
`uazapiService`. Para detalhes do app, veja as skills `overdrive-integrations` (conectar
instância/webhook), `overdrive-chat` (envio/recepção) e `overdrive-incident-response`
(mensagem não chega). Esta skill cobre o **contrato da API** em si.

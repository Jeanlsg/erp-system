# Varredura de segurança — ERP X-Life — 03/11/2026

Escopo: repositório no commit `533b3ba` (mais a senha temporária, ainda não publicada), site https://erp.lojaxlife.com.br,
Supabase self-hosted (o mesmo do CRM) lido com a chave pública e, no banco, só leitura pela VPS.
Ferramentas: scripts da skill varredura-seguranca (repositório, histórico do git, `npm audit`, site, Supabase) e revisão manual.

## Resumo

0 altos · 5 médios · 9 baixos. O mais urgente: **o login não tem limite de tentativas**. Nada conta senha errada
(`tentativas_login` nunca sobe) e a `erp-login` (CPF) também não limita, então dá para tentar senhas sem parar.

O banco está em ordem. Uma conta que é só do CRM lê **0 linhas** das 127 tabelas e views do ERP. Nenhuma policy está
aberta, toda tabela tem RLS, a anon não tem acesso a nada do `erp` e o cadastro público está desligado.

## Achados

| # | Sev. | ID | O quê | Onde | Como corrigir | Status |
|---|---|---|---|---|---|---|
| 1 | média | E30 · M05 | **Login sem limite de tentativas.** Nada incrementa `erp_usuarios.tentativas_login`. A `erp-login` chama o GoTrue sem limite próprio, e todas as tentativas chegam lá com o IP da função: ou não há limite, ou um ataque tranca o login por CPF de todo mundo. O GoTrue de produção está no padrão (nenhum `GOTRUE_RATE_LIMIT_*`). Senhas antigas de 6 caracteres seguem valendo, e o CPF de um funcionário é fácil de conseguir. A `erp-login` também responde mais rápido quando o CPF não tem login, o que deixa descobrir quais CPFs têm acesso. | `supabase/functions/erp-login/index.ts`, `src/lib/store/auth-store.ts` | Tabela de tentativas no `erp` (por CPF/e-mail e por IP, janela de 15 min). A `erp-login` recusa depois de N erros, grava cada erro e espera um tempo fixo também para CPF desconhecido. O login por e-mail passa pelo mesmo contador (RPC ou edge). Conferir e ajustar os limites do GoTrue, que é do CRM também. | confirmado |
| 2 | média | E53 | **XSS na impressão.** A etiqueta do "Gerar Código de Barras" escreve `nome`, `sku` e código do produto sem escapar; o relatório de devolução a fornecedor escreve o nome do fornecedor e da filial do mesmo jeito. A janela de impressão é da mesma origem do ERP: um `<img onerror>` no nome lê a sessão do `localStorage` e toma a conta de quem imprimiu. O nome vem do cadastro (um estoquista pode digitar) ou do XML da NF-e do fornecedor (`xProd`, `xNome`). | `src/pages/gesta-final.tsx:356`, `src/pages/devolucao-fornecedor.tsx:488` | Usar o `esc()` que as outras impressões já usam (`ficha-produto.ts`, `relatorio-contadora.ts`). | confirmado |
| 3 | média | S03 · E103 | **Cabeçalhos de segurança não chegam à página.** O `nginx.conf` põe X-Frame-Options, nosniff e Referrer-Policy no `server`, mas o `add_header` do `location = /index.html` apaga todos, e `/` cai nele. O site no ar sai sem nenhum: dá para embutir o ERP num iframe (clickjacking). Não há CSP, HSTS nem Permissions-Policy, e o `Server` mostra a versão do nginx. | `nginx.conf` | Arquivo de headers incluído em cada `location`, mais CSP (`default-src 'self'` com o domínio do Supabase), HSTS e `server_tokens off`. Testar o PDV e a impressão com a CSP antes de publicar. | confirmado |
| 4 | média | B09 · E13 · E14 | **Bucket `midias` público aceita qualquer arquivo de qualquer login.** Limite de 50 MB e nenhuma lista de tipos. A policy de INSERT só confere o bucket, então vale para qualquer usuário autenticado, inclusive os só do CRM. HTML e SVG ficam numa URL pública do Supabase (phishing). | storage `midias` (policy "Permitir upload para usuários autenticados") | Lista de tipos (imagem, áudio, vídeo, PDF) e upload só para quem usa. O bucket parece ser do CRM: **combinar antes**. | confirmado |
| 5 | média | E02 | **O `.gitignore` não cobre certificado nem chave** (`*.pfx`, `*.p12`, `*.pem`, `*.key`, credencial de conta de serviço, `*.map`). O ERP lida com o certificado A1 da loja: um `.pfx` salvo na pasta do projeto entraria no próximo commit. | `.gitignore` | Acrescentar os padrões. | confirmado |
| 6 | baixa | M09 | Duas funções do banco só conferem se é usuário do ERP. Pela `aplicar_entrada_pedido`, qualquer um lança entrada em caixa aberto de qualquer filial. Pela `baixar_lote_vencido`, qualquer um zera lote vencido de qualquer filial, sem precisar da permissão de ajustar estoque. Fica o `usuario_id` em cada registro. | `erp.aplicar_entrada_pedido`, `erp.baixar_lote_vencido` | `pode_operar_caixa(p_caixa_id)` na primeira; `usuario_tem_permissao('estoque.ajustar')` e a filial do lote na segunda. | confirmado |
| 7 | baixa | E63 | O `FeatureGuard` libera a tela enquanto as páginas ligadas/desligadas carregam, e também se a leitura falhar: página desligada aparece por um instante, ou de vez se a consulta falhar. Os dados continuam protegidos pela RLS; é só a tela. | `src/components/feature-guard.tsx:29` | Tela neutra enquanto carrega; erro de leitura = página bloqueada para quem não é o dono. | confirmado |
| 8 | baixa | E120 | Dependências: `react-router-dom` 6.30.1 (open redirect com barra invertida em `<Link>`/`navigate`), `zod` 3 (memória com coleção enorme; só no front), `fast-xml-parser` 4 (falha no XMLBuilder, que o ERP não usa para montar XML), `source-map-js`/`postcss-selector-parser` (só no build). | `package.json` | `npm audit fix` para o que não muda de versão maior; react-router na última 6.x. | confirmado |
| 9 | baixa | — | A regra nova de senha (8 caracteres, letras e números, igual ao CRM) vale nas telas e edges do ERP, mas o servidor de login aceita 6. Quem chamasse a API do GoTrue direto criaria uma senha fraca. | serviço `auth` na VPS | `GOTRUE_PASSWORD_MIN_LENGTH=8` e `GOTRUE_PASSWORD_REQUIRED_CHARACTERS` (afeta o CRM, que já usa a mesma regra nas telas). | confirmado |
| 10 | baixa | E101 | `erp-email-campanha` devolve `String(e)` no erro 500. | `supabase/functions/erp-email-campanha/index.ts:143` | Logar e responder texto genérico. | confirmado |
| 11 | baixa | E104 | Não há `.dockerignore`: o estágio de build copia `.git` e um `.env` que esteja na pasta. A imagem final só leva o `dist`. | `Dockerfile` | `.dockerignore` com `.git`, `.env*`, `docs/`, `node_modules`. | confirmado |
| 12 | baixa | E13 · B09 | O bucket `branding` aceita SVG (a escrita é só de quem edita a marca). Os buckets `avatares`, `certificados` e `fiscal` não têm limite de tamanho. A policy global "update/delete own objects" deixa quem subiu um certificado apagá-lo mesmo depois de perder `config.editar`. | storage | Tirar SVG do `branding`; limite de tamanho nos buckets; policy de dono só nos buckets que precisam. | confirmado |
| 13 | baixa | B03 · B02 · B10 | `public.app_branding` (tema do login do CRM) é legível sem login, aparece no OpenAPI e no GraphQL, e expõe `updated_by` e `id_workspace`. | schema `public` (CRM) | Do CRM: aceitar com motivo, ou servir só as cores. | do CRM |
| 14 | baixa | E56 | A busca de produto põe o texto digitado dentro do `.or()`: uma vírgula ou um parêntese quebra a busca. A RLS continua valendo. | `src/lib/supabase-queries.ts:240` | Escapar `,()` ou trocar por `ilike` separado. | confirmado |

## Falsos positivos e riscos aceitos (em `.varredura-ignorar`)

- **E01** `supabase/COMO_APLICAR_MIGRATIONS.md:94`: a "senha" da URL de exemplo é `...`.
- **E21/E22/E23** (~150 avisos): vêm das migrations 001–028, que foram substituídas depois. No banco vivo: nenhuma
  policy `true`, RLS ligada nas 105 tabelas, a anon sem privilégio em nada do `erp`, as 15 views sem `security_invoker`
  todas com filtro de usuário do ERP, e nenhuma função SECURITY DEFINER sem `search_path`.
- **B07** `mailer_autoconfirm: true`: o cadastro público está desligado (`disable_signup: true`), só o admin cria conta.
- **E08** sessão no `localStorage`: padrão do SDK. É por isso que o achado 2 importa.
- **E30** `erp-reset-password` e `erp-consultar-cadastro`: só admin ativo chama.

## O que está em dia (não regredir)

- Conta só do CRM lê 0 linhas de 127 tabelas e views do ERP (simulado no banco, numa transação só de leitura); o admin, como controle, lê de 50.
- Toda edge `erp-*` confere quem chama: criar, excluir e trocar senha só com admin ativo, e a conta do dono só pelo próprio dono. A `erp-login` é pública de propósito e devolve mensagem genérica.
- Nenhum segredo no repositório nem no histórico do git; o bundle não traz chave de serviço; sem source map publicado.
- O site não expõe `.git` nem `.env` (devolve o index da SPA).
- Buckets `certificados` e `fiscal` privados, com policy por permissão e filial.
- Cadastro público do Supabase desligado.

## Não verificado (e por quê)

- **M12 (a tela nunca vaza)** com conta sem acesso, rede lenta e API bloqueada: precisa do navegador e de uma conta de
  teste (`ERP_TESTE_EMAIL` não está no `.env`).
- **Limites reais do GoTrue** (quantas tentativas e qual IP ele enxerga atrás do Kong): medir exigiria martelar o login de produção.
- **B04 com token real**: feito pela simulação no banco, não pela API.
- **M06 limites de gasto**: o ERP não chama IA; SEFAZ não cobra por chamada.
- **M11** permissões do `.env` na VPS.

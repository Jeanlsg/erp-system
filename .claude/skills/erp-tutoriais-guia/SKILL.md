---
name: erp-tutoriais-guia
description: Gerar e atualizar os tutoriais com print de cada tela do ERP X-Life e o guia "Primeiros passos" em PDF para o cliente — dados de demonstração, captura com Playwright, limpeza depois, e as regras para nenhum dado real aparecer. Use quando uma tela mudou e o tutorial ficou velho, quando faltar tutorial de uma página, ou para regerar o PDF do cliente.
---

# Tutoriais e guia do cliente

## Peças

| Peça | Onde |
|---|---|
| Conteúdo dos tutoriais (gerado, **não editar à mão**) | `src/content/tutoriais.json` |
| Imagens | `public/tutorial/*.jpeg` |
| Texto do "?" de cada página (objetivo curado) | `src/lib/ajuda-paginas.ts` |
| Gerador | `scripts/gerar-tutoriais.mjs` |
| Dados fictícios para os prints | `scripts/dados-demonstracao.sql` |
| Guia do cliente | `docs/guia/primeiros-passos.html` (marcadores `IMG:nome`), `docs/guia/gerar-pdf.mjs`, `docs/guia/COMO-REGERAR.md` |

O PDF (`docs/*.pdf`) fica fora do git: o `.gitignore` ignora `*.pdf`.

## Regerar tutoriais

1. **Só com dados fictícios.** Em banco limpo, aplique `scripts/dados-demonstracao.sql`
   (nomes com "Exemplo", CPF/CNPJ com dígitos repetidos; inclui produto abaixo do mínimo, conta
   vencida, compra pendente e pedido LGPD para as telas não aparecerem vazias).
2. Conta de **teste** criada para isso (`ERP_TESTE_EMAIL`/`ERP_TESTE_SENHA` no `.env`).
3. Rodar:
   ```bash
   ERP_URL="$ERP_URL" ERP_EMAIL="$ERP_TESTE_EMAIL" ERP_SENHA="$ERP_TESTE_SENHA" \
     node scripts/gerar-tutoriais.mjs /rota-1 /rota-2   # sem rotas = todas; com rotas preserva as demais
   ```
   Precisa do Playwright (instale fora do repo; ver `erp-testes`).
4. O gerador **nunca clica** em botão perigoso (emitir, excluir, enviar, confirmar, receber…):
   descreve e marca como "ação com efeito real".
5. **Limpar depois:** `scripts/virada-producao.sql` apaga os dados fictícios e preserva logins,
   lojas, certificados e config SEFAZ. Em produção só com confirmação do usuário, e ensaiado num
   clone (skill `erp-banco-rls`). Desativar a conta de teste.
6. Conferir os prints antes de commitar: nenhum nome, e-mail ou documento real, nem o nome da
   conta de teste.

## Guia em PDF

Siga `docs/guia/COMO-REGERAR.md`. Confirme com o usuário o plano seção a seção antes de gerar o
documento comercial.

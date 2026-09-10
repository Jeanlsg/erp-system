# Sessão 09 — Acesso e sistema

Data: 10/09/2026 · Ambiente: **produção** · Testado por: agente

São as telas de borda: as que aparecem antes do login, quando o link expira ou quando o endereço não existe. Foram testadas em contexto **deslogado**, salvo o Setup.

Prints: [login](prints/09-acesso-sistema/01-login-inicial.jpeg) · [senha incorreta](prints/09-acesso-sistema/01-login-senha-errada.jpeg) · [redefinir senha](prints/09-acesso-sistema/02-redefinir-senha.jpeg) · [setup já configurado](prints/09-acesso-sistema/03-setup-ja-configurado.jpeg) · [404](prints/09-acesso-sistema/04-404.jpeg)

| Página | Função | O que deveria fazer | Resultado | Status |
|---|---|---|---|---|
| Login | tela inicial | formulário de acesso | ERP X-Life Acesse o sistema para operar o PDV, gerir estoque, emitir notas fiscais e acomp | ✅ |
| Login | senha incorreta | recusar sem revelar se o e-mail existe | E-mail ou senha inválidos | ✅ |
| Login | enviar vazio | não autenticar | permanece no login | ✅ |
| Acesso | rota protegida sem login | redirecionar para o login | redirecionou para /login | ✅ |
| Login | recuperação de senha | oferecer caminho para redefinir | link presente: "Esqueci minha senha" | ✅ |
| Redefinir senha | abrir sem token do e-mail | explicar que o link é inválido/expirado | Redefinir Senha Digite sua nova senha abaixo. Nova Senha Confirmar Senha Redefinir SenhaVoltar para o login | ✅ |
| 404 | rota inexistente | mostrar página não encontrada com saída | Página não encontrada O endereço /rota-que-nao-existe-auditoria não existe neste sistema. Verifique o link ou  | ✅ |
| Setup | abrir com lojas já cadastradas | avisar que o sistema já está configurado | Sistema já configurado Já existem 2 lojas cadastradas (Juazeiro, Petrolina). Para adicionar outra loja ou fili | ✅ |

## Problemas encontrados

- **[BUG-09-01] Redefinir senha sem link válido só falha ao submeter, com erro em inglês** · Severidade: **média**
  Passos: abrir `/auth/redefinir-senha` direto (ou por um link de e-mail já expirado) → digitar a nova senha → Redefinir.
  Esperado: avisar de saída que o link é inválido ou expirou, com caminho para pedir outro.
  Obtido: o formulário abre normalmente, aceita a senha e só então mostra **"Erro: Auth session missing!"** — mensagem crua do Supabase Auth, em inglês, sem dizer o que fazer.
  Impacto: link de recuperação expira em pouco tempo; quem tentar reusar vai digitar a senha duas vezes para receber um erro técnico. É o tipo de tela que gera chamado de suporte porque o usuário não entende se a culpa é da senha, do e-mail ou do sistema.
  Correção sugerida: ao montar a tela, verificar se existe sessão de recuperação; sem ela, trocar o formulário por "Este link é inválido ou expirou — peça um novo em Esqueci minha senha", com o botão de voltar. E traduzir o erro residual.

### Pontos verificados que passaram
- **Senha incorreta** devolve "E-mail ou senha inválidos" — não revela se o e-mail existe, que é o comportamento correto para não vazar cadastro.
- **Rota protegida sem login** (`/pdv`) redireciona para `/login`.
- **404** mostra o endereço tentado e caminho de volta.
- **Setup** com lojas cadastradas avisa "Sistema já configurado. Já existem 2 lojas (Juazeiro, Petrolina)" em vez de oferecer novo cadastro — a correção feita antes desta auditoria segue de pé.
- **"Esqueci minha senha"** está presente na tela de login.

### Resumo da sessão
4 páginas | 8 funções verificadas (8 ✅) | 1 problema (médio)
Páginas novas descobertas: nenhuma.


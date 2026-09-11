# Auditoria funcional do ERP X-Life — relatório final

Data: 10/09/2026 · Ambiente: **produção** (`erp.lojaxlife.com.br`) — não existe homologação
Executado por: agente, com a conta temporária `demo.admin@lojaxlife.com.br`
Documentos por sessão: [01 contagem](01-contagem-paginas.md) · [01 balcão](01-vendas-balcao.md) · [02 venda mais](02-venda-mais.md) · [03 estoque](03-estoque.md) · [04 cadastros](04-cadastros.md) · [05 financeiro](05-financeiro.md) · [06 fiscal](06-fiscal.md) · [07 início](07-atendimento-inicio.md) · [08 configurações](08-configuracoes.md) · [09 acesso](09-acesso-sistema.md) · [fase 5](10-fase5-paginas-desativadas.md)

---

## 1. Contagem final

| | Aprovado na Fase 1 | Ao final |
|---|---|---|
| Total de páginas | 89 | **81** |
| Ativas (no menu) | 46 | **42** |
| Atrás de flag | 37 | 38 |
| Só no código (comentadas) | 5 | 9 |
| Ocultas/órfãs | 2 | **0** |

A diferença vem de decisões tomadas durante o trabalho, não de erro de contagem:

- **iFood** (2 telas) saiu a pedido do cliente — código comentado, reativável
- **Dinheiro, Cartão de Crédito, Cartão de Débito, Recebimento Cheque** (4) saíram por duplicarem *Relatórios Financeiros › Formas*
- **As 2 órfãs foram removidas** (detalhe na seção 7)

Nenhuma página nova foi descoberta depois da Fase 1.

## 2. Cobertura

- **46 de 46 páginas ativas** auditadas (100%), em 9 sessões
- **27 das 38 desativadas** auditadas na Fase 5 — as que podem realmente funcionar
- **254 capturas de tela** (desktop, mobile, cada modal e cada aba)
- **42 páginas com tutorial** e **42 com modo demonstração** — todas as ativas do perfil administrador
- Cerca de **200 funções verificadas**, cada uma com o efeito observado, não suposto

## 3. Bugs encontrados — todos corrigidos e verificados

| # | Severidade | O que era | Como se manifestava |
|---|---|---|---|
| 01 | **crítica** | Tela de Vendas nunca listou nada | 34 vendas no banco, tela dizia "Nenhuma venda encontrada" |
| 02 | alta | Caixa e "Caixas em Aberto" vazios | 3 caixas no banco, nada aparecia |
| 03 | alta | Remessas com a mesma falha | idem |
| 05 | alta | Fechamento de caixa não somava o movimento | esperado em gaveta = só o saldo inicial; **todo fechamento acusaria quebra** |
| 06 | média | Entrada extra não atualizava o esperado | valor gravado, tela desatualizada |
| 04-01 | alta | Cadastrar funcionário **sem CPF** sempre falhava | erro cru do Postgres em inglês; zero registros com o marcador provam que nunca funcionou |
| 05-01 | média | Ticket médio com denominador errado | R$ 121,12 em vez de R$ 126,89 — subestimado, e "plausível" demais para alguém notar |
| 06-01 | alta | Salvar Configurações SEFAZ **duplicava** a configuração | com 2 linhas, a emissão de nota da loja parava com "configuração ausente" |
| 09-01 | média | Redefinir senha falhava só ao submeter, em inglês | link expirado → "Auth session missing!" |
| F5-01 | média | Transportadoras e Regiões nunca listavam nem cadastravam | filtro por coluna inexistente; telas desalinhadas do banco |
| **F5-02** | **crítica** | **Campos de dinheiro multiplicavam o valor por 100** | digitar `149,90` gravava **R$ 14.990,00**, sem erro nenhum — 27 campos em 13 telas |

**11 bugs reais, 2 deles críticos.** Mais 1 falso positivo descartado após investigação (botões de Sangria/Entrada Extra, que estavam corretamente desabilitados sem caixa aberto).

### O que esses bugs têm em comum
Sete dos onze **falhavam em silêncio**: a tela mostrava "sem registros", um número plausível ou nada — nunca um erro. É o tipo de defeito que sobrevive a qualquer inspeção visual e só aparece quando alguém executa o fluxo e confere o resultado contra o banco. Foi o que esta auditoria fez.

## 4. O que foi provado funcionando

- **NFC-e autorizada pela SEFAZ** em homologação: nota #3, `cStat 100`, protocolo `329260000149953`
- **Venda completa no PDV**: abrir caixa → carrinho → pagamento → finalizar → baixa de estoque no kardex
- **Fechamento de caixa** conferindo: R$ 200 + R$ 3,00 − R$ 30 + R$ 80 = **R$ 253,00**
- **Comissão** nascendo sozinha na venda (R$ 0,30 = 10% de R$ 3,00) e sendo paga em lote
- **SPED** gerando EFD ICMS/IPI com 57 linhas e avisos úteis
- **Consulta de cadastro na SEFAZ** (IE 233978558, habilitado)
- **Devolução** carregando itens da venda e bloqueando até marcar algo
- KPIs de Dashboard e Relatórios **batendo com o banco**

## 5. Funções não testadas e por quê

| Função | Motivo |
|---|---|
| Busca de notas recebidas (DF-e) | **Limitação da SEFAZ**: o Ambiente Nacional não devolve documentos de homologação. Só testável após a virada para produção |
| Cancelamento de NF-e autorizada, inutilização de numeração | Efeito fiscal irreversível; evitados para não sujar a numeração |
| Envio de nota por e-mail/WhatsApp ao cliente | Efeito externo real — mandaria mensagem para número/e-mail de terceiro |
| Disparo de campanha de e-mail | idem |
| Boletos, SMS, TEF, iFood | Dependem de contratação que não existe (ver seção 6) |

## 6. Páginas sem provedor — agora avisam em vez de fingir

Telas que dependem de serviço externo mostravam a lista vazia como se estivessem funcionando. Agora exibem o que falta, como ativar e a alternativa disponível:

- **Boletos** → convênio bancário; enquanto isso, Promissórias e Crediário Próprio
- **Torpedos SMS** → gateway pago por mensagem; o WhatsApp da loja já está conectado
- **Mala Direta** → só a parte impressa depende de gráfica; **o e-mail já funciona** (Resend, ~3.000/mês no plano gratuito)
- **TEF/SITEF** → já explicava a exigência no próprio formulário

## 7. Recomendações por página órfã ou inativa

| Página | Recomendação |
|---|---|
| `/pedidos`, `/gestao/cadastro-produtos` | **Removidas** ✔ — eram versões antigas das telas que já estão no menu. As duas URLs continuam abrindo, agora apontando para a tela atual (alias de compatibilidade, o mesmo padrão que `/produtos` e `/lotes` já usavam), então nenhum link antigo quebra |
| Controle Comercial (Pedido, Orçamento, OS, Consignação, Locação) | **Manter desligadas, prontas** — auditadas e funcionando; ligar quando a loja precisar |
| Cobrança (protesto, negativação, parcelamento) | **Manter desligadas** — fazem sentido só com inadimplência relevante |
| Consulta PF/PJ | **Manter desligadas** — são cadastro, não consulta a birô de crédito; o nome sugere outra coisa |
| Transportadoras, Regiões de Entrega | **Ligar quando houver entrega própria** — agora funcionam |

**Correção a uma anotação da Fase 1:** lá eu registrei que `/pedidos` seria substituída por "Ciclo de Pedidos". Ao remover, conferi o código: `orders.tsx` lia exatamente a mesma fonte que a tela **Vendas** (`useVendas`) — era uma versão anterior *dela*, e é para `/vendas` que a URL passou a apontar. `/gestao/cadastro-produtos` aponta para **Cadastro e Estoque**, como previsto.

Também apaguei `dashboard-layout.tsx`: um layout de menu que nunca foi importado por ninguém e era o único lugar do código que ainda linkava `/pedidos`.

## 8. Melhorias de UX sugeridas (não urgentes)

1. Modal de **editar produto** tem título "Cadastrar Produto" — sugere que vai duplicar
2. Card **"produtos abaixo do mínimo"** conta também os que estão exatamente no mínimo; o texto poderia dizer "no mínimo ou abaixo"
3. Botões desabilitados **sem dica** em alguns pontos (paginação, "Adicionar" da agenda, pagar comissão) — o padrão bom já existe no Caixa, que explica o bloqueio
4. **108 rotas para 83 telas**: os apelidos herdados do sistema antigo funcionam, mas dobram a superfície de manutenção

## 9. Manutenção — como manter isto vivo

**Quando uma tela mudar:**
1. Rode o robô de auditoria daquela sessão (`auditar.mjs`) — ele recaptura prints e relê o que cada botão faz
2. Rode `gera_tutoriais.py` — regenera `src/content/tutoriais.json` e copia as imagens novas
3. Tutorial e modo demonstração se atualizam sozinhos: **nenhum componente precisa ser tocado**

**Quando uma página nova for criada:**
1. Adicione a rota, o item de menu e a descrição em `src/lib/ajuda-paginas.ts`
2. Inclua a rota na próxima rodada do robô — ela entra no tutorial e no tour automaticamente

**O que nunca fazer:**
- Editar `src/content/tutoriais.json` à mão: ele é gerado, e a edição se perde na próxima rodada
- Trocar a chave de criptografia dos certificados pela tela de configurações (use `scripts/rotacionar-chave-certificado.sh`)

## 10. Conta temporária

`demo.admin@lojaxlife.com.br` — criada em 10/09/2026 10:37, papel admin (não principal), usada em toda a auditoria. Senha guardada fora do repositório.

**Status: DESATIVADA** ✔ — em 10/09/2026:

| Camada | Ação | Verificação |
|---|---|---|
| Aplicação | `ativo = false` em `erp_usuarios` | login recusa com "Usuário desativado" |
| Autenticação (GoTrue) | `banned_until = 2099-12-31` | a API responde `user_banned` **mesmo com a senha correta** |
| Sessões | 75 sessões e 75 refresh tokens apagados | nenhuma sessão ativa resta |

O arquivo de senha (`~/.config/erp-xlife/conta-temporaria.txt`, sempre fora do repositório) foi apagado — a credencial não serve mais para nada. Nenhuma senha aparece no repositório, apenas o endereço de e-mail nos documentos da auditoria.

Não apaguei o usuário: os registros que ele criou (vendas, NFC-e de homologação, movimentos de caixa) apontam para ele, e apagá-lo arrastaria esse histórico. Ele sai junto com os dados de teste, no script da virada.

## 11. Pendências desta auditoria

- [x] **Conta temporária desativada** — seção 10
- [x] **2 páginas órfãs removidas** — seção 7
- [ ] Dados de teste criados durante a auditoria (vendas #20–22, NFC-e #3 sem valor fiscal, sangrias, entradas, caixas, "Vendedor Auditoria" e sua comissão) — saem no script da virada, `scripts/virada-producao.sql`, junto com o usuário temporário

Nada mais desta auditoria está em aberto. O que falta para o go-live não é código, é informação do cliente: CSC de produção, planilha de produtos, dados do contador para o SPED e a lista de funcionários.


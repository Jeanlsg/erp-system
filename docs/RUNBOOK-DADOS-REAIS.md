# Virada para dados reais — passo a passo

Procedimento para o dia em que o ERP deixa de ter dados de exemplo e passa a operar com os dados reais da loja.

**Leia a seção 0 antes de clicar em qualquer coisa.** A ordem importa mais que os passos: há um script que apaga cadastros, e fazer na ordem errada significa digitar tudo duas vezes.

Cada passo cita o caminho no menu, o nome exato do botão e o que você deve ver quando der certo. Onde houver armadilha conhecida, ela está marcada com **⚠**.

---

## 0. A ordem, em uma página

```
  ANTES do script            │  O SCRIPT            │  DEPOIS do script
  ─────────────────────────  │  ──────────────────  │  ──────────────────────────
  1. backup completo         │  virada-producao.sql │  6. produtos (planilha)
  2. ensaiar num clone       │  apaga todo o         │  7. clientes (planilha)
  3. usuários/logins         │  movimento e os       │  8. fornecedores (planilha)
  4. certificado digital     │  cadastros de         │  9. funcionários + comissão
  5. dados do contabilista   │  exemplo              │ 10. contas em aberto
                             │                      │ 11. CSC + ambiente produção
                             │                      │ 12. primeira NFC-e real
```

**O que o script apaga:** produtos, categorias, kits, pessoas (clientes e fornecedores), funcionários, serviços, vendas, notas, contas, caixa, estoque, compras, comissões, e a conta temporária da auditoria.

**O que o script preserva:** lojas, usuários/logins, certificados digitais, configuração SEFAZ, dados empresariais, integrações, plano de contas, feature flags e chaves PIX.

⚠ **Por isso funcionários vão DEPOIS e logins vão ANTES.** Usuário sobrevive ao script; funcionário não. E o campo "Usuário do sistema" do cadastro de funcionário só lista logins que já existem — criar o funcionário primeiro deixa o vínculo impossível pela tela.

---

## 1. Backup completo

```bash
ssh xlifevps
/opt/backups/backup-diario.sh
ls -lh /opt/backups/ | grep $(date +%Y%m%d)
```

Esperado: três arquivos do dia — `postgres-AAAAMMDD.dump` (~40 MB), `globals-AAAAMMDD.sql` e `supabase-AAAAMMDD.dump`.

Os três são necessários para restaurar. Procedimento completo em [`scripts/RESTAURAR-BACKUP.md`](../scripts/RESTAURAR-BACKUP.md).

## 2. Ensaiar o script num clone

Dois minutos, e já pegou erro uma vez.

```bash
DB=$(docker ps -qf name=supabase-db | head -1)
docker exec $DB psql -U supabase_admin -d postgres -qc 'CREATE DATABASE ensaio;'
docker exec -i $DB pg_restore -U supabase_admin -d ensaio --no-owner --no-acl \
  < /opt/backups/postgres-$(date +%Y%m%d).dump
docker exec -i $DB psql -U supabase_admin -d ensaio -v ON_ERROR_STOP=1 < virada-producao.sql
```

Esperado: termina em `COMMIT`, com `DEPOIS vendas=0 produtos=0 pessoas=0 contas=0 notas=0` e `conta_auditoria_restante=0`.

⚠ Restaurar num banco com outro nome produz exatamente **6 erros de `pg_cron`** ("can only create extension in database postgres"). São esperados. Qualquer erro além desses 6 é problema de verdade — pare e investigue.

Apague o clone: `docker exec $DB psql -U supabase_admin -d postgres -qc 'DROP DATABASE ensaio;'`

## 3. Usuários e logins — *antes* do script

**Gestão › Usuários e Permissões** (`/gestao/usuarios`)

Só quem tem papel **Administrador** cria usuário. Se o botão "Novo Usuário" estiver apagado, a conta logada não é admin.

1. **Novo Usuário** → preencha **Nome ***, **E-mail ***, **Papel** (Administrador, Gerente, Operador de Caixa ou Estoquista), **Loja Padrão** e **Telefone**. Deixe **Usuário ativo** marcado.
2. Senha: marque **"Definir senha agora"** e digite em **Senha (mínimo 6 caracteres)** — a pessoa já loga. Ou deixe desmarcado para enviar convite por e-mail.
3. **Salvar**. Esperado: *"Usuário criado com senha! Pode logar imediatamente com: &lt;e-mail&gt;"* ou *"Usuário criado! Email de convite enviado"*.

⚠ O botão Salvar **não** fica desabilitado durante a criação. Clique **uma única vez** e espere a mensagem — clicar duas vezes cria dois usuários.

⚠ Se aparecer o aviso laranja de que o convite não saiu, defina a senha na hora em vez de insistir no e-mail.

**Quem precisa de login:** só quem vai operar o sistema. Entregador e ajudante que não usam o sistema não precisam.

**Permissões por usuário:** o botão de escudo na linha abre a customização. Ela controla **o que a pessoa vê no menu e nos botões** — o acesso ao banco é governado pelo *cargo*. Para restringir de verdade o que alguém pode gravar, mude o cargo.

## 4. Certificado digital

**Gestão › Fiscal › Certificado Digital** (`/gestao/nfe-certificado`)

1. **Novo Certificado** → a área pontilhada **"Clique para selecionar o certificado"** aceita `.pfx` ou `.p12`, máximo 5 MB. O arquivo sobe primeiro.
2. Depois de *"Arquivo enviado!"*, preencha a senha do certificado e salve.
3. Confira que o cartão **"Ativos"** mostra 1 e que o certificado não aparece em **"Vencendo 30d"** nem vencido.

## 5. Dados do contabilista (registro 0100 do SPED)

**Gestão › Fiscal › Escrituração (SPED)** (`/fiscal/escrituracao`) → card **"Dados do contabilista"**, no topo.

Peça ao contador; ele dita em um minuto:

| Campo | Observação |
|---|---|
| **Nome do contabilista** * | como consta no CRC |
| **CPF do contabilista** | 11 dígitos; a tela confere |
| **CRC** | registro no Conselho Regional |
| **CNPJ do escritório contábil** | deixe vazio se for autônomo |
| **Telefone** | com DDD |
| **E-mail** | |

Clique em **"Salvar dados do contabilista"** e confira que o selo no título virou **"completo"** (verde).

⚠ Sem esses dados o registro 0100 sai vazio e a EFD volta do PVA. O único campo que gera aviso automático é o nome — os outros cinco saem em branco **sem nenhum alerta** se você esquecer.

Aproveite e confirme com o contador, em **Configurações › Configurações do Sistema › Configurações Técnicas**, os valores de `regime_tributario` (1 = Simples Nacional, 2 = Simples com excesso de sublimite, 3 = Regime normal), `sped_perfil` (A, B ou C) e `sped_ind_ativ` (0 = industrial, 1 = outros). Nessa aba o salvamento é **ao sair do campo**, sem botão e sem confirmação: recarregue com F5 para ter certeza de que gravou.

## 6. Rodar o script da virada

```bash
docker exec -i $(docker ps -qf name=supabase-db | head -1) \
  psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < virada-producao.sql
```

Esperado: `COMMIT`, e a linha `mantidos: lojas=2 usuarios=N ... (conta_auditoria_restante=0, deve ser 0)`.

⚠ Roda **uma única vez**. Depois dele, o sistema está vazio de movimento — é esse o ponto.

## 7. Produtos (planilha)

**Gestão › Gestão Empresarial › Cadastro e Estoque** (`/produtos-estoque-lotes`) → botão **"Importar Planilha"**.

1. **"Baixar modelo"** → salva `modelo-importacao-produtos.csv`.
2. Substitua as duas linhas de exemplo pelos produtos reais, **sem mexer no cabeçalho**:
   `nome;sku;codigo_barras;categoria;preco_custo;preco_venda;estoque;estoque_minimo;ncm;cest;csosn;unidade;marca;validade_dias`
3. **Preços sempre com centavos e vírgula decimal**: `149,90`, `1.234,56`, `45,00`.
4. Salve como **"CSV UTF-8"**.
5. **"Escolher arquivo"** → confira a linha de resumo e a **pré-visualização**, em especial a coluna **Venda**.
6. Se a planilha tiver coluna de estoque, escolha a **"Loja que recebe o estoque inicial"**.
7. **"Importar N produto(s)"** → leia o resumo até o fim e anote as linhas **"pulada — …"**: esses produtos **não** entraram.

⚠ **`1.234` sem centavos é lido como R$ 1,23.** É ambiguidade real entre formato brasileiro e americano, sem como decidir pelo texto. A pré-visualização mostra o valor convertido — é lá que você pega.

⚠ **Não salve em ANSI.** A janela sugere "CSV (separado por ponto e vírgula)", que no Excel em português grava em ANSI e estraga os acentos: "Proteínas" vira "Proteínas". Use **CSV UTF-8**.

⚠ **Preço de custo inválido entra como zero, em silêncio** — e aí a margem e o custo médio nascem errados. Confira os custos depois de importar.

⚠ Cabeçalho renomeado é ignorado sem aviso. "Preço Venda" não é reconhecido; "Preço de Venda" é.

**Estoque inicial de outra loja:** importe de novo com a coluna de estoque daquela loja, ou use **Inventário / Balanço** (`/estoque/inventario`) → **"Abrir inventário"**.

**Validade e lotes:** na linha do produto, ícone de calendário → **"Validade e lotes"**.

## 8. Clientes (planilha)

**Gestão › Gestão Empresarial › Clientes** (`/gestao/clientes`) → **"Importar planilha"**.

Cabeçalho do modelo:
`nome;cpf_cnpj;email;celular;telefone;cep;endereco;numero;bairro;cidade;uf;limite_credito;data_nascimento;observacoes`

- **nome** é o único obrigatório.
- CPF/CNPJ aceita com ou sem pontuação; 11 ou 14 dígitos. Outro tamanho é recusado com a linha apontada.
- Datas em `31/12/1990`, `31-12-1990` ou `1990-12-31`.
- Quem já existe pelo CPF/CNPJ **não é duplicado**.
- Sem CPF/CNPJ, a conferência cai para o nome exato.

## 9. Fornecedores (planilha)

**Gestão › Gestão Empresarial › Fornecedores** (`/gestao/fornecedores`) → **"Importar planilha"**.

Cabeçalho: `nome;nome_fantasia;cpf_cnpj;email;telefone;celular;cep;endereco;numero;bairro;cidade;uf;inscricao_estadual;observacoes`

Cliente e fornecedor são papéis, não tabelas separadas: a mesma empresa pode ser os dois — o distribuidor que também compra no balcão aparece nas duas telas, com um cadastro só. Se alguém importado como fornecedor já existia como cliente, ele **ganha o papel** em vez de virar cadastro repetido.

## 10. Funcionários e comissão

**Gestão › Gestão Empresarial › Funcionários** (`/gestao/funcionarios`) → **"Novo Funcionário"**.

1. **Nome *** é o único obrigatório. Preencha também CPF, Cargo, Departamento, Email, Telefone, Salário, **Comissão %** e Admissão.
2. **"Usuário do sistema"**: escolha o login criado no passo 3. O padrão é *"Sem login (não vende no PDV)"* — deixe assim só para quem não opera o sistema.
3. **"Cadastrar"**.

⚠ Sem CPF, aparece uma confirmação explicando que o CPF é necessário para folha de pagamento e obrigações trabalhistas. Dá para seguir sem, mas decida conscientemente.

⚠ **Funcionário não loga, e usuário não vende.** Para quem vende *e* opera o sistema, os dois cadastros são necessários, ligados pelo campo "Usuário do sistema". Esquecer o vínculo faz a venda sair sem vendedor automático — e venda sem vendedor **não gera comissão**, sem nenhum aviso.

**Comissão:** não existe tela para digitar valor. O percentual é o campo **Comissão %** (digite `3` para 3%) e a comissão nasce sozinha quando a venda é finalizada com vendedor. A precedência é: percentual do **serviço** › do **produto** › do **funcionário**.

**Corrigir depois:** a lista tem ícone de lápis para **editar** (cargo, salário, comissão, vínculo de login) e de pessoa-menos para **registrar demissão** com data, reversível.

**Conferir:** **Gestão › Gestão Empresarial › Comissões** (`/gestao/comissoes`), com filtros De/Até/Vendedor/Situação. Para pagar: marque as linhas e use **"Pagar selecionadas"**.

## 11. Contas em aberto (planilha)

**Relatórios Financeiros** (`/financeiro`) → aba **"À Receber"** ou **"À Pagar"** → botão **"Importar contas a receber/pagar"**.

Cabeçalho: `cliente;cpf_cnpj;descricao;valor;vencimento;parcela;parcelas;forma_pagamento;numero_documento;observacoes`

- **Uma linha por parcela.** Crediário em 3x são 3 linhas com `parcela` 1, 2 e 3 e `parcelas` 3.
- Escolha a **"Loja dona dessas contas"** antes de importar.
- Conta com vencimento passado entra como **vencida**, não pendente — para o painel de inadimplência dizer a verdade no dia seguinte.
- Reimportar o mesmo arquivo não duplica.

⚠ **Importe clientes (passo 8) antes das contas.** A conta é ligada pelo CPF/CNPJ ou pelo nome exato; sem o cadastro ela entra sem vínculo e não aparece no extrato do cliente. O relatório da importação diz quantas ficaram assim.

## 12. CSC de produção e troca de ambiente

**Gestão › Fiscal › Configurações SEFAZ** (`/gestao/configuracoes-sefaz`)

⚠ **A tela é por loja, e a loja é a do seletor no topo da página.** Abra a tela, escolha a loja no seletor, e confira que os campos recarregaram antes de digitar.

Para **cada** loja:

1. Escolha a loja no seletor do topo (a matriz tem ★).
2. **Espere os campos aparecerem.** O card só aparece quando a configuração chega.
3. **Anote** os valores de Série NFC-e, Série NF-e, Numeração Atual NF-e e Numeração Atual NFC-e.
4. **"CSC ID"**: o ID do CSC que a SEFAZ forneceu para **esta** loja (número curto, tipo `000001`).
5. **"CSC Token"**: cole o código CSC de produção. É campo de senha — não dá para reler depois.
6. Confira a **"UF"** (2 letras). Vazia ou com 1 letra, o sistema recusa.
7. Ajuste **"Numeração Atual"** para o número **anterior** ao primeiro que você quer usar. ⚠ O sistema soma 1 ao emitir: com `1`, a primeira nota sai como **nº 2** e o nº 1 fica pulado — e número pulado em produção tem de ser inutilizado na SEFAZ.
8. **Só agora** troque **"Ambiente"** de Homologação para **Produção**.
9. **"Salvar"** → esperado *"Configurações SEFAZ salvas."*
10. **F5** e confira com os próprios olhos: Ambiente em Produção, CSC ID preenchido, numerações corretas.

⚠ **CSC primeiro, ambiente depois.** A tela salva sem reclamar se o ambiente virar produção com o CSC vazio — e quem descobre é o operador no meio da venda: a venda fica registrada e o cupom não sai.

⚠ **O CSC só é exigido em produção.** Nota autorizada em homologação **não prova** que o CSC de produção está certo.

⚠ **Virar a matriz não vira a filial.** Cada loja tem CSC e numeração próprios, e a filial continua emitindo nota sem valor fiscal com a mesma cara de sucesso.

Depois, em **Gestão › Gestão Empresarial › Lojas**: na linha da loja, ícone de selo (**"Conferir cadastro na SEFAZ"**). Se aparecer a janela de divergências, confirme — é o que preenche Inscrição Estadual, endereço e código IBGE do município, que o SPED exige. Esta ação exige **Administrador** (gerente é recusado).

## 13. Primeira NFC-e real

Antes: confira em **Cadastro e Estoque** que o produto a vender tem **NCM**, CFOP, CSOSN e unidade preenchidos. ⚠ Produto sem NCM não bloqueia o cadastro, mas **bloqueia a emissão**.

**Vendas e Pedidos › PDV** (`/pdv`)

1. Se o selo disser **"Caixa Fechado"**: clique em **"CAIXA 001"**, informe o **Saldo Inicial (Troco)**, **"Abrir Caixa"** e **"Confirmar"**.
2. Busque o produto (ou bipe o código) e clique no cartão para jogar no **Carrinho**. Use valor baixo nesta primeira.
3. Escolha **Cliente** e **Vendedor**.
4. Escolha a **Forma de Pagamento**.
5. **"Finalizar"**.
6. No diálogo **"Confirmar Venda"**: **marque "Emitir NFC-e (cupom fiscal)"** e confirme.

⚠ O checkbox de emitir NFC-e **volta a desmarcado** a cada recarga do PDV.

⚠ Emitir exige **Administrador ou Gerente**. Operador de caixa consegue marcar o checkbox, mas a venda termina com *"Venda registrada, mas a NFC-e falhou: sem permissão"*.

7. Leia os avisos **sem fechar a página**: *"Venda finalizada com sucesso."* e *"NFC-e nº N autorizada."* ⚠ Se vier **"(HOMOLOGAÇÃO — sem valor fiscal)"**, a loja ainda está em homologação e a nota não vale.
8. **Vendas e Pedidos › Notas Fiscais**: a primeira linha deve ter o selo **"Produção"** e **"autorizada"** em verde.
9. Ícone de olho → confira e **anote o Protocolo e a Chave de Acesso** (44 dígitos).
10. Ícone de folha → **DANFE** em PDF, para imprimir na térmica. Ícone de seta → **baixar XML**. Ícone de avião → **enviar por e-mail ao cliente**.

⚠ **Se a nota for rejeitada, o motivo só existe no aviso da tela, que desaparece em segundos.** Nenhuma tela guarda o cStat nem a mensagem da SEFAZ. **Tire print do aviso antes que ele saia.** E a venda rejeitada não volta à lista de "venda sem nota": a correção prática é fazer uma venda nova.

**Cancelar uma nota autorizada:** Notas Fiscais → ícone de olho → **"Cancelar nota"** → justificativa com no mínimo 15 caracteres. O prazo legal da NFC-e é curto; fora dele a SEFAZ recusa.

## 14. Depois da virada, conferir

| Conferir | Onde | Esperado |
|---|---|---|
| Notas recebidas do fornecedor | Fiscal › Notas Recebidas (SEFAZ) → **"Buscar novas notas"** | agora **funciona** — em homologação nunca trazia nada, porque o Ambiente Nacional não devolve documento de homologação |
| Estoque | Cadastro e Estoque | saldos da planilha, por loja |
| Inadimplência | Relatórios Financeiros › À Receber | as contas importadas, vencidas em vermelho |
| Avisos do sistema | Notificações, e o sino do cabeçalho | estoque baixo, contas vencidas, certificado vencendo |
| SPED | Fiscal › Escrituração → **"Gerar"** | o card de avisos deve estar vazio ou só com pendências conhecidas |

---

## O que ainda depende de contratação

Estas telas avisam na própria página o que falta — não somem e não fingem funcionar:

| Tela | Falta | Alternativa hoje |
|---|---|---|
| Boletos | convênio de cobrança registrada com o banco | Promissórias, Crediário Próprio |
| Torpedos SMS | gateway pago por mensagem | WhatsApp da loja, já conectado |
| Mala Direta impressa | gráfica | o **e-mail já funciona** (~3.000/mês no plano gratuito) |
| TEF / SITEF | contrato com a adquirente | maquininha avulsa, lançando a forma no PDV |
| Pedidos Delivery | integração iFood ou ExApp, e um recebedor de pedidos | venda no PDV + combinar entrega pelo WhatsApp |

---

## Se algo der errado

**Restaurar só os dados**, sem mexer em login nem configuração:

```bash
DB=$(docker ps -qf name=supabase-db | head -1)
docker exec -i $DB pg_restore -U supabase_admin -d postgres \
  --clean --if-exists --no-owner --no-acl --schema=erp \
  < /opt/backups/postgres-AAAAMMDD.dump
docker restart apps_supabase-rest-1
```

Restauração completa (servidor novo, perda total): [`scripts/RESTAURAR-BACKUP.md`](../scripts/RESTAURAR-BACKUP.md).

**Telas abrem mas toda lista vem vazia:** o cache de schema do PostgREST ficou velho. `docker restart apps_supabase-rest-1`.

**Deploy:** um por vez — dois webhooks se cancelam. Confirme pelo **nome novo do container** com status healthy, nunca pelo HTTP 200 do webhook.

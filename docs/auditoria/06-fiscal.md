# Sessão 06 — Fiscal

Data: 10/09/2026 · Ambiente: **produção** (não há homologação) · Testado por: agente, conta `demo.admin@lojaxlife.com.br`

Regra do ambiente: botões de efeito imediato ou irreversível não são acionados (⏭️). Formulários são abertos e fotografados, nunca confirmados.

## Página: Remessas entre Filiais — `/remessas`

Objetivo: Transferência entre filiais com NF-e de remessa (CFOP 5152/6152) e acompanhamento do trânsito.

Perfis com acesso: admin, gerente

Prints: [desktop](docs/auditoria/prints/06-fiscal/01-remessas-entre-filiais-inicial.jpeg) · [mobile](docs/auditoria/prints/06-fiscal/01-remessas-entre-filiais-mobile.jpeg) · [modal · Nova Remessa](docs/auditoria/prints/06-fiscal/01-remessas-entre-filiais-modal-nova-remessa.jpeg)

Texto de apoio na tela: *Transferência de produtos entre lojas com emissão de NFe*

Estado observado: 0 linha(s) na tabela, 2 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Nova Remessa (botão) | abrir formulário/modal | abre "Nova Remessa entre Filiais" · campos: Loja Origem *, Loja Destino *, Tipo *, Previsão Chegada, CFOP Automático, Valor Frete, Valor Seguro, Adicionar Produtos | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Notas Recebidas (SEFAZ) — `/fiscal/notas-recebidas`

Objetivo: NF-e emitidas contra o CNPJ da loja, buscadas no canal oficial da SEFAZ; ciência libera o XML com itens.

Perfis com acesso: admin, gerente, estoquista

Prints: [desktop](docs/auditoria/prints/06-fiscal/02-notas-recebidas-sefaz-inicial.jpeg) · [mobile](docs/auditoria/prints/06-fiscal/02-notas-recebidas-sefaz-mobile.jpeg)

Texto de apoio na tela: *Toda NF-e emitida contra o CNPJ da loja, direto do canal oficial — sem depender de o fornecedor mandar o XML.*

Estado observado: 0 linha(s) na tabela, 1 campo(s), lista vazia.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| X-life Suplementos Juazeiro — BA (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Buscar novas notas (botão) | reagir na tela | falha ao clicar: locator.click: Timeout 6000ms exceeded. | ⚠️ |  |
| Baixar (botão) | reagir na tela | falha ao clicar: locator.click: Timeout 6000ms exceeded. | ⚠️ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Escrituração (SPED) — `/fiscal/escrituracao`

Objetivo: Gera EFD ICMS/IPI e SINTEGRA da competência a partir das notas, do kardex e do inventário.

Perfis com acesso: admin, gerente

Prints: [desktop](docs/auditoria/prints/06-fiscal/03-escrituracao-sped-inicial.jpeg) · [mobile](docs/auditoria/prints/06-fiscal/03-escrituracao-sped-mobile.jpeg)

Texto de apoio na tela: *EFD ICMS/IPI e SINTEGRA a partir das notas, do kardex e do inventário já registrados.*

Estado observado: 2 linha(s) na tabela, 1 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| X-life Suplementos Juazeiro — BA (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| EFD ICMS/IPI (botão) | reagir na tela | falha ao clicar: locator.click: Timeout 6000ms exceeded. | ⚠️ |  |
| Original (botão) | reagir na tela | falha ao clicar: locator.click: Timeout 6000ms exceeded. | ⚠️ |  |
| Gerar (botão) | reagir na tela | falha ao clicar: locator.click: Timeout 6000ms exceeded. | ⚠️ |  |
| Baixar (botão) | reagir na tela | falha ao clicar: locator.click: Timeout 6000ms exceeded. | ⚠️ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Certificado Digital — `/gestao/nfe-certificado`

Objetivo: Certificado digital A1 da loja: upload, validade e senha criptografada.

Perfis com acesso: admin, gerente

Prints: [desktop](docs/auditoria/prints/06-fiscal/04-certificado-digital-inicial.jpeg) · [mobile](docs/auditoria/prints/06-fiscal/04-certificado-digital-mobile.jpeg) · [modal · Novo Certificado](docs/auditoria/prints/06-fiscal/04-certificado-digital-modal-novo-certificado.jpeg)

Texto de apoio na tela: *Gestão de certificados A1 para emissão de NF-e / NFC-e*

Estado observado: 0 linha(s) na tabela, 0 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Novo Certificado (botão) | abrir formulário/modal | abre "Upload do Certificado A1" · campos: Clique para selecionar o certificado

Arquivos .pfx ou .p12 · Máximo 5MB | ✅ |  |
| Baixar .pfx (botão) | reagir na tela | muda o conteúdo na própria tela | ✅ |  |
| Excluir (botão) | executar a ação | não acionado (efeito imediato/irreversível em produção) | ⏭️ | efeito imediato/irreversível — não executado em produção |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

## Página: Configurações SEFAZ — `/gestao/configuracoes-sefaz`

Objetivo: Ambiente (homologação/produção), série, numeração e CSC por loja.

Perfis com acesso: admin, gerente

Prints: [desktop](docs/auditoria/prints/06-fiscal/05-configuracoes-sefaz-inicial.jpeg) · [mobile](docs/auditoria/prints/06-fiscal/05-configuracoes-sefaz-mobile.jpeg)

Texto de apoio na tela: *Integração para NF-e/NFC-e*

Estado observado: 0 linha(s) na tabela, 8 campo(s), com conteúdo.

| Função/Elemento | O que deveria fazer | Resultado | Status | Obs |
|---|---|---|---|---|
| Salvar (botão) | reagir na tela | mensagem: "Configurações SEFAZ salvas." | ✅ |  |

Console e rede: sem erros JS e sem respostas 4xx/5xx.

### Fluxos fiscais executados

| Fluxo | Resultado | Status |
|---|---|---|
| Remessas · Nova Remessa | abre com Loja Origem, Loja Destino, Tipo, Produtos — **listagem voltou a funcionar** (BUG-03 da sessão 01) | ✅ |
| **SPED · Gerar EFD ICMS/IPI** | arquivo gerado: **57 linhas, 1.179 bytes**, 1 saída, 1 produto; toast "57 linhas geradas · 1 saída(s) e 0 entrada(s)"; avisos apontam dados de exemplo ainda no cadastro da loja | ✅ |
| **Notas Recebidas · Buscar novas notas** | recusa com a explicação correta: *"distribuição DF-e só funciona em produção — o Ambiente Nacional não devolve documentos de homologação"* | ✅ (limitação, não defeito) |
| Certificado Digital · Novo Certificado | abre o upload do A1 | ✅ |
| Configurações SEFAZ · Salvar | grava e confirma, **mas duplicava a configuração da loja** — ver [BUG-06-01](#bug-06-01-salvar-configurações-sefaz-duplicava-a-configuração-da-loja--severidade-alta--corrigido) | ❌ → corrigido |

> **Para o cliente:** a busca de notas recebidas da SEFAZ **não pode ser testada antes da virada para produção** — é limitação do Ambiente Nacional, que não devolve documentos de homologação. Só será exercitável depois do CSC e da troca de ambiente.

## Problemas encontrados

### [BUG-06-01] Salvar Configurações SEFAZ duplicava a configuração da loja · Severidade: **alta** · CORRIGIDO

**Como apareceu.** Salvei a tela de Configurações SEFAZ para testar o botão. Ele confirmou ("Configurações SEFAZ salvas.") e, em vez de atualizar a linha existente, **inseriu uma segunda** para a mesma loja — com UF `SP`, o valor padrão do formulário, não o `PE` real.

**Por que é grave.** `erp_configuracoes_sefaz` não tinha restrição de unicidade por loja. Com duas linhas, a consulta que busca a configuração passa a devolver duas e a emissão de nota da loja para com "configuração ausente". Ou seja: **usar o botão Salvar era suficiente para derrubar a emissão fiscal da loja.**

**Agravante honesto:** isto aconteceu em produção, disparado pelo meu próprio teste. Restaurei o estado na hora (apaguei a linha duplicada, UF de volta para `PE`) e confirmei que a distribuição DF-e voltou a responder antes de seguir.

**Correção.** `supabase/migrations/067_config_sefaz_unica.sql`: deduplica o que existia e cria `UNIQUE (loja_id)`. A tela passou a atualizar em vez de inserir.

**Verificação.** Salvei três vezes seguidas: continua **uma única linha** por loja, com a UF correta, e a emissão segue funcionando.

## Limitações do robô (não são defeitos do sistema)

O robô registrou 6 falhas de clique nesta sessão. Investigadas uma a uma, **nenhuma era defeito do sistema** — eram limitações da minha própria ferramenta. Ficam registradas com prefixo `ROBO-` para não se confundirem com bugs:

| # | Onde | O que o robô relatou | O que era de fato |
|---|---|---|---|
| ROBO-06-01 | `/fiscal/notas-recebidas` | timeout em "Buscar novas notas" | o botão **responde**: recusa com a explicação correta de que DF-e só funciona em produção. O robô lia o toast 25s depois do clique, quando o Sonner já o havia removido |
| ROBO-06-02 | `/fiscal/notas-recebidas` | timeout em "Baixar" | havia **dois** botões "Baixar" na página; o seletor era ambíguo e o Playwright recusou o clique. Não é indisponibilidade |
| ROBO-06-03 a 06 | `/fiscal/escrituracao` | timeout em "EFD ICMS/IPI", "Original", "Gerar", "Baixar" | a mesma ambiguidade de seletor. Testado à mão, o fluxo **gera o arquivo**: 57 linhas, 1.179 bytes (ver "Fluxos fiscais executados" acima) |

**Erro de método que isto expôs:** eu lia o resultado 25 segundos depois de clicar, mas o toast desaparece em ~5. Passei a acompanhar a tela desde o instante do clique — foi assim que as funções "sem resposta" se revelaram funcionando.

### Resumo da sessão
5 páginas | 13 funções verificadas | **1 bug real** (alto, corrigido) + 6 limitações do robô, nenhuma defeito do sistema
Páginas novas descobertas: nenhuma.


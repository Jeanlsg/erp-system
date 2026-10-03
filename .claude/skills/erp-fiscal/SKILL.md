---
name: erp-fiscal
description: Módulo fiscal do ERP X-Life — como NF-e e NFC-e são emitidas (edge erp-emitir-nfe → nfe-service/sped-nfe → SEFAZ), eventos (cancelamento, CC-e, inutilização), DF-e com manifestação, SPED EFD/SINTEGRA, DANFE, certificado e CSC, homologação × produção, contingência offline, e as regras legais de BA e PE que o sistema precisa cumprir (com fontes). Use para qualquer tarefa com nota fiscal, rejeição da SEFAZ, obrigação acessória, "o que falta para regularizar", ou antes de mexer no emissor.
---

# Fiscal do ERP X-Life

Emitente: **Simples Nacional (CRT 1)**, duas lojas — Petrolina-**PE** e Juazeiro-**BA** (matriz).
Para a Reforma Tributária (IBS/CBS, 2027), use a skill `erp-reforma-ibs-cbs`.

## ⚠️ Antes de tudo

- **Emitir, cancelar ou inutilizar em produção tem efeito legal.** Só com pedido explícito.
  Teste em homologação ou no dry-run.
- Sem nota em produção até hoje: as lojas estão em homologação. A troca de ambiente segue
  `docs/RUNBOOK-DADOS-REAIS.md` (CSC **antes** de trocar o ambiente).

## Arquitetura

```
tela (Notas Fiscais / PDV / Remessas)
  → edge erp-emitir-nfe   valida (cert, SEFAZ, NCM), numera (RPC incrementar_numeracao_nfe), monta payload
  → nfe-service           PHP + sped-nfe: XML, assinatura, QR Code, transmissão
  → SEFAZ
  ← grava erp_notas_fiscais + XML/DANFE no bucket `fiscal`; dispara erp-enviar-nota
```

| Peça | Faz |
|---|---|
| `erp-emitir-nfe` | NF-e de venda, NFC-e, remessa entre filiais (5152/6152), devolução de venda (1202/2202), contingência offline |
| `erp-eventos-fiscais` | cancelar, carta de correção, inutilizar faixa — grava em `erp_nfe_eventos` / `erp_inutilizacoes` mesmo quando a SEFAZ recusa |
| `erp-dfe` | notas emitidas CONTRA o CNPJ (NSU sequencial; sem novidade, 1 consulta/hora; cStat 656 bloqueia 1h) e manifestação — sem ciência, só o resumo chega |
| `erp-sped` | EFD ICMS/IPI (blocos 0, C, E, H) e SINTEGRA. **Não valida**: o arquivo só vale depois do PVA da Receita |
| `erp-danfe` | DANFE de nota antiga que não tem PDF |
| `erp-enviar-nota` | XML + DANFE ao cliente (e-mail via Resend; WhatsApp via Uazapi) |
| `nfe-service` | `POST /v1/nfe/{emitir,cancelar,cce,inutilizar}`, `/v1/dfe/{distribuicao,manifestar}`, `/v1/danfe`, `/v1/status`, `/v1/certificado/validar`, `/v1/cadastro/consultar` |

Configuração por loja em `erp_configuracoes_sefaz` (ambiente, séries, numeração, `csc_id`/`csc_token`,
`certificado_id`). Senha do certificado cifrada; a chave só roda por `scripts/rotacionar-chave-certificado.sh`.
Credenciais do nfe-service em `public.integrations` (`provider = 'nfe_service'`).

## Homologação × produção

- **DF-e não devolve nada em homologação**: tela zerada ali não é defeito.
- QR Code da NFC-e: v3 (homologação) assina com o certificado e dispensa CSC; em produção BA/PE,
  enquanto for v2, o CSC é obrigatório. O nfe-service decide pela tabela da própria lib.
- Nota de homologação não tem valor fiscal; o envio ao cliente marca "SEM VALOR FISCAL" no assunto.

## Totais da nota: desconto, acréscimo e entrega

- A nota soma o total pelos itens (vNF = Σ vProd − vDesc + vFrete + vOutro). Desconto geral,
  acréscimo e taxa de entrega da venda são **rateados por item** em
  `supabase/functions/erp-emitir-nfe/rateio.ts` (testado). O desconto é derivado do total gravado
  na venda, e a edge recusa se o total da nota não fechar com o da venda.
- Item sem `produto_id` (kit, serviço) não vai para a nota: a emissão recusa explicando, em vez de
  esconder o valor em "outras despesas".
- **NFC-e com entrega:** só aceita frete como entrega a domicílio (`indPres=4`, regra X02-10,
  rejeição 753), e aí exige destinatário com CPF/CNPJ e endereço com IBGE (787/788). A edge lê o
  endereço do pedido (`erp_pedidos.endereco_entrega`); faltando algo, a taxa vai como `vOutro` e o
  motivo entra nas observações. PE exige CPF em toda entrega em domicílio. `modFrete` 3 (entrega
  da loja) ou 0 (transportadora). NF-e 55 leva o frete com a mesma modalidade.
- Teste: `services/nfe-service/tests/dryrun-entrega.php` num contêiner descartável da imagem.

## Contingência offline (NFC-e)

Venda feita sem internet sobe pela fila; ao ser emitida, sai com `tpEmis=9` e `dhCont` = hora
real da venda. **Limitação atual:** nada é impresso no ato. A regra da contingência offline é
DANFE impresso na hora e transmissão em até 24h ou no 1º dia útil ([Focus NFe][cont]).

## Regras legais que o sistema precisa cumprir

| Regra | Onde | Estado no ERP |
|---|---|---|
| Toda venda ao consumidor tem documento fiscal; negar é crime formal (Lei 8.137/90, art. 1º, V) ([Dizer o Direito][8137]) | todas | a opção "Sem nota" do PDV precisa de revisão |
| Pagamento com cartão/meio eletrônico **vinculado** à NFC-e (Dec. 46.087/2018, art. 149-A, desde 01/01/2019) ([SEFAZ-PE][pe46087]) | **PE** | TEF desligado; cartão vai como "não integrado" (`tpIntegra=2`) |
| Pagamento detalhado por forma; operadoras de cartão e PIX informam ao Fisco (Conv. ICMS 134/2016) ([CONFAZ][c134]) | todas | a nota leva só a forma principal com o total |
| Valor aproximado dos tributos no documento ao consumidor (Lei 12.741/2012) ([Planalto][l12741]) | todas, Simples inclusive | ausente |
| CPF/CNPJ do consumidor: PE a partir de **R$ 5.000** e em toda **entrega em domicílio** ([SEFAZ-PE, P&R NFC-e][penfce]); BA a partir de R$ 1.000 (Dec. 16.434/2015, a confirmar) ([NDD][ndd]) | PE / BA | CPF sempre opcional |
| Cancelamento da NFC-e em até 24h ([Oobj][cancel]) | BA e PE | sem aviso de prazo |
| Devolução de consumidor: nota de **entrada** (1202/2202); em PE pode ser uma por dia (Dec. 44.650/2017, art. 531) | todas | NF-e de devolução só total e só com CPF; separada da tela Devoluções |
| Devolução referencia a nota por item em `DFeReferenciado`; `refNFe` proibido a partir de **05/10/2026** (NT 2025.002, regra VC02-14, rejeição 321) | todas | nfe-service usa `refNFe` |
| Antecipação de ICMS nas compras interestaduais para revenda — BA (antecipação parcial, até o dia 25 do mês seguinte) ([Econet][ba-ant]); PE (ICMS antecipado do Simples, Dec. 44.650/2017) | BA e PE | não calcula |
| EFD ICMS/IPI mensal: BA exige do Simples desde 01/01/2016 (RICMS/BA art. 248) ([Radinfo][efdba]); PE, só regime normal ([SEFAZ-PE][efdpe]) | Juazeiro | gera, sem PVA |
| DeSTDA (dia 28, SEDIF-SN) quando há ST/DIFAL/antecipação ([Cefis][destda]) | a confirmar | não gera |
| Transferência entre filiais PE↔BA: CFOP 6152, sem ICMS desde 2024 (LC 204/2023) ([Clicknotas][transf]) | — | CFOP certo; CSOSN 400 a confirmar com o contador |
| NFS-e pelo Emissor Nacional, obrigatória ao Simples desde 01/11/2026 ([gov.br][nfse]) | se prestar serviço | não emite NFS-e |

Pontos marcados "a confirmar" dependem do contador.

## Como testar

1. **Sem SEFAZ:** `services/nfe-service/tests/dryrun-nfce.php` — monta, valida contra o XSD e assina com certificado self-signed (uso no cabeçalho do arquivo).
2. **Homologação:** emitir pela tela com a loja em homologação; conferir `cstat`, XML e DANFE no bucket `fiscal`.
3. **Rejeição:** o `cstat` e a mensagem ficam em `erp_notas_fiscais` (`codigo_retorno`, `mensagem_retorno`).

[cont]: https://focusnfe.com.br/blog/nfc-e-em-contingencia-como-emitir-e-detalhes-para-aprovacao/
[8137]: https://buscadordizerodireito.com.br/jurisprudencia/8908/o-crime-do-art-1o-v-da-lei-813790-e-formal-e-prescinde-de-previo-exaurimento-de-processo-fiscal
[pe46087]: https://www.sefaz.pe.gov.br/Legislacao/Tributaria/Documents/Legislacao/Decretos/2018/Dec46087_2018.htm
[c134]: https://www.confaz.fazenda.gov.br/legislacao/convenios/2016/CV134_16
[l12741]: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12741.htm
[penfce]: https://www.sefaz.pe.gov.br/Publicacoes/Novo%20regulamento%20ICMS/Informativos%20a%20partir%20de%2001.10.2017/NFC-e%20-%20NOTA%20FISCAL%20CONSUMIDOR%20ELETR%C3%94NICA.pdf
[ndd]: https://ndd.tech/saiba-em-quais-estados-e-obrigatorio-informar-o-cpf-na-nota-fiscal-e-como-essa-medida-pode-combater-a-sonegacao-fiscal/
[cancel]: https://oobj.com.br/legislacao/cancelamento-nfce/
[ba-ant]: https://blog.econeteditora.com.br/icms-ba-antecipacao-parcial/
[efdba]: https://home.radinfo.com.br/ba-sped-efd-icmsipi-obrigatoriedade/
[efdpe]: https://www.sefaz.pe.gov.br/Noticias/Paginas/Ades%C3%A3o-de-Pernambuco-%C3%A0-EFD-ICMSIPI.aspx
[destda]: https://blog.cefis.com.br/destda/
[transf]: https://clicknotas.com.br/cfop-transferencia-filiais-tabela-exemplos/
[nfse]: https://www.gov.br/nfse/pt-br/noticias/comite-gestor-do-simples-nacional-prorroga-a-obrigatoriedade-de-emissao-de-notas-fiscais-de-servico-pelo-emissor-nacional-da-nfs-e

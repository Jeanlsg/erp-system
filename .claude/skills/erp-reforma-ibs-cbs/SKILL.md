---
name: erp-reforma-ibs-cbs
description: Reforma Tributária (IBS, CBS, Imposto Seletivo) aplicada ao ERP X-Life — cronograma, a opção do Simples Nacional, e o mapa campo a campo da NT 2025.002-RTC (grupo IBSCBS no item, totais W03, devolução) com o que o ERP e o nfe-service precisam mudar até 04/01/2027; inclui como baixar a versão nova da NT e das tabelas oficiais quando saírem. Use para qualquer pergunta sobre IBS/CBS, cClassTrib, CST do IBS/CBS, "o que muda em 2027", ou ao implementar os campos novos na nota.
---

# Reforma Tributária no ERP X-Life

Base: **NT 2025.002-RTC v1.51** (Portal da NF-e, 04/08/2026), tabela de cClassTrib de
23/06/2026, tabela de alíquotas da CBS de 12/05/2026 e a LC 214/2025. **Antes de implementar,
confira se saiu versão nova** (receita no fim).

## O essencial

- **CBS** (União) substitui PIS/Cofins; **IBS** (estados e municípios) substitui ICMS e ISS;
  **IS** é o seletivo. De 2029 a 2032 o ICMS encolhe e o IBS cresce; em 2033 só existem os três.
  **O ICMS vale até 2032** — as obrigações estaduais da skill `erp-fiscal` continuam.
- **2026:** teste (CBS 0,9%, IBS 0,1%), sem mudança para o Simples.
- **2027:** CBS cobrada; IBS a 0,05% estadual + 0,05% municipal (Resolução CGIBS 14/2026).
  Alíquota da CBS de 2027: a tabela oficial ainda diz **"aguarda legislação"**.
- **Simples Nacional:** escolhe entre IBS/CBS **dentro do DAS** ou pelo **regime regular**.
  Janela de 1º a 30/09 (desistência até 30/11) para o 1º semestre; nova janela em março.
  Varejo ao consumidor final tende a ficar no DAS: pessoa física não usa crédito.
- **Prazo técnico:** a partir de **04/01/2027**, em produção, nota de emitente CRT 1 sem o grupo
  `IBSCBS` em cada item é **rejeitada (cStat 1115, regra UB12-10)**.
- A v1.51 **ainda não traz as regras próprias do Simples**: "serão publicadas em NT futura"
  (art. 348 da LC 214/2025). O layout abaixo vale; os códigos do Simples podem mudar.

## Suplementos na lei

NCMs 2106.10 e 2106.90.30 **não estão** no Anexo I (redução a zero) nem no Anexo VII
(redução de 60%) da LC 214/2025 — só fórmulas infantis e dietoterápicas (2106.90.90).
Tributação integral: **CST 000, cClassTrib 000001**.
Caso de fronteira: bebidas e compostos lácteos em **2202.99.00** estão no Anexo VII
(cClassTrib 200034, redução de 60%) — confirmar com o contador produto a produto.

## Mapa campo a campo (NF-e 55 e NFC-e 65, CRT 1, venda de varejo)

**Cabeçalho**
| Campo | Preenchimento | ERP hoje |
|---|---|---|
| `finNFe` (B25) | 1 venda, 4 devolução (5/6 = nota de crédito/débito, não usar no dia a dia) | ok |
| `indFinal`/`indPres` | 1/1 no balcão; `indPres=4` em entrega a domicílio (NFC-e) | fixo 1/1 |
| `cMunFGIBS` (B12a) | só com `indPres=5` sem endereço do destinatário | não precisa |
| `CRT` (C21) | 1 | fixo no código — deve vir da configuração |

**Item — grupo `IBSCBS` (UB12)**
| Campo | ID | Valor para suplemento em 2027 |
|---|---|---|
| `CST` | UB13 | 000 |
| `cClassTrib` | UB14 | 000001 |
| `vBC` | UB16 | valor do item − desconto (+ frete/seguro/outras). No Simples, ICMS/PIS/Cofins do item são zero. A NT marca a fórmula como "aguardando orientação normativa" |
| `pIBSUF` → `vIBSUF` | UB18/UB35 | 0,05 → vBC × 0,05% |
| `pIBSMun` → `vIBSMun` | UB37/UB54 | 0,05 → vBC × 0,05% |
| `vIBS` | UB54a | vIBSUF + vIBSMun |
| `pCBS` → `vCBS` | UB56/UB67 | alíquota vigente → vBC × pCBS |
| `gRed` | UB26/45/64 | só em CST com redução (ex.: 200034 → `pRedAliq` 60, `pAliqEfet` = alíquota × 0,4) |
| `vItem` | VB01 | a biblioteca calcula |

Tolerância de cálculo: 0,01 para mais ou para menos.
Não se aplicam: IS, diferimento, `gDevTrib` (cashback), `gTribRegular`, compras
governamentais, monofásico, transferência de crédito, ajuste de competência, estorno,
crédito presumido, Zona Franca.

**Totais — `IBSCBSTot` (W03):** `vBCIBSCBS` e os valores de IBS (UF, município, total) e CBS
são somas dos itens; diferimento, devolução e crédito presumido em 0; `vNFTot` a biblioteca calcula.

**Devolução:** referência por item em `DFeReferenciado/chaveAcesso` (+ `nItem`); `refNFe`
proibido a partir de 05/10/2026 (VC02-14).

## O que muda no código

1. `services/nfe-service/src/index.php`: `schemes` está em **`PL_009_V4`**; os grupos novos só
   existem no **PL_010**. A sped-nfe instalada já tem `tagIBSCBS`, `tagIBSCBSTot`,
   `tagDFeReferenciado` e traz até `PL_010_V1.30` — conferir/atualizar para o schema vigente da NT.
2. Produto: campos CST e cClassTrib (padrão 000/000001), editáveis; alerta para 2202.99.
3. Configuração: alíquotas por ano (IBS UF, IBS município, CBS).
4. `erp-emitir-nfe`: calcular base e valores de cada item e enviar no payload; CRT da configuração.
5. Testar em homologação antes de 2027: a SEFAZ só aplica as regras quando os campos vêm preenchidos.

## Quando sair versão nova da NT ou das tabelas

O portal exige cookie; `WebFetch` falha por redirecionamento. Use `curl` com cookie jar:

```bash
UA="Mozilla/5.0"; cd "$(mktemp -d)"
curl -sL -c ck -b ck -A "$UA" \
  "https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY%3D" -o nts.html   # Notas Técnicas
curl -sL -c ck -b ck -A "$UA" \
  "https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=%2FNJarYc9nus%3D" -o div.html  # Diversos (cClassTrib, alíquotas)
# Nas listas, o link exibirArquivo.aspx?conteudo=… vem ANTES do título do documento.
curl -sL -c ck -b ck -A "$UA" -D h.txt "https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=<ID-codificado>" -o arq.bin
pdftotext -layout arq.bin nt.txt    # planilhas: python3 + openpyxl
```

Procure no texto: `CRT=1`, `UB12-10`, `Cronograma`, e a aba de CST na planilha de cClassTrib
(indicadores `ind_gIBSCBS`, `ind_gRed`, coluna `tpRBSN` — tipo de receita bruta do Simples).

Fontes: [NT 2025.002 v1.51](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=AKD%2FmuSmiIY%3D) ·
[Tabela cClassTrib](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=D5b4Ov84WDg%3D) ·
[Alíquotas da CBS](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=LRksVAMl7nQ%3D) ·
[LC 214/2025](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm) ·
[Resolução CGIBS 14/2026](https://www.cgibs.gov.br/upload/arquivos/202607/31144942-resoluc-ao-cgibs-n-14-de-29-de-julho-de-2026-proposta-percentual-ibs-cgibs-2027.pdf) ·
[Receita — prazos de opção](https://www8.receita.fazenda.gov.br/simplesnacional/noticias/NoticiaCompleta.aspx?id=c739e03c-8482-473f-8e82-f38ec3b13637)

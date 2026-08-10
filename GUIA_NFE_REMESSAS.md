# 🛠️ Guia de Configuração: NFe Entrada + Remessas entre Filiais

## ✅ O que foi implementado

### 1. Importação de NFe de Compra
- ✅ Upload e parse automático de XML de NFe (modelo 55)
- ✅ Auto-criação de fornecedor (se CNPJ não existir)
- ✅ Auto-matching de produtos por EAN, SKU ou nome
- ✅ Criação automática de produtos novos
- ✅ Atualização automática de estoque
- ✅ Criação de compra vinculada
- ✅ Suporte a impostos (ICMS, IPI, PIS, COFINS)

### 2. Remessas entre Filiais
- ✅ CRUD completo de remessas
- ✅ 4 tipos: Remessa, Retorno, Transf. Simples, Venda entre Filiais
- ✅ Cálculo automático de CFOP (mesma UF × outra UF)
- ✅ Numeração automática de NFe
- ✅ Baixa de estoque origem / entrada destino
- ✅ Fluxo: Rascunho → NFe Emitida → Em Trânsito → Recebida
- ✅ Status: Cancelada, Rejeitada

---

## 📋 O que VOCÊ (cliente) precisa adicionar

### 1. Dados das Filiais no Banco

Para a aba de remessas funcionar, as lojas precisam ter UF e CNPJ preenchidos:

```sql
-- Atualizar lojas existentes com UF e CNPJ
UPDATE erp_lojas SET uf = 'SP', cnpj = '12.345.678/0001-90' WHERE apelido = 'Centro';
UPDATE erp_lojas SET uf = 'RJ', cnpj = '12.345.678/0002-71' WHERE apelido = 'Shopping';
-- Adicione mais lojas conforme necessário
```

### 2. Configuração SEFAZ por Filial

Para emitir NFe real, cada filial precisa de configuração SEFAZ:

```sql
INSERT INTO erp_configuracoes_sefaz (
  loja_id, ambiente, uf, serie_nfe, numeracao_atual_nfe, ativo
) VALUES (
  'ID-DA-LOJA', 'homologacao', 'SP', 1, 1, true
);
```

**Para preencher via UI:** Acesse `Gestão → Configurações SEFAZ` (já existe a página).

### 3. Certificado Digital A1 (para produção)

Para emitir NFe real (não homologação), é necessário:

1. **Adquirir Certificado A1** em uma Autoridade Certificadora:
   - Serasa Experian
   - Certisign
   - Valid
   - Soluti
   - Etc.

2. **Cadastrar no sistema** em `Gestão → NFE Certificado`:
   - Upload do arquivo .pfx
   - Senha do certificado
   - CNPJ/CPF do titular
   - Data de validade

3. **Vincular à loja** via Configurações SEFAZ (campo `certificado_id`).

### 4. Integração Real com SEFAZ

⚠️ **IMPORTANTE:** O que está implementado hoje é o **fluxo interno** (banco + UI). Para **emitir NFe real** com a SEFAZ, você precisa adicionar uma das bibliotecas:

#### Opção A: API própria + SEFAZ (recomendado para produção)

Você vai precisar de um **backend** (Node.js) que faça a comunicação com a SEFAZ:

```bash
npm install node-nfe
# ou
npm install @brunomoreno/nfe
# ou
npm install nfephp
```

A biblioteca escolhida precisa:
- Assinar o XML com o certificado A1
- Comunicar com webservice da SEFAZ
- Retornar protocolo de autorização
- Gerar chave de acesso válida

**Onde adicionar:** Criar uma pasta `api/` ou `server/` com endpoints REST:

```
POST /api/nfe/emitir    → Emite NFe com SEFAZ
POST /api/nfe/cancelar  → Cancela NFe autorizada
POST /api/nfe/manifestar → Manifestação do destinatário
GET  /api/nfe/download/:chave → Download de XML
```

#### Opção B: Serviços de terceiros (mais rápido)

Contratar um SaaS que faça a comunicação:
- **Focus NFe** (https://focusnfe.com.br/)
- **Webmania** (https://webmaniabr.com/)
- **eNotas** (https://enotas.com.br/)
- **NFe.io**

Esses serviços oferecem API REST simples que você consome do frontend.

### 5. Aplicar as novas migrations

Após clonar/atualizar o código:

```bash
cd erp-system

# 1. Instalar a nova dependência
npm install

# 2. Aplicar migrations 027 e 028 no Supabase
npm run migrate
# ou use o método que preferir (psql, Supabase CLI, etc)
```

As novas migrations criam:
- `erp_nfe_entrada`
- `erp_nfe_entrada_itens`
- `erp_remessas`
- `erp_remessa_itens`
- View `v_erp_remessas_dashboard`
- View `v_erp_nfe_entrada_dashboard`
- Função `erp_calcular_cfop_remessa`
- 6 configurações de CFOP padrão

---

## 🎯 Fluxo de Uso

### Importar NFe de Compra (entrada de mercadoria)

1. **Acesse** `/compras/importar-nfe` (ou sidebar Catálogo → Importar NFe)
2. **Faça upload** do XML da NFe recebida do fornecedor
3. **Revise** os itens auto-associados aos produtos existentes
4. **Ajuste** a margem padrão (50% por padrão) para produtos novos
5. **Clique em "Confirmar Importação"**
6. **Resultado:** Produtos novos criados, estoque atualizado, compra registrada

### Criar Remessa entre Filiais

1. **Acesse** `/remessas` (ou sidebar Fiscal → Remessas entre Filiais)
2. **Clique em "Nova Remessa"**
3. **Selecione:**
   - Loja origem (sugere automaticamente a loja atual)
   - Loja destino (apenas filiais diferentes)
   - Tipo (Remessa, Retorno, etc.)
4. **Adicione produtos** (quantidade e custo)
5. **Verifique** o CFOP automático (5152/6152/5202/6202)
6. **Salve como rascunho**
7. **Clique em "NFe"** para emitir:
   - NFe é gerada com numeração sequencial
   - Estoque da origem é baixado
   - Status muda para "NFe Emitida"
8. **Marque como "Em Trânsito"** quando enviar
9. **No destino**, clique em "Receber" para confirmar:
   - Estoque do destino é adicionado
   - Status muda para "Recebida"

---

## 🔍 Validações Automáticas

O sistema já faz:

- ✅ **Bloqueia** origem = destino
- ✅ **Calcula CFOP** baseado em UF × UF
- ✅ **Valida XML** antes de processar
- ✅ **Auto-match** por EAN → SKU → Nome
- ✅ **Atualiza preço de custo** do produto existente
- ✅ **Baixa estoque origem** ao emitir NFe
- ✅ **Sobe estoque destino** ao receber
- ✅ **Marca itens** como processados/não processados
- ✅ **Impede exclusão** de remessas já processadas (apenas rascunho)

---

## 📊 Dados que Você Precisa Cadastrar

Antes de usar o sistema, garanta:

1. **Lojas com UF e CNPJ** (não pode ser NULL para remessas)
2. **Configuração SEFAZ por loja** (em homologação para testes)
3. **Certificado Digital A1** (para produção)
4. **Produtos com código de barras (EAN)** (para melhor auto-matching)

---

## ⚠️ Limitações Atuais (TODO para produção)

| Limitação | Solução Recomendada |
|-----------|---------------------|
| Chave de acesso mock | Implementar biblioteca SEFAZ real |
| NFe não é enviada à SEFAZ | Backend com biblioteca de NFe |
| Sem download automático de XML de NFe | Integração com webservice de distribuição |
| Sem manifestação do destinatário | Implementar evento de manifestação |
| Sem cancelamento via SEFAZ | Endpoint de cancelamento |
| Sem Carta de Correção (CC-e) | Endpoint de CC-e |
| Sem contingência (SVC) | Lógica de contingência |
| Sem DANFE (PDF) | Gerador de PDF (ex: `@react-pdf/renderer`) |

---

## 🚀 Próximos Passos Recomendados

1. **Imediato:** Aplicar migrations 027 e 028 + configurar lojas
2. **Curto prazo:** Adicionar biblioteca SEFAZ (node-nfe ou similar)
3. **Curto prazo:** Implementar endpoints backend para NFe
4. **Médio prazo:** Integração com Focus NFe ou similar (mais rápido)
5. **Longo prazo:** SPED, contingência, eventos da NFe

---

## 📞 Suporte

Em caso de dúvidas sobre a integração fiscal, recomendo contratar uma consultoria especializada em NFe (ex: empresas que homologam com SEFAZ).

Para dúvidas técnicas do ERP, abra uma issue no repositório.
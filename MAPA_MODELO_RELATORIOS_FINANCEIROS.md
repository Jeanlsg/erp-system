# 📊 Modelo do Site · Relatórios Financeiros

**Origem:** `relatorios financeiros.html` (excellentsistemas.com.br)
**Sistema:** Ex Sistemas
**Página:** Relatórios Financeiros · Fluxo de Caixa
**Objetivo:** Mapear apenas a estrutura/modelo do site, sem dados financeiros reais.

---

## 🏗️ Estrutura Geral da Página

```
┌─────────────────────────────────────────────────────────────┐
│  [Header Top Bar]  · Menu · Perfil · Ocorrências · Boletos │
├──────────┬──────────────────────────────────────────────────┤
│          │  Relatórios Financeiros              [Voltar]    │
│ Sidebar  │  ─────────────────────────────────────────────  │
│          │  Botões de Ação Rápida                            │
│ Menu de  │  ─────────────────────────────────────────────  │
│ Navegação│  Filtro de Período [Data Inicial] [Data Final]   │
│          │  ─────────────────────────────────────────────  │
│          │  [Tabs: Fluxo | Vendas | Gráficos | Formas |     │
│          │   Taxas | Pagas | À Pagar | Recebidas | À Receber│
│          │   Notas Fiscais]                                  │
│          │  ─────────────────────────────────────────────  │
│          │  [Conteúdo da aba selecionada]                   │
└──────────┴──────────────────────────────────────────────────┘
```

---

## 📐 Layout · 12 Colunas (Bootstrap)

| Coluna | Tamanho | Uso |
|--------|:-------:|-----|
| Sidebar | 3 cols | Menu lateral fixo |
| Conteúdo | 9 cols | Área principal |
| Card KPI | 3 cols | 4 cards por linha |
| Tabela | 12 cols | Largura completa |

---

## 🎨 Estrutura de Componentes

### 1. Header (Top Bar)
```
┌──────────────────────────────────────────────────────────────┐
│ ☰ Menu │ Perfil · Config · Tutoriais · Sair │ ✉ · 🎂 · 🏦   │
└──────────────────────────────────────────────────────────────┘
```

**Componentes:**
- Botão toggle do menu lateral (☰)
- Dropdown de usuário (Perfil, Configuração, Tutoriais, Sair)
- Ícones de ação rápida:
  - ✉ Ocorrências (badge verde)
  - 🎂 Aniversariantes (badge verde)
  - 🏦 Contas a pagar/receber
  - 📢 Opinião
  - 📊 Boletos (alerta amarelo/vermelho)

### 2. Sidebar (Menu Lateral)
```
┌─────────────────┐
│  [Logo Cliente] │
├─────────────────┤
│  [Avatar]        │
│  Bem-vindo(a), X │
│  Nome · Cargo    │
├─────────────────┤
│ Página Inicial   │
├─────────────────┤
│ Vendas e Pedidos │
│  · Ex Frente     │
│  · Notas Fiscais │
│  · Pedidos Deliv.│
│  · iFood         │
│  · ExApp Pedidos │
│  · Comanda/Mesa  │
│  · Boletos       │
│  · Venda Mais    │
│  · Comerc.       │
│  · TEF/SITEF     │
├─────────────────┤
│ Gestão           │
│  · Financeiro ●  │
│  · Empresarial   │
│  · Cobrança      │
│  · Recebimentos  │
│  · Análise Créd. │
│  · Usuários      │
│  · Agendas       │
│  · Painel Gestor │
│  · Faturamento   │
├─────────────────┤
│ Configurações    │
│  · Sistema       │
│  · Empresariais  │
│  · Minhas Chaves │
│  · Contador      │
│  · Downloads     │
│  · Treinamento   │
│  · Links Úteis   │
└─────────────────┘
```

### 3. Botões de Ação Rápida
```
┌────────────────┬────────────────┬────────────────┬────────────────┐
│ Incluir        │ Sangrias de    │ Entradas       │ Extrato de     │
│ Contas P/R     │ Caixa          │ Extra Caixa    │ Serviços       │
├────────────────┼────────────────┼────────────────┼────────────────┤
│ Fechamento     │ Conta          │ Ações de NF    │ Vendas Excl.   │
│ Caixa          │ Bancária       │                │                │
├────────────────┼────────────────┼────────────────┼────────────────┤
│ Contas         │ Relatório      │ Entregas       │ Entradas       │
│ Excluídas      │ Gerencial      │ Delivery       │ Canceladas     │
└────────────────┴────────────────┴────────────────┴────────────────┘
```

**Estilo:** Grid de 4 colunas · Botões verdes (`btn-new`)

### 4. Filtro de Período
```
┌─────────────────────────────────────────────────────────┐
│ Selecione um período:                                  │
│ [Data Inicial 📅]  [Data Final 📅]  [Consultar]         │
└─────────────────────────────────────────────────────────┘
```

### 5. Abas de Navegação
```
┌─────────────────────────────────────────────────────────┐
│ Fluxo │ Vendas │ Gráficos │ Formas │ Taxas │ Pagas │    │
│ À Pagar │ Recebidas │ À Receber │ NF                    │
└─────────────────────────────────────────────────────────┘
```

---

## 💰 Estrutura dos KPIs (Cards)

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Vendas       │ Vendas       │ Vendas Não   │ Vendas       │
│              │ Finalizadas  │ Finalizadas  │ Canceladas   │
│   [count]    │   [R$ xxx]   │   [R$ xxx]   │   [R$ xxx]   │
│ Encontradas  │ Pagas/Receb. │ Não Final.   │ Canceladas   │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ Itens        │ Descontos    │ Custo Total  │ Lucros       │
│   [count]    │   [R$ xxx]   │   [R$ xxx]   │ [R$ xxx](%)  │
│ Vendidos     │ Concedidos   │ Na data venda│ Sobre vendas │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Estrutura de cada Card:**
```html
<div class="x_panel_dash x_panel">
  <div class="x_title">
    <h2>{Título}</h2> <span class="info-icon">ⓘ</span>
  </div>
  <span class="x_content"><strong>{Valor}</strong></span>
  <span class="count_bottom">{Descrição}</span>
</div>
```

---

## 📋 Estrutura das Tabelas

### Tabela · Formas de Recebimento
```
┌──────────────────────────────────┬───────────────────────┐
│ Tipo de Recebimento              │ Valores Recebidos     │
├──────────────────────────────────┼───────────────────────┤
│ Dinheiro                         │ R$ xxx                │
│ PIX                              │ R$ xxx                │
│ Cartão Crédito                   │ R$ xxx                │
│ Cartão Débito                    │ R$ xxx                │
└──────────────────────────────────┴───────────────────────┘
```

### Tabela · Entradas Extra Caixa
```
┌──────────────┬─────────┬──────────────────┬─────────┐
│ Data/Hora    │ Motivo  │ Forma Recebim.   │ Valor   │
├──────────────┼─────────┼──────────────────┼─────────┤
│ dd/mm/aa HHmm│ texto   │ Dinheiro/PIX/etc │ R$ xxx  │
└──────────────┴─────────┴──────────────────┴─────────┘
```

### Tabela · Sangria
```
┌──────────────┬─────────┬─────────┐
│ Data/Hora    │ Motivo  │ Valor   │
├──────────────┼─────────┼─────────┤
│ dd/mm/aa HHmm│ texto   │ R$ xxx  │
└──────────────┴─────────┴─────────┘
```

### Tabela · Sub Total (Contas)
```
┌──────────────────────────────────┬───────────────────────┐
│ Sub Total                        │ R$ xxx                │
└──────────────────────────────────┴───────────────────────┘
```

### Tabela · Notas Fiscais
```
┌──────────────────┬──────────────┐
│ Notas Período    │ qtd          │
│ Nota Ok          │ qtd          │
│ Nota Cancelada   │ qtd          │
│ Nota Denegada    │ qtd          │
│ NFc              │ qtd          │
│ NFe              │ qtd          │
│ CFe              │ qtd          │
└──────────────────┴──────────────┘
```

---

## 🛒 Estrutura · Top 10 Produtos

```
┌──────────────────────────────────────────────────────────────────┐
│ 10 Produtos mais vendidos                       [Imprimir 🖨]     │
├────┬──────┬────────┬─────────────┬──────┬──────────┬──────┬─────┤
│ #  │ IMG  │ Código │ Descrição   │ Qtd  │ Vlr Unit │ Total│ Custo│
├────┼──────┼────────┼─────────────┼──────┼──────────┼──────┼─────┤
│ 1  │ [📦] │ SKU-1  │ Whey 1kg    │ 50   │ R$ 149   │ R$...│ R$..│
│ 2  │ [📦] │ SKU-2  │ Creatina    │ 30   │ R$ 79    │ R$...│ R$..│
│ ...                                                              │
└────┴──────┴────────┴─────────────┴──────┴──────────┴──────┴─────┘
```

---

## 🎨 Padrões Visuais

### Cores
| Elemento | Cor |
|----------|-----|
| Botão primário | Verde (`btn-new`) |
| Botão voltar | Verde claro (`btn-voltar`) |
| Alerta info | Azul (cornflowerblue) |
| Alerta vencimento | Amarelo (-10 dias) |
| Alerta crítico | Vermelho (+10 dias) |
| Status sucesso | Verde (`bg-green`) |

### Tipografia
| Uso | Padrão |
|-----|--------|
| H1/H2 Página | `font-size: 18-24px` |
| KPI Valor | `font-weight: bold` |
| Labels | `text-transform: uppercase` |
| Datas | `dd/mm/aaaa` |
| Moeda | `R$ 0.000,00` (pt-BR) |

### Espaçamentos
| Elemento | Padding/Margin |
|----------|---------------|
| Card KPI | `padding: 10px` |
| Botão grid | `margin-bottom: .7%` |
| Seção | `<hr class="space">` |

---

## 📦 Estrutura de Classes CSS Utilizadas

```css
/* Layout */
.container.body          /* Container principal */
.main_container           /* Wrapper sidebar + conteúdo */
.left_col                 /* Sidebar (3 cols) */
.right_col                /* Conteúdo (9 cols) */
.nav-md                   /* Layout médio */

/* Sidebar */
.sidebar-menu             /* Menu lateral */
.menu_section             /* Seção do menu */
.nav.side-menu            /* Lista de navegação */
.child_menu               /* Submenu */

/* Cards */
.x_panel                  /* Painel */
.x_panel_dash             /* Painel de dashboard */
.x_title                  /* Título do painel */
.x_content                /* Conteúdo principal */
.count_bottom             /* Label inferior */

/* Botões */
.btn                      /* Base */
.btn-new                  /* Verde primário */
.btn-voltar               /* Voltar */
.btn-menuLarge            /* Grid de botões */
.btnCadastrarNovaConta    /* CTA */

/* Tabelas */
.table                    /* Base */
.table-bordered           /* Com bordas */
.table-striped            /* Listrado */

/* Indicadores */
.imagem-limitada          /* Imagens 40px */
.imagem-limitada-p        /* Imagens 20px */
.glyphicon                /* Ícones */
```

---

## 🔘 Botões e Modais

| Botão | Modal/Link |
|-------|-----------|
| Incluir contas | Modal `#cadastrar-conta` |
| Conta bancária | Modal `#conta_bancaria` |
| Extrato serviços | Modal `#modalExtratoServicos` |
| Relatório gerencial | Modal `#relatorio-gerencial` |
| Entregas Delivery | Modal |
| Imprimir Relatório | Função `gerarRelatorioFluxo()` |

---

## 📋 Hierarquia de Componentes

```
Page
├── Header (top_nav)
│   ├── Toggle Menu
│   ├── User Dropdown
│   ├── Notification Icons
│   └── Contrast/Font Controls
├── Sidebar (left_col)
│   ├── Logo
│   ├── User Profile
│   ├── Menu Sections
│   └── Footer (Config, Fullscreen, Download, Logout)
├── Content (right_col)
│   ├── Page Header (título + Voltar)
│   ├── Breadcrumb
│   ├── Quick Action Buttons
│   ├── Period Filter
│   ├── Tab Navigation
│   └── Tab Content
│       ├── KPI Cards Row 1
│       ├── KPI Cards Row 2
│       ├── Detail Tables
│       └── Top Products
└── Modals
    ├── Cadastrar Conta
    ├── Conta Bancária
    ├── Extrato Serviços
    ├── Relatório Gerencial
    └── Boletos/Notificações (Popovers)
```

---

## 📌 Resumo da Estrutura

| Elemento | Quantidade | Padrão |
|----------|:----------:|--------|
| Colunas (Bootstrap) | 12 | grid responsivo |
| Abas principais | 10 | tabs horizontais |
| Cards KPI | 8 | grid 4x2 |
| Botões de ação rápida | 12 | grid 4x3 |
| Tabelas detalhadas | 9 | bordas + listrado |
| Modais | 5+ | Bootstrap modal |
| Header icons | 5 | badges + alerts |
| Sidebar seções | 3+ | collapsible |

Este mapeamento descreve **apenas o modelo/estrutura** do site, sem incluir dados financeiros reais.
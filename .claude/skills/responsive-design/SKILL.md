---
name: responsive-design
description: >
  Guia e checklist de revisão de design responsivo em CSS moderno — dimensionar layout,
  containers e tipografia com unidades relativas em vez de px (rem, em, %, ch, vw/vh,
  dvh/svh/lvh, vmin/vmax, fr, cqw/cqi), além de clamp()/min()/max(), Grid auto-fit +
  minmax (padrão RAM), Flexbox com wrap, aspect-ratio, gap, tipografia fluida, container
  queries vs media queries e as armadilhas comuns (100vh no mobile, em que compõe,
  breakpoints demais). Use para REVISAR responsividade de telas/componentes, propor
  troca de px por unidades relativas, montar layout que escala de 320px a 4K com poucas
  ou nenhuma media query, ou tirar dúvida sobre unidades CSS. Aplica-se a qualquer
  projeto (CSS puro, Tailwind, styled-components). Acione quando o pedido envolver
  "responsivo", "não quebra em mobile", "dimensionar container", "px vs rem/%", "fonte
  fluida", "container query" ou revisão de layout responsivo.
---

# Design responsivo — referência + checklist de revisão

Princípio central: **`px` é absoluto e fixo** (ignora zoom/preferência do usuário, não
escala). Layout responsivo dimensiona com **unidades relativas** — o valor é calculado a
partir da fonte raiz, da fonte do pai, da viewport ou do container. Regra prática:
**`px` só para o que NÃO deve escalar** (bordas de 1px, hairlines, sombras); **unidade
relativa para todo o resto** (layout, espaçamento, fonte).

## Modo revisão (use isto ao auditar uma tela/componente)

Percorra na ordem. Cada item ✗ é um achado a reportar com a correção sugerida.

1. **Largura/altura em `px` fixo** em containers, cards, wrappers → trocar por `%`,
   `rem`, `min()`/`clamp()` ou deixar grid/flex resolver. `width: 1200px` ✗ →
   `width: min(100% - 2rem, 75rem)` ✓.
2. **`height: 100vh`** em tela cheia/hero → vira barra "pulando" no mobile. Trocar por
   `min-height: 100dvh` ✓.
3. **`font-size` em `px`** → ignora acessibilidade. Trocar por `rem`; se varia por tela,
   usar `clamp()` (tipografia fluida) e remover o `@media` de fonte.
4. **Grade de cards com nº fixo de colunas + media queries** → trocar pelo padrão RAM
   (`repeat(auto-fit, minmax(min(100%, 16rem), 1fr))`) que quebra sozinho.
5. **`em` aninhado** em componentes (compõe e multiplica de forma imprevisível) → usar
   `rem` salvo quando o objetivo é justamente escalar com o texto do próprio elemento.
6. **Espaçamento com `margin` órfã** em listas/flex → trocar por `gap`.
7. **Blocos de texto largos demais** (linha > ~75 caracteres) → `max-width: 65ch`.
8. **Mídia/imagem sem proporção** causando layout shift → `aspect-ratio` + `width: 100%`.
9. **Overflow horizontal no mobile** → caçar larguras fixas > viewport, faltando
   `min-width: 0` em filhos de flex/grid, ou `100vw` ignorando scrollbar.
10. **Media queries demais para coisa de componente** → se a quebra depende do espaço do
    *componente* e não da *tela*, usar **container query**.
11. **Breakpoints "mágicos"** baseados em devices específicos (`768px`, `1024px`) →
    preferir breakpoints orientados ao conteúdo ("quando o texto fica apertado") e/ou
    soluções fluidas que dispensam o breakpoint.
12. **`min-width: 0` ausente** em itens de flex/grid que precisam encolher (causa
    estouro de texto/imagem). Adicionar nos filhos.

## Unidades — qual usar para quê

### Relativas a fonte
- **`rem`** — relativa ao `<html>` (raiz). **A unidade-base de tudo**: espaçamento,
  fonte, larguras. Respeita zoom/preferência. Padrão: `1rem = 16px`. Pense em múltiplos
  de `0.25rem`.
- **`em`** — relativa à fonte do **próprio elemento**. Bom pra padding de botão que deve
  acompanhar o texto. **Compõe** (aninhado multiplica) — cuidado.
- **`ch`** — largura do "0"; ideal pra largura de coluna de texto (`max-width: 65ch`).

### Relativas ao pai / espaço livre
- **`%`** — dimensão correspondente do **pai**.
- **`fr`** — fração do espaço livre (só em **Grid**).

### Relativas à viewport
- **`vw` / `vh`** — 1% da largura/altura da tela.
- **`vmin` / `vmax`** — 1% da menor/maior dimensão (cabe em retrato e paisagem).
- **`dvh` / `dvw`** — **dinâmica**: recalcula quando a barra do browser aparece/some.
  Use `100dvh` pra tela cheia no mobile.
- **`svh` / `lvh`** — small/large viewport (barra visível / escondida).

### Relativas ao container (Container Queries)
- **`cqw` / `cqh`** — 1% da largura/altura do container marcado.
- **`cqi` / `cqb`** — 1% do tamanho inline/block (respeita direção do texto).

## Funções que substituem media queries

```css
/* clamp(min, ideal, max) — o canivete suíço */
h1        { font-size: clamp(2rem, 1.5rem + 4vw, 4rem); }  /* fonte fluida */
.container{ width: min(100% - 2rem, 75rem); margin-inline: auto; } /* gutter + trava */
section   { padding-inline: clamp(1rem, 5vw, 4rem); }       /* padding fluido */
.wrapper  { width: min(90%, 60rem); }                       /* menor dos dois */
.card     { width: max(15rem, 30%); }                       /* garante mínimo */
```
O termo do meio do `clamp()` costuma ser `base + unidade-de-viewport` (ex.: `1rem + 2vw`).

## Layout que se arranja sozinho

```css
/* Grid auto-responsivo — padrão "RAM" (Repeat, Auto-fit, Minmax). Zero media query. */
.grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
}
/* auto-fit: colunas vazias colapsam (cards esticam) | auto-fill: mantém trilhas vazias */

/* Flex que quebra sozinho */
.row { display: flex; flex-wrap: wrap; gap: 1rem; }
.row > * { flex: 1 1 20rem; min-width: 0; }   /* cresce, encolhe, base 20rem */

/* Proporção sem hack */
.video { aspect-ratio: 16 / 9; width: 100%; }
.avatar{ aspect-ratio: 1; width: 4rem; }
```

## Container Queries vs Media Queries

- **Media query** = "qual o tamanho da **tela**?" → use só pra mudanças de layout
  **global** (mostrar/esconder sidebar, trocar navegação).
- **Container query** = "qual o tamanho do **espaço do componente**?" → use pra
  componentes reutilizáveis (um card que aparece em sidebar estreita E em coluna larga).

```css
.card-wrapper { container-type: inline-size; container-name: card; }
@container card (min-width: 30rem) {
  .card { display: grid; grid-template-columns: 12rem 1fr; }
}
```

## Sistema recomendado (qualquer projeto)

1. Base em **`rem`** pra todo espaçamento e tipografia (escala: `0.25 0.5 1 1.5 2 3rem`).
2. Container centralizado: `width: min(100% - 2rem, 75rem); margin-inline: auto;`.
3. **Tipografia fluida com `clamp()`** — mata breakpoints de fonte.
4. **Grid `auto-fit` + `minmax`** pra cards/galerias — mata breakpoints de coluna.
5. **`100dvh`** pra tela cheia no mobile.
6. **`max-width: 65ch`** em texto longo.
7. **Container queries** pra componentes; media queries só pra layout global.
8. **`px` só** pra bordas, hairlines e sombras.

### Exemplo que é responsivo de 320px a 4K sem nenhuma media query
```css
:root { --gutter: clamp(1rem, 5vw, 3rem); }
.page  { width: min(100% - 2rem, 75rem); margin-inline: auto;
         padding-block: clamp(2rem, 8vh, 6rem); }
h1     { font-size: clamp(2rem, 1.5rem + 4vw, 4rem); }
p      { max-width: 65ch; }
.cards { display: grid; gap: var(--gutter);
         grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); }
.hero  { min-height: 100dvh; }
```

## Tailwind (mapa rápido)

O Tailwind já materializa quase tudo: spacing em `rem` (`p-4` = `1rem`), `min-h-dvh`,
`aspect-video`/`aspect-square`, `gap-*`, `max-w-prose` (≈65ch), `w-[min(100%-2rem,75rem)]`,
fonte fluida via `text-[clamp(...)]`. Container queries com o plugin
`@tailwindcss/container-queries` (`@container`, `@sm:` etc.). Breakpoints `sm md lg xl 2xl`
são media queries — use pra layout global; pra componente, prefira o `@container`.
Ao revisar: classes com valores arbitrários em px (`w-[1200px]`, `text-[18px]`,
`h-[100vh]`) são candidatas a troca por `rem`/`dvh`/`clamp`/`min`.

## Armadilhas (resumo)

- `100vh` "pula" no mobile → `100dvh`.
- `em` aninhado compõe e multiplica → prefira `rem`.
- Estouro horizontal → falta `min-width: 0` em filho de flex/grid, ou largura fixa.
- `100vw` inclui a scrollbar e causa overflow → prefira `100%`.
- `auto-fit` vs `auto-fill`: escolha errada deixa cards esticados ou colunas fantasma.
- `html { font-size: 62.5% }` (truque do `1rem=10px`) pode prejudicar acessibilidade.

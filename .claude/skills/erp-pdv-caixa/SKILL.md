---
name: erp-pdv-caixa
description: PDV e caixa do ERP X-Life — como a venda é montada, paga (várias formas, troco), gravada (RPC registrar_venda_pdv, idempotente), emitida (NFC-e/NF-e) e o que acontece sem internet (fila cifrada, service worker); abertura, sangria, entrada extra e fechamento de caixa; atalhos de teclado; cliente pelo celular. Use para qualquer mudança ou defeito no PDV/frente de caixa, no fechamento, no modo offline ou nos atalhos, e para montar o roteiro de teste do balcão.
---

# PDV e caixa

Tela: `src/pages/pdv.tsx` (grande; leia os comentários antes de mudar — cada bloco registra um
defeito real). Regras puras ficam em `src/lib/*` e têm teste; mantenha assim.

## Fluxo da venda

1. **Cupom:** produto por código (leitor USB em qualquer lugar da tela: `use-leitor-usb.ts`;
   câmera: `leitor-codigo-barras`), busca (F5), quantidade (`quantidade-lancamento.ts`),
   desconto por item (F6/F7). Kit entra como item com `kit_id`.
2. **Cliente:** combobox da filial (`useClientesDaFilial`) ou "cliente pelo celular"
   (`src/components/cliente-rapido-pdv.tsx`): busca no ERP (`erp.buscar_cliente_por_telefone`) e no
   CRM (`erp.buscar_lead_crm`), ou cadastra. Vendedor = funcionário ligado ao usuário (comissão).
3. **Tela de pagamento (F10):** ocupa a frente inteira. Desconto geral, acréscimo, formas
   (`src/components/pagamentos-venda.tsx`: `aplicarDigitado`, `prepararFinalizacao`,
   `faltaPagar`, `trocoDe` — testadas), documento fiscal (sem nota / NFC-e / NF-e), CPF na nota.
   Desconto e acréscimo travam depois do primeiro pagamento lançado.
4. **Gravar:** `registrarVenda` (`src/lib/offline/fila-vendas.ts`) → RPC
   `erp.registrar_venda_pdv`: venda, itens, pagamentos e baixa de estoque numa transação.
   A chave `uuid_local` nasce no caixa: reenviar devolve a mesma venda, não cria outra.
5. **Depois:** triggers em `erp_vendas` — conta a receber, comissão, pontos de fidelidade,
   auditoria, fila do CRM (`trg_crm_sync_venda`). Nota fiscal pela edge `erp-emitir-nfe`
   (se falhar, a venda fica e a nota sai depois em Notas Fiscais).
6. **A tela relê tudo que a venda mexeu:** `invalidarDominios(qc, ...DOMINIOS_DA_VENDA)` logo
   depois de gravar, e de novo quando a fila offline sobe. ⚠️ Sem isso, o fechamento mostrou como
   esperado na gaveta só o saldo inicial depois de R$ 400 vendidos em dinheiro.

## Offline

- `public/sw.js`: navegação network-first com fallback para o shell; `/assets/*` cache-first;
  chamadas ao Supabase **nunca** em cache (dado de negócio cacheado vira tela mentirosa).
- `src/lib/offline/`: IndexedDB (`db.ts`), cifra (`cifra.ts`), catálogo espelhado
  (`catalogo.ts`), estado da rede (`conexao.ts`), fila (`fila-vendas.ts`).
- A venda entra na fila **antes** do envio e só sai quando o servidor confirma.
- **Sair** apaga o espelho offline (`apagarCacheOffline`, store `cache`), nunca a fila
  (`fila_vendas`) nem a chave do aparelho (`chaves`). Com venda não enviada, os botões de sair
  perguntam antes (`podeSair()`): a fila sobe depois com a sessão de quem entrar.
- Sem internet, só "sem nota" fica disponível na tela de pagamento; a NFC-e sai depois em
  contingência (`tpEmis=9`). Ver limitação legal na skill `erp-fiscal`.

## Caixa (turno)

- Pontos de venda por loja (`usePontosVenda`, RPCs `criar_pontos_venda`/`remover_ponto_venda`).
- Abrir: confirma a senha de quem assume (login do Supabase; a senha não é guardada).
- Sangria (Ctrl+S) e entrada extra (Ctrl+E): só a forma **dinheiro** mexe no esperado da gaveta.
  Ctrl+A aplica entrada em pedido (`aplicar_entrada_pedido`).
- **Esperado na gaveta** vem do banco (`vw_caixa_resumo.valor_esperado_gaveta` = inicial +
  vendas em dinheiro − sangrias em dinheiro + entradas em dinheiro). A tela nunca recalcula.
  O resumo é relido sempre que o fechamento abre, e o botão espera a leitura terminar.
- Fechar (Ctrl+X): `useFecharCaixa` marca o caixa fechado; o trigger
  `fn_criar_fechamento_automatico` cria a linha em `erp_fechamentos_caixa` zerada; a tela completa
  por upsert. **Upsert = UPDATE** → precisa da policy de UPDATE para quem abriu o caixa (migration 075).
- Fechar caixa de outra pessoa: `fechar_caixa_indireto`.
- Comprovante: `src/lib/comprovante-fechamento.ts` + `dados-fechamento.ts` (formato do sistema
  anterior; o esperado na gaveta vem do banco, `vw_caixa_resumo`, por forma).

## Atalhos

`src/lib/use-atalhos-pdv.ts` escuta a **janela inteira** em fase de captura: F-keys e Ctrl valem
até dentro de campo. Qualquer tela sobreposta que não pode receber os atalhos do cupom
precisa desligá-los (`useAtalhosPdv(ATALHOS, !telaAberta)`) e ter os seus. Um F11 vazando para
a tela de pagamento cancelaria a venda. `Ctrl+H` lista todos.

## Roteiro de teste do balcão (homologação)

1. Venda simples em dinheiro com troco; conferir `erp_vendas`, `erp_venda_pagamentos`, estoque e conta a receber.
2. Venda mista (PIX + dinheiro), desconto no item e geral; conferir que a soma bate e o troco só sai do dinheiro.
3. Venda com cliente pelo celular (lead do CRM); em até 5 min, lead ganho no CRM (`erp-integracao-crm`).
4. NFC-e com e sem CPF; NF-e com cliente sem endereço (tem de avisar **antes** de gravar).
5. Offline: desligar a rede, vender, religar; a venda sobe uma vez só.
6. Abrir, sangria, fechar caixa **com um usuário de papel caixa** (RLS), imprimir comprovante.
7. Atalhos com a tela de pagamento aberta: F11/F8 não podem agir; F10 confirma.

Unitários: `npx vitest run` (pagamentos, atalhos, quantidade, fechamento por forma, comprovante, caixas permitidos).

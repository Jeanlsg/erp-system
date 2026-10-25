---
name: erp-pdv-caixa
description: PDV e caixa do ERP X-Life — como a venda é montada, paga (várias formas, troco), gravada (RPC registrar_venda_pdv, idempotente), emitida (NFC-e/NF-e) e o que acontece sem internet (fila cifrada, service worker); abertura, sangria, entrada extra e fechamento de caixa; atalhos de teclado; cliente pelo celular. Use para qualquer mudança ou defeito no PDV/frente de caixa, no fechamento, no modo offline ou nos atalhos, e para montar o roteiro de teste do balcão.
---

# PDV e caixa

Tela: `src/pages/pdv.tsx` (grande; leia os comentários antes de mudar — cada bloco registra um
defeito real). Regras puras ficam em `src/lib/*` e têm teste; mantenha assim.

## Fluxo da venda

0. **Visual:** a frente de caixa copia a do sistema anterior (Excellent, pedido da loja em
   10/2026): abas dos módulos (itens e permissões vêm de `sections` do menu), faixa
   Caixa/Usuário/Vendedor/Cliente/Loja/SAIR (F12), produto em letra grande, código à esquerda,
   cupom em Courier à direita, 6 botões de ação + totais, barra de baixo. Cores em `COR`
   (`pdv.tsx`). Com a venda aberta o `PdvLayout` esconde o cabeçalho dele; filial e logout ficam
   na seleção de caixa (SAIR). Nada de painel aberto ao lado do cupom: vendedor, cliente,
   desconto e acréscimo abrem pelo botão/atalho.
1. **Cupom:** produto por código (leitor USB em qualquer lugar da tela: `use-leitor-usb.ts`;
   câmera: `leitor-codigo-barras`), busca (F5), quantidade (`quantidade-lancamento.ts`),
   quantidade em dinheiro (Ctrl+R, `quantidadePorValor`), desconto geral ou por item (F6, ou
   o ⟳ no cabeçalho % DESC/R$ DESC), alterar item (F7), cancelar item pelo número (F8; sem
   clique na linha, vale o último lançado). Kit entra como item com `kit_id`.
2. **Cliente (F2):** diálogo com a busca da filial (`useClientesDaFilial`) e o botão "cliente
   pelo celular" (`src/components/cliente-rapido-pdv.tsx`): busca no ERP
   (`erp.buscar_cliente_por_telefone`) e no CRM (`erp.buscar_lead_crm`), ou cadastra.
   Vendedor (F1) = funcionário ligado ao usuário (comissão).
3. **Tela de pagamento (F10):** ocupa a frente inteira. Desconto geral, acréscimo, formas
   (`src/components/pagamentos-venda.tsx`: `aplicarDigitado`, `prepararFinalizacao`,
   `faltaPagar`, `trocoDe` — testadas), documento fiscal (sem nota / NFC-e / NF-e), CPF na nota.
   Desconto e acréscimo travam depois do primeiro pagamento lançado.
3b. **Entrega ("Precisa de entrega?", na tela de pagamento):** `src/components/entrega-venda-pdv.tsx`
   + regras em `src/lib/entrega-venda.ts` (testadas). Transportadora, região (sugerida pelo CEP ou
   bairro, traz a taxa), frete, entrega futura e endereço (busca no ViaCEP, que traz o IBGE; endereços
   salvos do cliente). A taxa soma no total e fica fora do desconto; trava depois do primeiro
   pagamento. Exige cliente. A venda grava `taxa_entrega` e vira pedido no Ciclo de pedidos já em
   Separação (migration 098); cancelar/devolver a venda cancela o pedido. O fechamento mostra as
   taxas do turno (`vw_caixa_resumo.taxas_entrega`, informativo — o dinheiro já está nas vendas).
4. **Gravar:** `registrarVenda` (`src/lib/offline/fila-vendas.ts`) → RPC
   `erp.registrar_venda_pdv`: venda, itens, pagamentos e baixa de estoque numa transação.
   A chave `uuid_local` nasce no caixa: reenviar devolve a mesma venda, não cria outra.
5. **Depois:** triggers em `erp_vendas` — conta a receber, comissão, pontos de fidelidade,
   auditoria, fila do CRM (`trg_crm_sync_venda`). Nota fiscal pela edge `erp-emitir-nfe`
   (se falhar, a venda fica e a nota sai depois em Notas Fiscais).
6. **A tela relê tudo que a venda mexeu:** `invalidarDominios(qc, ...DOMINIOS_DA_VENDA)` logo
   depois de gravar, e de novo quando a fila offline sobe. ⚠️ Sem isso, o fechamento mostrou como
   esperado na gaveta só o saldo inicial depois de R$ 400 vendidos em dinheiro.

## Cancelar venda (Vendas › Cancelar)

`erp.cancelar_venda(venda, motivo, simular)` (migration 099) + `src/lib/cancelar-venda.ts` (ordem,
testada) + `src/components/cancelar-venda-dialog.tsx`. Ordem: **simula no banco → cancela a nota na
SEFAZ → cancela a venda** (invertido, uma recusa do banco deixaria a nota cancelada e a venda de pé).
Desfaz pelos movimentos da venda (estoque e lotes ao custo da saída), cancela contas/crediário/
promissórias, estorna pontos; comissão pendente e pedido de entrega caem pelos triggers. Recusa:
caixa da venda fechado, venda com devolução, parcela a prazo já recebida, nota em contingência, quem
não tem `venda.cancelar` (`erp.usuario_tem_permissao`, mesmo critério do `can()`). Motivo ≥ 15
caracteres (vai como justificativa da nota). Fora disso, o caminho é Devolução.

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

## Vendedor no caixa de quem está acima (migration 113)

- Função `vendedor` (111/112, `ROLE_RANK` 0). Vende no turno **aberto** por ele ou por alguém de
  função acima (caixa, estoquista, gerente, master), nos caixas que o master liberou para ele
  (`erp_usuario_pontos_venda`, lista vazia = todos) e na filial dele. As outras funções: só o
  próprio caixa. Vale o papel **principal** (`erp_usuarios.role`).
- Banco: `erp.pode_operar_caixa(caixa)` e `erp.caixas_operaveis(loja)` (SECURITY DEFINER — o
  vendedor não lê o papel de quem abriu). `registrar_venda_pdv` confere o `caixa_id`: existe, é da
  filial da venda e, **online**, está aberto e quem vende pode operá-lo. Venda da fila offline só
  precisa do caixa existir na filial e de quem envia trabalhar nela (o caixa pode ter fechado; a
  fila sobe com a sessão de quem entrar).
- Tela: `useCaixasOperaveis` (chave `erp_caixa-operaveis`, no domínio `caixa` — a venda relê) +
  `caixasParaOperar`/`caixaAtivoNaLoja` (próprios primeiro). A faixa mostra "Caixa: 002 · de
  Fulano"; o seletor e "Caixas em Aberto" oferecem "Operar". **Só quem abriu fecha**
  (`motivoParaNaoFechar`).
- Travas por permissão (o master tira por usuário), no `ativo` do atalho + title no botão:
  `venda.desconto` (F6, Ctrl+F6, ⟳ do cupom, campos da tela de pagamento e preço abaixo do cadastro
  / desconto no Alterar item), `caixa.sangria` (Ctrl+S, Ctrl+E), `caixa.fechar` (Ctrl+X),
  `caixa.abrir` (Abrir Caixa). "Receber e finalizar" não tem trava.
- ⚠️ A RLS de `erp_sangrias`/`erp_entradas_extras` (inserts diretos do front) só aceita escrita de
  admin/gerente nas migrations — confira no banco real, com o JWT de um caixa e de um vendedor,
  antes de contar que sangria funciona para eles.

## Atalhos

`src/lib/use-atalhos-pdv.ts` escuta a **janela inteira** em fase de captura: F-keys e Ctrl valem
até dentro de campo. Qualquer tela sobreposta que não pode receber os atalhos do cupom
precisa desligá-los (`useAtalhosPdv(ATALHOS, !telaAberta)`) e ter os seus. Um F11 vazando para
a tela de pagamento cancelaria a venda. `Ctrl+H` lista todos.

Mesmas teclas do sistema anterior: F1 vendedor, F2 cliente, F4 código, F5 localizar, F6
desconto, Ctrl+F6 acréscimo, F7 alterar item, F8 cancelar item, F9 consultar preço, Ctrl+R
quantidade em dinheiro, F10 pagamento, F11 cancelar venda, Ctrl+S sangria, Ctrl+E entrada,
Ctrl+D devoluções (só com cupom vazio — sair da tela perde o cupom), Ctrl+A aplicar entrada,
Ctrl+X fechar caixa, F12/Ctrl+F12 sair da frente. Os botões da tela chamam o mesmo `ATALHOS`
(`disparar`), então botão e tecla nunca divergem.

Para ver a tela sem tocar no banco: suba o Vite com `VITE_SUPABASE_URL` apontando para um host
falso e responda as chamadas no Playwright (`page.route`) com dados fictícios, semeando o
`localStorage` `erp-auth` com um usuário.

## Roteiro de teste do balcão (homologação)

1. Venda simples em dinheiro com troco; conferir `erp_vendas`, `erp_venda_pagamentos`, estoque e conta a receber.
2. Venda mista (PIX + dinheiro), desconto no item e geral; conferir que a soma bate e o troco só sai do dinheiro.
3. Venda com cliente pelo celular (lead do CRM); em até 5 min, lead ganho no CRM (`erp-integracao-crm`).
4. NFC-e com e sem CPF; NF-e com cliente sem endereço (tem de avisar **antes** de gravar).
5. Offline: desligar a rede, vender, religar; a venda sobe uma vez só.
6. Abrir, sangria, fechar caixa **com um usuário de papel caixa** (RLS), imprimir comprovante.
6b. Vendedor: vender no caixa aberto pelo gerente ("Caixa: 00X · de Fulano"), sangria nele, e conferir que Fechar Caixa fica desligado; gerente fecha o turno e a próxima venda do vendedor é recusada com a mensagem de caixa fechado.
7. Atalhos com a tela de pagamento aberta: F11/F8 não podem agir; F10 confirma.

Unitários: `npx vitest run` (pagamentos, atalhos, quantidade, fechamento por forma, comprovante, caixas permitidos).

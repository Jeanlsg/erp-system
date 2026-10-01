#!/usr/bin/env bash
# Confere, SÓ LENDO, se os números que um módulo passa para o outro batem no
# banco de produção. Cada linha devolvida é um defeito a investigar (ou dado de
# teste antigo — confira a data). Bugs que não aparecem na tela moram aqui.
# Uso: bash .claude/skills/erp-testes/scripts/conferir-dados.sh
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
source .claude/skills/erp-deploy/scripts/env.sh || exit 1
ssh -o ConnectTimeout=15 "$ERP_SSH_HOST" "docker exec -i $ERP_DB_CONTAINER psql -U supabase_admin -d postgres -At -F ' | '" <<'SQL'
\echo == 1. venda do PDV sem caixa (não entra no fechamento)
SELECT id, created_at::date FROM erp.erp_vendas WHERE status='finalizada' AND tipo_venda='pdv' AND caixa_id IS NULL LIMIT 10;
\echo == 2. pagamentos que não somam o total (sem linhas = venda antiga; a view cai na forma principal)
SELECT v.id, v.created_at::date, v.total, coalesce(sum(p.valor),0) FROM erp.erp_vendas v LEFT JOIN erp.erp_venda_pagamentos p ON p.venda_id=v.id
 WHERE v.status='finalizada' GROUP BY v.id HAVING abs(v.total - coalesce(sum(p.valor),0)) > 0.01 LIMIT 10;
\echo == 3. crediário/boleto/promissória sem conta a receber
SELECT v.id, p.forma, p.valor FROM erp.erp_vendas v JOIN erp.erp_venda_pagamentos p ON p.venda_id=v.id
 WHERE v.status='finalizada' AND p.forma::text IN ('crediario','boleto','promissoria')
   AND NOT EXISTS (SELECT 1 FROM erp.erp_contas c WHERE c.venda_id=v.id) LIMIT 10;
\echo == 4. item vendido sem saída no estoque
SELECT i.venda_id, i.nome, i.quantidade FROM erp.erp_venda_itens i JOIN erp.erp_vendas v ON v.id=i.venda_id
 WHERE v.status='finalizada' AND i.produto_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM erp.erp_estoque_movimentacoes m WHERE m.documento_id=v.id AND m.produto_id=i.produto_id) LIMIT 10;
\echo == 5. estoque negativo
SELECT p.sku, l.apelido, e.quantidade FROM erp.erp_estoque e JOIN erp.erp_produtos p ON p.id=e.produto_id JOIN erp.erp_lojas l ON l.id=e.loja_id WHERE e.quantidade < 0;
\echo == 6. caixa aberto há mais de 24h
SELECT c.id, u.email, c.data_abertura::timestamp(0) FROM erp.erp_caixa c LEFT JOIN erp.erp_usuarios u ON u.id=c.usuario_id
 WHERE c.status='aberto' AND c.data_abertura < now() - interval '24 hours';
\echo == 7. fechamento com diferença ≠ informado − esperado (view)
SELECT f.caixa_id, f.created_at::date, f.valor_final, r.valor_esperado_gaveta, f.diferenca FROM erp.erp_fechamentos_caixa f JOIN erp.vw_caixa_resumo r ON r.id=f.caixa_id
 WHERE abs(f.diferenca - (f.valor_final - r.valor_esperado_gaveta)) > 0.01 ORDER BY f.created_at DESC LIMIT 10;
\echo == 8. comissão: venda com vendedor e sem comissão
SELECT v.id, v.created_at::date FROM erp.erp_vendas v WHERE v.status='finalizada' AND v.vendedor_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM erp.erp_comissoes c WHERE c.venda_id=v.id) LIMIT 10;
\echo == 9. tabelas perto do corte de 1000 linhas do PostgREST (listas sem lerTudo cortam)
SELECT relname || ' ≈ ' || n_live_tup FROM pg_stat_user_tables WHERE schemaname='erp' AND n_live_tup > 700 ORDER BY n_live_tup DESC;
SQL

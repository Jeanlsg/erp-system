-- ============================================================
-- 111 — função (papel) "vendedor"
--
-- Pedido da loja (outubro/2026): as funções passam a ser Usuário master
-- (o `admin` de sempre — só o rótulo mudou no front), Gerente, Estoquista,
-- Operador de caixa e o novo Vendedor, que vende no caixa aberto por ele ou
-- por alguém acima dele, nos caixas que o master liberar (113).
--
-- Fica SOZINHA nesta migration de propósito: um valor novo de enum não pode
-- ser usado na mesma transação em que foi criado. Quem semeia as permissões
-- do vendedor é a 112, depois do COMMIT desta.
--
-- No banco o vendedor tem os mesmos direitos do operador de caixa: as
-- policies só distinguem admin/gerente (is_erp_admin) do resto. A regra do
-- caixa de quem está acima fica em erp.pode_operar_caixa (113).
-- ============================================================

BEGIN;

ALTER TYPE erp.erp_user_role ADD VALUE IF NOT EXISTS 'vendedor';

COMMIT;

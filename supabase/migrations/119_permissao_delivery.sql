-- ============================================================
-- 119 — permissão "pedido.delivery"
--
-- O botão Delivery da frente de caixa (Ciclo de pedidos) e o "Precisa de
-- entrega?" da tela de pagamento não olhavam permissão nenhuma, e o menu
-- Pedidos Delivery pedia só "venda.criar". O vendedor via tudo isso sem o
-- master ter liberado. Nasce "pedido.delivery", que o master dá ou tira por
-- usuário (Usuários e Permissões, já no formulário de criação do vendedor).
--
-- Quem usa delivery hoje não pode perder o botão: entra no padrão de toda
-- função que vende, menos o vendedor, e em todo usuário com permissões
-- próprias que vende e não é vendedor (o objeto não vazio JÁ É o conjunto
-- efetivo do can()).
--
-- Navegação, não banco: como as outras permissões, controla botões e menu.
-- ============================================================

BEGIN;

UPDATE erp.erp_papel_permissoes
   SET permissoes = array_append(permissoes, 'pedido.delivery'),
       updated_at = now()
 WHERE papel::text <> 'vendedor'
   AND 'venda.criar' = ANY (permissoes)
   AND NOT ('pedido.delivery' = ANY (permissoes));

UPDATE erp.erp_usuarios
   SET permissoes = permissoes || '{"pedido.delivery": true}'::jsonb
 WHERE jsonb_typeof(permissoes) = 'object'
   AND role::text <> 'vendedor'
   AND (permissoes ->> 'venda.criar') = 'true'
   AND NOT (permissoes ? 'pedido.delivery')
   AND coalesce(permissoes ->> 'all', '') <> 'true';

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================
-- 112 — permissões padrão do vendedor e a permissão "caixa.sangria"
--
-- 1. Vendedor (função criada na 111): por padrão faz tudo o que o balcão
--    faz — vende, recebe, dá desconto, faz sangria/entrada e fecha o próprio
--    caixa. O master tira o que não quiser ao criar o login (permissões
--    próprias do usuário, tela Usuários e Permissões).
--
-- 2. Sangria e entrada de valores não tinham permissão própria: qualquer um
--    com caixa aberto fazia. Para o master poder tirar isso do vendedor, nasce
--    "caixa.sangria". Sem o passo abaixo, quem faz sangria hoje PERDERIA o
--    botão no dia em que o front novo entrasse — o PDV passa a exigir a
--    permissão. Por isso ela é dada a toda função e a todo usuário com
--    permissões próprias que já abre caixa ("caixa.abrir").
--
-- Navegação, não banco: como as outras permissões, isto controla botões e
-- menu. O que o banco aceita continua nas policies.
--
-- Depende da 111 já COMMITADA (o valor 'vendedor' do enum).
-- ============================================================

BEGIN;

INSERT INTO erp.erp_papel_permissoes (papel, permissoes) VALUES
  ('vendedor', ARRAY[
    'pdv.usar','caixa.abrir','caixa.fechar','caixa.sangria','venda.criar','venda.desconto',
    'produto.ver','estoque.ver',
    'cliente.ver','cliente.criar'])
ON CONFLICT (papel) DO NOTHING;

-- O PDV novo também passa a conferir "caixa.fechar" (fechar o próprio caixa)
-- e "venda.desconto" (F6, Ctrl+F6, desconto da linha). Antes esses botões
-- não olhavam permissão nenhuma: para quem usa o PDV e não tem a chave no
-- objeto, ela entra como verdadeira — mantém o que a pessoa já fazia. Chave
-- gravada como false foi o master tirando, e fica como está.
UPDATE erp.erp_papel_permissoes
   SET permissoes = permissoes
         || CASE WHEN 'caixa.fechar'   = ANY (permissoes) THEN '{}'::text[] ELSE ARRAY['caixa.fechar'] END
         || CASE WHEN 'venda.desconto' = ANY (permissoes) THEN '{}'::text[] ELSE ARRAY['venda.desconto'] END,
       updated_at = now()
 WHERE 'pdv.usar' = ANY (permissoes)
   AND NOT ('caixa.fechar' = ANY (permissoes) AND 'venda.desconto' = ANY (permissoes));

UPDATE erp.erp_usuarios
   SET permissoes = permissoes
         || CASE WHEN permissoes ? 'caixa.fechar'   THEN '{}'::jsonb ELSE '{"caixa.fechar": true}'::jsonb END
         || CASE WHEN permissoes ? 'venda.desconto' THEN '{}'::jsonb ELSE '{"venda.desconto": true}'::jsonb END
         || CASE WHEN permissoes ? 'caixa.abrir'    THEN '{}'::jsonb ELSE '{"caixa.abrir": true}'::jsonb END
 WHERE jsonb_typeof(permissoes) = 'object'
   AND (permissoes ->> 'pdv.usar') = 'true'
   AND coalesce(permissoes ->> 'all', '') <> 'true'
   AND NOT (permissoes ? 'caixa.fechar' AND permissoes ? 'venda.desconto' AND permissoes ? 'caixa.abrir');

-- toda função que abre caixa ganha sangria/entrada (era assim, sem trava)
UPDATE erp.erp_papel_permissoes
   SET permissoes = array_append(permissoes, 'caixa.sangria'),
       updated_at = now()
 WHERE 'caixa.abrir' = ANY (permissoes)
   AND NOT ('caixa.sangria' = ANY (permissoes));

-- usuários com permissões próprias: o objeto não vazio JÁ É o conjunto
-- efetivo (can() no front), então a chave nova tem de entrar nele. O curinga
-- {"all": true} já cobre tudo e fica como está.
UPDATE erp.erp_usuarios
   SET permissoes = permissoes || '{"caixa.sangria": true}'::jsonb
 WHERE jsonb_typeof(permissoes) = 'object'
   AND (permissoes ->> 'caixa.abrir') = 'true'
   AND NOT (permissoes ? 'caixa.sangria')
   AND coalesce(permissoes ->> 'all', '') <> 'true';

NOTIFY pgrst, 'reload schema';

COMMIT;

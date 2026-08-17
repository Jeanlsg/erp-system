-- ============================================================
-- 056: Fecha EXECUTE público nas funções do schema erp
--
-- Achado ao verificar se o PDV offline funciona de verdade: 18 funções
-- SECURITY DEFINER do schema erp estavam executáveis pelo papel `anon`.
--
-- A causa é um padrão do Postgres, não um descuido pontual: toda função
-- nasce com EXECUTE para PUBLIC. Quem escreve `GRANT ... TO authenticated`
-- e não escreve o REVOKE correspondente acha que restringiu e não
-- restringiu — foi o que aconteceu em curva_abc, saldo_devedor_cliente,
-- preco_efetivo, lojas_dfe_pendentes e marcar_*_vencidas.
--
-- O que isso significa na prática: a chave anônima está no bundle do front
-- por desenho, é pública. Com ela dava para chamar erp.curva_abc() e ler
-- faturamento e margem de todos os produtos sem login, ou chamar
-- erp.marcar_contas_vencidas() e mexer no financeiro.
--
-- A correção é uma varredura, não um remendo: revoga de PUBLIC e de anon em
-- TODAS as funções do schema, devolve para os papéis certos, e muda o
-- default para que função nova não volte a nascer aberta.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- 1. Fecha tudo.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA erp FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA erp FROM anon;

-- 2. Devolve para quem o app usa. `authenticated` é o papel de todo usuário
--    logado no ERP; a autorização fina continua sendo o current_erp_user_id()
--    e o RLS dentro de cada função.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA erp TO authenticated, service_role;

-- 3. Reaperta as que nunca deveriam sair do service_role.
--    descriptografar_senha_cert devolve a senha do certificado A1 em claro:
--    é a única chave que protege a assinatura fiscal da empresa.
--    registrar_dfe_lote e disparar_coleta_dfe são chamadas pelas edge
--    functions e pelo cron — dar à tela seria deixar o controle de NSU,
--    que é a memória do canal da SEFAZ, ao alcance do front.
REVOKE ALL ON FUNCTION erp.descriptografar_senha_cert(bytea) FROM authenticated;
REVOKE ALL ON FUNCTION erp.disparar_coleta_dfe() FROM authenticated;
REVOKE ALL ON FUNCTION erp.registrar_dfe_lote(uuid, jsonb, bigint, bigint, text, text, timestamptz, text, bigint)
  FROM authenticated;

-- 4. Função nova não nasce mais aberta. Sem isto a próxima migration
--    reabre o buraco sem ninguém perceber — que é exatamente o que aconteceu.
ALTER DEFAULT PRIVILEGES IN SCHEMA erp REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA erp
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA erp
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- 5. Tabelas e sequências: já estavam fechadas para anon, mas explicitar
--    custa nada e documenta a intenção.
REVOKE ALL ON ALL TABLES IN SCHEMA erp FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA erp FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA erp REVOKE ALL ON TABLES FROM anon;

-- USAGE no schema fica: sem privilégio em nenhum objeto ele não abre nada,
-- e tirar mexeria na superfície de autenticação inteira por um ganho que já
-- foi obtido acima. Fechar o que vaza é o conserto; o resto seria aposta.

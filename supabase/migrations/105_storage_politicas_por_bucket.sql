-- ============================================================
-- 105 — storage: cada bucket com a sua regra; fim do "qualquer um pode tudo".
--
-- Achado em 10/10/2026. O Supabase da xlifevps é dividido com o CRM (schema
-- public, usuários próprios em auth.users) e tinha duas políticas genéricas:
--   "Authenticated can view objects" (SELECT true)
--   "Authenticated can upload"       (INSERT true)
-- Ou seja, qualquer usuário logado — do ERP ou do CRM, até um caixa — lia e
-- gravava em qualquer bucket: baixava o certificado digital A1 da loja
-- (.pfx), lia os XML das notas e podia trocar ou apagar o certificado
-- (erp_certificados_* só conferiam o bucket).
--
-- Regras novas:
--   certificados  ler/enviar/apagar: quem tem config.editar (o admin), só na
--                 pasta da loja dele (<loja_id>/...). As edges leem com a
--                 service key, que não passa por RLS.
--   fiscal        ler: usuário ERP da loja da pasta (<loja_id>/<ano>/...).
--                 Gravar: só as edges (service key).
-- Os buckets do CRM (midias, avatars, branding) já têm políticas próprias e
-- não dependiam das genéricas; "avatares" está vazio e sem uso no código.
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';

-- O pior: o RLS de storage.objects estava DESLIGADO. Nenhuma política valia,
-- e a chave pública (anon, que vai no JavaScript do site) listava e baixava
-- o certificado A1 da loja sem login — confirmado pela API em 10/10/2026.
-- Liga o RLS; TRUNCATE não passa por RLS, então sai de anon/authenticated.
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
REVOKE TRUNCATE ON storage.objects FROM anon, authenticated;

DROP POLICY IF EXISTS "Authenticated can view objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload"       ON storage.objects;

-- loja da pasta pertence ao usuário ERP logado?
CREATE OR REPLACE FUNCTION erp.storage_pasta_da_minha_loja(p_nome text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'erp', 'public'
AS $$
  SELECT erp.current_erp_user_id() IS NOT NULL
     AND split_part(p_nome, '/', 1) IN (
           SELECT l::text FROM erp.lojas_do_usuario(erp.current_erp_user_id()) AS l);
$$;
REVOKE ALL ON FUNCTION erp.storage_pasta_da_minha_loja(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.storage_pasta_da_minha_loja(text) TO authenticated;

-- ── certificados ──
DROP POLICY IF EXISTS erp_certificados_select ON storage.objects;
DROP POLICY IF EXISTS erp_certificados_insert ON storage.objects;
DROP POLICY IF EXISTS erp_certificados_delete ON storage.objects;

CREATE POLICY erp_certificados_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'certificados' AND erp.usuario_tem_permissao('config.editar')
         AND erp.storage_pasta_da_minha_loja(name));
CREATE POLICY erp_certificados_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificados' AND erp.usuario_tem_permissao('config.editar')
              AND erp.storage_pasta_da_minha_loja(name));
CREATE POLICY erp_certificados_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'certificados' AND erp.usuario_tem_permissao('config.editar')
         AND erp.storage_pasta_da_minha_loja(name));

-- ── fiscal (XML e DANFE das notas) ──
DROP POLICY IF EXISTS erp_fiscal_select ON storage.objects;
CREATE POLICY erp_fiscal_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fiscal' AND erp.storage_pasta_da_minha_loja(name));

-- "update/delete own objects" (owner = auth.uid()) continuam valendo para
-- quem enviou o arquivo; nos buckets do ERP quem envia é a edge ou o admin.
COMMIT;

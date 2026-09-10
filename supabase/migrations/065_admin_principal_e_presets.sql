-- ============================================================
-- 065: Admin principal e presets de páginas.
--
-- Duas decisões da implantação:
--
-- 1. PÁGINA DESLIGADA SOME PARA TODOS. Antes, qualquer usuário com role
--    'admin' via a página desativada em modo preview e podia religá-la.
--    Agora só o ADMIN PRINCIPAL (o dono do sistema) enxerga e mexe; para
--    todos os outros — inclusive outros admins — a página simplesmente
--    não existe. Quem controla o menu é um só.
--
-- 2. PRESETS DE TELAS. O conjunto de páginas ligadas é uma decisão que
--    muda com o momento da loja (implantação, operação enxuta, uso
--    completo). Em vez de religar dezenas de páginas na mão a cada
--    mudança, salva-se o conjunto atual com um nome e alterna-se entre
--    eles. Páginas protegidas nunca entram: elas não podem ser
--    desligadas por preset nenhum.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- ---------- 1. admin principal ----------
ALTER TABLE erp.erp_usuarios
  ADD COLUMN IF NOT EXISTS admin_principal boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN erp.erp_usuarios.admin_principal IS
  'Dono do sistema: único que vê páginas desativadas e altera o conjunto de telas ativas.';

-- O admin mais antigo é o dono; se já houver um marcado, nada muda.
UPDATE erp.erp_usuarios u
   SET admin_principal = true
 WHERE u.id = (
   SELECT id FROM erp.erp_usuarios
    WHERE role = 'admin' AND ativo
    ORDER BY created_at
    LIMIT 1
 )
   AND NOT EXISTS (SELECT 1 FROM erp.erp_usuarios WHERE admin_principal);

-- Só um principal por vez: promover alguém rebaixa o anterior.
CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_usuarios_admin_principal
  ON erp.erp_usuarios (admin_principal) WHERE admin_principal;

CREATE OR REPLACE FUNCTION erp.is_admin_principal()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = erp, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM erp.erp_usuarios
     WHERE id = auth.uid() AND ativo AND admin_principal
  );
$$;

REVOKE ALL ON FUNCTION erp.is_admin_principal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION erp.is_admin_principal() TO authenticated, service_role;

-- ---------- 2. quem altera as flags ----------
-- A leitura continua liberada (a sidebar de todo mundo precisa saber o que
-- está ligado); a escrita passa a ser exclusiva do principal.
DROP POLICY IF EXISTS erp_admin_update ON erp.erp_feature_flags;
DROP POLICY IF EXISTS erp_admin_insert ON erp.erp_feature_flags;
DROP POLICY IF EXISTS erp_admin_delete ON erp.erp_feature_flags;

CREATE POLICY erp_principal_update ON erp.erp_feature_flags
  FOR UPDATE USING (erp.is_admin_principal()) WITH CHECK (erp.is_admin_principal());
CREATE POLICY erp_principal_insert ON erp.erp_feature_flags
  FOR INSERT WITH CHECK (erp.is_admin_principal());
CREATE POLICY erp_principal_delete ON erp.erp_feature_flags
  FOR DELETE USING (erp.is_admin_principal());

-- ---------- 3. presets ----------
CREATE TABLE IF NOT EXISTS erp.erp_flag_presets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               varchar(80)  NOT NULL UNIQUE,
  descricao          text,
  -- guarda o que fica DESLIGADO: página nova nasce visível em vez de
  -- sumir por não constar num preset antigo.
  paths_desativados  jsonb        NOT NULL DEFAULT '[]'::jsonb,
  criado_por         uuid REFERENCES erp.erp_usuarios(id),
  aplicado_em        timestamptz,
  created_at         timestamptz  NOT NULL DEFAULT now(),
  updated_at         timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE erp.erp_flag_presets IS
  'Conjuntos nomeados de páginas desativadas, para alternar o menu entre padrões de uso.';

ALTER TABLE erp.erp_flag_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS presets_select ON erp.erp_flag_presets;
DROP POLICY IF EXISTS presets_write  ON erp.erp_flag_presets;
CREATE POLICY presets_select ON erp.erp_flag_presets
  FOR SELECT USING (erp.is_admin_principal());
CREATE POLICY presets_write ON erp.erp_flag_presets
  FOR ALL USING (erp.is_admin_principal()) WITH CHECK (erp.is_admin_principal());

GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_flag_presets TO authenticated;

-- ---------- 4. salvar o estado atual como preset ----------
CREATE OR REPLACE FUNCTION erp.salvar_preset_flags(p_nome text, p_descricao text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE v_id uuid; v_paths jsonb;
BEGIN
  IF NOT erp.is_admin_principal() THEN
    RAISE EXCEPTION 'apenas o administrador principal pode salvar presets';
  END IF;
  IF coalesce(trim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'o preset precisa de um nome';
  END IF;

  SELECT coalesce(jsonb_agg(path ORDER BY path), '[]'::jsonb) INTO v_paths
    FROM erp.erp_feature_flags WHERE NOT ativo AND NOT is_protegida;

  INSERT INTO erp.erp_flag_presets (nome, descricao, paths_desativados, criado_por)
  VALUES (trim(p_nome), nullif(trim(coalesce(p_descricao, '')), ''), v_paths, auth.uid())
  ON CONFLICT (nome) DO UPDATE
    SET paths_desativados = EXCLUDED.paths_desativados,
        descricao = coalesce(EXCLUDED.descricao, erp.erp_flag_presets.descricao),
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------- 5. aplicar um preset ----------
CREATE OR REPLACE FUNCTION erp.aplicar_preset_flags(p_preset_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v      erp.erp_flag_presets%ROWTYPE;
  v_off  int; v_on int;
BEGIN
  IF NOT erp.is_admin_principal() THEN
    RAISE EXCEPTION 'apenas o administrador principal pode aplicar presets';
  END IF;
  SELECT * INTO v FROM erp.erp_flag_presets WHERE id = p_preset_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'preset não encontrado'; END IF;

  -- desliga o que o preset manda desligar (protegida nunca cai)
  UPDATE erp.erp_feature_flags f
     SET ativo = false,
         desativado_em = coalesce(f.desativado_em, now()),
         desativado_por = auth.uid(),
         motivo_desativacao = 'Preset: ' || v.nome,
         updated_at = now()
   WHERE NOT f.is_protegida
     AND f.path IN (SELECT jsonb_array_elements_text(v.paths_desativados))
     AND f.ativo;
  GET DIAGNOSTICS v_off = ROW_COUNT;

  -- liga todo o resto
  UPDATE erp.erp_feature_flags f
     SET ativo = true, desativado_em = NULL, desativado_por = NULL,
         motivo_desativacao = NULL, updated_at = now()
   WHERE NOT f.ativo
     AND f.path NOT IN (SELECT jsonb_array_elements_text(v.paths_desativados));
  GET DIAGNOSTICS v_on = ROW_COUNT;

  UPDATE erp.erp_flag_presets SET aplicado_em = now() WHERE id = p_preset_id;

  RETURN jsonb_build_object('preset', v.nome, 'desativadas', v_off, 'reativadas', v_on,
    'ativas_agora', (SELECT count(*) FROM erp.erp_feature_flags WHERE ativo));
END;
$$;

REVOKE ALL ON FUNCTION erp.salvar_preset_flags(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION erp.aplicar_preset_flags(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION erp.salvar_preset_flags(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION erp.aplicar_preset_flags(uuid) TO authenticated, service_role;

-- ---------- 6. o conjunto de hoje vira o primeiro preset ----------
INSERT INTO erp.erp_flag_presets (nome, descricao, paths_desativados, criado_por)
SELECT 'Loja de suplementos',
       'Só o que o balcão usa no dia a dia: vender, repor, cobrar e emitir nota.',
       coalesce(jsonb_agg(path ORDER BY path), '[]'::jsonb),
       (SELECT id FROM erp.erp_usuarios WHERE admin_principal LIMIT 1)
  FROM erp.erp_feature_flags WHERE NOT ativo AND NOT is_protegida
ON CONFLICT (nome) DO NOTHING;

INSERT INTO erp.erp_flag_presets (nome, descricao, paths_desativados, criado_por)
VALUES ('Sistema completo', 'Todas as páginas visíveis — para explorar ou treinar.', '[]'::jsonb,
        (SELECT id FROM erp.erp_usuarios WHERE admin_principal LIMIT 1))
ON CONFLICT (nome) DO NOTHING;

SELECT 'principal: ' || email FROM erp.erp_usuarios WHERE admin_principal;
SELECT 'preset "' || nome || '": ' || jsonb_array_length(paths_desativados) || ' página(s) desligada(s)' FROM erp.erp_flag_presets ORDER BY nome;

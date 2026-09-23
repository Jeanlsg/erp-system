-- ============================================================
-- 089 — fechar um caixa que ficou aberto de ontem
--
-- Caixa esquecido aberto trava o operador seguinte e distorce todo
-- relatório do período: o turno fica sem data de fechamento, sem valor
-- contado e sem diferença. Hoje não há saída — só quem abriu consegue
-- fechar, e ele pode estar de folga, ou ter saído da empresa.
--
-- O sistema anterior chamava isso de "fechamento indireto", e é o nome
-- que a equipe conhece: um responsável fecha por fora, e o relatório
-- MARCA que foi assim. Um caixa fechado por terceiro não tem o mesmo peso
-- de um conferido pelo operador — esconder essa diferença seria pior do
-- que não ter a função.
-- ============================================================

BEGIN;

ALTER TABLE erp.erp_fechamentos_caixa
  ADD COLUMN IF NOT EXISTS tipo_fechamento text NOT NULL DEFAULT 'normal'
    CHECK (tipo_fechamento IN ('normal','indireto')),
  ADD COLUMN IF NOT EXISTS motivo_indireto text;

COMMENT ON COLUMN erp.erp_fechamentos_caixa.tipo_fechamento IS
  'normal = o próprio operador contou e fechou. indireto = fechado por um responsável, com o caixa já abandonado.';

CREATE OR REPLACE FUNCTION erp.fechar_caixa_indireto(
  p_caixa_id uuid,
  p_valor_contado numeric,
  p_motivo text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'erp', 'public'
AS $$
DECLARE
  c        erp.erp_caixa%ROWTYPE;
  v_uid    uuid := erp.current_erp_user_id();
  r        RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'usuário sem perfil no ERP' USING ERRCODE = '42501';
  END IF;
  -- fechar caixa de outro é ato de supervisão
  IF NOT (SELECT erp.is_erp_admin()) THEN
    RAISE EXCEPTION 'Só um gerente ou administrador fecha o caixa de outro operador.'
      USING ERRCODE = '42501';
  END IF;
  IF coalesce(btrim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo do fechamento indireto — ele fica no relatório.';
  END IF;

  SELECT * INTO c FROM erp.erp_caixa WHERE id = p_caixa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'caixa não encontrado'; END IF;
  IF c.status = 'fechado' THEN RAISE EXCEPTION 'este caixa já está fechado'; END IF;

  SELECT * INTO r FROM erp.vw_caixa_resumo WHERE id = p_caixa_id;

  UPDATE erp.erp_caixa
     SET status = 'fechado',
         data_fechamento = now(),
         valor_final = p_valor_contado,
         encerrado_por = v_uid,
         observacoes = concat_ws(' · ', nullif(observacoes,''),
                                 'Fechamento indireto: ' || btrim(p_motivo))
   WHERE id = p_caixa_id;

  -- o trigger já criou a linha do fechamento; marca o tipo
  UPDATE erp.erp_fechamentos_caixa
     SET tipo_fechamento = 'indireto',
         motivo_indireto = btrim(p_motivo),
         usuario_id = COALESCE(usuario_id, c.usuario_id)
   WHERE caixa_id = p_caixa_id;

  RETURN jsonb_build_object(
    'caixa_id', p_caixa_id,
    'esperado', COALESCE(r.valor_esperado_gaveta, c.valor_inicial),
    'contado',  p_valor_contado,
    'diferenca', p_valor_contado - COALESCE(r.valor_esperado_gaveta, c.valor_inicial));
END;
$$;

GRANT EXECUTE ON FUNCTION erp.fechar_caixa_indireto(uuid, numeric, text) TO authenticated;

COMMIT;

-- ============================================================
-- 071 — solicitações de exclusão LGPD que existem de verdade
--
-- O QUE ESTAVA ERRADO: a tela "Exclusão de Informações (LGPD)" fazia
-- `confirm()` e em seguida `toast.success("Solicitação de exclusão
-- registrada... prazo de 15 dias")` — e NADA era gravado. Nenhuma fila,
-- nenhum status, nenhum responsável, nenhum rastro ao recarregar.
--
-- Numa obrigação legal com prazo isso é pior que a tela não existir: cria
-- no operador a convicção de que o pedido do titular foi acolhido, sem que
-- exista pedido nenhum. Se o titular reclamar na ANPD, não há o que mostrar.
--
-- A DECISÃO DE DESENHO: atender é ANONIMIZAR, não apagar.
--
-- Apagar a pessoa é impossível e seria ilegal. Impossível porque erp_vendas
-- e erp_contas apontam para erp_pessoas com ON DELETE RESTRICT — justamente
-- o titular que comprou é o que o banco recusa apagar. Ilegal porque a nota
-- fiscal emitida tem guarda obrigatória de 5 anos (e o Art. 16, I da própria
-- LGPD ressalva o cumprimento de obrigação legal).
--
-- A saída que atende os dois lados é anonimizar: a venda e a nota continuam
-- existindo para o fisco, e o dado pessoal desaparece. É o que a função
-- erp.atender_solicitacao_lgpd faz.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS erp.erp_lgpd_solicitacoes (
  id              uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  pessoa_id       uuid REFERENCES erp.erp_pessoas(id) ON DELETE SET NULL,

  -- retrato do titular no momento do pedido. Depois de anonimizar, a linha
  -- de erp_pessoas não diz mais quem era — e o registro do pedido precisa
  -- dizer, para provar o que foi atendido e a quem.
  nome_titular     text NOT NULL,
  documento_titular text,

  solicitado_em   timestamptz NOT NULL DEFAULT now(),
  solicitado_por  uuid REFERENCES erp.erp_usuarios(id) ON DELETE SET NULL,
  -- Art. 18 da LGPD: 15 dias para atender
  prazo_em        date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '15 days'),

  status          text NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'atendida', 'recusada')),
  atendido_em     timestamptz,
  atendido_por    uuid REFERENCES erp.erp_usuarios(id) ON DELETE SET NULL,
  observacoes     text,
  -- o que foi efetivamente anonimizado, para auditoria
  resultado       jsonb,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE erp.erp_lgpd_solicitacoes IS
  'Pedidos de eliminação de dados pessoais (LGPD Art. 18), com prazo de 15 dias e rastro de quem atendeu.';

-- um titular não deve ter dois pedidos pendentes ao mesmo tempo
CREATE UNIQUE INDEX IF NOT EXISTS idx_lgpd_pendente_por_pessoa
  ON erp.erp_lgpd_solicitacoes (pessoa_id) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_lgpd_status_prazo
  ON erp.erp_lgpd_solicitacoes (status, prazo_em);

ALTER TABLE erp.erp_lgpd_solicitacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lgpd_select ON erp.erp_lgpd_solicitacoes;
DROP POLICY IF EXISTS lgpd_write  ON erp.erp_lgpd_solicitacoes;
-- dado pessoal sensível e obrigação legal: fica com admin/gerente
CREATE POLICY lgpd_select ON erp.erp_lgpd_solicitacoes
  FOR SELECT USING (erp.is_erp_admin());
CREATE POLICY lgpd_write ON erp.erp_lgpd_solicitacoes
  FOR ALL USING (erp.is_erp_admin()) WITH CHECK (erp.is_erp_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON erp.erp_lgpd_solicitacoes TO authenticated;

-- ---------- registrar o pedido ----------
CREATE OR REPLACE FUNCTION erp.registrar_solicitacao_lgpd(p_pessoa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_pessoa  record;
  v_id      uuid;
  v_user    uuid := auth.uid();
BEGIN
  IF NOT erp.is_erp_admin() THEN
    RAISE EXCEPTION 'Apenas administrador ou gerente pode registrar solicitação LGPD';
  END IF;

  SELECT id, nome_razao, cpf_cnpj INTO v_pessoa
    FROM erp.erp_pessoas WHERE id = p_pessoa_id;
  IF v_pessoa.id IS NULL THEN
    RAISE EXCEPTION 'Titular não encontrado';
  END IF;

  -- pedido pendente já existente: devolve o que há, em vez de estourar o
  -- índice único e mostrar erro de banco ao operador
  SELECT id INTO v_id FROM erp.erp_lgpd_solicitacoes
   WHERE pessoa_id = p_pessoa_id AND status = 'pendente';
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'ja_existia', true, 'solicitacao_id', v_id,
      'mensagem', 'Já existe uma solicitação pendente para este titular.');
  END IF;

  INSERT INTO erp.erp_lgpd_solicitacoes
    (pessoa_id, nome_titular, documento_titular, solicitado_por)
  VALUES (p_pessoa_id, v_pessoa.nome_razao, v_pessoa.cpf_cnpj, v_user)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'solicitacao_id', v_id,
    'prazo_em', (CURRENT_DATE + INTERVAL '15 days')::date);
END;
$$;

-- ---------- atender: anonimiza o titular e conta o que mexeu ----------
CREATE OR REPLACE FUNCTION erp.atender_solicitacao_lgpd(p_solicitacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_s       record;
  v_vendas  integer := 0;
  v_contas  integer := 0;
  v_notas   integer := 0;
BEGIN
  IF NOT erp.is_erp_admin() THEN
    RAISE EXCEPTION 'Apenas administrador ou gerente pode atender solicitação LGPD';
  END IF;

  SELECT * INTO v_s FROM erp.erp_lgpd_solicitacoes WHERE id = p_solicitacao_id;
  IF v_s.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v_s.status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação já está %', v_s.status;
  END IF;

  -- o que fica preservado para o fisco, só sem o dado pessoal
  IF v_s.pessoa_id IS NOT NULL THEN
    SELECT count(*) INTO v_vendas FROM erp.erp_vendas WHERE cliente_id = v_s.pessoa_id;
    SELECT count(*) INTO v_contas FROM erp.erp_contas WHERE pessoa_id = v_s.pessoa_id;
    SELECT count(*) INTO v_notas  FROM erp.erp_notas_fiscais WHERE destinatario_id = v_s.pessoa_id;

    UPDATE erp.erp_pessoas SET
      nome_razao      = 'Titular anonimizado (LGPD)',
      nome_fantasia   = NULL,
      cpf_cnpj        = NULL,
      email           = NULL,
      telefone        = NULL,
      celular         = NULL,
      endereco        = NULL,
      data_nascimento = NULL,
      profissao       = NULL,
      estado_civil    = NULL,
      sexo            = NULL,
      observacoes     = NULL,
      inscricao_estadual = NULL,
      ativo           = false,
      updated_at      = now()
    WHERE id = v_s.pessoa_id;

    -- o CRM guarda o telefone como identidade: sem limpar aqui, o dado
    -- pessoal continuaria vivo na agenda
    DELETE FROM erp.erp_agenda_telefonica WHERE pessoa_id = v_s.pessoa_id;
  END IF;

  UPDATE erp.erp_lgpd_solicitacoes SET
    status       = 'atendida',
    atendido_em  = now(),
    atendido_por = auth.uid(),
    resultado    = jsonb_build_object(
                     'vendas_preservadas', v_vendas,
                     'contas_preservadas', v_contas,
                     'notas_preservadas',  v_notas,
                     'metodo', 'anonimizacao'),
    updated_at   = now()
  WHERE id = p_solicitacao_id;

  RETURN jsonb_build_object('ok', true, 'metodo', 'anonimizacao',
    'vendas_preservadas', v_vendas, 'contas_preservadas', v_contas,
    'notas_preservadas', v_notas);
END;
$$;

-- ---------- recusar, com motivo obrigatório ----------
CREATE OR REPLACE FUNCTION erp.recusar_solicitacao_lgpd(p_solicitacao_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
BEGIN
  IF NOT erp.is_erp_admin() THEN
    RAISE EXCEPTION 'Apenas administrador ou gerente pode recusar solicitação LGPD';
  END IF;
  IF COALESCE(btrim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Recusa exige motivo — o titular tem direito à justificativa';
  END IF;

  UPDATE erp.erp_lgpd_solicitacoes SET
    status = 'recusada', atendido_em = now(), atendido_por = auth.uid(),
    observacoes = p_motivo, updated_at = now()
  WHERE id = p_solicitacao_id AND status = 'pendente';

  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada ou já encerrada'; END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION erp.registrar_solicitacao_lgpd(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION erp.atender_solicitacao_lgpd(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION erp.recusar_solicitacao_lgpd(uuid, text) TO authenticated;

SELECT 'tabela de solicitações LGPD criada; pedidos existentes: ' || count(*)
  FROM erp.erp_lgpd_solicitacoes;

COMMIT;

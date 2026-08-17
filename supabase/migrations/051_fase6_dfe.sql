-- ============================================================
-- 051: FASE 6 — Entrada automática de mercadoria (DF-e)
--
-- A SEFAZ entrega toda NF-e emitida CONTRA o nosso CNPJ, sem depender
-- de o fornecedor mandar o XML. O endpoint no nfe-service já existia e
-- foi testado; faltava o lado do ERP: onde guardar, como não repetir e
-- como respeitar o limite do canal.
--
-- Duas regras da SEFAZ moldam este desenho:
--   1. O canal é sequencial por NSU. Perder o controle do NSU significa
--      reprocessar tudo ou pular documentos — por isso ele é persistido.
--   2. Sem novidade, aceita 1 consulta/hora (cStat 656 = consumo indevido).
--      Por isso a próxima consulta permitida é gravada, não estimada.
--
-- A tabela erp_nfe_entrada já existia (do importador de XML) com colunas
-- de manifestação sem uso. Em vez de criar uma tabela paralela, ela vira
-- o destino comum: XML manual e DF-e chegam no mesmo lugar, e a tela de
-- conferência não precisa saber de onde veio.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '120s';

-- ── Controle de NSU por loja ──
-- Uma linha por loja porque o NSU é por CNPJ, e cada loja tem o seu.
CREATE TABLE IF NOT EXISTS erp.erp_dfe_nsu (
  loja_id              uuid PRIMARY KEY REFERENCES erp.erp_lojas(id) ON DELETE CASCADE,
  ult_nsu              bigint NOT NULL DEFAULT 0,
  max_nsu              bigint NOT NULL DEFAULT 0,
  ultima_consulta_em   timestamptz,
  proxima_consulta_em  timestamptz,
  ultimo_cstat         varchar(10),
  ultimo_motivo        text,
  documentos_recebidos integer NOT NULL DEFAULT 0,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN erp.erp_dfe_nsu.proxima_consulta_em IS
  'Quando a SEFAZ volta a aceitar consulta. Gravado a partir do cStat da última resposta, não estimado.';

-- ── Log de cada varredura ──
-- Sem isto, "não veio nada" e "deu erro" ficam indistinguíveis depois do fato.
CREATE TABLE IF NOT EXISTS erp.erp_dfe_consultas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id      uuid NOT NULL REFERENCES erp.erp_lojas(id) ON DELETE CASCADE,
  nsu_inicial  bigint,
  ult_nsu      bigint,
  max_nsu      bigint,
  cstat        varchar(10),
  motivo       text,
  documentos   integer NOT NULL DEFAULT 0,
  novos        integer NOT NULL DEFAULT 0,
  origem       varchar(20) NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','agendada','chave')),
  usuario_id   uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_dfe_consultas_loja
  ON erp.erp_dfe_consultas (loja_id, created_at DESC);

-- ── erp_nfe_entrada ganha a procedência ──
ALTER TABLE erp.erp_nfe_entrada
  ADD COLUMN IF NOT EXISTS nsu        bigint,
  ADD COLUMN IF NOT EXISTS origem     varchar(20) NOT NULL DEFAULT 'xml_manual',
  ADD COLUMN IF NOT EXISTS resumo     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS schema_dfe text;

COMMENT ON COLUMN erp.erp_nfe_entrada.resumo IS
  'true = veio só o resumo (resNFe): cabeçalho e valor, sem itens. Só a manifestação libera o XML completo.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'erp_nfe_entrada_origem_check'
  ) THEN
    ALTER TABLE erp.erp_nfe_entrada
      ADD CONSTRAINT erp_nfe_entrada_origem_check
      CHECK (origem IN ('xml_manual','dfe'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_erp_nfe_entrada_nsu
  ON erp.erp_nfe_entrada (loja_id, nsu) WHERE nsu IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_nfe_entrada_resumo
  ON erp.erp_nfe_entrada (loja_id, resumo) WHERE compra_id IS NULL;

-- ── Registra um lote vindo da distribuição ──
-- Chamada pela edge function, que já parseou o XML. O parse fica lá porque
-- é onde há biblioteca de XML; aqui fica a decisão de o que é novidade.
--
-- p_documentos: [{
--   nsu, schema, tipo: 'nfe'|'resumo'|'evento', chave, numero, serie,
--   data_emissao, valor_total, valor_produtos, valor_frete, emitente_cnpj,
--   emitente_nome, emitente_ie, xml, evento_tipo, evento_protocolo
-- }]
CREATE OR REPLACE FUNCTION erp.registrar_dfe_lote(
  p_loja_id     uuid,
  p_documentos  jsonb,
  p_ult_nsu     bigint,
  p_max_nsu     bigint,
  p_cstat       text DEFAULT NULL,
  p_motivo      text DEFAULT NULL,
  p_proxima_em  timestamptz DEFAULT NULL,
  p_origem      text DEFAULT 'manual',
  p_nsu_inicial bigint DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  d          jsonb;
  v_novos    integer := 0;
  v_total    integer := 0;
  v_eventos  integer := 0;
  v_forn     uuid;
  v_cnpj     text;
  v_inserido boolean;
  v_usuario  uuid := erp.current_erp_user_id();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM erp.erp_lojas WHERE id = p_loja_id) THEN
    RAISE EXCEPTION 'Loja % não encontrada', p_loja_id USING ERRCODE = 'P0001';
  END IF;

  FOR d IN SELECT * FROM jsonb_array_elements(COALESCE(p_documentos, '[]'::jsonb))
  LOOP
    v_total := v_total + 1;

    -- Evento (cancelamento do fornecedor, CC-e): não vira nota, atualiza a que já temos.
    IF d->>'tipo' = 'evento' THEN
      v_eventos := v_eventos + 1;
      IF d->>'evento_tipo' = 'cancelamento' AND d->>'chave' IS NOT NULL THEN
        UPDATE erp.erp_nfe_entrada
           SET status = 'cancelada'::public.erp_nfe_entrada_status,
               motivo_cancelamento = COALESCE(d->>'evento_descricao', 'Cancelada pelo emitente'),
               updated_at = now()
         WHERE chave_acesso = d->>'chave'
           AND status <> 'cancelada'::public.erp_nfe_entrada_status;
      END IF;
      CONTINUE;
    END IF;

    IF COALESCE(d->>'chave', '') = '' THEN
      CONTINUE;
    END IF;

    -- Fornecedor: só vincula se o CNPJ já existir no cadastro. Não cria pessoa
    -- automaticamente — cadastro de fornecedor é decisão de quem confere.
    v_cnpj := regexp_replace(COALESCE(d->>'emitente_cnpj',''), '\D', '', 'g');
    v_forn := NULL;
    IF length(v_cnpj) = 14 THEN
      SELECT id INTO v_forn FROM erp.erp_pessoas
       WHERE regexp_replace(COALESCE(cpf_cnpj,''), '\D', '', 'g') = v_cnpj
       LIMIT 1;
    END IF;

    INSERT INTO erp.erp_nfe_entrada (
      loja_id, fornecedor_id, chave_acesso, numero, serie, tipo,
      data_emissao, valor_produtos, valor_frete, valor_total,
      emitente_cnpj, emitente_nome, emitente_ie,
      xml_original, nsu, origem, resumo, schema_dfe, status, usuario_id
    ) VALUES (
      p_loja_id, v_forn, d->>'chave',
      COALESCE((d->>'numero')::integer, 0),
      COALESCE((d->>'serie')::integer, 1),
      COALESCE(NULLIF(d->>'modelo_tipo',''), 'nfe')::public.erp_nfe_entrada_tipo,
      COALESCE((d->>'data_emissao')::timestamptz, now()),
      COALESCE((d->>'valor_produtos')::numeric, 0),
      COALESCE((d->>'valor_frete')::numeric, 0),
      COALESCE((d->>'valor_total')::numeric, 0),
      NULLIF(d->>'emitente_cnpj',''), NULLIF(d->>'emitente_nome',''), NULLIF(d->>'emitente_ie',''),
      d->>'xml',
      COALESCE((d->>'nsu')::bigint, NULL),
      'dfe',
      COALESCE((d->>'tipo') = 'resumo', false),
      d->>'schema',
      'pendente'::public.erp_nfe_entrada_status,
      v_usuario
    )
    ON CONFLICT (chave_acesso) DO UPDATE
      -- Resumo já gravado + XML completo chegando (depois da manifestação):
      -- promove a linha em vez de duplicar. O caminho inverso não sobrescreve.
      SET xml_original   = CASE WHEN erp.erp_nfe_entrada.resumo AND EXCLUDED.resumo = false
                                THEN EXCLUDED.xml_original ELSE erp.erp_nfe_entrada.xml_original END,
          resumo         = erp.erp_nfe_entrada.resumo AND EXCLUDED.resumo,
          valor_produtos = CASE WHEN erp.erp_nfe_entrada.resumo AND EXCLUDED.resumo = false
                                THEN EXCLUDED.valor_produtos ELSE erp.erp_nfe_entrada.valor_produtos END,
          valor_frete    = CASE WHEN erp.erp_nfe_entrada.resumo AND EXCLUDED.resumo = false
                                THEN EXCLUDED.valor_frete ELSE erp.erp_nfe_entrada.valor_frete END,
          schema_dfe     = COALESCE(EXCLUDED.schema_dfe, erp.erp_nfe_entrada.schema_dfe),
          nsu            = COALESCE(erp.erp_nfe_entrada.nsu, EXCLUDED.nsu),
          updated_at     = now()
    -- FOUND é true nos dois ramos do ON CONFLICT. xmax = 0 só no INSERT real —
    -- é o que separa "nota nova" de "resumo que já tínhamos".
    RETURNING (xmax = 0) INTO v_inserido;

    IF v_inserido THEN
      v_novos := v_novos + 1;
    END IF;
  END LOOP;

  -- Controle de NSU: só avança, nunca retrocede — resposta fora de ordem
  -- não pode fazer o canal reprocessar o que já foi lido.
  INSERT INTO erp.erp_dfe_nsu (
    loja_id, ult_nsu, max_nsu, ultima_consulta_em, proxima_consulta_em,
    ultimo_cstat, ultimo_motivo, documentos_recebidos
  ) VALUES (
    p_loja_id, GREATEST(COALESCE(p_ult_nsu,0),0), GREATEST(COALESCE(p_max_nsu,0),0),
    now(), p_proxima_em, p_cstat, p_motivo, v_total
  )
  ON CONFLICT (loja_id) DO UPDATE SET
    ult_nsu              = GREATEST(erp.erp_dfe_nsu.ult_nsu, EXCLUDED.ult_nsu),
    max_nsu              = GREATEST(erp.erp_dfe_nsu.max_nsu, EXCLUDED.max_nsu),
    ultima_consulta_em   = EXCLUDED.ultima_consulta_em,
    proxima_consulta_em  = EXCLUDED.proxima_consulta_em,
    ultimo_cstat         = EXCLUDED.ultimo_cstat,
    ultimo_motivo        = EXCLUDED.ultimo_motivo,
    documentos_recebidos = erp.erp_dfe_nsu.documentos_recebidos + EXCLUDED.documentos_recebidos,
    updated_at           = now();

  INSERT INTO erp.erp_dfe_consultas (
    loja_id, nsu_inicial, ult_nsu, max_nsu, cstat, motivo,
    documentos, novos, origem, usuario_id
  ) VALUES (
    p_loja_id, p_nsu_inicial, p_ult_nsu, p_max_nsu, p_cstat, p_motivo,
    v_total, v_novos,
    CASE WHEN p_origem IN ('manual','agendada','chave') THEN p_origem ELSE 'manual' END,
    v_usuario
  );

  RETURN jsonb_build_object(
    'documentos', v_total,
    'novos',      v_novos,
    'eventos',    v_eventos,
    'ult_nsu',    GREATEST(COALESCE(p_ult_nsu,0),0),
    'max_nsu',    GREATEST(COALESCE(p_max_nsu,0),0)
  );
END;
$$;

REVOKE ALL ON FUNCTION erp.registrar_dfe_lote(uuid, jsonb, bigint, bigint, text, text, timestamptz, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.registrar_dfe_lote(uuid, jsonb, bigint, bigint, text, text, timestamptz, text, bigint) TO service_role;

-- ── Lojas que estão liberadas para uma varredura agendada ──
-- Centraliza a regra num lugar só, para o cron e a tela não divergirem.
CREATE OR REPLACE FUNCTION erp.lojas_dfe_pendentes() RETURNS TABLE (loja_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = erp, public
AS $$
  SELECT l.id
    FROM erp.erp_lojas l
    JOIN erp.erp_configuracoes_sefaz s ON s.loja_id = l.id
    LEFT JOIN erp.erp_dfe_nsu n ON n.loja_id = l.id
   WHERE COALESCE(l.ativo, true)
     -- Distribuição DF-e só existe de verdade em produção: o Ambiente
     -- Nacional não tem dados de homologação para devolver.
     AND s.ambiente = 'producao'
     AND (n.proxima_consulta_em IS NULL OR n.proxima_consulta_em <= now());
$$;

GRANT EXECUTE ON FUNCTION erp.lojas_dfe_pendentes() TO authenticated, service_role;

-- ── Coleta agendada ──
-- Fica DESLIGADA por padrão de propósito: a primeira varredura manual
-- respondeu "consumo indevido", o que indica outro sistema (provavelmente a
-- contabilidade) já consumindo o mesmo canal. Dois consumidores dividem o
-- mesmo limite horário, e ligar isto às cegas derruba os dois. Ligar é uma
-- linha de configuração depois de confirmar com o contador.
INSERT INTO erp.erp_configuracoes_sistema (chave, valor, descricao)
SELECT 'dfe_coleta_automatica', 'false',
       'Liga a varredura agendada da distribuição DF-e. Confirme antes que a contabilidade não consome o mesmo canal.'
WHERE NOT EXISTS (SELECT 1 FROM erp.erp_configuracoes_sistema WHERE chave = 'dfe_coleta_automatica');

INSERT INTO erp.erp_configuracoes_sistema (chave, valor, descricao)
SELECT 'functions_base_url', 'https://apps-supabase.mvj9qv.easypanel.host/functions/v1',
       'Base das edge functions, usada pelo cron para chamar erp-dfe'
WHERE NOT EXISTS (SELECT 1 FROM erp.erp_configuracoes_sistema WHERE chave = 'functions_base_url');

CREATE OR REPLACE FUNCTION erp.disparar_coleta_dfe() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_ligado text;
  v_url    text;
  v_key    text;
  v_loja   uuid;
  v_n      integer := 0;
BEGIN
  SELECT valor INTO v_ligado FROM erp.erp_configuracoes_sistema WHERE chave = 'dfe_coleta_automatica';
  IF COALESCE(v_ligado, 'false') <> 'true' THEN
    RETURN 0;
  END IF;

  SELECT valor INTO v_url FROM erp.erp_configuracoes_sistema WHERE chave = 'functions_base_url';
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'coleta DF-e ligada mas falta functions_base_url ou o segredo service_role_key';
    RETURN 0;
  END IF;

  FOR v_loja IN SELECT loja_id FROM erp.lojas_dfe_pendentes() LOOP
    PERFORM net.http_post(
      url     := rtrim(v_url, '/') || '/erp-dfe',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || v_key),
      body    := jsonb_build_object('acao', 'sincronizar', 'loja_id', v_loja, 'origem', 'agendada')
    );
    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION erp.disparar_coleta_dfe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.disparar_coleta_dfe() TO service_role;

-- De 3 em 3 horas, não de hora em hora: o limite é 1/hora POR CONSUMIDOR e
-- somos o segundo. Margem para a contabilidade continuar funcionando.
SELECT cron.schedule('erp_coleta_dfe', '17 */3 * * *', $cron$ SELECT erp.disparar_coleta_dfe(); $cron$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'erp_coleta_dfe');

-- ── RLS ──
ALTER TABLE erp.erp_dfe_nsu       ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.erp_dfe_consultas ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['erp_dfe_nsu','erp_dfe_consultas'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS erp_user_select ON erp.%I', t);
    EXECUTE format(
      'CREATE POLICY erp_user_select ON erp.%I FOR SELECT TO authenticated '
      'USING ((SELECT erp.current_erp_user_id()) IS NOT NULL)', t);
  END LOOP;
END $$;

-- Escrita só pela edge function: o NSU é a memória do canal e não pode ser
-- corrigido à mão pela tela sem quebrar a sequência.
GRANT SELECT ON erp.erp_dfe_nsu       TO authenticated;
GRANT SELECT ON erp.erp_dfe_consultas TO authenticated;
GRANT ALL    ON erp.erp_dfe_nsu       TO service_role;
GRANT ALL    ON erp.erp_dfe_consultas TO service_role;

-- ── Visão da conferência ──
-- O que chegou da SEFAZ e ainda não virou compra.
CREATE OR REPLACE VIEW erp.vw_dfe_pendentes AS
SELECT e.id, e.loja_id, l.nome AS loja_nome,
       e.chave_acesso, e.numero, e.serie, e.data_emissao,
       e.emitente_cnpj, e.emitente_nome,
       e.valor_total, e.valor_frete,
       e.resumo, e.nsu, e.status,
       e.tipo_manifestacao, e.data_manifestacao,
       e.compra_id, e.fornecedor_id,
       p.nome_razao AS fornecedor_nome,
       (e.xml_original IS NOT NULL AND NOT e.resumo) AS tem_xml_completo
  FROM erp.erp_nfe_entrada e
  JOIN erp.erp_lojas l ON l.id = e.loja_id
  LEFT JOIN erp.erp_pessoas p ON p.id = e.fornecedor_id
 WHERE e.origem = 'dfe'
   AND e.compra_id IS NULL
   AND e.status <> 'cancelada'::public.erp_nfe_entrada_status;

GRANT SELECT ON erp.vw_dfe_pendentes TO authenticated, service_role;

-- ============================================================
-- 054: FASE 7 — Escrituração fiscal (EFD ICMS/IPI e SINTEGRA)
--
-- Obrigação acessória tem prazo e multa, e é a única fase da fila que
-- gera penalidade por não existir. Até aqui o ERP não tinha estrutura
-- nenhuma para isso.
--
-- O que a fase 1 destravou: a escrituração exige quantidade, custo e
-- saldo POR PERÍODO. Antes do kardex esses números teriam que ser
-- inventados — e arquivo fiscal inventado é pior do que arquivo ausente,
-- porque vira declaração falsa em vez de omissão.
--
-- Esta migration cuida só do que falta de CADASTRO e da coleta dos dados.
-- A montagem do arquivo (posição de campo, ordem de registro, contagem de
-- linhas) fica na edge function, onde manipular texto é natural.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '120s';

-- ── Participante: o que a EFD exige e o cadastro não tinha ──
-- Registro 0150 pede IE e código do município de cada participante que
-- aparece no período. Sem isso o PVA rejeita o arquivo inteiro.
ALTER TABLE erp.erp_pessoas
  ADD COLUMN IF NOT EXISTS inscricao_estadual    varchar(20),
  ADD COLUMN IF NOT EXISTS codigo_municipio_ibge varchar(7),
  ADD COLUMN IF NOT EXISTS uf                    varchar(2);

COMMENT ON COLUMN erp.erp_pessoas.inscricao_estadual IS
  'Registro 0150 da EFD. Vazio vale como ISENTO para pessoa física.';

-- ── Parâmetros da escrituração ──
-- Todos dependem do enquadramento, que é definição do contador — não há
-- valor que o sistema possa deduzir sozinho sem risco.
INSERT INTO erp.erp_configuracoes_sistema (chave, valor, descricao)
SELECT * FROM (VALUES
  ('sped_perfil',           'B',    'Perfil de apresentação da EFD (A = detalhado, B = consolidado, C). Definido pelo Fisco estadual'),
  ('sped_ind_ativ',         '1',    'Indicador de atividade: 0 = industrial/equiparado, 1 = outros'),
  ('regime_tributario',     '1',    '1 = Simples Nacional, 2 = Simples excesso sublimite, 3 = Regime normal'),
  ('sped_contador_nome',    '',     'Nome do contabilista (registro 0100)'),
  ('sped_contador_cpf',     '',     'CPF do contabilista'),
  ('sped_contador_crc',     '',     'CRC do contabilista'),
  ('sped_contador_cnpj',    '',     'CNPJ do escritório contábil'),
  ('sped_contador_email',   '',     'E-mail do contabilista'),
  ('sped_contador_fone',    '',     'Telefone do contabilista')
) v(chave, valor, descricao)
WHERE NOT EXISTS (
  SELECT 1 FROM erp.erp_configuracoes_sistema c WHERE c.chave = v.chave
);

-- ── Arquivos gerados ──
-- Guardar o arquivo (e não só regerar quando precisar) importa porque a
-- escrituração retrata um momento: um ajuste de inventário lançado depois
-- mudaria o conteúdo, e o que foi entregue ao Fisco tem que ser recuperável.
CREATE TABLE IF NOT EXISTS erp.erp_sped_arquivos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id       uuid NOT NULL REFERENCES erp.erp_lojas(id) ON DELETE RESTRICT,
  tipo          varchar(20) NOT NULL CHECK (tipo IN ('efd_icms_ipi','sintegra')),
  competencia   date NOT NULL,
  data_inicial  date NOT NULL,
  data_final    date NOT NULL,
  finalidade    varchar(2) NOT NULL DEFAULT '0' CHECK (finalidade IN ('0','1')),
  perfil        varchar(1),
  conteudo      text NOT NULL,
  linhas        integer NOT NULL DEFAULT 0,
  bytes         integer NOT NULL DEFAULT 0,
  avisos        jsonb NOT NULL DEFAULT '[]'::jsonb,
  usuario_id    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN erp.erp_sped_arquivos.avisos IS
  'O que o gerador não conseguiu preencher com dado real. Vazio não significa arquivo aceito — só o PVA valida.';

CREATE INDEX IF NOT EXISTS idx_erp_sped_arquivos_loja
  ON erp.erp_sped_arquivos (loja_id, tipo, competencia DESC);

ALTER TABLE erp.erp_sped_arquivos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_user_select ON erp.erp_sped_arquivos;
CREATE POLICY erp_user_select ON erp.erp_sped_arquivos
  FOR SELECT TO authenticated USING ((SELECT erp.current_erp_user_id()) IS NOT NULL);

GRANT SELECT ON erp.erp_sped_arquivos TO authenticated;
GRANT ALL    ON erp.erp_sped_arquivos TO service_role;

-- ── Coleta dos dados do período ──
-- Uma chamada devolve tudo que a escrituração precisa. Fazer dez consultas
-- da edge function significaria dez fotografias em momentos diferentes do
-- mesmo período — e a EFD tem que fechar consigo mesma.
CREATE OR REPLACE FUNCTION erp.dados_escrituracao(
  p_loja_id uuid,
  p_inicio  date,
  p_fim     date
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE
  v_loja        jsonb;
  v_saidas      jsonb;
  v_entradas    jsonb;
  v_produtos    jsonb;
  v_unidades    jsonb;
  v_participes  jsonb;
  v_inventario  jsonb;
  v_config      jsonb;
BEGIN
  -- A edge function chama com service_role, que não tem auth.uid(). Exigir
  -- usuário do ERP aqui bloquearia o próprio gerador. current_user não serve
  -- para distinguir: dentro de SECURITY DEFINER ele já é o dono da função.
  IF (SELECT erp.current_erp_user_id()) IS NULL
     AND COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'Não autenticado no ERP' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(l) INTO v_loja FROM erp.erp_lojas l WHERE l.id = p_loja_id;
  IF v_loja IS NULL THEN
    RAISE EXCEPTION 'Loja % não encontrada', p_loja_id USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_object_agg(chave, valor) INTO v_config
    FROM erp.erp_configuracoes_sistema;

  -- Saídas: NF-e e NFC-e autorizadas ou canceladas. Nota cancelada NÃO some
  -- da escrituração — ela entra com COD_SIT 02, senão abre buraco na
  -- numeração e o Fisco cobra a explicação.
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'data_emissao', (x->>'numero')::int), '[]'::jsonb)
    INTO v_saidas
    FROM (
      SELECT jsonb_build_object(
        'id', n.id, 'modelo', CASE WHEN n.tipo::text = 'nfce' THEN '65' ELSE '55' END,
        'numero', n.numero, 'serie', n.serie, 'chave', n.chave_acesso,
        'status', n.status::text,
        'data_emissao', n.data_emissao,
        'valor_total', n.valor_total,
        'valor_desconto', COALESCE(n.valor_desconto, 0),
        'valor_frete', COALESCE(n.valor_frete, 0),
        'destinatario_id', n.destinatario_id,
        'consumidor_cpf_cnpj', n.consumidor_cpf_cnpj,
        'consumidor_nome', n.consumidor_nome,
        'venda_id', n.venda_id,
        'itens', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'produto_id', i.produto_id,
                   'nome', i.nome,
                   'quantidade', i.quantidade,
                   'valor_unitario', i.preco_unitario,
                   'valor_total', COALESCE(i.valor_total, i.subtotal, 0),
                   'desconto', COALESCE(i.desconto_unitario, 0) * i.quantidade,
                   'ncm', p.ncm, 'csosn', p.csosn, 'origem', p.origem_mercadoria,
                   'aliquota_icms', p.icms, 'unidade', p.unidade
                 ) ORDER BY i.id)
            FROM erp.erp_venda_itens i
            LEFT JOIN erp.erp_produtos p ON p.id = i.produto_id
           WHERE i.venda_id = n.venda_id AND i.produto_id IS NOT NULL
        ), '[]'::jsonb)
      ) AS x
        FROM erp.erp_notas_fiscais n
       WHERE n.loja_id = p_loja_id
         AND n.status::text IN ('autorizada','cancelada')
         AND n.data_emissao >= p_inicio
         AND n.data_emissao < (p_fim + 1)
    ) s;

  -- Entradas: o que veio da distribuição DF-e ou do XML importado.
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'data_emissao'), '[]'::jsonb)
    INTO v_entradas
    FROM (
      SELECT jsonb_build_object(
        'id', e.id, 'modelo', CASE e.tipo::text WHEN 'nfce' THEN '65' WHEN 'cte' THEN '57' ELSE '55' END,
        'numero', e.numero, 'serie', e.serie, 'chave', e.chave_acesso,
        'status', e.status::text,
        'data_emissao', e.data_emissao, 'data_entrada', e.data_entrada,
        'valor_total', e.valor_total, 'valor_produtos', e.valor_produtos,
        'valor_frete', COALESCE(e.valor_frete, 0),
        'valor_desconto', COALESCE(e.valor_desconto, 0),
        'valor_icms', COALESCE(e.valor_icms, 0),
        'emitente_cnpj', e.emitente_cnpj, 'emitente_nome', e.emitente_nome,
        'emitente_ie', e.emitente_ie,
        'fornecedor_id', e.fornecedor_id,
        'resumo', e.resumo,
        'itens', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'produto_id', it.produto_id, 'nome', it.nome,
                   'quantidade', it.quantidade, 'valor_unitario', it.valor_unitario,
                   'valor_total', it.valor_total, 'desconto', COALESCE(it.valor_desconto,0),
                   'ncm', it.ncm, 'cfop', it.cfop, 'unidade', it.unidade,
                   'csosn', it.icms_csosn, 'origem', it.icms_origem,
                   'aliquota_icms', it.icms_aliquota, 'valor_icms', it.icms_valor
                 ) ORDER BY it.numero_item)
            FROM erp.erp_nfe_entrada_itens it
           WHERE it.nfe_entrada_id = e.id
        ), '[]'::jsonb)
      ) AS x
        FROM erp.erp_nfe_entrada e
       WHERE e.loja_id = p_loja_id
         AND e.data_emissao >= p_inicio
         AND e.data_emissao < (p_fim + 1)
    ) s;

  -- Produtos e unidades citados no período (registros 0200 e 0190).
  -- Só os movimentados: o cadastro inteiro incharia o arquivo sem necessidade.
  WITH movimentados AS (
    SELECT DISTINCT m.produto_id
      FROM erp.erp_estoque_movimentacoes m
     WHERE m.loja_id = p_loja_id
       AND m.created_at >= p_inicio AND m.created_at < (p_fim + 1)
       AND m.produto_id IS NOT NULL
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', p.id, 'codigo', COALESCE(NULLIF(p.sku,''), left(p.id::text, 8)),
      'nome', p.nome, 'ncm', p.ncm, 'unidade', COALESCE(NULLIF(p.unidade,''), 'UN'),
      'codigo_barras', p.codigo_barras, 'cest', p.cest,
      'aliquota_icms', p.icms, 'csosn', p.csosn, 'origem', p.origem_mercadoria,
      'tipo_item', '00'
    ) ORDER BY p.sku), '[]'::jsonb)
    INTO v_produtos
    FROM erp.erp_produtos p
   WHERE p.id IN (SELECT produto_id FROM movimentados);

  SELECT COALESCE(jsonb_agg(DISTINCT COALESCE(NULLIF(p.unidade,''), 'UN')), '["UN"]'::jsonb)
    INTO v_unidades
    FROM erp.erp_produtos p
   WHERE p.id IN (
     SELECT DISTINCT m.produto_id FROM erp.erp_estoque_movimentacoes m
      WHERE m.loja_id = p_loja_id AND m.created_at >= p_inicio AND m.created_at < (p_fim + 1)
   );

  -- Participantes: só quem aparece em nota do período.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', pe.id, 'codigo', left(pe.id::text, 8),
           'nome', pe.nome_razao, 'cpf_cnpj', pe.cpf_cnpj,
           'tipo', pe.tipo::text,
           'ie', pe.inscricao_estadual,
           'codigo_municipio', pe.codigo_municipio_ibge,
           'uf', pe.uf,
           'endereco', pe.endereco
         ) ORDER BY pe.nome_razao), '[]'::jsonb)
    INTO v_participes
    FROM erp.erp_pessoas pe
   WHERE pe.id IN (
     SELECT n.destinatario_id FROM erp.erp_notas_fiscais n
      WHERE n.loja_id = p_loja_id AND n.destinatario_id IS NOT NULL
        AND n.data_emissao >= p_inicio AND n.data_emissao < (p_fim + 1)
     UNION
     SELECT e.fornecedor_id FROM erp.erp_nfe_entrada e
      WHERE e.loja_id = p_loja_id AND e.fornecedor_id IS NOT NULL
        AND e.data_emissao >= p_inicio AND e.data_emissao < (p_fim + 1)
   );

  -- Inventário (bloco H): só entra no período em que foi aplicado. O saldo
  -- vem do kardex, não do cadastro — é a diferença entre escriturar o que
  -- se contou e escriturar o que se imagina ter.
  SELECT COALESCE(jsonb_build_object(
           'inventario_id', inv.id,
           'data', inv.data_fim,
           'itens', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
                      'produto_id', e.produto_id,
                      'codigo', COALESCE(NULLIF(p.sku,''), left(p.id::text,8)),
                      'quantidade', e.quantidade,
                      'custo_medio', COALESCE(e.custo_medio, p.preco_custo, 0),
                      'valor', round(e.quantidade * COALESCE(e.custo_medio, p.preco_custo, 0), 2)
                    ) ORDER BY p.sku)
               FROM erp.erp_estoque e
               JOIN erp.erp_produtos p ON p.id = e.produto_id
              WHERE e.loja_id = p_loja_id AND e.quantidade <> 0
           ), '[]'::jsonb)
         ), 'null'::jsonb)
    INTO v_inventario
    FROM erp.erp_inventarios inv
   WHERE inv.loja_id = p_loja_id
     AND inv.status = 'aplicado'
     AND inv.data_fim >= p_inicio AND inv.data_fim < (p_fim + 1)
   ORDER BY inv.data_fim DESC
   LIMIT 1;

  RETURN jsonb_build_object(
    'loja',          v_loja,
    'periodo',       jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
    'config',        COALESCE(v_config, '{}'::jsonb),
    'saidas',        v_saidas,
    'entradas',      v_entradas,
    'produtos',      v_produtos,
    'unidades',      v_unidades,
    'participantes', v_participes,
    'inventario',    v_inventario
  );
END;
$$;

REVOKE ALL ON FUNCTION erp.dados_escrituracao(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.dados_escrituracao(uuid, date, date) TO authenticated, service_role;

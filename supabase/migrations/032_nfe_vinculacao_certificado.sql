-- =====================================================
-- ERP System · Vinculação NF-e × Certificado × SEFAZ
-- Migration: 032_nfe_vinculacao_certificado.sql
--
-- Adiciona colunas para rastrear:
--   1. Certificado digital usado na emissão
--   2. Configuração SEFAZ aplicada
--   3. XML gerado/assinado/protocolo SEFAZ
--   4. Lote de envio
-- =====================================================

-- Colunas novas na tabela de notas fiscais
ALTER TABLE erp.erp_notas_fiscais
  ADD COLUMN IF NOT EXISTS certificado_id UUID REFERENCES erp.erp_certificados_digitais(id),
  ADD COLUMN IF NOT EXISTS configuracao_sefaz_id UUID REFERENCES erp.erp_configuracoes_sefaz(id),
  ADD COLUMN IF NOT EXISTS xml_gerado TEXT,
  ADD COLUMN IF NOT EXISTS xml_assinado TEXT,
  ADD COLUMN IF NOT EXISTS numero_lote INTEGER,
  ADD COLUMN IF NOT EXISTS codigo_retorno VARCHAR(10),
  ADD COLUMN IF NOT EXISTS mensagem_retorno TEXT,
  ADD COLUMN IF NOT EXISTS data_processamento TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ambiente VARCHAR(20) DEFAULT 'homologacao',
  ADD COLUMN IF NOT EXISTS tipo_emissao INTEGER DEFAULT 1;

-- Índices
CREATE INDEX IF NOT EXISTS idx_erp_nf_certificado ON erp.erp_notas_fiscais(certificado_id);
CREATE INDEX IF NOT EXISTS idx_erp_nf_sefaz ON erp.erp_notas_fiscais(configuracao_sefaz_id);
CREATE INDEX IF NOT EXISTS idx_erp_nf_lote ON erp.erp_notas_fiscais(numero_lote);
CREATE INDEX IF NOT EXISTS idx_erp_nf_ambiente ON erp.erp_notas_fiscais(ambiente);

-- Função: validar se loja tem certificado + SEFAZ válidos antes de emitir
CREATE OR REPLACE FUNCTION erp.loja_pode_emitir_nfe(p_loja_id UUID)
RETURNS TABLE (
  pode_emitir BOOLEAN,
  tem_certificado BOOLEAN,
  tem_sefaz BOOLEAN,
  certificado_vencido BOOLEAN,
  mensagem TEXT
) AS $$
DECLARE
  v_cert RECORD;
  v_sefaz RECORD;
BEGIN
  -- Buscar certificado ativo
  SELECT
    id,
    data_validade,
    ativo,
    arquivo_path IS NOT NULL AS tem_arquivo
  INTO v_cert
  FROM erp.erp_certificados_digitais
  WHERE loja_id = p_loja_id AND ativo = true
  ORDER BY data_validade DESC
  LIMIT 1;

  -- Buscar config SEFAZ
  SELECT id, ambiente, ativo
  INTO v_sefaz
  FROM erp.erp_configuracoes_sefaz
  WHERE loja_id = p_loja_id AND ativo = true
  LIMIT 1;

  RETURN QUERY SELECT
    (v_cert.id IS NOT NULL AND v_sefaz.id IS NOT NULL
     AND v_cert.tem_arquivo AND v_cert.data_validade >= CURRENT_DATE) AS pode_emitir,
    (v_cert.id IS NOT NULL) AS tem_certificado,
    (v_sefaz.id IS NOT NULL) AS tem_sefaz,
    (v_cert.id IS NOT NULL AND v_cert.data_validade < CURRENT_DATE) AS certificado_vencido,
    CASE
      WHEN v_cert.id IS NULL THEN 'Loja não possui certificado digital cadastrado'
      WHEN NOT v_cert.tem_arquivo THEN 'Certificado sem arquivo .pfx'
      WHEN v_cert.data_validade < CURRENT_DATE THEN 'Certificado vencido em ' || v_cert.data_validade::text
      WHEN v_sefaz.id IS NULL THEN 'Loja não possui configuração SEFAZ'
      WHEN NOT v_sefaz.ativo THEN 'Configuração SEFAZ desativada'
      ELSE 'OK'
    END AS mensagem;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Função: incrementar numeração de NFe ao autorizar
CREATE OR REPLACE FUNCTION erp.incrementar_numeracao_nfe(p_loja_id UUID, p_tipo VARCHAR DEFAULT 'nfe')
RETURNS INTEGER AS $$
DECLARE
  v_proximo INTEGER;
BEGIN
  UPDATE erp.erp_configuracoes_sefaz
  SET
    numeracao_atual_nfe = CASE WHEN p_tipo = 'nfe' THEN numeracao_atual_nfe + 1 ELSE numeracao_atual_nfe END,
    numeracao_atual_nfce = CASE WHEN p_tipo = 'nfce' THEN numeracao_atual_nfce + 1 ELSE numeracao_atual_nfce END,
    updated_at = NOW()
  WHERE loja_id = p_loja_id AND ativo = true;

  SELECT
    CASE WHEN p_tipo = 'nfe' THEN numeracao_atual_nfe ELSE numeracao_atual_nfce END
  INTO v_proximo
  FROM erp.erp_configuracoes_sefaz
  WHERE loja_id = p_loja_id;

  RETURN v_proximo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: gerar chave de acesso (44 dígitos) seguindo padrão SEFAZ
CREATE OR REPLACE FUNCTION erp.gerar_chave_acesso_nfe(
  p_uf VARCHAR(2),
  p_data_emissao DATE,
  p_cnpj VARCHAR(14),
  p_modelo VARCHAR(2),
  p_serie INTEGER,
  p_numero INTEGER,
  p_tipo_emissao INTEGER DEFAULT 1
)
RETURNS VARCHAR(44) AS $$
DECLARE
  v_uf_codigo VARCHAR(2);
  v_ano_mes VARCHAR(4);
  v_cnpj_clean VARCHAR(14);
  v_numero_str VARCHAR(9);
  v_chave VARCHAR(43);
  v_dv INTEGER;
BEGIN
  -- Mapear UF para código numérico (tabela IBGE)
  v_uf_codigo := CASE p_uf
    WHEN '11' THEN '11' WHEN '12' THEN '12' WHEN '13' THEN '13' WHEN '14' THEN '14' WHEN '15' THEN '15'
    WHEN '16' THEN '16' WHEN '17' THEN '17' WHEN '21' THEN '21' WHEN '22' THEN '22' WHEN '23' THEN '23'
    WHEN '24' THEN '24' WHEN '25' THEN '25' WHEN '26' THEN '26' WHEN '27' THEN '27' WHEN '28' THEN '28'
    WHEN '29' THEN '29' WHEN '31' THEN '31' WHEN '32' THEN '32' WHEN '33' THEN '33' WHEN '35' THEN '35'
    WHEN '41' THEN '41' WHEN '42' THEN '42' WHEN '43' THEN '43' WHEN '50' THEN '50' WHEN '51' THEN '51'
    WHEN '52' THEN '52' WHEN '53' THEN '53'
    ELSE '35'
  END;

  v_ano_mes := TO_CHAR(p_data_emissao, 'YYMM');
  v_cnpj_clean := LPAD(REGEXP_REPLACE(p_cnpj, '\D', '', 'g'), 14, '0');
  v_numero_str := LPAD(p_numero::text, 9, '0');

  v_chave := v_uf_codigo || v_ano_mes || v_cnpj_clean || p_modelo ||
             LPAD(p_serie::text, 3, '0') || v_numero_str ||
             LPAD(p_tipo_emissao::text, 1, '0');

  -- Calcular DV módulo 11
  v_dv := erp.calcular_dv_modulo11(v_chave);

  RETURN v_chave || v_dv::text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função: calcular DV módulo 11 (padrão NF-e)
CREATE OR REPLACE FUNCTION erp.calcular_dv_modulo11(chave VARCHAR(43))
RETURNS INTEGER AS $$
DECLARE
  v_soma INTEGER := 0;
  v_peso INTEGER := 2;
  v_dv INTEGER;
  v_rest INTEGER;
  i INTEGER;
BEGIN
  FOR i IN REVERSE LENGTH(chave)..1 LOOP
    v_soma := v_soma + (SUBSTRING(chave, i, 1)::INTEGER * v_peso);
    v_peso := v_peso + 1;
    IF v_peso > 9 THEN v_peso := 2; END IF;
  END LOOP;

  v_rest := v_soma % 11;
  v_dv := CASE
    WHEN v_rest < 2 THEN 0
    ELSE 11 - v_rest
  END;

  RETURN v_dv;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comentários
COMMENT ON COLUMN erp.erp_notas_fiscais.certificado_id IS 'Certificado digital A1 usado para assinar a NF-e';
COMMENT ON COLUMN erp.erp_notas_fiscais.configuracao_sefaz_id IS 'Configuração SEFAZ aplicada (ambiente, série, etc)';
COMMENT ON COLUMN erp.erp_notas_fiscais.xml_gerado IS 'XML gerado antes da assinatura';
COMMENT ON COLUMN erp.erp_notas_fiscais.xml_assinado IS 'XML assinado com certificado digital';
COMMENT ON COLUMN erp.erp_notas_fiscais.numero_lote IS 'Número do lote de envio à SEFAZ';
COMMENT ON COLUMN erp.erp_notas_fiscais.codigo_retorno IS 'Código de retorno da SEFAZ (ex: 100=autorizado)';
COMMENT ON COLUMN erp.erp_notas_fiscais.mensagem_retorno IS 'Mensagem de retorno da SEFAZ';
COMMENT ON COLUMN erp.erp_notas_fiscais.ambiente IS 'Ambiente de emissão: homologacao ou producao';

-- Grant
GRANT EXECUTE ON FUNCTION erp.loja_pode_emitir_nfe(UUID) TO supabase_admin;
GRANT EXECUTE ON FUNCTION erp.incrementar_numeracao_nfe(UUID, VARCHAR) TO supabase_admin;
GRANT EXECUTE ON FUNCTION erp.gerar_chave_acesso_nfe(VARCHAR, DATE, VARCHAR, VARCHAR, INTEGER, INTEGER, INTEGER) TO supabase_admin;
GRANT EXECUTE ON FUNCTION erp.calcular_dv_modulo11(VARCHAR) TO supabase_admin;
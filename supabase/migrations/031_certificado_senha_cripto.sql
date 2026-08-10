-- =====================================================
-- ERP System · Criptografia de Senha do Certificado A1
-- Migration: 031_certificado_senha_cripto.sql
--
-- Adiciona coluna para senha criptografada e função para
-- criptografar/descriptografar usando pgcrypto.
--
-- IMPORTANTE: Esta migration mantém compatibilidade com a
-- coluna antiga senha_armazenada (que armazenava texto plano).
-- A nova coluna senha_armazenada_cripto armazena a senha
-- criptografada com pgp_sym_encrypt.
-- =====================================================

-- Coluna para senha criptografada (bytea)
ALTER TABLE erp.erp_certificados_digitais
  ADD COLUMN IF NOT EXISTS senha_armazenada_cripto BYTEA;

-- Função helper para criptografar (chave virá de config do sistema)
CREATE OR REPLACE FUNCTION erp.criptografar_senha_cert(plaintext TEXT)
RETURNS BYTEA AS $$
DECLARE
  chave TEXT;
BEGIN
  -- Chave mestra: idealmente viria de variável de ambiente,
  -- mas para Supabase self-hosted usamos uma chave fixa em config_sistema
  SELECT valor INTO chave
  FROM erp.erp_configuracoes_sistema
  WHERE chave = 'chave_cripto_certificado'
  LIMIT 1;

  IF chave IS NULL THEN
    -- Fallback: usa CNPJ da loja (NÃO recomendado para produção)
    -- Será substituído quando você configurar uma chave mestra
    chave := 'xlife-erp-chave-padrao-trocar-em-producao';
  END IF;

  RETURN pgp_sym_encrypt(plaintext, chave, 'cipher-algo=aes256');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função helper para descriptografar
CREATE OR REPLACE FUNCTION erp.descriptografar_senha_cert(crypto_data BYTEA)
RETURNS TEXT AS $$
DECLARE
  chave TEXT;
BEGIN
  SELECT valor INTO chave
  FROM erp.erp_configuracoes_sistema
  WHERE chave = 'chave_cripto_certificado'
  LIMIT 1;

  IF chave IS NULL THEN
    chave := 'xlife-erp-chave-padrao-trocar-em-producao';
  END IF;

  RETURN pgp_sym_decrypt(crypto_data, chave);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migrar senhas antigas (se houver) para o formato criptografado
DO $$
DECLARE
  cert_record RECORD;
BEGIN
  FOR cert_record IN
    SELECT id, senha_armazenada
    FROM erp.erp_certificados_digitais
    WHERE senha_armazenada IS NOT NULL
      AND senha_armazenada_cripto IS NULL
  LOOP
    UPDATE erp.erp_certificados_digitais
    SET senha_armazenada_cripto = erp.criptografar_senha_cert(cert_record.senha_armazenada)
    WHERE id = cert_record.id;
  END LOOP;
END $$;

-- Configuração inicial da chave mestra (RECOMENDA-SE TROCAR!)
INSERT INTO erp.erp_configuracoes_sistema (chave, valor, tipo, categoria, descricao, editavel)
VALUES (
  'chave_cripto_certificado',
  'xlife-erp-chave-padrao-trocar-em-producao',
  'texto',
  'seguranca',
  'Chave mestra para criptografar senhas de certificados A1. IMPORTANTE: Trocar em produção!',
  false
)
ON CONFLICT (chave) DO NOTHING;

-- RLS para as funções helper
GRANT EXECUTE ON FUNCTION erp.criptografar_senha_cert(TEXT) TO supabase_admin;
GRANT EXECUTE ON FUNCTION erp.descriptografar_senha_cert(BYTEA) TO supabase_admin;

-- Comentário
COMMENT ON COLUMN erp.erp_certificados_digitais.senha_armazenada_cripto IS
  'Senha do certificado A1 criptografada com AES-256 via pgcrypto';
COMMENT ON COLUMN erp.erp_certificados_digitais.senha_armazenada IS
  'DEPRECATED: Use senha_armazenada_cripto. Mantida temporariamente para compatibilidade.';
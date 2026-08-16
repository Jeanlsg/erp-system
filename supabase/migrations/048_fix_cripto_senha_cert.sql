-- ============================================================
-- 048: Corrige as funções de criptografia da senha do certificado
--
-- A variável PL/pgSQL chamava-se `chave` e a tabela
-- erp_configuracoes_sistema também tem uma coluna `chave`, então o
-- WHERE ficava ambíguo e a função SEMPRE falhava com
-- "column reference chave is ambiguous". Ou seja: a criptografia da
-- senha do certificado nunca funcionou — descoberto ao cadastrar o
-- primeiro certificado A1 real.
--
-- Correção: renomeia a variável para v_chave e qualifica a coluna.
-- Também troca o EXCEPTION genérico do decrypt, que engolia qualquer
-- erro e devolvia NULL (a auditoria de 15/08 já tinha apontado isso):
-- agora só o erro de decriptação vira NULL, e o resto propaga.
-- ============================================================
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE OR REPLACE FUNCTION erp.criptografar_senha_cert(plaintext text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public, extensions
AS $$
DECLARE
  v_chave TEXT;
BEGIN
  SELECT s.valor INTO v_chave
    FROM erp.erp_configuracoes_sistema s
   WHERE s.chave = 'chave_cripto_certificado'
   LIMIT 1;

  IF v_chave IS NULL OR v_chave = '' THEN
    -- Chave padrão: trocar em produção cadastrando
    -- erp_configuracoes_sistema.chave = 'chave_cripto_certificado'
    v_chave := 'xlife-erp-chave-padrao-trocar-em-producao';
  END IF;

  RETURN pgp_sym_encrypt(plaintext, v_chave, 'cipher-algo=aes256');
END;
$$;

CREATE OR REPLACE FUNCTION erp.descriptografar_senha_cert(crypto_data bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public, extensions
AS $$
DECLARE
  v_chave TEXT;
BEGIN
  SELECT s.valor INTO v_chave
    FROM erp.erp_configuracoes_sistema s
   WHERE s.chave = 'chave_cripto_certificado'
   LIMIT 1;

  IF v_chave IS NULL OR v_chave = '' THEN
    v_chave := 'xlife-erp-chave-padrao-trocar-em-producao';
  END IF;

  RETURN pgp_sym_decrypt(crypto_data, v_chave);
EXCEPTION
  -- Só a falha de decriptação (chave errada/dado corrompido) vira NULL.
  -- Qualquer outro erro propaga, em vez de virar "certificado sem senha".
  WHEN external_routine_invocation_exception OR data_exception THEN
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION erp.criptografar_senha_cert(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION erp.descriptografar_senha_cert(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp.criptografar_senha_cert(text)      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION erp.descriptografar_senha_cert(bytea)  TO service_role;

#!/usr/bin/env bash
# ============================================================
# Rotaciona a chave que criptografa a senha dos certificados A1.
#
# A instalação sai de fábrica com a chave padrão
# 'xlife-erp-chave-padrao-trocar-em-producao' — ANTES do go-live
# ela precisa virar um segredo real. Este script:
#   1. gera uma chave aleatória de 256 bits;
#   2. re-encripta as senhas dos certificados com a chave nova
#      (a função de decriptação ainda lê a antiga da config);
#   3. grava a chave nova em erp_configuracoes_sistema;
#   4. só COMMITA se todas as senhas decriptarem com a chave nova.
#
# Rodar NA VPS (xlifevps), uma única vez:
#   bash rotacionar-chave-certificado.sh
# Depois, validar com um dry_run de emissão nas duas lojas.
# ============================================================
set -euo pipefail

NOVA=$(openssl rand -hex 32)
DB=$(docker ps -qf name=supabase-db)

docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <<SQL
BEGIN;
UPDATE erp.erp_certificados_digitais
   SET senha_armazenada_cripto = extensions.pgp_sym_encrypt(
         erp.descriptografar_senha_cert(senha_armazenada_cripto),
         '$NOVA', 'cipher-algo=aes256')
 WHERE senha_armazenada_cripto IS NOT NULL;

UPDATE erp.erp_configuracoes_sistema
   SET valor = '$NOVA'
 WHERE chave = 'chave_cripto_certificado';

DO \$verif\$
DECLARE falhas int;
BEGIN
  SELECT count(*) INTO falhas FROM erp.erp_certificados_digitais
   WHERE senha_armazenada_cripto IS NOT NULL
     AND erp.descriptografar_senha_cert(senha_armazenada_cripto) IS NULL;
  IF falhas > 0 THEN
    RAISE EXCEPTION 'rotação falhou: % certificado(s) não decriptam — nada foi alterado', falhas;
  END IF;
END
\$verif\$;
COMMIT;
SELECT 'ok: '||count(*)||' certificado(s) na chave nova'
  FROM erp.erp_certificados_digitais
 WHERE erp.descriptografar_senha_cert(senha_armazenada_cripto) IS NOT NULL;
SQL

unset NOVA
echo "Chave rotacionada. Valide com um dry_run de NFC-e nas duas lojas."

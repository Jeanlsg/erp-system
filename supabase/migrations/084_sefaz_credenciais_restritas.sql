-- ============================================================
-- 084 — o CSC de produção ficava legível para o balcão
--
-- erp_configuracoes_sefaz guarda csc_id e csc_token: a credencial que
-- assina o QR Code da NFC-e. A policy de leitura era a genérica
-- (qualquer usuário autenticado), e o hook do front faz `select *` —
-- então o token ia para o navegador de quem abrisse a tela.
--
-- Hoje o campo está vazio, porque a X-Life ainda não cadastrou o CSC de
-- produção. Ou seja: o vazamento ainda não aconteceu, mas aconteceria no
-- dia da virada, que é justamente quando ninguém estaria olhando isto.
--
-- Quem precisa da configuração no dia a dia precisa de POUCO dela: o
-- aviso de homologação do PDV olha `ambiente`. Esse pouco vira uma view;
-- a tabela passa a exigir admin/gerente.
-- ============================================================

BEGIN;

CREATE OR REPLACE VIEW erp.v_erp_sefaz_ambiente AS
  SELECT loja_id, ambiente, uf, serie_nfe, serie_nfce, ativo,
         -- serve para a tela dizer "falta cadastrar o CSC" sem entregar o valor
         (coalesce(csc_token, '') <> '') AS csc_configurado
    FROM erp.erp_configuracoes_sefaz;

COMMENT ON VIEW erp.v_erp_sefaz_ambiente IS
  'O que o balcão precisa saber da configuração fiscal: ambiente, UF e série. Sem csc_id nem csc_token.';

GRANT SELECT ON erp.v_erp_sefaz_ambiente TO authenticated;

DROP POLICY IF EXISTS erp_user_select ON erp.erp_configuracoes_sefaz;
DROP POLICY IF EXISTS erp_gestao_select_sefaz ON erp.erp_configuracoes_sefaz;
CREATE POLICY erp_gestao_select_sefaz ON erp.erp_configuracoes_sefaz
  FOR SELECT TO authenticated
  USING ((SELECT erp.is_erp_admin()));

COMMENT ON POLICY erp_gestao_select_sefaz ON erp.erp_configuracoes_sefaz IS
  'A tabela tem o CSC de produção. Quem só opera o caixa usa v_erp_sefaz_ambiente.';

COMMIT;

-- ============================================================
-- 069 — papéis em erp_pessoas: cliente e/ou fornecedor
--
-- PROBLEMA: as telas "Clientes" e "Fornecedores" mostravam a MESMA lista.
-- `useClientes()` e `useFornecedores()` consultavam erp_pessoas com o mesmo
-- filtro (`ativo = true`), e a tabela não tinha nenhuma coluna que separasse
-- um do outro — `tipo` é só `fisica|juridica`. Resultado em produção: as duas
-- telas listavam as mesmas 14 pessoas, cada cliente aparecendo como
-- fornecedor e vice-versa.
--
-- Isso também bloqueava a importação por planilha: não havia como gravar
-- "este registro é fornecedor".
--
-- SOLUÇÃO: duas flags, não um enum. Uma pessoa pode ser os dois ao mesmo
-- tempo — é comum o distribuidor que também compra no balcão, e a academia
-- que compra e revende. Um enum forçaria escolher.
--
-- BACKFILL: por evidência no movimento, e generoso onde não há evidência,
-- para que ninguém desapareça de uma tela ao aplicar isto:
--   · eh_cliente    = true para todos (preserva exatamente o que a tela
--                     Clientes mostra hoje)
--   · eh_fornecedor = true para quem tem compra, NFe de entrada ou conta a
--                     pagar; e para pessoa jurídica sem nenhuma venda, que é
--                     o perfil de distribuidora
-- ============================================================

BEGIN;

ALTER TABLE erp.erp_pessoas
  ADD COLUMN IF NOT EXISTS eh_cliente    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eh_fornecedor boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN erp.erp_pessoas.eh_cliente IS
  'Aparece na tela Clientes. Pode ser true junto com eh_fornecedor.';
COMMENT ON COLUMN erp.erp_pessoas.eh_fornecedor IS
  'Aparece na tela Fornecedores. Pode ser true junto com eh_cliente.';

-- ---- backfill: fornecedor por evidência de compra ----
UPDATE erp.erp_pessoas p SET eh_fornecedor = true
 WHERE EXISTS (SELECT 1 FROM erp.erp_compras c     WHERE c.fornecedor_id = p.id)
    OR EXISTS (SELECT 1 FROM erp.erp_nfe_entrada n WHERE n.fornecedor_id = p.id)
    OR EXISTS (SELECT 1 FROM erp.erp_contas ct     WHERE ct.pessoa_id = p.id AND ct.tipo = 'pagar');

-- ---- backfill: pessoa jurídica sem venda nenhuma é provável distribuidora ----
-- Mantém eh_cliente = true também, porque o palpite pode errar: melhor a
-- pessoa aparecer nas duas telas do que sumir da certa.
UPDATE erp.erp_pessoas p SET eh_fornecedor = true
 WHERE p.tipo = 'juridica'
   AND NOT EXISTS (SELECT 1 FROM erp.erp_vendas v WHERE v.cliente_id = p.id);

CREATE INDEX IF NOT EXISTS idx_pessoas_eh_cliente
  ON erp.erp_pessoas (eh_cliente) WHERE eh_cliente;
CREATE INDEX IF NOT EXISTS idx_pessoas_eh_fornecedor
  ON erp.erp_pessoas (eh_fornecedor) WHERE eh_fornecedor;

-- ---- a view da tela Clientes precisa expor as flags para poder filtrar ----
DROP VIEW IF EXISTS erp.vw_clientes_compras;
CREATE VIEW erp.vw_clientes_compras AS
  SELECT p.id,
         p.nome_razao,
         p.cpf_cnpj,
         p.email,
         p.telefone,
         p.celular,
         p.tipo,
         p.ativo,
         p.eh_cliente,
         p.eh_fornecedor,
         erp.chave_telefone(COALESCE(NULLIF(p.celular::text, ''::text), p.telefone::text)) AS chave_telefone,
         COALESCE(r.compras, 0) AS compras,
         COALESCE(r.total, 0::numeric) AS total_gasto,
         r.primeira AS primeira_compra,
         r.ultima AS ultima_compra
    FROM erp.erp_pessoas p
    LEFT JOIN LATERAL erp.resumo_compras_telefone(
           COALESCE(NULLIF(p.celular::text, ''::text), p.telefone::text)
         ) r(compras, total, primeira, ultima) ON true;

-- mesmos grants que a view tinha antes: authenticated e service_role, sem anon
GRANT SELECT ON erp.vw_clientes_compras TO authenticated, service_role;

-- ---- conferência (fica no log de quem aplicar) ----
SELECT 'pessoas='    || count(*)
    || ' clientes='  || count(*) FILTER (WHERE eh_cliente)
    || ' fornecedores=' || count(*) FILTER (WHERE eh_fornecedor)
    || ' ambos='     || count(*) FILTER (WHERE eh_cliente AND eh_fornecedor)
  FROM erp.erp_pessoas;

COMMIT;

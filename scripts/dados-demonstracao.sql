-- ============================================================
-- DADOS DE DEMONSTRAÇÃO — só para gerar as imagens dos tutoriais.
--
-- Tudo aqui é fictício e propositalmente reconhecível como tal: nomes com
-- "Exemplo", CPF/CNPJ com dígitos repetidos, marca "Marca Exemplo". Nenhuma
-- imagem de tutorial pode mostrar dado real de cliente.
--
-- USO:
--   1. rodar este script num sistema LIMPO
--   2. gerar as capturas (scripts/gerar-tutoriais.mjs)
--   3. rodar scripts/virada-producao.sql para apagar tudo de novo
--
-- O conjunto é montado para que cada tela alterada mostre algo útil:
--   · um produto ABAIXO do mínimo, para o alerta de estoque aparecer
--   · uma conta VENCIDA, para a inadimplência aparecer em vermelho
--   · um pedido de compra pendente, para o botão "Receber" existir
--   · um pedido LGPD pendente, para a fila não estar vazia
-- ============================================================

BEGIN;

-- ---------- categorias e produtos ----------
INSERT INTO erp.erp_categorias (nome, ativo) VALUES
  ('Proteínas', true), ('Creatinas', true), ('Pré-treino', true), ('Vitaminas', true);

INSERT INTO erp.erp_produtos
  (sku, nome, codigo_barras, categoria_id, preco_custo, preco_venda, estoque_minimo,
   ncm, csosn, cfop_padrao, unidade, marca, ativo)
VALUES
  ('WHEY-900-CHOC','Whey Protein Concentrado 900g — Chocolate','7890000000017',
   (SELECT id FROM erp.erp_categorias WHERE nome='Proteínas'), 89.90, 159.90, 5,
   '21061000','102','5102','UN','Marca Exemplo', true),
  ('WHEY-900-MOR','Whey Protein Concentrado 900g — Morango','7890000000024',
   (SELECT id FROM erp.erp_categorias WHERE nome='Proteínas'), 89.90, 159.90, 5,
   '21061000','102','5102','UN','Marca Exemplo', true),
  ('CREAT-300','Creatina Monoidratada 300g','7890000000031',
   (SELECT id FROM erp.erp_categorias WHERE nome='Creatinas'), 72.00, 129.90, 4,
   '21069090','102','5102','UN','Marca Exemplo', true),
  ('PRE-300-UVA','Pré-treino 300g — Uva','7890000000048',
   (SELECT id FROM erp.erp_categorias WHERE nome='Pré-treino'), 58.00, 109.90, 3,
   '21069090','102','5102','UN','Marca Exemplo', true),
  ('MULTI-60','Multivitamínico 60 cápsulas','7890000000055',
   (SELECT id FROM erp.erp_categorias WHERE nome='Vitaminas'), 24.00, 49.90, 6,
   '21069090','102','5102','UN','Marca Exemplo', true),
  ('BCAA-200','BCAA em pó 200g','7890000000062',
   (SELECT id FROM erp.erp_categorias WHERE nome='Proteínas'), 41.00, 79.90, 3,
   '21069090','102','5102','UN','Marca Exemplo', true);

-- estoque nas duas lojas. O Pré-treino fica com 2 contra mínimo 3, de
-- propósito: é o que faz o alerta de estoque baixo aparecer nas telas.
INSERT INTO erp.erp_estoque (produto_id, loja_id, quantidade, custo_medio)
SELECT p.id, l.id,
       CASE p.sku WHEN 'WHEY-900-CHOC' THEN 18 WHEN 'WHEY-900-MOR' THEN 12
                  WHEN 'CREAT-300' THEN 9 WHEN 'PRE-300-UVA' THEN 2
                  WHEN 'MULTI-60' THEN 24 ELSE 7 END,
       p.preco_custo
  FROM erp.erp_produtos p CROSS JOIN erp.erp_lojas l;

-- ---------- pessoas ----------
INSERT INTO erp.erp_pessoas (tipo, nome_razao, cpf_cnpj, email, celular, uf, ativo, eh_cliente, eh_fornecedor) VALUES
  ('fisica','Ana Exemplo da Silva','11111111111','ana.exemplo@email.com','(87) 90000-0001','PE', true, true, false),
  ('fisica','Bruno Exemplo Costa','22222222222','bruno.exemplo@email.com','(87) 90000-0002','PE', true, true, false),
  ('juridica','Academia Exemplo Ltda','33333333000133','contato@academiaexemplo.com','(87) 90000-0003','PE', true, true, false);

INSERT INTO erp.erp_pessoas (tipo, nome_razao, nome_fantasia, cpf_cnpj, email, telefone, uf, ativo, eh_cliente, eh_fornecedor) VALUES
  ('juridica','Distribuidora Exemplo Suplementos Ltda','Distribuidora Exemplo','44444444000144','vendas@distexemplo.com','(11) 4000-0000','SP', true, false, true),
  ('juridica','Importadora Exemplo Nutrição ME','Importadora Exemplo','55555555000155','comercial@impexemplo.com','(11) 5000-0000','SP', true, false, true);

INSERT INTO erp.erp_pessoas (tipo, nome_razao, cpf_cnpj, ativo, eh_cliente, eh_fornecedor) VALUES
  ('fisica','Carla Exemplo (vendedora)','66666666666', true, false, false),
  ('fisica','Diego Exemplo (estoquista)','77777777777', true, false, false);

-- ---------- equipe ----------
INSERT INTO erp.erp_funcionarios (pessoa_id, cargo, departamento, salario, data_admissao, comissao_percentual, cpf)
SELECT id, 'Vendedora', 'Loja', 1800.00, CURRENT_DATE - 120, 3.0, '66666666666'
  FROM erp.erp_pessoas WHERE nome_razao='Carla Exemplo (vendedora)';
INSERT INTO erp.erp_funcionarios (pessoa_id, cargo, departamento, salario, data_admissao, comissao_percentual, cpf)
SELECT id, 'Estoquista', 'Estoque', 1600.00, CURRENT_DATE - 60, 0, '77777777777'
  FROM erp.erp_pessoas WHERE nome_razao='Diego Exemplo (estoquista)';

-- ---------- contas a receber: uma vencida, duas a vencer ----------
INSERT INTO erp.erp_contas
  (loja_id, tipo, pessoa_id, descricao, valor, data_vencimento, status, categoria,
   parcela_numero, parcela_total, forma_pagamento)
SELECT l.id, 'receber', p.id, d.descricao, d.valor, d.venc, d.st::erp.erp_conta_status,
       'Crediário', d.pn, d.pt, 'crediario'
  FROM erp.erp_pessoas p
  CROSS JOIN (SELECT id FROM erp.erp_lojas WHERE matriz LIMIT 1) l,
       (VALUES ('Crediário — compra de 20/08', 159.90, CURRENT_DATE - 8,  'vencido',  1, 2),
               ('Crediário — compra de 20/08', 159.90, CURRENT_DATE + 22, 'pendente', 2, 2)) AS d(descricao,valor,venc,st,pn,pt)
 WHERE p.nome_razao = 'Ana Exemplo da Silva';

INSERT INTO erp.erp_contas
  (loja_id, tipo, pessoa_id, descricao, valor, data_vencimento, status, categoria, forma_pagamento)
SELECT (SELECT id FROM erp.erp_lojas WHERE matriz LIMIT 1), 'receber', id,
       'Venda a prazo — pedido 1042', 389.70, CURRENT_DATE + 12, 'pendente', 'Venda a prazo', 'boleto'
  FROM erp.erp_pessoas WHERE nome_razao='Academia Exemplo Ltda';

-- ---------- conta a pagar ----------
INSERT INTO erp.erp_contas
  (loja_id, tipo, pessoa_id, descricao, valor, data_vencimento, status, categoria, forma_pagamento)
SELECT (SELECT id FROM erp.erp_lojas WHERE matriz LIMIT 1), 'pagar', id,
       'Compra de mercadoria — NF 5678', 1450.00, CURRENT_DATE + 18, 'pendente', 'Mercadoria', 'boleto'
  FROM erp.erp_pessoas WHERE nome_razao='Distribuidora Exemplo Suplementos Ltda';

-- ---------- pedido de compra pendente (para o botão "Receber" existir) ----------
INSERT INTO erp.erp_compras (loja_id, fornecedor_id, usuario_id, total, status, data_compra, observacoes)
SELECT (SELECT id FROM erp.erp_lojas WHERE matriz LIMIT 1),
       (SELECT id FROM erp.erp_pessoas WHERE nome_razao='Distribuidora Exemplo Suplementos Ltda'),
       (SELECT id FROM erp.erp_usuarios WHERE ativo ORDER BY created_at LIMIT 1),
       1450.00, 'pendente', CURRENT_DATE - 2, 'Reposição mensal — exemplo';

INSERT INTO erp.erp_compra_itens (compra_id, produto_id, quantidade, preco_custo, subtotal)
SELECT c.id, p.id, 10, p.preco_custo, 10 * p.preco_custo
  FROM erp.erp_compras c
  JOIN erp.erp_produtos p ON p.sku IN ('WHEY-900-CHOC','CREAT-300')
 WHERE c.observacoes = 'Reposição mensal — exemplo';

-- ---------- pedido LGPD pendente (para a fila não estar vazia) ----------
INSERT INTO erp.erp_lgpd_solicitacoes (pessoa_id, nome_titular, documento_titular, solicitado_por)
SELECT p.id, p.nome_razao, p.cpf_cnpj,
       (SELECT id FROM erp.erp_usuarios WHERE ativo ORDER BY created_at LIMIT 1)
  FROM erp.erp_pessoas p WHERE p.nome_razao = 'Bruno Exemplo Costa';

SELECT 'demonstração: produtos=' || (SELECT count(*) FROM erp.erp_produtos)
    || ' pessoas='      || (SELECT count(*) FROM erp.erp_pessoas)
    || ' estoque='      || (SELECT count(*) FROM erp.erp_estoque)
    || ' contas='       || (SELECT count(*) FROM erp.erp_contas)
    || ' compras='      || (SELECT count(*) FROM erp.erp_compras)
    || ' funcionarios=' || (SELECT count(*) FROM erp.erp_funcionarios)
    || ' lgpd='         || (SELECT count(*) FROM erp.erp_lgpd_solicitacoes) AS resultado;

COMMIT;

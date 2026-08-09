-- Limpa seed duplicado e reaplica limpo
TRUNCATE erp.erp_estoque, erp.erp_produtos, erp.erp_categorias, erp.erp_lojas CASCADE;

-- Re-aplica seed
INSERT INTO erp.erp_lojas (nome, apelido, cnpj, telefone, ativo, cidade, uf, logradouro, numero, bairro, cep) VALUES
  ('Mercadinho do Bairro Ltda', 'Loja Centro', '11.222.333/0001-44', '1133334444', true, 'Sao Paulo', 'SP', 'Rua das Flores', '100', 'Centro', '01000-000'),
  ('Mercadinho do Bairro Filial', 'Loja Bairro', '11.222.333/0002-25', '1155556666', true, 'Sao Paulo', 'SP', 'Av. Brasil', '200', 'Bairro', '02000-000');

INSERT INTO erp.erp_categorias (nome, descricao, ativo) VALUES
  ('Bebidas', 'Refrigerantes, sucos, aguas', true),
  ('Padaria', 'Paes, bolos, salgados', true),
  ('Hortifruti', 'Frutas, verduras, legumes', true),
  ('Limpeza', 'Produtos de limpeza domestica', true),
  ('Mercearia', 'Graos, enlatados, temperos', true);

-- Produtos
DO $$
DECLARE cat_beb_id UUID; cat_pad_id UUID; cat_hor_id UUID; cat_mer_id UUID;
BEGIN
  SELECT id INTO cat_beb_id FROM erp.erp_categorias WHERE nome = 'Bebidas' LIMIT 1;
  SELECT id INTO cat_pad_id FROM erp.erp_categorias WHERE nome = 'Padaria' LIMIT 1;
  SELECT id INTO cat_hor_id FROM erp.erp_categorias WHERE nome = 'Hortifruti' LIMIT 1;
  SELECT id INTO cat_mer_id FROM erp.erp_categorias WHERE nome = 'Mercearia' LIMIT 1;

  INSERT INTO erp.erp_produtos (sku, nome, categoria_id, preco_venda, preco_custo, estoque_minimo, ativo) VALUES
    ('BEB001', 'Coca-Cola 2L', cat_beb_id, 12.50, 8.00, 10, true),
    ('BEB002', 'Agua Mineral 500ml', cat_beb_id, 3.00, 1.50, 20, true),
    ('PAD001', 'Pao Frances (un)', cat_pad_id, 1.00, 0.50, 50, true),
    ('HOR001', 'Banana Prata (kg)', cat_hor_id, 5.00, 3.00, 15, true),
    ('MER001', 'Arroz Tipo 1 5kg', cat_mer_id, 25.00, 18.00, 8, true);
END $$;

-- Estoque: cada produto x cada loja
INSERT INTO erp.erp_estoque (produto_id, loja_id, quantidade)
SELECT p.id, l.id, 50
FROM erp.erp_produtos p
CROSS JOIN erp.erp_lojas l;
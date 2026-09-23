-- ============================================================
-- 090 — duas regras de conferência do caixa, ligáveis pelo dono
--
-- Do sistema anterior, tela de Configurações Gerais:
--
--   "No fechamento de caixa, informar valores por forma de pagamento?"
--     Obriga o operador a declarar quanto entrou em cada forma, em vez de
--     só o total da gaveta. Serve para pegar venda lançada na forma errada
--     — que é o erro mais comum do balcão e o que mais desencontra caixa.
--
--   "Ocultar valores do fechamento, exceto para o Funcionário Master"
--     O operador conta a gaveta SEM ver o esperado. É controle contra o
--     ajuste do valor informado: quem vê que faltam R$ 50 tem a tentação
--     de declarar o número que fecha.
--
-- Ficam desligadas: ligar uma conferência sem avisar quem opera seria
-- mudar a rotina do balcão de um dia para o outro.
-- ============================================================

BEGIN;

INSERT INTO erp.erp_configuracoes_sistema (chave, valor, tipo, categoria, descricao, editavel)
VALUES
  ('caixa_exigir_valores_por_forma', 'false', 'booleano', 'caixa',
   'No fechamento, exigir que o operador informe quanto entrou em cada forma de pagamento.', true),
  ('caixa_ocultar_esperado', 'false', 'booleano', 'caixa',
   'Esconder do operador o valor esperado na gaveta durante o fechamento. O administrador continua vendo.', true)
ON CONFLICT (chave) DO NOTHING;

SELECT 'configurações de caixa: ' || count(*) FROM erp.erp_configuracoes_sistema WHERE categoria='caixa';

COMMIT;

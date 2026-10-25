-- ============================================================
-- 114 — Lojas aparecem como "Matriz" e "Filial" na tela (pedido da loja, 10/2026)
--
-- A loja pediu que as duas unidades, hoje "Juazeiro" e "Petrolina" em todo
-- o sistema, apareçam como "Matriz" e "Filial". É um renome SÓ DE EXIBIÇÃO:
--
--   · `apelido` é o que a tela mostra (seletor do topo, PDV, relatórios) —
--     é ele que muda;
--   · `nome` (nome comercial, razão social na NF-e e no SPED 0000) e
--     `cidade` (Juazeiro-BA / Petrolina-PE, usada no fiscal e no endereço do
--     emitente) NÃO mudam;
--   · a nota fiscal e o SPED deixaram de usar o apelido (xFant, "Remessa para
--     filial …", registro 0005 passam a usar o nome comercial). Publique as
--     edge functions erp-emitir-nfe e erp-sped ANTES desta migration — com as
--     versões antigas no ar, a próxima nota sairia com fantasia "Matriz".
--
-- Qual é a matriz vem do CNPJ cadastrado (decisão do usuário, regra da
-- Receita): os 4 dígitos depois da raiz (posições 9–12) são o número do
-- estabelecimento — "0001" é a matriz, "0002" em diante são filiais.
--
-- Só age quando o CNPJ decide sem dúvida: pelo menos duas lojas ativas,
-- todas com CNPJ de 14 dígitos, exatamente uma com "0001" e as demais com
-- outro número. Duas empresas de raízes diferentes podem ser ambas "0001" —
-- aí o CNPJ não diz qual é a matriz, e a migration só avisa (RAISE NOTICE)
-- e não altera nada; o renome fica manual na tela Lojas.
--
-- Ao agir:
--   1. apelido = 'Matriz' na loja 0001 e 'Filial' na outra. Com mais de uma
--      filial, 'Filial <cidade>' quando todas têm cidade preenchida e
--      diferente; senão 'Filial <número do CNPJ>' ("0003" → "Filial 3").
--      As duas regras só dependem do cadastro, então rodar de novo dá o
--      mesmo resultado.
--   2. `matriz` passa a bater com o CNPJ: true só na 0001 (o ★ do seletor e a
--      filial padrão do login usam essa coluna).
--   3. Os caixas que a migration 080 batizou 'Caixa N — <apelido>' (ex.:
--      "Caixa 1 — Petrolina") viram 'Caixa N — <apelido novo>'. O nome foi
--      gravado como texto e não acompanha o renome sozinho. Nomes
--      personalizados (qualquer coisa fora desse padrão exato) ficam como
--      estão, e um caixa só é renomeado se o nome novo não colidir com outro
--      caixa ativo da mesma loja (uq_erp_pontos_venda_nome_ativo, 094) —
--      o que ficar de fora sai num NOTICE.
--
-- Loja inativa não entra na conta nem é alterada.
--
-- Idempotente: só atualiza linha que ainda está diferente do alvo; rodar a
-- segunda vez não muda nada (o apelido antigo já é o novo, então nenhum
-- caixa casa com o padrão de renome).
--
-- Só dados, nenhuma DDL: não precisa de NOTIFY pgrst. As telas guardam a
-- lista de lojas em cache (React Query persistido): o nome novo aparece no
-- próximo carregamento da lista.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_ativas        int;
  v_sem_cnpj      int;
  v_matrizes      int;
  v_raizes        int;
  v_filiais       int;
  v_por_cidade    boolean;
  v_resumo        text;
  v_novo          text;
  v_eh_matriz     boolean;
  v_caixas        int;
  v_pulados       text;
  v_lojas_mudadas int := 0;
  v_caixas_total  int := 0;
  r               record;
BEGIN
  -- Diagnóstico do cadastro: só lojas ativas, CNPJ reduzido aos dígitos
  WITH l AS (
    SELECT id, apelido, cnpj, cidade,
           regexp_replace(coalesce(cnpj, ''), '\D', '', 'g') AS d
      FROM erp.erp_lojas
     WHERE coalesce(ativo, true)
  )
  SELECT count(*),
         count(*) FILTER (WHERE length(d) <> 14),
         count(*) FILTER (WHERE length(d) = 14 AND substr(d, 9, 4) = '0001'),
         count(DISTINCT left(d, 8)) FILTER (WHERE length(d) = 14),
         string_agg(apelido || ' (' || coalesce(nullif(cnpj, ''), 'sem CNPJ') || ')', ', ' ORDER BY apelido)
    INTO v_ativas, v_sem_cnpj, v_matrizes, v_raizes, v_resumo
    FROM l;

  IF v_ativas < 2 THEN
    RAISE NOTICE '114: % loja(s) ativa(s) [%] — o renome Matriz/Filial precisa de pelo menos duas. Nada foi alterado.',
      v_ativas, coalesce(v_resumo, '');
    RETURN;
  END IF;

  IF v_sem_cnpj > 0 THEN
    RAISE NOTICE '114: % loja(s) ativa(s) sem CNPJ de 14 dígitos [%] — sem CNPJ não dá para saber qual é a matriz. Nada foi alterado; renomeie na tela Lojas.',
      v_sem_cnpj, v_resumo;
    RETURN;
  END IF;

  IF v_matrizes <> 1 THEN
    RAISE NOTICE '114: % loja(s) com estabelecimento "0001" no CNPJ [%] — a matriz precisa ser exatamente uma (CNPJs de raízes diferentes podem ser todos 0001). Nada foi alterado; renomeie na tela Lojas.',
      v_matrizes, v_resumo;
    RETURN;
  END IF;

  IF v_raizes > 1 THEN
    -- Não bloqueia: a regra combinada é só o número do estabelecimento. Fica
    -- o aviso porque a "filial" de outra raiz é filial de OUTRA empresa.
    RAISE NOTICE '114: os CNPJs têm % raízes diferentes [%]; seguindo pela regra 0001 = matriz.',
      v_raizes, v_resumo;
  END IF;

  v_filiais := v_ativas - 1;

  -- Mais de uma filial: 'Filial <cidade>' só se todas têm cidade e nenhuma repete
  SELECT count(DISTINCT lower(btrim(cidade))) FILTER (WHERE btrim(coalesce(cidade, '')) <> '') = v_filiais
    INTO v_por_cidade
    FROM erp.erp_lojas
   WHERE coalesce(ativo, true)
     AND substr(regexp_replace(coalesce(cnpj, ''), '\D', '', 'g'), 9, 4) <> '0001';

  FOR r IN
    SELECT id, apelido, cidade, matriz,
           substr(regexp_replace(coalesce(cnpj, ''), '\D', '', 'g'), 9, 4) AS estab
      FROM erp.erp_lojas
     WHERE coalesce(ativo, true)
     ORDER BY 5, id
  LOOP
    v_eh_matriz := (r.estab = '0001');
    v_novo := left(CASE
      WHEN v_eh_matriz    THEN 'Matriz'
      WHEN v_filiais = 1  THEN 'Filial'
      WHEN v_por_cidade   THEN 'Filial ' || btrim(r.cidade)
      ELSE 'Filial ' || coalesce(nullif(ltrim(r.estab, '0'), ''), r.estab)
    END, 100);  -- apelido é VARCHAR(100)

    -- Caixas antes da loja: o padrão de renome usa o apelido ANTIGO
    v_caixas := 0;
    IF r.apelido IS DISTINCT FROM v_novo THEN
      UPDATE erp.erp_pontos_venda p
         SET nome = substring(p.nome FROM '^Caixa [0-9]+ — ') || v_novo
       WHERE p.loja_id = r.id
         AND p.nome = substring(p.nome FROM '^Caixa [0-9]+ — ') || r.apelido
         AND NOT EXISTS (
               SELECT 1 FROM erp.erp_pontos_venda o
                WHERE o.loja_id = p.loja_id AND o.id <> p.id
                  AND o.ativo AND p.ativo
                  AND lower(btrim(o.nome)) = lower(btrim(substring(p.nome FROM '^Caixa [0-9]+ — ') || v_novo)));
      GET DIAGNOSTICS v_caixas = ROW_COUNT;
      v_caixas_total := v_caixas_total + v_caixas;

      -- o que sobrou no padrão antigo é caixa cujo nome novo já existia
      SELECT string_agg(p.nome, ', ' ORDER BY p.numero) INTO v_pulados
        FROM erp.erp_pontos_venda p
       WHERE p.loja_id = r.id
         AND p.nome = substring(p.nome FROM '^Caixa [0-9]+ — ') || r.apelido;
      IF v_pulados IS NOT NULL THEN
        RAISE NOTICE '114: loja %: caixa(s) [%] mantido(s) — o nome novo já é de outro caixa ativo da loja. Renomeie na tela.',
          r.id, v_pulados;
      END IF;
    END IF;

    UPDATE erp.erp_lojas
       SET apelido = v_novo,
           matriz  = v_eh_matriz
     WHERE id = r.id
       AND (apelido IS DISTINCT FROM v_novo OR matriz IS DISTINCT FROM v_eh_matriz);

    IF FOUND THEN
      v_lojas_mudadas := v_lojas_mudadas + 1;
      RAISE NOTICE '114: loja % (cidade %, estabelecimento %): apelido "%" → "%", matriz % → %, % caixa(s) renomeado(s).',
        r.id, coalesce(r.cidade, '—'), r.estab, r.apelido, v_novo, coalesce(r.matriz::text, 'null'), v_eh_matriz::text, v_caixas;
    END IF;
  END LOOP;

  IF v_lojas_mudadas = 0 THEN
    RAISE NOTICE '114: lojas já estavam como Matriz/Filial pelo CNPJ [%]. Nada a mudar.', v_resumo;
  ELSE
    RAISE NOTICE '114: % loja(s) e % caixa(s) atualizados.', v_lojas_mudadas, v_caixas_total;
  END IF;
END $$;

COMMIT;

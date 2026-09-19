-- ============================================================
-- 077 — PDV: achar cliente pelo celular, no ERP e no CRM
--
-- No fechamento da venda o caixa digita o celular. Duas buscas:
--   · erp.buscar_cliente_por_telefone: cadastro do ERP (erp_pessoas), com
--     telefone normalizado dos dois lados — os telefones estão gravados com
--     máscara e às vezes com DDI;
--   · erp.buscar_lead_crm: o lead do CRM (public.leads, mesmo banco), pelo
--     phone_chatid. SECURITY DEFINER porque o usuário do ERP não tem
--     policy em public.leads — e não deve ter: a função devolve só o que o
--     balcão precisa para cadastrar (nome, e-mail, CPF, workspace).
-- O cadastro criado no PDV tem o celular, e é pelo celular que o
-- erp-crm-sync acha o lead e marca a venda no CRM.
-- ============================================================

BEGIN;

-- só dígitos, sem o DDI 55
CREATE OR REPLACE FUNCTION erp.telefone_normalizado(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d = '' THEN NULL
    WHEN length(d) > 11 AND left(d, 2) = '55' THEN substr(d, 3)
    ELSE d END
  FROM (SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g') AS d) x;
$$;

CREATE OR REPLACE FUNCTION erp.buscar_cliente_por_telefone(p_telefone text)
RETURNS TABLE (id uuid, nome_razao text, cpf_cnpj text, celular text, telefone text, email text)
LANGUAGE sql STABLE
SET search_path = erp, public AS $$
  SELECT p.id, p.nome_razao, p.cpf_cnpj, p.celular, p.telefone, p.email
    FROM erp.erp_pessoas p
   WHERE p.ativo
     AND length(erp.telefone_normalizado(p_telefone)) >= 10
     AND (erp.telefone_normalizado(p.celular)  = erp.telefone_normalizado(p_telefone)
       OR erp.telefone_normalizado(p.telefone) = erp.telefone_normalizado(p_telefone))
   ORDER BY p.eh_cliente DESC, p.updated_at DESC
   LIMIT 5;
$$;

CREATE OR REPLACE FUNCTION erp.buscar_lead_crm(p_telefone text)
RETURNS TABLE (lead_id text, nome text, email text, cpf text, telefone text,
               workspace text, etapa text, status text, ultima_msg text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = erp, public AS $$
  SELECT l.id, l.name, l.email, l.cpf, l.phone_chatid,
         w.nome, e.nome, l.status, l.ultima_msg_lead::text
    FROM public.leads l
    LEFT JOIN public.workspaces w ON w.id = l.id_workspace
    LEFT JOIN public.etapas e ON e.id = l.etapa
   WHERE erp.current_erp_user_id() IS NOT NULL
     AND length(erp.telefone_normalizado(p_telefone)) >= 10
     AND erp.telefone_normalizado(l.phone_chatid) = erp.telefone_normalizado(p_telefone)
   ORDER BY l.ultima_msg_lead DESC NULLS LAST
   LIMIT 3;
$$;

REVOKE ALL ON FUNCTION erp.buscar_lead_crm(text) FROM public;
GRANT EXECUTE ON FUNCTION erp.buscar_lead_crm(text) TO authenticated;
GRANT EXECUTE ON FUNCTION erp.buscar_cliente_por_telefone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION erp.telefone_normalizado(text) TO authenticated;

COMMIT;

-- =====================================================
-- ERP System · RLS Policies (prefixo erp_)
-- Migration: 009_rls_policies.sql
-- =====================================================

-- ===== Habilitar RLS =====
ALTER TABLE erp_agenda_compromissos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_agenda_telefonica ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_cheques ENABLE ROW LEVEL SECURITY;

ALTER TABLE erp_boletos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_crediario_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_crediario_parcela_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_promissorias ENABLE ROW LEVEL SECURITY;

ALTER TABLE erp_bandeiras_cartao ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_venda_taxas ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_sangrias ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_entradas_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_comissoes ENABLE ROW LEVEL SECURITY;

ALTER TABLE erp_avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_recomendacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_cartao_fidelidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_cartao_fidelidade_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_email_marketing ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_mala_direta ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_torpedos ENABLE ROW LEVEL SECURITY;

ALTER TABLE erp_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_chaves_pix ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_dados_empresariais ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_configuracoes_sefaz ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_certificados_digitais ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_configuracoes_sistema ENABLE ROW LEVEL SECURITY;

ALTER TABLE erp_negativacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_parcelamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_parcelamento_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_parcelamento_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_protestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_parcerias ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_ocorrencias ENABLE ROW LEVEL SECURITY;

-- ===== Policies =====
CREATE POLICY "Auth users can read erp_agenda_compromissos" ON erp_agenda_compromissos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_agenda_compromissos" ON erp_agenda_compromissos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update erp_agenda_compromissos" ON erp_agenda_compromissos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete erp_agenda_compromissos" ON erp_agenda_compromissos FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_agenda_telefonica" ON erp_agenda_telefonica FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_agenda_telefonica" ON erp_agenda_telefonica FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update erp_agenda_telefonica" ON erp_agenda_telefonica FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_cheques" ON erp_cheques FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_cheques" ON erp_cheques FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update erp_cheques" ON erp_cheques FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_boletos" ON erp_boletos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_boletos" ON erp_boletos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update erp_boletos" ON erp_boletos FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_crediario_parcelas" ON erp_crediario_parcelas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_crediario_parcelas" ON erp_crediario_parcelas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update erp_crediario_parcelas" ON erp_crediario_parcelas FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_crediario_parcela_itens" ON erp_crediario_parcela_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_crediario_parcela_itens" ON erp_crediario_parcela_itens FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth users can read erp_promissorias" ON erp_promissorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_promissorias" ON erp_promissorias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update erp_promissorias" ON erp_promissorias FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_bandeiras_cartao" ON erp_bandeiras_cartao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_bandeiras_cartao" ON erp_bandeiras_cartao FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_venda_taxas" ON erp_venda_taxas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_venda_taxas" ON erp_venda_taxas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth users can read erp_sangrias" ON erp_sangrias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_sangrias" ON erp_sangrias FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth users can read erp_entradas_extras" ON erp_entradas_extras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_entradas_extras" ON erp_entradas_extras FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth users can read erp_comissoes" ON erp_comissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_comissoes" ON erp_comissoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update erp_comissoes" ON erp_comissoes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_avaliacoes" ON erp_avaliacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_avaliacoes" ON erp_avaliacoes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth users can read erp_recomendacoes" ON erp_recomendacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_recomendacoes" ON erp_recomendacoes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth users can read erp_cartao_fidelidade" ON erp_cartao_fidelidade FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_cartao_fidelidade" ON erp_cartao_fidelidade FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update erp_cartao_fidelidade" ON erp_cartao_fidelidade FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_cartao_fidelidade_movimentacoes" ON erp_cartao_fidelidade_movimentacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_cartao_fidelidade_movimentacoes" ON erp_cartao_fidelidade_movimentacoes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth users can read erp_email_marketing" ON erp_email_marketing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_email_marketing" ON erp_email_marketing FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth users can read erp_mala_direta" ON erp_mala_direta FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_mala_direta" ON erp_mala_direta FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth users can read erp_torpedos" ON erp_torpedos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_torpedos" ON erp_torpedos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth users can read erp_documentos" ON erp_documentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_documentos" ON erp_documentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update erp_documentos" ON erp_documentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete erp_documentos" ON erp_documentos FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_downloads" ON erp_downloads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_downloads" ON erp_downloads FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_chaves_pix" ON erp_chaves_pix FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_chaves_pix" ON erp_chaves_pix FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_contas_bancarias" ON erp_contas_bancarias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_contas_bancarias" ON erp_contas_bancarias FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_dados_empresariais" ON erp_dados_empresariais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_dados_empresariais" ON erp_dados_empresariais FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_configuracoes_sefaz" ON erp_configuracoes_sefaz FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_configuracoes_sefaz" ON erp_configuracoes_sefaz FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_certificados_digitais" ON erp_certificados_digitais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_certificados_digitais" ON erp_certificados_digitais FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_configuracoes_sistema" ON erp_configuracoes_sistema FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_configuracoes_sistema" ON erp_configuracoes_sistema FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_negativacoes" ON erp_negativacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_negativacoes" ON erp_negativacoes FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_parcelamentos" ON erp_parcelamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_parcelamentos" ON erp_parcelamentos FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_parcelamento_contas" ON erp_parcelamento_contas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_parcelamento_contas" ON erp_parcelamento_contas FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_parcelamento_parcelas" ON erp_parcelamento_parcelas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_parcelamento_parcelas" ON erp_parcelamento_parcelas FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_protestos" ON erp_protestos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_protestos" ON erp_protestos FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_parcerias" ON erp_parcerias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_parcerias" ON erp_parcerias FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read erp_notificacoes" ON erp_notificacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can update erp_notificacoes" ON erp_notificacoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can insert erp_notificacoes" ON erp_notificacoes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth users can read erp_ocorrencias" ON erp_ocorrencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage erp_ocorrencias" ON erp_ocorrencias FOR ALL TO authenticated USING (true);
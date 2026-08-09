-- =====================================================
-- ERP System · Tornar cpf_cnpj opcional
-- Migration: 013_allow_null_cpf_cnpj.sql
--
-- Justificativa: o sync de leads do Overdrive (apps_supabase)
-- não tem CPF/CNPJ — é dado de WhatsApp. Para permitir sync
-- one-shot sem gerar dado fake, permitimos null.
--
-- ATENÇÃO: ainda mantém UNIQUE pra evitar duplicatas quando
-- o dado existir. Mas tolera nulos (Postgres: múltiplos NULL
-- são permitidos em colunas UNIQUE por padrão).
-- =====================================================

ALTER TABLE erp_pessoas ALTER COLUMN cpf_cnpj DROP NOT NULL;
-- ============================================================================
-- FARMA MARKETING — Migration 003: Hardening de segurança
-- Corrige aviso do linter Supabase: functions sem search_path fixo são
-- vulneráveis a search_path hijacking. Fixamos explicitamente em cada uma.
-- ============================================================================

alter function set_updated_at() set search_path = public;
alter function checar_aprovacao_campanha() set search_path = public;
alter function registrar_auditoria() set search_path = public;
alter function auth_farmacia_id() set search_path = public;
alter function auth_papel() set search_path = public;

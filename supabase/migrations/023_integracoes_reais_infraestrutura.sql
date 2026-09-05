-- ============================================================================
-- FARMA MARKETING — Migration 023: Infraestrutura de Integrações Reais (Fase 2)
-- Não edita 001-022. Estende `integracoes` (não recria), usa supabase_vault
-- (já instalada) para armazenar credenciais — nunca em texto puro em coluna
-- normal, nunca acessível a anon/authenticated.
--
-- DECISÃO ARQUITETURAL CENTRAL: um token de acesso é um segredo por
-- FARMÁCIA (multi-tenant), não um segredo global do projeto — por isso não
-- pode ser um "Supabase secret" de Edge Function (que é global). O Vault
-- resolve isso: cada integracoes.vault_secret_id aponta para um segredo
-- individual, criptografado em repouso, só decifrável via
-- vault.decrypted_secrets — view que só service_role (Edge Functions)
-- acessa. RLS de integracoes nunca expõe essa coluna a um valor útil por
-- si só (é só um UUID de referência, não o segredo).
-- ============================================================================

alter type status_integracao add value if not exists 'token_expirado';

alter table integracoes
  add column if not exists vault_secret_id uuid references vault.secrets(id),
  add column if not exists conta_externa_id text,
  add column if not exists conta_externa_nome text,
  add column if not exists escopo text,
  add column if not exists token_expira_em timestamptz,
  add column if not exists conectado_por uuid references usuarios(id);

comment on column integracoes.vault_secret_id is
  'Referência ao segredo no Supabase Vault (access token). Nunca contém o token em si. Só decifrável via vault.decrypted_secrets, acessível apenas a service_role.';
comment on column integracoes.conta_externa_id is 'ID da Página/conta/WABA na Meta — não é segredo, só identificação.';
comment on column integracoes.conectado_por is 'Usuário (admin) que executou o fluxo OAuth de conexão.';

-- Corrige achado B1 (auditoria Sprints 10-12): SELECT de integracoes não
-- verificava pode_ver do módulo correspondente ao provedor.
drop policy if exists integracoes_select on integracoes;

create policy integracoes_select on integracoes for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (
      select 1 from permissoes
      where papel = auth_papel()
        and modulo_id = provedor::text
        and pode_ver
    )
  );

-- id_externo — o ID real que a Meta atribui a cada mensagem/publicação.
alter table whatsapp_mensagens add column if not exists id_externo text;
alter table instagram_publicacoes add column if not exists id_externo text;
alter table facebook_publicacoes add column if not exists id_externo text;

create unique index if not exists idx_whatsapp_mensagens_id_externo on whatsapp_mensagens(id_externo) where id_externo is not null;
create unique index if not exists idx_instagram_publicacoes_id_externo on instagram_publicacoes(id_externo) where id_externo is not null;
create unique index if not exists idx_facebook_publicacoes_id_externo on facebook_publicacoes(id_externo) where id_externo is not null;

-- Idempotência de webhook: evita processar o mesmo evento da Meta duas vezes.
create table webhook_eventos_processados (
  id uuid primary key default gen_random_uuid(),
  provedor provedor_integracao not null,
  evento_id text not null,
  farmacia_id uuid references farmacias(id),
  processado_em timestamptz not null default now(),
  constraint webhook_eventos_unicos unique (provedor, evento_id)
);

comment on table webhook_eventos_processados is
  'Idempotência de webhook — impede reprocessar o mesmo evento da Meta duas vezes. Só service_role grava/lê; não é consultada pelo frontend.';

alter table webhook_eventos_processados enable row level security;
-- Sem policy para anon/authenticated de propósito: só service_role (que
-- bypassa RLS por padrão) grava e lê aqui.

-- Funções de acesso ao Vault — únicas formas de gravar/ler um segredo.
-- SECURITY DEFINER necessário: vault.create_secret/decrypted_secrets não
-- são acessíveis a `authenticated` por design do Vault. Encapsulado em
-- duas funções mínimas, cada uma fazendo uma coisa só, GRANT restrito a
-- service_role.
create or replace function vault_gravar_token_integracao(
  p_integracao_id uuid,
  p_token text,
  p_nome_secret text
) returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  if not exists (select 1 from integracoes where id = p_integracao_id) then
    raise exception 'Integração % não encontrada.', p_integracao_id;
  end if;

  select vault.create_secret(p_token, p_nome_secret) into v_secret_id;

  update integracoes set vault_secret_id = v_secret_id, updated_at = now()
  where id = p_integracao_id;

  return v_secret_id;
end;
$$;

revoke all on function vault_gravar_token_integracao(uuid, text, text) from public, anon, authenticated;
grant execute on function vault_gravar_token_integracao(uuid, text, text) to service_role;

create or replace function vault_ler_token_integracao(p_integracao_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_token text;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets ds
  join integracoes i on i.vault_secret_id = ds.id
  where i.id = p_integracao_id;

  return v_token;
end;
$$;

revoke all on function vault_ler_token_integracao(uuid) from public, anon, authenticated;
grant execute on function vault_ler_token_integracao(uuid) to service_role;

-- Auditoria de conexão/desconexão: `trg_auditoria_integracoes` já existe
-- desde a migration 001 (confirmado ao tentar recriá-la — erro "already
-- exists"), reaproveitando registrar_auditoria() como todo o resto do
-- sistema. Nenhuma trigger nova necessária aqui. O token nunca passa por
-- ela como texto puro — só vault_secret_id (um UUID de referência) é
-- capturado em NEW/OLD.

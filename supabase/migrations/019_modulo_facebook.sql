-- ============================================================================
-- FARMA MARKETING — Migration 019: Módulo Facebook (Sprint 12)
-- Não edita 001-018. Reaproveita: tabela `integracoes` (provedor
-- 'facebook'), src/lib/integracoes/AdaptadorIntegracao.js,
-- permissoes (módulo 'facebook' já semeado), logs_auditoria + trigger
-- genérico, e `conteudo_canais` (Sprint 5) — mesmo padrão arquitetural já
-- estabelecido em instagram_publicacoes (migration 018): uma publicação no
-- Facebook é sempre a publicação de um Conteúdo já modelado no sistema.
-- ============================================================================

create type facebook_status_publicacao as enum ('pendente', 'publicada', 'erro', 'indisponivel');

create table facebook_publicacoes (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  conteudo_id uuid not null references conteudos(id),
  status facebook_status_publicacao not null default 'pendente',
  link_publicado text,
  curtidas integer,
  comentarios integer,
  alcance integer,
  erro_mensagem text,
  usuario_id uuid references usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facebook_publicacoes_link_somente_quando_publicada
    check (status <> 'publicada' or link_publicado is not null),
  constraint facebook_publicacoes_metricas_nao_negativas
    check (
      (curtidas is null or curtidas >= 0) and
      (comentarios is null or comentarios >= 0) and
      (alcance is null or alcance >= 0)
    )
);

comment on table facebook_publicacoes is
  'Histórico de tentativas de publicação de Conteúdo no Facebook. Sem publicação real neste sprint — status fica indisponivel. Métricas nunca fabricadas. Mesmo padrão de instagram_publicacoes (migration 018).';

create index idx_facebook_publicacoes_farmacia on facebook_publicacoes(farmacia_id);
create index idx_facebook_publicacoes_status on facebook_publicacoes(farmacia_id, status);
create index idx_facebook_publicacoes_conteudo on facebook_publicacoes(conteudo_id);
create index idx_facebook_publicacoes_usuario on facebook_publicacoes(usuario_id);

create trigger trg_facebook_publicacoes_updated before update on facebook_publicacoes
  for each row execute function set_updated_at();

create or replace function proteger_identidade_facebook_publicacao()
returns trigger language plpgsql as $$
declare
  v_farmacia_conteudo uuid;
begin
  if tg_op = 'INSERT' then
    new.farmacia_id := auth_farmacia_id();
    new.usuario_id := auth.uid();
    if new.farmacia_id is null or new.usuario_id is null then
      raise exception 'Registro de publicação requer usuário autenticado vinculado a uma farmácia.';
    end if;
  else
    if new.farmacia_id is distinct from old.farmacia_id then
      raise exception 'farmacia_id não pode ser alterado após a criação da publicação.';
    end if;
    if new.usuario_id is distinct from old.usuario_id then
      raise exception 'usuario_id não pode ser alterado após a criação da publicação.';
    end if;
    if new.conteudo_id is distinct from old.conteudo_id then
      raise exception 'conteudo_id não pode ser alterado após a criação da publicação.';
    end if;
  end if;

  select farmacia_id into v_farmacia_conteudo from conteudos where id = new.conteudo_id;
  if v_farmacia_conteudo is null or v_farmacia_conteudo <> new.farmacia_id then
    raise exception 'Conteúdo não pertence à mesma farmácia da publicação.';
  end if;

  if tg_op = 'INSERT' and not exists (
    select 1 from conteudo_canais where conteudo_id = new.conteudo_id and canal = 'facebook'
  ) then
    raise exception 'Conteúdo % não está marcado com o canal facebook em conteudo_canais.', new.conteudo_id;
  end if;

  return new;
end;
$$;

alter function proteger_identidade_facebook_publicacao() set search_path = public;

create trigger trg_proteger_identidade_facebook_publicacao
  before insert or update on facebook_publicacoes
  for each row execute function proteger_identidade_facebook_publicacao();

create or replace function checar_transicao_facebook_publicacao()
returns trigger language plpgsql as $$
declare
  v_transicoes jsonb := '{
    "pendente": ["publicada", "erro", "indisponivel"]
  }'::jsonb;
begin
  if tg_op = 'INSERT' then
    if new.status not in ('pendente', 'indisponivel') then
      raise exception 'Nova publicação só pode nascer pendente ou indisponivel (recebido: %).', new.status;
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (
      v_transicoes ? old.status::text
      and (v_transicoes -> old.status::text) ? new.status::text
    ) then
      raise exception 'Transição de status de publicação inválida: % -> %.', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

alter function checar_transicao_facebook_publicacao() set search_path = public;

create trigger trg_facebook_publicacao_state_machine
  before insert or update on facebook_publicacoes
  for each row execute function checar_transicao_facebook_publicacao();

alter table facebook_publicacoes enable row level security;

create policy facebook_publicacoes_select on facebook_publicacoes for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'facebook' and pode_ver)
  );

create policy facebook_publicacoes_insert on facebook_publicacoes for insert
  with check (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'facebook' and pode_editar)
  );

create policy facebook_publicacoes_update on facebook_publicacoes for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'facebook' and pode_editar)
  )
  with check (
    farmacia_id = auth_farmacia_id()
  );

create trigger trg_auditoria_facebook_publicacoes after insert or update on facebook_publicacoes
  for each row execute function registrar_auditoria();

update modulos set disponivel = true where id = 'facebook';

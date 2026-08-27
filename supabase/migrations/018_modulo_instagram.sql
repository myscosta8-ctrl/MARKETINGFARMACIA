-- ============================================================================
-- FARMA MARKETING — Migration 018: Módulo Instagram (Sprint 11)
-- Não edita 001-017. Reaproveita: tabela `integracoes` (Sprint 1, já cobre
-- status de conexão do provedor 'instagram'), src/lib/integracoes/
-- AdaptadorIntegracao.js (Sprint 1), permissoes (módulo 'instagram' já
-- semeado desde a migration 001), logs_auditoria + trigger genérico, e
-- `conteudo_canais` (Sprint 5) — uma publicação no Instagram é sempre a
-- publicação de um Conteúdo já modelado no sistema; nada de texto/mídia é
-- duplicado aqui, só o registro da tentativa/resultado de publicação.
-- ============================================================================

create type instagram_status_publicacao as enum ('pendente', 'publicada', 'erro', 'indisponivel');

create table instagram_publicacoes (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  conteudo_id uuid not null references conteudos(id),
  status instagram_status_publicacao not null default 'pendente',
  link_publicado text,
  curtidas integer,
  comentarios integer,
  alcance integer,
  erro_mensagem text,
  usuario_id uuid references usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instagram_publicacoes_link_somente_quando_publicada
    check (status <> 'publicada' or link_publicado is not null),
  constraint instagram_publicacoes_metricas_nao_negativas
    check (
      (curtidas is null or curtidas >= 0) and
      (comentarios is null or comentarios >= 0) and
      (alcance is null or alcance >= 0)
    )
);

comment on table instagram_publicacoes is
  'Histórico de tentativas de publicação de Conteúdo no Instagram. Sem publicação real neste sprint — status fica indisponivel. Métricas (curtidas/comentários/alcance) nunca fabricadas — nulas até um provedor real preenchê-las.';

create index idx_instagram_publicacoes_farmacia on instagram_publicacoes(farmacia_id);
create index idx_instagram_publicacoes_status on instagram_publicacoes(farmacia_id, status);
create index idx_instagram_publicacoes_conteudo on instagram_publicacoes(conteudo_id);
create index idx_instagram_publicacoes_usuario on instagram_publicacoes(usuario_id);

create trigger trg_instagram_publicacoes_updated before update on instagram_publicacoes
  for each row execute function set_updated_at();

-- Identidade + farmácia + integridade de canal. farmacia_id/usuario_id
-- sempre de auth_farmacia_id()/auth.uid(), imutáveis. Vínculo extra
-- específico deste módulo: o conteúdo referenciado precisa ter o canal
-- 'instagram' registrado em conteudo_canais (Sprint 5) — reaproveita a
-- estrutura existente em vez de duplicar o conceito de "canal".
create or replace function proteger_identidade_instagram_publicacao()
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
    select 1 from conteudo_canais where conteudo_id = new.conteudo_id and canal = 'instagram'
  ) then
    raise exception 'Conteúdo % não está marcado com o canal instagram em conteudo_canais.', new.conteudo_id;
  end if;

  return new;
end;
$$;

alter function proteger_identidade_instagram_publicacao() set search_path = public;

create trigger trg_proteger_identidade_instagram_publicacao
  before insert or update on instagram_publicacoes
  for each row execute function proteger_identidade_instagram_publicacao();

-- Máquina de estados simples — mesmo padrão de
-- checar_transicao_whatsapp_mensagem() (migration 017).
create or replace function checar_transicao_instagram_publicacao()
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

alter function checar_transicao_instagram_publicacao() set search_path = public;

create trigger trg_instagram_publicacao_state_machine
  before insert or update on instagram_publicacoes
  for each row execute function checar_transicao_instagram_publicacao();

alter table instagram_publicacoes enable row level security;

create policy instagram_publicacoes_select on instagram_publicacoes for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'instagram' and pode_ver)
  );

create policy instagram_publicacoes_insert on instagram_publicacoes for insert
  with check (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'instagram' and pode_editar)
  );

create policy instagram_publicacoes_update on instagram_publicacoes for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'instagram' and pode_editar)
  )
  with check (
    farmacia_id = auth_farmacia_id()
  );

create trigger trg_auditoria_instagram_publicacoes after insert or update on instagram_publicacoes
  for each row execute function registrar_auditoria();

update modulos set disponivel = true where id = 'instagram';

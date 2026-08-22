-- ============================================================================
-- FARMA MARKETING — Migration 011: Módulo de Conteúdo (Sprint 5)
-- Não edita 001-010. Reaproveita RLS/farmacia_id, permissoes (módulo
-- 'conteudo' já semeado desde a migration 001), logs_auditoria + trigger
-- genérico, proteger_criado_por_produto() (genérica desde a migration 008).
-- Máquina de estados e aprovação seguem o MESMO PRINCÍPIO de campanhas
-- (migration 004), adaptadas para o ciclo de vida próprio de conteúdo.
-- ============================================================================

create type tipo_conteudo as enum (
  'post', 'story', 'reels', 'video', 'carrossel', 'arte', 'texto', 'oferta_promocao'
);

create type status_conteudo as enum (
  'rascunho', 'revisao', 'aprovado', 'agendado', 'publicado', 'pausado', 'cancelado'
);

-- ----------------------------------------------------------------------------
-- conteudos — entidade principal. Separação clara entre o que é destinado
-- ao público (texto_copy, cta, hashtags) e gestão interna
-- (observacoes_internas) — pedido explícito da especificação.
-- ----------------------------------------------------------------------------
create table conteudos (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  titulo text not null,
  tipo tipo_conteudo not null default 'post',
  status status_conteudo not null default 'rascunho',
  descricao text,
  texto_copy text,
  cta text,
  hashtags text,
  observacoes_internas text,
  campanha_id uuid references campanhas(id),
  produto_id uuid references produtos(id),
  responsavel_id uuid references usuarios(id),
  data_agendamento date,
  hora_agendamento time,
  aprovado_por uuid references usuarios(id),
  aprovado_em timestamptz,
  criado_por uuid references usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conteudos_titulo_nao_vazio check (length(trim(titulo)) > 0)
);

comment on table conteudos is
  'Camada própria de conteúdo de marketing. Vincula opcionalmente a campanha/produto/responsável — nunca duplica esses dados.';

create index idx_conteudos_farmacia on conteudos(farmacia_id);
create index idx_conteudos_status on conteudos(farmacia_id, status);
create index idx_conteudos_campanha on conteudos(campanha_id) where campanha_id is not null;
create index idx_conteudos_produto on conteudos(produto_id) where produto_id is not null;
create index idx_conteudos_responsavel on conteudos(responsavel_id);
create index idx_conteudos_agendamento on conteudos(farmacia_id, data_agendamento) where data_agendamento is not null;

create trigger trg_conteudos_updated before update on conteudos
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- conteudo_canais — tabela filha (um conteúdo pode ter vários canais).
-- Estrutura própria em vez de coluna array, conforme pedido explícito da
-- especificação para dados multi-valorados desta natureza.
-- ----------------------------------------------------------------------------
create table conteudo_canais (
  id uuid primary key default gen_random_uuid(),
  conteudo_id uuid not null references conteudos(id) on delete cascade,
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  canal text not null,
  created_at timestamptz not null default now(),
  unique (conteudo_id, canal)
);

create index idx_conteudo_canais_conteudo on conteudo_canais(conteudo_id);
create index idx_conteudo_canais_farmacia on conteudo_canais(farmacia_id);

-- ----------------------------------------------------------------------------
-- conteudo_midias — tabela filha (um conteúdo pode ter várias peças de
-- mídia, ex.: carrossel). Só referência de URL — sem upload real neste
-- sprint, mesmo padrão já usado em campanha_conteudos.imagem_url.
-- ----------------------------------------------------------------------------
create table conteudo_midias (
  id uuid primary key default gen_random_uuid(),
  conteudo_id uuid not null references conteudos(id) on delete cascade,
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  url text not null,
  tipo_arquivo text,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_conteudo_midias_conteudo on conteudo_midias(conteudo_id);
create index idx_conteudo_midias_farmacia on conteudo_midias(farmacia_id);

-- ----------------------------------------------------------------------------
-- Proteção de farmacia_id (conteudos) — mesmo padrão de
-- proteger_farmacia_evento_calendario() (migration 009, corrigida na
-- migration 010): farmacia_id vem sempre de auth_farmacia_id(), nunca do
-- client; imutável após criado; campanha_id/produto_id/responsavel_id,
-- quando informados, precisam pertencer à mesma farmácia. Já nasce
-- incluindo a checagem de responsavel_id desde o início (lição do S4-01).
-- ----------------------------------------------------------------------------
create or replace function proteger_farmacia_conteudo()
returns trigger language plpgsql as $$
declare
  v_farmacia_campanha uuid;
  v_farmacia_produto uuid;
  v_farmacia_responsavel uuid;
begin
  if tg_op = 'INSERT' then
    new.farmacia_id := auth_farmacia_id();
    if new.farmacia_id is null then
      raise exception 'Criação de conteúdo requer usuário autenticado vinculado a uma farmácia.';
    end if;
  else
    if new.farmacia_id is distinct from old.farmacia_id then
      raise exception 'farmacia_id não pode ser alterado após a criação do conteúdo.';
    end if;
  end if;

  if new.campanha_id is not null then
    select farmacia_id into v_farmacia_campanha from campanhas where id = new.campanha_id;
    if v_farmacia_campanha is null or v_farmacia_campanha <> new.farmacia_id then
      raise exception 'Campanha não pertence à mesma farmácia do conteúdo.';
    end if;
  end if;

  if new.produto_id is not null then
    select farmacia_id into v_farmacia_produto from produtos where id = new.produto_id;
    if v_farmacia_produto is null or v_farmacia_produto <> new.farmacia_id then
      raise exception 'Produto não pertence à mesma farmácia do conteúdo.';
    end if;
  end if;

  if new.responsavel_id is not null then
    select farmacia_id into v_farmacia_responsavel from usuarios where id = new.responsavel_id;
    if v_farmacia_responsavel is null or v_farmacia_responsavel <> new.farmacia_id then
      raise exception 'Responsável não pertence à mesma farmácia do conteúdo.';
    end if;
  end if;

  return new;
end;
$$;

alter function proteger_farmacia_conteudo() set search_path = public;

create trigger trg_proteger_farmacia_conteudo
  before insert or update on conteudos
  for each row execute function proteger_farmacia_conteudo();

create trigger trg_proteger_criado_por_conteudo
  before insert or update on conteudos
  for each row execute function proteger_criado_por_produto();

-- ----------------------------------------------------------------------------
-- Máquina de estados + aprovação — mesmo princípio de segurança usado em
-- checar_aprovacao_campanha (migration 004): auth.uid(), permissão
-- específica (pode_aprovar), mesma farmácia, aprovado_por nunca informável
-- manualmente, transições explícitas e travadas no banco.
-- ----------------------------------------------------------------------------
create or replace function checar_aprovacao_conteudo()
returns trigger language plpgsql as $$
declare
  v_transicoes jsonb := '{
    "rascunho": ["revisao"],
    "revisao": ["rascunho", "aprovado"],
    "aprovado": ["agendado", "cancelado"],
    "agendado": ["publicado", "pausado", "cancelado"],
    "publicado": ["pausado", "cancelado"],
    "pausado": ["agendado", "publicado", "cancelado"]
  }'::jsonb;
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'rascunho' then
      raise exception 'Novo conteúdo deve começar em rascunho (recebido: %).', new.status;
    end if;
    if new.aprovado_por is not null then
      raise exception 'aprovado_por não pode ser definido na criação do conteúdo.';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (
      v_transicoes ? old.status::text
      and (v_transicoes -> old.status::text) ? new.status::text
    ) then
      raise exception 'Transição de status inválida: % -> %.', old.status, new.status;
    end if;

    if new.status = 'aprovado' then
      if auth.uid() is null then
        raise exception 'Aprovação requer usuário autenticado.';
      end if;
      if new.aprovado_por is distinct from auth.uid() then
        raise exception 'aprovado_por deve ser o usuário autenticado que está aprovando.';
      end if;
      if not exists (
        select 1
        from usuarios u
        join permissoes p on p.papel = u.papel and p.modulo_id = 'conteudo'
        where u.id = auth.uid()
          and u.farmacia_id = new.farmacia_id
          and p.pode_aprovar
      ) then
        raise exception 'Usuário não tem permissão para aprovar conteúdo desta farmácia.';
      end if;
      new.aprovado_em := now();
    end if;

  else
    if new.aprovado_por is distinct from old.aprovado_por then
      raise exception 'aprovado_por só pode ser definido durante uma aprovação válida (revisão -> aprovado).';
    end if;
  end if;

  return new;
end;
$$;

alter function checar_aprovacao_conteudo() set search_path = public;

create trigger trg_conteudo_state_machine
  before insert or update on conteudos
  for each row execute function checar_aprovacao_conteudo();

-- ----------------------------------------------------------------------------
-- RLS — conteudos: mesmo padrão dos demais módulos. Sem DELETE (assim como
-- campanhas): remoção lógica via status = 'cancelado', preserva histórico.
-- ----------------------------------------------------------------------------
alter table conteudos enable row level security;

create policy conteudos_select on conteudos for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'conteudo' and pode_ver)
  );

create policy conteudos_insert on conteudos for insert
  with check (
    exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'conteudo' and pode_editar)
  );

create policy conteudos_update on conteudos for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'conteudo' and pode_editar)
  )
  with check (
    farmacia_id = auth_farmacia_id()
    and (
      status <> 'aprovado'
      or exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'conteudo' and pode_aprovar)
    )
  );

create trigger trg_auditoria_conteudos after insert or update on conteudos
  for each row execute function registrar_auditoria();

-- ----------------------------------------------------------------------------
-- farmacia_id das tabelas filhas (canais/mídias) sempre derivado do
-- conteúdo-mãe — mesmo padrão de sincronizar_farmacia_filho_campanha
-- (migration 005/007), função nova pois a fonte é uma tabela diferente.
-- ----------------------------------------------------------------------------
create or replace function sincronizar_farmacia_filho_conteudo()
returns trigger language plpgsql as $$
begin
  select farmacia_id into new.farmacia_id from conteudos where id = new.conteudo_id;
  if new.farmacia_id is null then
    raise exception 'Conteúdo % não encontrado.', new.conteudo_id;
  end if;
  return new;
end;
$$;

alter function sincronizar_farmacia_filho_conteudo() set search_path = public;

create trigger trg_sync_farmacia_canais before insert or update on conteudo_canais
  for each row execute function sincronizar_farmacia_filho_conteudo();
create trigger trg_sync_farmacia_midias before insert or update on conteudo_midias
  for each row execute function sincronizar_farmacia_filho_conteudo();

alter table conteudo_canais enable row level security;
alter table conteudo_midias enable row level security;

create policy conteudo_canais_select on conteudo_canais for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'conteudo' and pode_ver)
  );
create policy conteudo_canais_insert on conteudo_canais for insert
  with check (
    exists (select 1 from conteudos c where c.id = conteudo_id and c.farmacia_id = auth_farmacia_id())
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'conteudo' and pode_editar)
  );
create policy conteudo_canais_delete on conteudo_canais for delete
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'conteudo' and pode_editar)
  );

create policy conteudo_midias_select on conteudo_midias for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'conteudo' and pode_ver)
  );
create policy conteudo_midias_insert on conteudo_midias for insert
  with check (
    exists (select 1 from conteudos c where c.id = conteudo_id and c.farmacia_id = auth_farmacia_id())
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'conteudo' and pode_editar)
  );
create policy conteudo_midias_delete on conteudo_midias for delete
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'conteudo' and pode_editar)
  );

create trigger trg_auditoria_conteudo_canais after insert or delete on conteudo_canais
  for each row execute function registrar_auditoria();
create trigger trg_auditoria_conteudo_midias after insert or delete on conteudo_midias
  for each row execute function registrar_auditoria();

-- ----------------------------------------------------------------------------
-- Ativa o módulo 'conteudo' na navegação (linha já existia desde a
-- migration 001 com disponivel=false; só liga a flag).
-- ----------------------------------------------------------------------------
update modulos set disponivel = true where id = 'conteudo';

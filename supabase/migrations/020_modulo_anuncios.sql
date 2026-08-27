-- ============================================================================
-- FARMA MARKETING — Migration 020: Módulo de Anúncios (Sprint 13)
-- Não edita 001-019. Reaproveita: `campanhas`/`produtos` (um anúncio é
-- sempre a execução paga de uma Campanha já existente, opcionalmente
-- promovendo um Produto), `integracoes` (provedor 'anuncios' já existe),
-- AdaptadorIntegracao.js, permissoes (módulo 'anuncios' já semeado desde a
-- migration 001 — com regra especial: gestor nunca tem pode_aprovar=true
-- nesse módulo, só admin. Esta migration não altera essa regra, só a usa),
-- logs_auditoria + trigger genérico, proteger_criado_por_produto()
-- (genérica), e o mesmo princípio de aprovação de
-- checar_aprovacao_campanha() (migration 004).
-- ============================================================================

create type anuncio_plataforma as enum ('meta_ads', 'google_ads', 'outro');

create type status_anuncio as enum (
  'rascunho', 'revisao', 'aprovado', 'ativo', 'pausado', 'encerrado', 'erro', 'indisponivel'
);

create table anuncios (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  campanha_id uuid not null references campanhas(id),
  produto_id uuid references produtos(id),
  plataforma anuncio_plataforma not null default 'meta_ads',
  titulo text not null,
  orcamento_diario numeric(10,2),
  data_inicio date,
  data_fim date,
  status status_anuncio not null default 'rascunho',
  aprovado_por uuid references usuarios(id),
  aprovado_em timestamptz,
  link_externo text,
  impressoes integer,
  cliques integer,
  gasto_total numeric(10,2),
  erro_mensagem text,
  responsavel_id uuid references usuarios(id),
  criado_por uuid references usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anuncios_titulo_nao_vazio check (length(trim(titulo)) > 0),
  constraint anuncios_orcamento_nao_negativo check (orcamento_diario is null or orcamento_diario >= 0),
  constraint anuncios_metricas_nao_negativas check (
    (impressoes is null or impressoes >= 0) and
    (cliques is null or cliques >= 0) and
    (gasto_total is null or gasto_total >= 0)
  ),
  constraint anuncios_datas_coerentes check (data_fim is null or data_inicio is null or data_fim >= data_inicio)
);

comment on table anuncios is
  'Anúncios pagos — execução de uma Campanha já existente. Sem integração real com Meta Ads/Google Ads neste sprint. Orçamento e datas são planejamento real do usuário; impressões/cliques/gasto nunca são fabricados.';

create index idx_anuncios_farmacia on anuncios(farmacia_id);
create index idx_anuncios_status on anuncios(farmacia_id, status);
create index idx_anuncios_campanha on anuncios(campanha_id);
create index idx_anuncios_produto on anuncios(produto_id) where produto_id is not null;
create index idx_anuncios_responsavel on anuncios(responsavel_id);

create trigger trg_anuncios_updated before update on anuncios
  for each row execute function set_updated_at();

create trigger trg_proteger_criado_por_anuncio
  before insert or update on anuncios
  for each row execute function proteger_criado_por_produto();

create or replace function proteger_farmacia_anuncio()
returns trigger language plpgsql as $$
declare
  v_farmacia_campanha uuid;
  v_farmacia_produto uuid;
  v_farmacia_responsavel uuid;
begin
  if tg_op = 'INSERT' then
    new.farmacia_id := auth_farmacia_id();
    if new.farmacia_id is null then
      raise exception 'Criação de anúncio requer usuário autenticado vinculado a uma farmácia.';
    end if;
  else
    if new.farmacia_id is distinct from old.farmacia_id then
      raise exception 'farmacia_id não pode ser alterado após a criação do anúncio.';
    end if;
  end if;

  select farmacia_id into v_farmacia_campanha from campanhas where id = new.campanha_id;
  if v_farmacia_campanha is null or v_farmacia_campanha <> new.farmacia_id then
    raise exception 'Campanha não pertence à mesma farmácia do anúncio.';
  end if;

  if new.produto_id is not null then
    select farmacia_id into v_farmacia_produto from produtos where id = new.produto_id;
    if v_farmacia_produto is null or v_farmacia_produto <> new.farmacia_id then
      raise exception 'Produto não pertence à mesma farmácia do anúncio.';
    end if;
  end if;

  if new.responsavel_id is not null then
    select farmacia_id into v_farmacia_responsavel from usuarios where id = new.responsavel_id;
    if v_farmacia_responsavel is null or v_farmacia_responsavel <> new.farmacia_id then
      raise exception 'Responsável não pertence à mesma farmácia do anúncio.';
    end if;
  end if;

  return new;
end;
$$;

alter function proteger_farmacia_anuncio() set search_path = public;

create trigger trg_proteger_farmacia_anuncio
  before insert or update on anuncios
  for each row execute function proteger_farmacia_anuncio();

create or replace function checar_aprovacao_anuncio()
returns trigger language plpgsql as $$
declare
  v_transicoes jsonb := '{
    "rascunho": ["revisao"],
    "revisao": ["rascunho", "aprovado"],
    "aprovado": ["ativo", "indisponivel", "erro"],
    "ativo": ["pausado", "encerrado"],
    "pausado": ["ativo", "encerrado"]
  }'::jsonb;
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'rascunho' then
      raise exception 'Novo anúncio deve começar em rascunho (recebido: %).', new.status;
    end if;
    if new.aprovado_por is not null then
      raise exception 'aprovado_por não pode ser definido na criação do anúncio.';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (
      v_transicoes ? old.status::text
      and (v_transicoes -> old.status::text) ? new.status::text
    ) then
      raise exception 'Transição de status de anúncio inválida: % -> %.', old.status, new.status;
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
        join permissoes p on p.papel = u.papel and p.modulo_id = 'anuncios'
        where u.id = auth.uid()
          and u.farmacia_id = new.farmacia_id
          and p.pode_aprovar
      ) then
        raise exception 'Usuário não tem permissão para aprovar anúncios desta farmácia.';
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

alter function checar_aprovacao_anuncio() set search_path = public;

create trigger trg_anuncio_state_machine
  before insert or update on anuncios
  for each row execute function checar_aprovacao_anuncio();

alter table anuncios enable row level security;

create policy anuncios_select on anuncios for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'anuncios' and pode_ver)
  );

create policy anuncios_insert on anuncios for insert
  with check (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'anuncios' and pode_editar)
  );

create policy anuncios_update on anuncios for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'anuncios' and pode_editar)
  )
  with check (
    farmacia_id = auth_farmacia_id()
  );

create trigger trg_auditoria_anuncios after insert or update on anuncios
  for each row execute function registrar_auditoria();

update modulos set disponivel = true where id = 'anuncios';

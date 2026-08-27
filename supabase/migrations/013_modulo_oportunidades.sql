-- ============================================================================
-- FARMA MARKETING — Migration 013: Módulo de Oportunidades (Sprint 6)
-- Não edita 001-012. Reaproveita RLS/farmacia_id, permissoes (módulo
-- 'oportunidades' já semeado desde a migration 001), logs_auditoria +
-- trigger genérico, proteger_criado_por_produto() (genérica desde a
-- migration 008). Já nasce com farmacia_id explícito no WITH CHECK de
-- INSERT desde o início — lição da correção M1 (Sprint 5).
-- ============================================================================

create type categoria_oportunidade as enum (
  'produto_potencial', 'tendencia_consumo', 'rede_social', 'pesquisa_mercado',
  'sazonalidade', 'concorrencia', 'campanha', 'novo_produto', 'parceria', 'outra'
);

create type prioridade_oportunidade as enum ('baixa', 'media', 'alta', 'urgente');

-- Da identificação até conclusão/descarte — nenhuma etapa pode ser pulada.
create type status_oportunidade as enum (
  'identificada', 'em_analise', 'validada', 'em_execucao', 'concluida', 'descartada'
);

create table oportunidades (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  titulo text not null,
  descricao text,
  categoria categoria_oportunidade not null default 'outra',
  origem text,  -- descritivo (ex.: "Instagram", "pesquisa interna") — sem integração real
  prioridade prioridade_oportunidade not null default 'media',
  status status_oportunidade not null default 'identificada',
  potencial_estimado numeric(12,2),  -- opcional; nunca preenchido com dado fictício
  prazo date,
  responsavel_id uuid references usuarios(id),
  produto_id uuid references produtos(id),
  campanha_id uuid references campanhas(id),
  conteudo_id uuid references conteudos(id),
  observacoes text,
  criado_por uuid references usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oportunidades_titulo_nao_vazio check (length(trim(titulo)) > 0),
  constraint oportunidades_potencial_nao_negativo check (potencial_estimado is null or potencial_estimado >= 0)
);

comment on table oportunidades is
  'Central de identificação e acompanhamento de oportunidades comerciais/mercadológicas. Vincula opcionalmente a produto/campanha/conteúdo — nunca duplica esses dados. Sem integração externa real neste sprint.';

create index idx_oportunidades_farmacia on oportunidades(farmacia_id);
create index idx_oportunidades_status on oportunidades(farmacia_id, status);
create index idx_oportunidades_prioridade on oportunidades(farmacia_id, prioridade);
create index idx_oportunidades_categoria on oportunidades(farmacia_id, categoria);
create index idx_oportunidades_responsavel on oportunidades(responsavel_id);
create index idx_oportunidades_produto on oportunidades(produto_id) where produto_id is not null;
create index idx_oportunidades_campanha on oportunidades(campanha_id) where campanha_id is not null;
create index idx_oportunidades_conteudo on oportunidades(conteudo_id) where conteudo_id is not null;

create trigger trg_oportunidades_updated before update on oportunidades
  for each row execute function set_updated_at();

-- criado_por: reaproveita a função genérica já existente (migration 008),
-- sem criar mecanismo novo.
create trigger trg_proteger_criado_por_oportunidade
  before insert or update on oportunidades
  for each row execute function proteger_criado_por_produto();

-- ----------------------------------------------------------------------------
-- farmacia_id sempre de auth_farmacia_id(), nunca do client; imutável após
-- criado; responsavel_id/produto_id/campanha_id/conteudo_id, quando
-- informados, precisam pertencer à mesma farmácia. Mesmo padrão de
-- proteger_farmacia_conteudo() (migration 011).
-- ----------------------------------------------------------------------------
create or replace function proteger_farmacia_oportunidade()
returns trigger language plpgsql as $$
declare
  v_farmacia_responsavel uuid;
  v_farmacia_produto uuid;
  v_farmacia_campanha uuid;
  v_farmacia_conteudo uuid;
begin
  if tg_op = 'INSERT' then
    new.farmacia_id := auth_farmacia_id();
    if new.farmacia_id is null then
      raise exception 'Criação de oportunidade requer usuário autenticado vinculado a uma farmácia.';
    end if;
  else
    if new.farmacia_id is distinct from old.farmacia_id then
      raise exception 'farmacia_id não pode ser alterado após a criação da oportunidade.';
    end if;
  end if;

  if new.responsavel_id is not null then
    select farmacia_id into v_farmacia_responsavel from usuarios where id = new.responsavel_id;
    if v_farmacia_responsavel is null or v_farmacia_responsavel <> new.farmacia_id then
      raise exception 'Responsável não pertence à mesma farmácia da oportunidade.';
    end if;
  end if;

  if new.produto_id is not null then
    select farmacia_id into v_farmacia_produto from produtos where id = new.produto_id;
    if v_farmacia_produto is null or v_farmacia_produto <> new.farmacia_id then
      raise exception 'Produto não pertence à mesma farmácia da oportunidade.';
    end if;
  end if;

  if new.campanha_id is not null then
    select farmacia_id into v_farmacia_campanha from campanhas where id = new.campanha_id;
    if v_farmacia_campanha is null or v_farmacia_campanha <> new.farmacia_id then
      raise exception 'Campanha não pertence à mesma farmácia da oportunidade.';
    end if;
  end if;

  if new.conteudo_id is not null then
    select farmacia_id into v_farmacia_conteudo from conteudos where id = new.conteudo_id;
    if v_farmacia_conteudo is null or v_farmacia_conteudo <> new.farmacia_id then
      raise exception 'Conteúdo não pertence à mesma farmácia da oportunidade.';
    end if;
  end if;

  return new;
end;
$$;

alter function proteger_farmacia_oportunidade() set search_path = public;

create trigger trg_proteger_farmacia_oportunidade
  before insert or update on oportunidades
  for each row execute function proteger_farmacia_oportunidade();

-- ----------------------------------------------------------------------------
-- Máquina de estados — identificação até conclusão/descarte, sem saltos.
-- ----------------------------------------------------------------------------
create or replace function checar_transicao_oportunidade()
returns trigger language plpgsql as $$
declare
  v_transicoes jsonb := '{
    "identificada": ["em_analise", "descartada"],
    "em_analise": ["validada", "descartada"],
    "validada": ["em_execucao", "descartada"],
    "em_execucao": ["concluida", "descartada"]
  }'::jsonb;
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'identificada' then
      raise exception 'Nova oportunidade deve começar em identificada (recebido: %).', new.status;
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
  end if;

  return new;
end;
$$;

alter function checar_transicao_oportunidade() set search_path = public;

create trigger trg_oportunidade_state_machine
  before insert or update on oportunidades
  for each row execute function checar_transicao_oportunidade();

-- ----------------------------------------------------------------------------
-- RLS — mesmo padrão dos demais módulos. farmacia_id explícito no INSERT
-- desde o início (lição da correção M1). Sem DELETE — remoção lógica via
-- status='descartada', preserva histórico.
-- ----------------------------------------------------------------------------
alter table oportunidades enable row level security;

create policy oportunidades_select on oportunidades for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'oportunidades' and pode_ver)
  );

create policy oportunidades_insert on oportunidades for insert
  with check (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'oportunidades' and pode_editar)
  );

create policy oportunidades_update on oportunidades for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'oportunidades' and pode_editar)
  )
  with check (
    farmacia_id = auth_farmacia_id()
  );

create trigger trg_auditoria_oportunidades after insert or update on oportunidades
  for each row execute function registrar_auditoria();

-- ----------------------------------------------------------------------------
-- Ativa o módulo 'oportunidades' na navegação (linha já existia desde a
-- migration 001 com disponivel=false; só liga a flag).
-- ----------------------------------------------------------------------------
update modulos set disponivel = true where id = 'oportunidades';

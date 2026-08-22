-- ============================================================================
-- FARMA MARKETING — Migration 009: Calendário de Marketing (Sprint 4)
-- Não edita 001-008. Campanhas continuam sendo a fonte de verdade das suas
-- próprias datas (campanhas.periodo_inicio/periodo_fim, já existentes desde
-- o Sprint 2) — o calendário só as CONSULTA, nunca as duplica. Cria só uma
-- entidade nova para planejamento que não é uma campanha (datas
-- comemorativas, lembretes, ações locais etc.).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Status de planejamento — deliberadamente distinto e sem relação com
-- status_campanha (migration 004). Não é uma segunda máquina de estados de
-- campanha; é só o ciclo de vida de um evento de calendário.
-- ----------------------------------------------------------------------------
create type status_evento_calendario as enum ('planejado', 'em_andamento', 'concluido', 'cancelado');
create type tipo_evento_calendario as enum (
  'data_comemorativa', 'acao_local', 'evento_sazonal', 'lembrete', 'periodo_promocional', 'outro'
);

-- ----------------------------------------------------------------------------
-- eventos_calendario — só para planejamento que NÃO é uma campanha.
-- data/hora em colunas simples (date/time), sem timestamptz, no mesmo
-- padrão já usado em campanhas.periodo_inicio/periodo_fim — evita ambiguidade
-- de timezone (data de calendário é um conceito de "dia", não um instante).
-- ----------------------------------------------------------------------------
create table eventos_calendario (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  titulo text not null,
  descricao text,
  tipo tipo_evento_calendario not null default 'outro',
  status status_evento_calendario not null default 'planejado',
  data_inicio date not null,
  data_fim date,
  dia_inteiro boolean not null default true,
  hora_inicio time,
  hora_fim time,
  responsavel_id uuid references usuarios(id),
  produto_id uuid references produtos(id),
  campanha_id uuid references campanhas(id),
  observacoes text,
  criado_por uuid references usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eventos_calendario_titulo_nao_vazio check (length(trim(titulo)) > 0),
  constraint eventos_calendario_periodo_valido check (data_fim is null or data_fim >= data_inicio)
);

comment on table eventos_calendario is
  'Planejamento de calendário que NÃO é uma campanha (datas comemorativas, lembretes, ações locais). Campanhas aparecem no calendário consultando campanhas.periodo_inicio/periodo_fim diretamente — nunca duplicadas aqui.';

create index idx_eventos_calendario_farmacia on eventos_calendario(farmacia_id);
create index idx_eventos_calendario_datas on eventos_calendario(farmacia_id, data_inicio, data_fim);
create index idx_eventos_calendario_status on eventos_calendario(farmacia_id, status);
create index idx_eventos_calendario_campanha on eventos_calendario(campanha_id) where campanha_id is not null;
create index idx_eventos_calendario_produto on eventos_calendario(produto_id) where produto_id is not null;
create index idx_eventos_calendario_responsavel on eventos_calendario(responsavel_id);

create trigger trg_eventos_calendario_updated before update on eventos_calendario
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- criado_por: mesma proteção da migration 008 (correção S3-01). A função já
-- é genérica (só olha NEW.criado_por/auth.uid(), sem depender de tabela) —
-- reaproveitada tal como está, sem editar a migration 008.
-- ----------------------------------------------------------------------------
create trigger trg_proteger_criado_por_evento
  before insert or update on eventos_calendario
  for each row execute function proteger_criado_por_produto();

-- ----------------------------------------------------------------------------
-- farmacia_id: ao contrário de campanha_produtos/campanha_conteudos (que
-- herdam farmacia_id de uma campanha-mãe), evento_calendario é uma entidade
-- de primeira classe — farmacia_id vem sempre de auth_farmacia_id(), nunca
-- do client, e é imutável após criado. produto_id/campanha_id, quando
-- informados, precisam pertencer à mesma farmácia (mesmo princípio já usado
-- em sincronizar_farmacia_filho_campanha, migration 005/007 — aqui a fonte
-- de farmacia_id é diferente, por isso uma função nova, mas a mesma lógica).
-- ----------------------------------------------------------------------------
create or replace function proteger_farmacia_evento_calendario()
returns trigger language plpgsql as $$
declare
  v_farmacia_produto uuid;
  v_farmacia_campanha uuid;
begin
  if tg_op = 'INSERT' then
    new.farmacia_id := auth_farmacia_id();
    if new.farmacia_id is null then
      raise exception 'Criação de evento requer usuário autenticado vinculado a uma farmácia.';
    end if;
  else
    if new.farmacia_id is distinct from old.farmacia_id then
      raise exception 'farmacia_id não pode ser alterado após a criação do evento.';
    end if;
  end if;

  if new.produto_id is not null then
    select farmacia_id into v_farmacia_produto from produtos where id = new.produto_id;
    if v_farmacia_produto is null or v_farmacia_produto <> new.farmacia_id then
      raise exception 'Produto não pertence à mesma farmácia do evento.';
    end if;
  end if;

  if new.campanha_id is not null then
    select farmacia_id into v_farmacia_campanha from campanhas where id = new.campanha_id;
    if v_farmacia_campanha is null or v_farmacia_campanha <> new.farmacia_id then
      raise exception 'Campanha não pertence à mesma farmácia do evento.';
    end if;
  end if;

  return new;
end;
$$;

alter function proteger_farmacia_evento_calendario() set search_path = public;

create trigger trg_proteger_farmacia_evento
  before insert or update on eventos_calendario
  for each row execute function proteger_farmacia_evento_calendario();

-- ----------------------------------------------------------------------------
-- RLS — mesmo padrão dos demais módulos: pode_ver para leitura, pode_editar
-- para escrita. DELETE físico permitido (evento de calendário não é
-- referenciado por nenhuma outra entidade como pai — ao contrário de
-- produtos/campanhas); histórico preservado via logs_auditoria, que grava o
-- snapshot completo da linha antes de apagar (dados_anteriores).
-- ----------------------------------------------------------------------------
alter table eventos_calendario enable row level security;

create policy eventos_calendario_select on eventos_calendario for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'calendario' and pode_ver)
  );

create policy eventos_calendario_insert on eventos_calendario for insert
  with check (
    exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'calendario' and pode_editar)
  );

create policy eventos_calendario_update on eventos_calendario for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'calendario' and pode_editar)
  )
  with check (
    farmacia_id = auth_farmacia_id()
  );

create policy eventos_calendario_delete on eventos_calendario for delete
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'calendario' and pode_editar)
  );

-- Reaproveita a auditoria existente (mesmo trigger genérico, nenhum log novo).
create trigger trg_auditoria_eventos_calendario after insert or update or delete on eventos_calendario
  for each row execute function registrar_auditoria();

-- ----------------------------------------------------------------------------
-- Ativa o módulo 'calendario' na navegação (linha já existia desde a
-- migration 001 com disponivel=false; só liga a flag).
-- ----------------------------------------------------------------------------
update modulos set disponivel = true where id = 'calendario';

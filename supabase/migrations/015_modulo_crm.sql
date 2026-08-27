-- ============================================================================
-- FARMA MARKETING — Migration 015: Módulo de CRM (Sprint 8)
-- Não edita 001-014. Reaproveita RLS/farmacia_id, permissoes (módulo 'crm'
-- já semeado desde a migration 001), logs_auditoria + trigger genérico,
-- proteger_criado_por_produto() (genérica desde a migration 008).
-- ============================================================================

create type crm_origem_contato as enum (
  'manual', 'oportunidade', 'conteudo', 'campanha', 'ia', 'outro'
);

create type crm_status_contato as enum ('novo', 'em_atendimento', 'cliente', 'inativo');

create type crm_tipo_interacao as enum (
  'anotacao', 'contato_realizado', 'retorno', 'acompanhamento',
  'mudanca_responsavel', 'mudanca_status'
);

-- ----------------------------------------------------------------------------
-- crm_contatos — cadastro de contatos/clientes.
-- ----------------------------------------------------------------------------
create table crm_contatos (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  nome text not null,
  telefone text,
  whatsapp text,
  email text,
  cpf text,
  origem crm_origem_contato not null default 'manual',
  status crm_status_contato not null default 'novo',
  observacoes text,
  responsavel_id uuid references usuarios(id),
  oportunidade_id uuid references oportunidades(id),
  campanha_id uuid references campanhas(id),
  conteudo_id uuid references conteudos(id),
  criado_por uuid references usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_contatos_nome_nao_vazio check (length(trim(nome)) > 0)
);

comment on table crm_contatos is
  'Contatos/clientes do CRM. Vincula opcionalmente a oportunidade/campanha/conteúdo de origem — nunca duplica esses dados. Sem integração externa real neste sprint.';

create index idx_crm_contatos_farmacia on crm_contatos(farmacia_id);
create index idx_crm_contatos_status on crm_contatos(farmacia_id, status);
create index idx_crm_contatos_responsavel on crm_contatos(responsavel_id);
create index idx_crm_contatos_oportunidade on crm_contatos(oportunidade_id) where oportunidade_id is not null;
create index idx_crm_contatos_campanha on crm_contatos(campanha_id) where campanha_id is not null;
create index idx_crm_contatos_conteudo on crm_contatos(conteudo_id) where conteudo_id is not null;
-- busca por nome/telefone/email é feita em memória no frontend (mesmo padrão
-- já usado nos demais módulos); índice de texto não é necessário no volume atual.

create trigger trg_crm_contatos_updated before update on crm_contatos
  for each row execute function set_updated_at();

-- criado_por: reaproveita a função genérica já existente (migration 008).
create trigger trg_proteger_criado_por_crm_contato
  before insert or update on crm_contatos
  for each row execute function proteger_criado_por_produto();

-- ----------------------------------------------------------------------------
-- farmacia_id sempre de auth_farmacia_id(), nunca do client; imutável após
-- criado. responsavel_id/oportunidade_id/campanha_id/conteudo_id, quando
-- informados, precisam pertencer à mesma farmácia. Mesmo padrão de
-- proteger_farmacia_oportunidade()/proteger_identidade_ia().
-- ----------------------------------------------------------------------------
create or replace function proteger_farmacia_crm_contato()
returns trigger language plpgsql as $$
declare
  v_farmacia_responsavel uuid;
  v_farmacia_oportunidade uuid;
  v_farmacia_campanha uuid;
  v_farmacia_conteudo uuid;
begin
  if tg_op = 'INSERT' then
    new.farmacia_id := auth_farmacia_id();
    if new.farmacia_id is null then
      raise exception 'Criação de contato requer usuário autenticado vinculado a uma farmácia.';
    end if;
  else
    if new.farmacia_id is distinct from old.farmacia_id then
      raise exception 'farmacia_id não pode ser alterado após a criação do contato.';
    end if;
  end if;

  if new.responsavel_id is not null then
    select farmacia_id into v_farmacia_responsavel from usuarios where id = new.responsavel_id;
    if v_farmacia_responsavel is null or v_farmacia_responsavel <> new.farmacia_id then
      raise exception 'Responsável não pertence à mesma farmácia do contato.';
    end if;
  end if;

  if new.oportunidade_id is not null then
    select farmacia_id into v_farmacia_oportunidade from oportunidades where id = new.oportunidade_id;
    if v_farmacia_oportunidade is null or v_farmacia_oportunidade <> new.farmacia_id then
      raise exception 'Oportunidade não pertence à mesma farmácia do contato.';
    end if;
  end if;

  if new.campanha_id is not null then
    select farmacia_id into v_farmacia_campanha from campanhas where id = new.campanha_id;
    if v_farmacia_campanha is null or v_farmacia_campanha <> new.farmacia_id then
      raise exception 'Campanha não pertence à mesma farmácia do contato.';
    end if;
  end if;

  if new.conteudo_id is not null then
    select farmacia_id into v_farmacia_conteudo from conteudos where id = new.conteudo_id;
    if v_farmacia_conteudo is null or v_farmacia_conteudo <> new.farmacia_id then
      raise exception 'Conteúdo não pertence à mesma farmácia do contato.';
    end if;
  end if;

  return new;
end;
$$;

alter function proteger_farmacia_crm_contato() set search_path = public;

create trigger trg_proteger_farmacia_crm_contato
  before insert or update on crm_contatos
  for each row execute function proteger_farmacia_crm_contato();

-- ----------------------------------------------------------------------------
-- Máquina de estados simples — só o suficiente para impedir saltos
-- arbitrários (ex.: novo -> cliente sem passar por atendimento). Reativação
-- a partir de inativo é permitida (contato pode voltar a ser trabalhado).
-- ----------------------------------------------------------------------------
create or replace function checar_transicao_crm_contato()
returns trigger language plpgsql as $$
declare
  v_transicoes jsonb := '{
    "novo": ["em_atendimento", "inativo"],
    "em_atendimento": ["cliente", "inativo"],
    "cliente": ["inativo"],
    "inativo": ["em_atendimento"]
  }'::jsonb;
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'novo' then
      raise exception 'Novo contato deve começar como novo (recebido: %).', new.status;
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (
      v_transicoes ? old.status::text
      and (v_transicoes -> old.status::text) ? new.status::text
    ) then
      raise exception 'Transição de status de contato inválida: % -> %.', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

alter function checar_transicao_crm_contato() set search_path = public;

create trigger trg_crm_contato_state_machine
  before insert or update on crm_contatos
  for each row execute function checar_transicao_crm_contato();

-- ----------------------------------------------------------------------------
-- RLS — crm_contatos: mesmo padrão dos demais módulos. farmacia_id explícito
-- no INSERT desde o início (lição da correção M1). Sem DELETE — remoção
-- lógica via status='inativo', preserva histórico.
-- ----------------------------------------------------------------------------
alter table crm_contatos enable row level security;

create policy crm_contatos_select on crm_contatos for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'crm' and pode_ver)
  );

create policy crm_contatos_insert on crm_contatos for insert
  with check (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'crm' and pode_editar)
  );

create policy crm_contatos_update on crm_contatos for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'crm' and pode_editar)
  )
  with check (
    farmacia_id = auth_farmacia_id()
  );

create trigger trg_auditoria_crm_contatos after insert or update on crm_contatos
  for each row execute function registrar_auditoria();

-- ----------------------------------------------------------------------------
-- crm_interacoes — histórico de interações. Log append-only: nunca
-- atualizado nem apagado, preserva histórico por design.
-- ----------------------------------------------------------------------------
create table crm_interacoes (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references crm_contatos(id) on delete cascade,
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  tipo crm_tipo_interacao not null,
  descricao text,
  usuario_id uuid not null references usuarios(id),
  created_at timestamptz not null default now(),
  constraint crm_interacoes_descricao_obrigatoria_quando_anotacao
    check (tipo <> 'anotacao' or (descricao is not null and length(trim(descricao)) > 0))
);

comment on table crm_interacoes is
  'Histórico de interações do CRM — append-only, nunca editado ou apagado (preserva histórico).';

create index idx_crm_interacoes_contato on crm_interacoes(contato_id);
create index idx_crm_interacoes_farmacia on crm_interacoes(farmacia_id);
create index idx_crm_interacoes_usuario on crm_interacoes(usuario_id);

-- farmacia_id sempre derivado do contato-mãe (nunca do client); usuario_id
-- sempre auth.uid(). Mesmo princípio das demais tabelas filhas, função
-- própria porque a tabela-mãe (crm_contatos) e a coluna de autor
-- (usuario_id, não criado_por) são específicas deste par de tabelas.
create or replace function proteger_identidade_crm_interacao()
returns trigger language plpgsql as $$
begin
  select farmacia_id into new.farmacia_id from crm_contatos where id = new.contato_id;
  if new.farmacia_id is null then
    raise exception 'Contato % não encontrado.', new.contato_id;
  end if;
  new.usuario_id := auth.uid();
  if new.usuario_id is null then
    raise exception 'Registro de interação requer usuário autenticado.';
  end if;
  return new;
end;
$$;

alter function proteger_identidade_crm_interacao() set search_path = public;

create trigger trg_proteger_identidade_crm_interacao
  before insert on crm_interacoes
  for each row execute function proteger_identidade_crm_interacao();

alter table crm_interacoes enable row level security;

create policy crm_interacoes_select on crm_interacoes for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'crm' and pode_ver)
  );

create policy crm_interacoes_insert on crm_interacoes for insert
  with check (
    exists (select 1 from crm_contatos c where c.id = contato_id and c.farmacia_id = auth_farmacia_id())
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'crm' and pode_editar)
  );

-- Sem UPDATE nem DELETE: log append-only, preserva histórico por design.

create trigger trg_auditoria_crm_interacoes after insert on crm_interacoes
  for each row execute function registrar_auditoria();

-- ----------------------------------------------------------------------------
-- Ativa o módulo 'crm' na navegação (linha já existia desde a migration 001
-- com disponivel=false; só liga a flag).
-- ----------------------------------------------------------------------------
update modulos set disponivel = true where id = 'crm';

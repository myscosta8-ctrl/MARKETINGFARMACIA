-- ============================================================================
-- FARMA MARKETING — Migration 014: Módulo de IA (Sprint 7)
-- Não edita 001-013. Reaproveita RLS/farmacia_id, permissoes (módulo 'ia'
-- já semeado desde a migration 001), logs_auditoria + trigger genérico. A
-- camada de abstração de provedor (src/lib/ia/ProvedorIA.js + registro.js)
-- já existe desde o Sprint 1 e não foi tocada — esta migration só cria o
-- histórico/persistência das solicitações.
-- ============================================================================

create type ia_finalidade as enum (
  'gerar_campanha', 'criar_conteudo', 'sugerir_promocao', 'analisar_oportunidade',
  'sugerir_estrategia', 'gerar_ideias_divulgacao', 'analisar_desempenho', 'outra'
);

create type ia_status_execucao as enum (
  'pendente', 'processando', 'concluida', 'erro', 'indisponivel'
);

create table ia_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  usuario_id uuid not null references usuarios(id),
  finalidade ia_finalidade not null,
  prompt_usuario text not null,
  instrucao_sistema text,
  contexto jsonb not null default '{}'::jsonb,
  campanha_id uuid references campanhas(id),
  produto_id uuid references produtos(id),
  conteudo_id uuid references conteudos(id),
  oportunidade_id uuid references oportunidades(id),
  resposta text,
  status ia_status_execucao not null default 'pendente',
  erro_mensagem text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ia_solicitacoes_prompt_nao_vazio check (length(trim(prompt_usuario)) > 0),
  constraint ia_solicitacoes_resposta_quando_concluida
    check (status <> 'concluida' or resposta is not null)
);

comment on table ia_solicitacoes is
  'Histórico de solicitações à camada de IA (src/lib/ia). Sem chamada real a provedor externo neste sprint — status fica indisponivel até haver credencial configurada. status=concluida exige resposta preenchida (constraint no banco).';

create index idx_ia_solicitacoes_farmacia on ia_solicitacoes(farmacia_id);
create index idx_ia_solicitacoes_usuario on ia_solicitacoes(usuario_id);
create index idx_ia_solicitacoes_finalidade on ia_solicitacoes(farmacia_id, finalidade);
create index idx_ia_solicitacoes_status on ia_solicitacoes(farmacia_id, status);
create index idx_ia_solicitacoes_campanha on ia_solicitacoes(campanha_id) where campanha_id is not null;
create index idx_ia_solicitacoes_produto on ia_solicitacoes(produto_id) where produto_id is not null;
create index idx_ia_solicitacoes_conteudo on ia_solicitacoes(conteudo_id) where conteudo_id is not null;
create index idx_ia_solicitacoes_oportunidade on ia_solicitacoes(oportunidade_id) where oportunidade_id is not null;

create trigger trg_ia_solicitacoes_updated before update on ia_solicitacoes
  for each row execute function set_updated_at();

-- Identidade + farmácia + contexto — mesmo princípio já usado em
-- proteger_farmacia_conteudo()/proteger_farmacia_oportunidade(): nunca
-- confiar no client. usuario_id e farmacia_id sempre de
-- auth.uid()/auth_farmacia_id(), ambos imutáveis após criados.
create or replace function proteger_identidade_ia()
returns trigger language plpgsql as $$
declare
  v_farmacia_campanha uuid;
  v_farmacia_produto uuid;
  v_farmacia_conteudo uuid;
  v_farmacia_oportunidade uuid;
begin
  if tg_op = 'INSERT' then
    new.farmacia_id := auth_farmacia_id();
    new.usuario_id := auth.uid();
    if new.farmacia_id is null or new.usuario_id is null then
      raise exception 'Solicitação de IA requer usuário autenticado vinculado a uma farmácia.';
    end if;
  else
    if new.farmacia_id is distinct from old.farmacia_id then
      raise exception 'farmacia_id não pode ser alterado após a criação da solicitação.';
    end if;
    if new.usuario_id is distinct from old.usuario_id then
      raise exception 'usuario_id não pode ser alterado após a criação da solicitação.';
    end if;
  end if;

  if new.campanha_id is not null then
    select farmacia_id into v_farmacia_campanha from campanhas where id = new.campanha_id;
    if v_farmacia_campanha is null or v_farmacia_campanha <> new.farmacia_id then
      raise exception 'Campanha de contexto não pertence à mesma farmácia da solicitação.';
    end if;
  end if;

  if new.produto_id is not null then
    select farmacia_id into v_farmacia_produto from produtos where id = new.produto_id;
    if v_farmacia_produto is null or v_farmacia_produto <> new.farmacia_id then
      raise exception 'Produto de contexto não pertence à mesma farmácia da solicitação.';
    end if;
  end if;

  if new.conteudo_id is not null then
    select farmacia_id into v_farmacia_conteudo from conteudos where id = new.conteudo_id;
    if v_farmacia_conteudo is null or v_farmacia_conteudo <> new.farmacia_id then
      raise exception 'Conteúdo de contexto não pertence à mesma farmácia da solicitação.';
    end if;
  end if;

  if new.oportunidade_id is not null then
    select farmacia_id into v_farmacia_oportunidade from oportunidades where id = new.oportunidade_id;
    if v_farmacia_oportunidade is null or v_farmacia_oportunidade <> new.farmacia_id then
      raise exception 'Oportunidade de contexto não pertence à mesma farmácia da solicitação.';
    end if;
  end if;

  return new;
end;
$$;

alter function proteger_identidade_ia() set search_path = public;

create trigger trg_proteger_identidade_ia
  before insert or update on ia_solicitacoes
  for each row execute function proteger_identidade_ia();

-- Máquina de estados simples: INSERT só nasce pendente ou indisponivel
-- (nunca já "concluida" com resposta fabricada).
create or replace function checar_transicao_ia()
returns trigger language plpgsql as $$
declare
  v_transicoes jsonb := '{
    "pendente": ["processando", "indisponivel", "erro"],
    "processando": ["concluida", "erro"]
  }'::jsonb;
begin
  if tg_op = 'INSERT' then
    if new.status not in ('pendente', 'indisponivel') then
      raise exception 'Nova solicitação de IA só pode nascer pendente ou indisponivel (recebido: %).', new.status;
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (
      v_transicoes ? old.status::text
      and (v_transicoes -> old.status::text) ? new.status::text
    ) then
      raise exception 'Transição de status de IA inválida: % -> %.', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

alter function checar_transicao_ia() set search_path = public;

create trigger trg_ia_state_machine
  before insert or update on ia_solicitacoes
  for each row execute function checar_transicao_ia();

alter table ia_solicitacoes enable row level security;

create policy ia_solicitacoes_select on ia_solicitacoes for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'ia' and pode_ver)
  );

create policy ia_solicitacoes_insert on ia_solicitacoes for insert
  with check (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'ia' and pode_editar)
  );

create policy ia_solicitacoes_update on ia_solicitacoes for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'ia' and pode_editar)
  )
  with check (
    farmacia_id = auth_farmacia_id()
  );

create trigger trg_auditoria_ia_solicitacoes after insert or update on ia_solicitacoes
  for each row execute function registrar_auditoria();

update modulos set disponivel = true where id = 'ia';

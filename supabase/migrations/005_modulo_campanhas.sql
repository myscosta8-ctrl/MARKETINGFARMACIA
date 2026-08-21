-- ============================================================================
-- FARMA MARKETING — Migration 005: Módulo de Campanhas (Sprint 2)
-- Não edita migrations 001-004. Estende `campanhas` (já existente e já
-- protegida pela máquina de estados do Sprint 1) e cria 2 tabelas filhas.
-- Reutiliza: RLS/farmacia_id, permissoes (pode_ver/pode_editar/pode_aprovar),
-- logs_auditoria + trigger genérico, papel_usuario, auth_farmacia_id()/auth_papel().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums novos (só o que a campanha precisa; nada de estoque/vendas reais)
-- ----------------------------------------------------------------------------
create type objetivo_campanha as enum (
  'aumentar_vendas', 'divulgar_produto', 'liquidar_estoque_parado', 'lancamento',
  'fidelizacao', 'aquisicao_clientes', 'presenca_digital', 'sazonal',
  'servico_farmacia', 'sorteio', 'institucional'
);

create type publico_alvo_campanha as enum (
  'geral', 'clientes_atuais', 'novos_clientes', 'clientes_inativos',
  'interesse', 'local', 'manual', 'sugerido_ia'
);

-- ----------------------------------------------------------------------------
-- Estende `campanhas` (tabela já existe desde a migration 001; só adiciona
-- colunas — nada destrutivo, nada removido).
-- ----------------------------------------------------------------------------
alter table campanhas
  add column if not exists descricao text,
  add column if not exists objetivos objetivo_campanha[] not null default '{}',
  add column if not exists periodo_inicio date,
  add column if not exists periodo_fim date,
  add column if not exists publico_alvo publico_alvo_campanha not null default 'geral',
  add column if not exists canais text[] not null default '{}',
  add column if not exists tipo_campanha text,
  add column if not exists possui_organico boolean not null default true,
  add column if not exists possui_pago boolean not null default false,
  add column if not exists orcamento_estimado numeric(12,2),
  add column if not exists orcamento_utilizado numeric(12,2),
  add column if not exists observacoes text,
  add column if not exists responsavel_id uuid references usuarios(id);

comment on column campanhas.canais is
  'Slugs livres (whatsapp, instagram, facebook, anuncios, outro...) — nenhuma publicação real neste sprint, só arquitetura/UI.';

create index if not exists idx_campanhas_periodo on campanhas(periodo_inicio, periodo_fim);
create index if not exists idx_campanhas_responsavel on campanhas(responsavel_id);

-- ----------------------------------------------------------------------------
-- Produtos da campanha (seleção manual — sem integração real com LC Sistemas
-- ainda; arquitetura preparada, dado nenhum inventado).
-- ----------------------------------------------------------------------------
create table campanha_produtos (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references campanhas(id) on delete cascade,
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  nome_produto text not null,
  categoria text,
  marca text,
  produto_parado boolean,  -- null = desconhecido; nunca inventado, só quando houver dado real
  created_at timestamptz not null default now()
);

create index idx_campanha_produtos_campanha on campanha_produtos(campanha_id);
create index idx_campanha_produtos_farmacia on campanha_produtos(farmacia_id);

-- ----------------------------------------------------------------------------
-- Conteúdo por canal (uma campanha pode ter peças diferentes por canal).
-- ----------------------------------------------------------------------------
create table campanha_conteudos (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references campanhas(id) on delete cascade,
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  canal text not null,
  texto text,
  imagem_url text,
  video_url text,
  chamada text,
  cta text,
  hashtags text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_campanha_conteudos_campanha on campanha_conteudos(campanha_id);
create index idx_campanha_conteudos_farmacia on campanha_conteudos(farmacia_id);

create trigger trg_campanha_conteudos_updated before update on campanha_conteudos
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- farmacia_id das tabelas filhas é sempre derivado da campanha-mãe no banco
-- (nunca confiado do client) — impede inconsistência/spoofing entre farmácias.
-- ----------------------------------------------------------------------------
create or replace function sincronizar_farmacia_filho_campanha()
returns trigger language plpgsql as $$
begin
  select farmacia_id into new.farmacia_id from campanhas where id = new.campanha_id;
  if new.farmacia_id is null then
    raise exception 'Campanha % não encontrada.', new.campanha_id;
  end if;
  return new;
end;
$$;

alter function sincronizar_farmacia_filho_campanha() set search_path = public;

create trigger trg_sync_farmacia_produtos before insert or update on campanha_produtos
  for each row execute function sincronizar_farmacia_filho_campanha();
create trigger trg_sync_farmacia_conteudos before insert or update on campanha_conteudos
  for each row execute function sincronizar_farmacia_filho_campanha();

-- ----------------------------------------------------------------------------
-- RLS das tabelas filhas — mesmo padrão de `campanhas`: isolada por
-- farmacia_id, leitura/escrita conforme a permissão do módulo 'campanhas'.
-- ----------------------------------------------------------------------------
alter table campanha_produtos enable row level security;
alter table campanha_conteudos enable row level security;

create policy campanha_produtos_select on campanha_produtos for select
  using (farmacia_id = auth_farmacia_id());
create policy campanha_produtos_insert on campanha_produtos for insert
  with check (
    exists (
      select 1 from campanhas c
      where c.id = campanha_id and c.farmacia_id = auth_farmacia_id()
    )
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'campanhas' and pode_editar)
  );
create policy campanha_produtos_update on campanha_produtos for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'campanhas' and pode_editar)
  );
create policy campanha_produtos_delete on campanha_produtos for delete
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'campanhas' and pode_editar)
  );

create policy campanha_conteudos_select on campanha_conteudos for select
  using (farmacia_id = auth_farmacia_id());
create policy campanha_conteudos_insert on campanha_conteudos for insert
  with check (
    exists (
      select 1 from campanhas c
      where c.id = campanha_id and c.farmacia_id = auth_farmacia_id()
    )
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'campanhas' and pode_editar)
  );
create policy campanha_conteudos_update on campanha_conteudos for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'campanhas' and pode_editar)
  );
create policy campanha_conteudos_delete on campanha_conteudos for delete
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'campanhas' and pode_editar)
  );

-- ----------------------------------------------------------------------------
-- Reaproveita a auditoria existente (mesmo trigger genérico do Sprint 1,
-- nenhum sistema de log novo).
-- ----------------------------------------------------------------------------
create trigger trg_auditoria_campanha_produtos after insert or update or delete on campanha_produtos
  for each row execute function registrar_auditoria();
create trigger trg_auditoria_campanha_conteudos after insert or update or delete on campanha_conteudos
  for each row execute function registrar_auditoria();

-- ----------------------------------------------------------------------------
-- Ativa o módulo 'campanhas' na navegação (catálogo já existia desde o
-- Sprint 1 com disponivel=false; só liga a flag, não cria linha nova).
-- ----------------------------------------------------------------------------
update modulos set disponivel = true where id = 'campanhas';

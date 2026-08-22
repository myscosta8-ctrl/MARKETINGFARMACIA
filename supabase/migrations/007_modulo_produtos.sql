-- ============================================================================
-- FARMA MARKETING — Migration 007: Módulo de Produtos (Sprint 3)
-- Não edita 001-006. Cria catálogo próprio de produtos (independente do
-- LC Sistemas) e associa não-destrutivamente a campanha_produtos.
-- Reutiliza: RLS/farmacia_id, permissoes, logs_auditoria + trigger genérico,
-- set_updated_at(), sincronizar_farmacia_filho_campanha() (estendida).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Catálogo próprio. codigo_lc_sistemas fica pronto para integração futura,
-- mas nulo agora — nenhuma dependência estrutural do LC Sistemas.
-- ----------------------------------------------------------------------------
create table produtos (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  nome text not null,
  categoria text,
  marca text,
  descricao text,
  codigo_interno text,
  codigo_barras text,
  codigo_lc_sistemas text,  -- preparado para integração futura; sem dependência agora
  preco_venda numeric(12,2),
  preco_custo numeric(12,2),
  imagem_url text,
  observacoes text,
  ativo boolean not null default true,
  criado_por uuid references usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint produtos_preco_venda_nao_negativo check (preco_venda is null or preco_venda >= 0),
  constraint produtos_preco_custo_nao_negativo check (preco_custo is null or preco_custo >= 0),
  constraint produtos_nome_nao_vazio check (length(trim(nome)) > 0)
);

comment on column produtos.codigo_lc_sistemas is
  'Reservado para integração futura com o LC Sistemas. Não usado neste sprint — nenhuma integração real existe ainda.';
comment on table produtos is
  'Catálogo próprio de produtos do módulo de Marketing. Independente do estoque real (LC Sistemas). Fonte estrutural para Campanhas, Analytics, Oportunidades e IA em sprints futuros.';

-- Índices: farmácia, busca por nome, status, categoria/marca, código de barras
-- (único por farmácia apenas quando informado — não força unicidade de nulls).
create index idx_produtos_farmacia on produtos(farmacia_id);
create index idx_produtos_ativo on produtos(farmacia_id, ativo);
create index idx_produtos_categoria on produtos(farmacia_id, categoria);
create index idx_produtos_marca on produtos(farmacia_id, marca);
create index idx_produtos_nome on produtos(farmacia_id, nome);
create unique index idx_produtos_codigo_barras_farmacia
  on produtos(farmacia_id, codigo_barras) where codigo_barras is not null;

create trigger trg_produtos_updated before update on produtos
  for each row execute function set_updated_at();

alter function set_updated_at() set search_path = public;

-- ----------------------------------------------------------------------------
-- RLS — mesmo padrão dos demais módulos: isolado por farmacia_id, leitura
-- exige pode_ver, escrita exige pode_editar. Sem política de DELETE: exclusão
-- física fica bloqueada por padrão (RLS nega o que não tem política) —
-- inativação é feita via UPDATE ativo=false, preservando histórico.
-- ----------------------------------------------------------------------------
alter table produtos enable row level security;

create policy produtos_select on produtos for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (
      select 1 from permissoes
      where papel = auth_papel() and modulo_id = 'produtos' and pode_ver
    )
  );

create policy produtos_insert on produtos for insert
  with check (
    farmacia_id = auth_farmacia_id()
    and exists (
      select 1 from permissoes
      where papel = auth_papel() and modulo_id = 'produtos' and pode_editar
    )
  );

create policy produtos_update on produtos for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (
      select 1 from permissoes
      where papel = auth_papel() and modulo_id = 'produtos' and pode_editar
    )
  )
  with check (
    farmacia_id = auth_farmacia_id()
  );

-- Reaproveita a auditoria existente (mesmo trigger genérico, nenhum log novo).
create trigger trg_auditoria_produtos after insert or update on produtos
  for each row execute function registrar_auditoria();

-- ----------------------------------------------------------------------------
-- Integração NÃO destrutiva com campanha_produtos: adiciona referência
-- opcional ao catálogo. Campanhas antigas (produto_id null, texto livre)
-- continuam funcionando exatamente como antes.
-- ----------------------------------------------------------------------------
alter table campanha_produtos
  add column if not exists produto_id uuid references produtos(id);

create index if not exists idx_campanha_produtos_produto on campanha_produtos(produto_id);

-- Estende a trigger de sincronização já existente (migration 005) em vez de
-- criar uma segunda lógica: agora também valida que, quando produto_id é
-- informado, o produto pertence à MESMA farmácia da campanha.
create or replace function sincronizar_farmacia_filho_campanha()
returns trigger language plpgsql as $$
declare
  v_farmacia_produto uuid;
begin
  select farmacia_id into new.farmacia_id from campanhas where id = new.campanha_id;
  if new.farmacia_id is null then
    raise exception 'Campanha % não encontrada.', new.campanha_id;
  end if;

  if tg_table_name = 'campanha_produtos' and new.produto_id is not null then
    select farmacia_id into v_farmacia_produto from produtos where id = new.produto_id;
    if v_farmacia_produto is null then
      raise exception 'Produto % não encontrado.', new.produto_id;
    end if;
    if v_farmacia_produto <> new.farmacia_id then
      raise exception 'Produto não pertence à mesma farmácia da campanha.';
    end if;
  end if;

  return new;
end;
$$;

alter function sincronizar_farmacia_filho_campanha() set search_path = public;

-- ----------------------------------------------------------------------------
-- Ativa o módulo 'produtos' na navegação (linha já existia desde a
-- migration 001 com disponivel=false; só liga a flag).
-- ----------------------------------------------------------------------------
update modulos set disponivel = true where id = 'produtos';

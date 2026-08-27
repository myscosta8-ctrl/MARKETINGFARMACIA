-- ============================================================================
-- FARMA MARKETING — Migration 016: Módulo de Leads (Sprint 9)
-- Não edita 001-015. Reaproveita RLS/farmacia_id, permissoes (módulo 'leads'
-- já semeado desde a migration 001), logs_auditoria + trigger genérico,
-- proteger_criado_por_produto() (genérica desde a migration 008), e o enum
-- crm_origem_contato (migration 015) — sem criar um segundo conceito de
-- "origem". crm_interacoes (migration 015) é ESTENDIDA para aceitar lead ou
-- contato, em vez de criar uma segunda tabela de histórico.
-- ============================================================================

create type leads_status as enum ('novo', 'em_atendimento', 'qualificado', 'convertido', 'perdido');

-- 'lead' passa a existir como origem possível de um contato CRM criado por
-- conversão — extensão aditiva do enum já existente (migration 015), não
-- duplica o conceito de origem.
alter type crm_origem_contato add value if not exists 'lead';

-- ----------------------------------------------------------------------------
-- leads — funil de aquisição, separado de crm_contatos por design: lead é
-- quem AINDA NÃO foi convertido; crm_contatos é quem JÁ é contato de
-- verdade. contato_crm_id só é preenchido no momento da conversão e nunca
-- antes — é o que distingue as duas entidades no banco.
-- ----------------------------------------------------------------------------
create table leads (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  nome text not null,
  telefone text,
  whatsapp text,
  email text,
  origem crm_origem_contato not null default 'manual',
  status leads_status not null default 'novo',
  responsavel_id uuid references usuarios(id),
  oportunidade_id uuid references oportunidades(id),
  campanha_id uuid references campanhas(id),
  conteudo_id uuid references conteudos(id),
  produto_id uuid references produtos(id),
  contato_crm_id uuid references crm_contatos(id),
  convertido_por uuid references usuarios(id),
  convertido_em timestamptz,
  observacoes text,
  criado_por uuid references usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_nome_nao_vazio check (length(trim(nome)) > 0),
  constraint leads_contato_crm_somente_quando_convertido
    check ((status = 'convertido') = (contato_crm_id is not null))
);

comment on table leads is
  'Funil de aquisição — separado de crm_contatos por design. Um lead só vira contato de verdade (crm_contatos) no momento da conversão, nunca antes. contato_crm_id/convertido_por/convertido_em preservam a rastreabilidade da conversão.';

create index idx_leads_farmacia on leads(farmacia_id);
create index idx_leads_status on leads(farmacia_id, status);
create index idx_leads_responsavel on leads(responsavel_id);
create index idx_leads_origem on leads(farmacia_id, origem);
create index idx_leads_oportunidade on leads(oportunidade_id) where oportunidade_id is not null;
create index idx_leads_campanha on leads(campanha_id) where campanha_id is not null;
create index idx_leads_conteudo on leads(conteudo_id) where conteudo_id is not null;
create index idx_leads_produto on leads(produto_id) where produto_id is not null;
create index idx_leads_contato_crm on leads(contato_crm_id) where contato_crm_id is not null;

create trigger trg_leads_updated before update on leads
  for each row execute function set_updated_at();

create trigger trg_proteger_criado_por_lead
  before insert or update on leads
  for each row execute function proteger_criado_por_produto();

create or replace function proteger_farmacia_lead()
returns trigger language plpgsql as $$
declare
  v_farmacia_responsavel uuid;
  v_farmacia_oportunidade uuid;
  v_farmacia_campanha uuid;
  v_farmacia_conteudo uuid;
  v_farmacia_produto uuid;
  v_farmacia_contato_crm uuid;
begin
  if tg_op = 'INSERT' then
    new.farmacia_id := auth_farmacia_id();
    if new.farmacia_id is null then
      raise exception 'Criação de lead requer usuário autenticado vinculado a uma farmácia.';
    end if;
  else
    if new.farmacia_id is distinct from old.farmacia_id then
      raise exception 'farmacia_id não pode ser alterado após a criação do lead.';
    end if;
  end if;

  if new.responsavel_id is not null then
    select farmacia_id into v_farmacia_responsavel from usuarios where id = new.responsavel_id;
    if v_farmacia_responsavel is null or v_farmacia_responsavel <> new.farmacia_id then
      raise exception 'Responsável não pertence à mesma farmácia do lead.';
    end if;
  end if;

  if new.oportunidade_id is not null then
    select farmacia_id into v_farmacia_oportunidade from oportunidades where id = new.oportunidade_id;
    if v_farmacia_oportunidade is null or v_farmacia_oportunidade <> new.farmacia_id then
      raise exception 'Oportunidade não pertence à mesma farmácia do lead.';
    end if;
  end if;

  if new.campanha_id is not null then
    select farmacia_id into v_farmacia_campanha from campanhas where id = new.campanha_id;
    if v_farmacia_campanha is null or v_farmacia_campanha <> new.farmacia_id then
      raise exception 'Campanha não pertence à mesma farmácia do lead.';
    end if;
  end if;

  if new.conteudo_id is not null then
    select farmacia_id into v_farmacia_conteudo from conteudos where id = new.conteudo_id;
    if v_farmacia_conteudo is null or v_farmacia_conteudo <> new.farmacia_id then
      raise exception 'Conteúdo não pertence à mesma farmácia do lead.';
    end if;
  end if;

  if new.produto_id is not null then
    select farmacia_id into v_farmacia_produto from produtos where id = new.produto_id;
    if v_farmacia_produto is null or v_farmacia_produto <> new.farmacia_id then
      raise exception 'Produto não pertence à mesma farmácia do lead.';
    end if;
  end if;

  if new.contato_crm_id is not null then
    select farmacia_id into v_farmacia_contato_crm from crm_contatos where id = new.contato_crm_id;
    if v_farmacia_contato_crm is null or v_farmacia_contato_crm <> new.farmacia_id then
      raise exception 'Contato CRM de destino não pertence à mesma farmácia do lead.';
    end if;
  end if;

  return new;
end;
$$;

alter function proteger_farmacia_lead() set search_path = public;

create trigger trg_proteger_farmacia_lead
  before insert or update on leads
  for each row execute function proteger_farmacia_lead();

create or replace function checar_transicao_lead()
returns trigger language plpgsql as $$
declare
  v_transicoes jsonb := '{
    "novo": ["em_atendimento", "perdido"],
    "em_atendimento": ["qualificado", "perdido"],
    "qualificado": ["convertido", "perdido"]
  }'::jsonb;
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'novo' then
      raise exception 'Novo lead deve começar como novo (recebido: %).', new.status;
    end if;
    if new.contato_crm_id is not null or new.convertido_por is not null or new.convertido_em is not null then
      raise exception 'Campos de conversão não podem ser definidos na criação do lead.';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (
      v_transicoes ? old.status::text
      and (v_transicoes -> old.status::text) ? new.status::text
    ) then
      raise exception 'Transição de status de lead inválida: % -> %.', old.status, new.status;
    end if;

    if new.status = 'convertido' then
      if auth.uid() is null then
        raise exception 'Conversão requer usuário autenticado.';
      end if;
      if new.contato_crm_id is null then
        raise exception 'Conversão exige contato_crm_id apontando para o contato CRM já criado.';
      end if;
      new.convertido_por := auth.uid();
      new.convertido_em := now();
    end if;

  else
    if new.contato_crm_id is distinct from old.contato_crm_id
       or new.convertido_por is distinct from old.convertido_por
       or new.convertido_em is distinct from old.convertido_em then
      raise exception 'Campos de conversão só podem ser definidos durante a transição para convertido.';
    end if;
  end if;

  return new;
end;
$$;

alter function checar_transicao_lead() set search_path = public;

create trigger trg_lead_state_machine
  before insert or update on leads
  for each row execute function checar_transicao_lead();

alter table leads enable row level security;

create policy leads_select on leads for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'leads' and pode_ver)
  );

create policy leads_insert on leads for insert
  with check (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'leads' and pode_editar)
  );

create policy leads_update on leads for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'leads' and pode_editar)
  )
  with check (
    farmacia_id = auth_farmacia_id()
  );

create trigger trg_auditoria_leads after insert or update on leads
  for each row execute function registrar_auditoria();

alter table crm_interacoes
  add column if not exists lead_id uuid references leads(id),
  alter column contato_id drop not null;

alter table crm_interacoes
  add constraint crm_interacoes_exatamente_um_vinculo
  check (num_nonnulls(contato_id, lead_id) = 1);

create or replace function proteger_identidade_crm_interacao()
returns trigger language plpgsql as $$
declare
  v_farmacia_contato uuid;
  v_farmacia_lead uuid;
begin
  if new.contato_id is not null then
    select farmacia_id into v_farmacia_contato from crm_contatos where id = new.contato_id;
    if v_farmacia_contato is null then
      raise exception 'Contato % não encontrado.', new.contato_id;
    end if;
    new.farmacia_id := v_farmacia_contato;
  elsif new.lead_id is not null then
    select farmacia_id into v_farmacia_lead from leads where id = new.lead_id;
    if v_farmacia_lead is null then
      raise exception 'Lead % não encontrado.', new.lead_id;
    end if;
    new.farmacia_id := v_farmacia_lead;
  else
    raise exception 'Interação precisa referenciar um contato ou um lead.';
  end if;

  new.usuario_id := auth.uid();
  if new.usuario_id is null then
    raise exception 'Registro de interação requer usuário autenticado.';
  end if;
  return new;
end;
$$;

alter function proteger_identidade_crm_interacao() set search_path = public;

drop policy if exists crm_interacoes_insert on crm_interacoes;

create policy crm_interacoes_insert on crm_interacoes for insert
  with check (
    (
      (contato_id is not null and exists (select 1 from crm_contatos c where c.id = contato_id and c.farmacia_id = auth_farmacia_id()))
      or
      (lead_id is not null and exists (select 1 from leads l where l.id = lead_id and l.farmacia_id = auth_farmacia_id()))
    )
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'crm' and pode_editar)
  );

update modulos set disponivel = true where id = 'leads';

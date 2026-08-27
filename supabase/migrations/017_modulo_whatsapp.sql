-- ============================================================================
-- FARMA MARKETING — Migration 017: Módulo WhatsApp (Sprint 10)
-- Não edita 001-016. Reaproveita: tabela `integracoes` (Sprint 1, já cobre
-- status de conexão do provedor 'whatsapp' — nenhuma tabela nova pra isso),
-- src/lib/integracoes/AdaptadorIntegracao.js (Sprint 1, camada de
-- abstração já pronta, nunca usada), permissoes (módulo 'whatsapp' já
-- semeado desde a migration 001), logs_auditoria + trigger genérico,
-- proteger_criado_por_produto() (genérica), e o padrão de vínculo único
-- (contato OU lead) já usado em crm_interacoes (migration 016). Nenhum
-- credential real é configurado nem simulado.
-- ============================================================================

create type whatsapp_direcao as enum ('enviada', 'recebida');

create type whatsapp_status_mensagem as enum (
  'pendente', 'enviada', 'entregue', 'lida', 'erro', 'indisponivel'
);

create table whatsapp_mensagens (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  contato_id uuid references crm_contatos(id),
  lead_id uuid references leads(id),
  telefone_destino text not null,
  direcao whatsapp_direcao not null default 'enviada',
  conteudo text not null,
  status whatsapp_status_mensagem not null default 'pendente',
  erro_mensagem text,
  usuario_id uuid references usuarios(id),
  created_at timestamptz not null default now(),
  constraint whatsapp_mensagens_conteudo_nao_vazio check (length(trim(conteudo)) > 0),
  constraint whatsapp_mensagens_telefone_nao_vazio check (length(trim(telefone_destino)) > 0),
  constraint whatsapp_mensagens_no_maximo_um_vinculo
    check (num_nonnulls(contato_id, lead_id) <= 1)
);

comment on table whatsapp_mensagens is
  'Histórico de mensagens WhatsApp. Sem envio real neste sprint — status fica indisponivel (mesmo padrão de ia_solicitacoes). contato_id/lead_id opcionais e mutuamente exclusivos quando informados.';

create index idx_whatsapp_mensagens_farmacia on whatsapp_mensagens(farmacia_id);
create index idx_whatsapp_mensagens_status on whatsapp_mensagens(farmacia_id, status);
create index idx_whatsapp_mensagens_contato on whatsapp_mensagens(contato_id) where contato_id is not null;
create index idx_whatsapp_mensagens_lead on whatsapp_mensagens(lead_id) where lead_id is not null;
create index idx_whatsapp_mensagens_usuario on whatsapp_mensagens(usuario_id);

create or replace function proteger_identidade_whatsapp_mensagem()
returns trigger language plpgsql as $$
declare
  v_farmacia_contato uuid;
  v_farmacia_lead uuid;
begin
  if tg_op = 'INSERT' then
    new.farmacia_id := auth_farmacia_id();
    new.usuario_id := auth.uid();
    if new.farmacia_id is null or new.usuario_id is null then
      raise exception 'Registro de mensagem requer usuário autenticado vinculado a uma farmácia.';
    end if;
  else
    if new.farmacia_id is distinct from old.farmacia_id then
      raise exception 'farmacia_id não pode ser alterado após a criação da mensagem.';
    end if;
    if new.usuario_id is distinct from old.usuario_id then
      raise exception 'usuario_id não pode ser alterado após a criação da mensagem.';
    end if;
  end if;

  if new.contato_id is not null then
    select farmacia_id into v_farmacia_contato from crm_contatos where id = new.contato_id;
    if v_farmacia_contato is null or v_farmacia_contato <> new.farmacia_id then
      raise exception 'Contato não pertence à mesma farmácia da mensagem.';
    end if;
  end if;

  if new.lead_id is not null then
    select farmacia_id into v_farmacia_lead from leads where id = new.lead_id;
    if v_farmacia_lead is null or v_farmacia_lead <> new.farmacia_id then
      raise exception 'Lead não pertence à mesma farmácia da mensagem.';
    end if;
  end if;

  return new;
end;
$$;

alter function proteger_identidade_whatsapp_mensagem() set search_path = public;

create trigger trg_proteger_identidade_whatsapp_mensagem
  before insert or update on whatsapp_mensagens
  for each row execute function proteger_identidade_whatsapp_mensagem();

create or replace function checar_transicao_whatsapp_mensagem()
returns trigger language plpgsql as $$
declare
  v_transicoes jsonb := '{
    "pendente": ["enviada", "indisponivel", "erro"],
    "enviada": ["entregue", "erro"],
    "entregue": ["lida"]
  }'::jsonb;
begin
  if tg_op = 'INSERT' then
    if new.status not in ('pendente', 'indisponivel') then
      raise exception 'Nova mensagem só pode nascer pendente ou indisponivel (recebido: %).', new.status;
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (
      v_transicoes ? old.status::text
      and (v_transicoes -> old.status::text) ? new.status::text
    ) then
      raise exception 'Transição de status de mensagem inválida: % -> %.', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

alter function checar_transicao_whatsapp_mensagem() set search_path = public;

create trigger trg_whatsapp_mensagem_state_machine
  before insert or update on whatsapp_mensagens
  for each row execute function checar_transicao_whatsapp_mensagem();

alter table whatsapp_mensagens enable row level security;

create policy whatsapp_mensagens_select on whatsapp_mensagens for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'whatsapp' and pode_ver)
  );

create policy whatsapp_mensagens_insert on whatsapp_mensagens for insert
  with check (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'whatsapp' and pode_editar)
  );

create policy whatsapp_mensagens_update on whatsapp_mensagens for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'whatsapp' and pode_editar)
  )
  with check (
    farmacia_id = auth_farmacia_id()
  );

create trigger trg_auditoria_whatsapp_mensagens after insert or update on whatsapp_mensagens
  for each row execute function registrar_auditoria();

update modulos set disponivel = true where id = 'whatsapp';

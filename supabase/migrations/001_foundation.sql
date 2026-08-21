-- ============================================================================
-- FARMA MARKETING — Migration 001: Fundação
-- Banco relacional multi-tenant (preparado para múltiplas farmácias).
-- V1 opera com 1 farmácia, mas todo dado é isolado por farmacia_id + RLS.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type papel_usuario as enum ('admin', 'gestor', 'colaborador');
create type status_integracao as enum ('nao_configurado', 'configurado', 'conectado', 'erro', 'desconectado');
create type provedor_integracao as enum ('whatsapp', 'instagram', 'facebook', 'anuncios', 'lc_sistemas', 'ia');
create type tipo_notificacao as enum ('info', 'alerta', 'oportunidade', 'aprovacao_pendente', 'sistema');

-- ----------------------------------------------------------------------------
-- FARMÁCIAS (tenant raiz)
-- ----------------------------------------------------------------------------
create table farmacias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  telefone text,
  endereco jsonb default '{}'::jsonb,
  configuracoes jsonb default '{}'::jsonb,  -- preferências gerais (horário, marca, cores, etc.)
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table farmacias is 'Tenant raiz. V1 terá 1 registro; arquitetura já suporta N farmácias.';

-- ----------------------------------------------------------------------------
-- USUÁRIOS (perfil vinculado a auth.users do Supabase Auth)
-- ----------------------------------------------------------------------------
create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  nome text not null,
  email text not null,
  papel papel_usuario not null default 'colaborador',
  ativo boolean not null default true,
  ultimo_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email)
);

create index idx_usuarios_farmacia on usuarios(farmacia_id);

-- ----------------------------------------------------------------------------
-- PERMISSÕES POR MÓDULO (matriz papel x módulo)
-- Módulos futuros já cadastrados como referência; telas ainda não existem.
-- ----------------------------------------------------------------------------
create table modulos (
  id text primary key,  -- slug: 'dashboard', 'campanhas', 'crm', etc.
  nome text not null,
  descricao text,
  ordem int not null default 0,
  disponivel boolean not null default false -- false = ainda não implementado (roadmap)
);

insert into modulos (id, nome, descricao, ordem, disponivel) values
  ('dashboard',   'Dashboard',    'Visão geral: oportunidades, campanhas, desempenho, alertas', 1, true),
  ('campanhas',   'Campanhas',    'Criação e gestão de campanhas de marketing', 2, false),
  ('calendario',  'Calendário',   'Calendário editorial e de campanhas', 3, false),
  ('conteudo',    'Conteúdo',     'Biblioteca e geração de conteúdo', 4, false),
  ('produtos',    'Produtos',     'Catálogo de produtos para marketing', 5, false),
  ('oportunidades','Oportunidades','Inteligência comercial e oportunidades', 6, false),
  ('ia',          'IA',           'Recomendações e geração assistida por IA', 7, false),
  ('crm',         'CRM',          'Relacionamento com clientes', 8, false),
  ('leads',       'Leads',        'Captação e funil de leads', 9, false),
  ('whatsapp',    'WhatsApp',     'Integração WhatsApp Business', 10, false),
  ('instagram',   'Instagram',    'Integração Instagram', 11, false),
  ('facebook',    'Facebook',     'Integração Facebook', 12, false),
  ('anuncios',    'Anúncios',     'Gestão de anúncios pagos', 13, false),
  ('analytics',   'Analytics',    'Métricas e relatórios', 14, false),
  ('configuracoes','Configurações','Configurações da farmácia e do sistema', 15, true);

create table permissoes (
  id uuid primary key default gen_random_uuid(),
  papel papel_usuario not null,
  modulo_id text not null references modulos(id) on delete cascade,
  pode_ver boolean not null default false,
  pode_editar boolean not null default false,
  pode_aprovar boolean not null default false,
  unique (papel, modulo_id)
);

-- Matriz padrão: admin vê/edita/aprova tudo; gestor vê/edita mas não aprova campanhas de anúncio pago;
-- colaborador só vê e edita rascunhos. Ajustável depois pela UI de Configurações.
insert into permissoes (papel, modulo_id, pode_ver, pode_editar, pode_aprovar)
select 'admin'::papel_usuario, id, true, true, true from modulos
union all
select 'gestor'::papel_usuario, id, true, true, (id <> 'anuncios') from modulos
union all
select 'colaborador'::papel_usuario, id, true, (id in ('campanhas','conteudo','calendario')), false from modulos;

-- ----------------------------------------------------------------------------
-- ARQUIVOS (metadados; binário fica no Supabase Storage)
-- ----------------------------------------------------------------------------
create table arquivos (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  bucket text not null default 'farmacia-arquivos',
  caminho text not null,
  nome_original text not null,
  tipo_mime text,
  tamanho_bytes bigint,
  enviado_por uuid references usuarios(id),
  created_at timestamptz not null default now()
);

create index idx_arquivos_farmacia on arquivos(farmacia_id);

-- ----------------------------------------------------------------------------
-- NOTIFICAÇÕES
-- ----------------------------------------------------------------------------
create table notificacoes (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  usuario_id uuid references usuarios(id) on delete cascade,  -- null = notificação para toda a farmácia
  tipo tipo_notificacao not null default 'info',
  titulo text not null,
  mensagem text,
  lida boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

create index idx_notificacoes_usuario on notificacoes(usuario_id, lida);

-- ----------------------------------------------------------------------------
-- LOGS DE AUDITORIA (trilha de auditoria genérica)
-- ----------------------------------------------------------------------------
create table logs_auditoria (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid references farmacias(id) on delete cascade,
  usuario_id uuid references usuarios(id),
  acao text not null,          -- ex: 'criar', 'editar', 'excluir', 'aprovar', 'login'
  entidade text not null,      -- ex: 'campanha', 'usuario', 'configuracao'
  entidade_id text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_auditoria_farmacia on logs_auditoria(farmacia_id, created_at desc);
create index idx_auditoria_entidade on logs_auditoria(entidade, entidade_id);

-- ----------------------------------------------------------------------------
-- LGPD — CONSENTIMENTOS
-- Nunca usar dados sensíveis de saúde para personalização de marketing (regra de produto).
-- ----------------------------------------------------------------------------
create table consentimentos_lgpd (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  titular_nome text,
  titular_email text,
  titular_telefone text,
  finalidade text not null,          -- ex: 'comunicacao_marketing', 'whatsapp_promocional'
  consentido boolean not null,
  origem text,                        -- como o consentimento foi coletado
  data_consentimento timestamptz not null default now(),
  data_revogacao timestamptz,
  ip text,
  created_at timestamptz not null default now()
);

create index idx_lgpd_farmacia on consentimentos_lgpd(farmacia_id);

-- ----------------------------------------------------------------------------
-- INTEGRAÇÕES (arquitetura de adaptadores — sem credenciais reais aqui)
-- Segredos ficam em Supabase Vault / variáveis de ambiente, nunca em texto puro.
-- ----------------------------------------------------------------------------
create table integracoes (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  provedor provedor_integracao not null,
  status status_integracao not null default 'nao_configurado',
  configuracao jsonb default '{}'::jsonb,  -- config não-sensível (ex: nome da conta, ids públicos)
  ultima_sincronizacao timestamptz,
  ultimo_erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farmacia_id, provedor)
);

-- ----------------------------------------------------------------------------
-- CAMPANHAS — placeholder mínimo só para fluxo de aprovação (regra de negócio
-- crítica: nenhuma campanha publica automaticamente). Módulo completo é fora
-- de escopo deste sprint; tabela existe para já fixar o state machine.
-- ----------------------------------------------------------------------------
create type status_campanha as enum ('rascunho', 'revisao', 'aprovada', 'publicada', 'pausada', 'encerrada');

create table campanhas (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid not null references farmacias(id) on delete cascade,
  titulo text not null,
  status status_campanha not null default 'rascunho',
  criado_por uuid references usuarios(id),
  aprovado_por uuid references usuarios(id),
  aprovado_em timestamptz,
  conteudo jsonb default '{}'::jsonb,
  demo boolean not null default false, -- true = dado de demonstração, nunca real
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_campanhas_farmacia on campanhas(farmacia_id, status);

-- ============================================================================
-- updated_at automático
-- ============================================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_farmacias_updated before update on farmacias
  for each row execute function set_updated_at();
create trigger trg_usuarios_updated before update on usuarios
  for each row execute function set_updated_at();
create trigger trg_integracoes_updated before update on integracoes
  for each row execute function set_updated_at();
create trigger trg_campanhas_updated before update on campanhas
  for each row execute function set_updated_at();

-- ============================================================================
-- Trava de negócio: campanha não pode ir para 'publicada' sem aprovado_por
-- (garante no banco a regra "IA recomenda; humano aprova")
-- ============================================================================
create or replace function checar_aprovacao_campanha()
returns trigger language plpgsql as $$
begin
  if new.status = 'publicada' and new.aprovado_por is null then
    raise exception 'Campanha não pode ser publicada sem aprovação humana registrada (aprovado_por).';
  end if;
  if new.status in ('aprovada', 'publicada') and old.status = 'rascunho' then
    raise exception 'Campanha deve passar por revisão antes de aprovação (rascunho -> revisao -> aprovacao).';
  end if;
  return new;
end;
$$;

create trigger trg_campanha_state_machine before update on campanhas
  for each row execute function checar_aprovacao_campanha();

-- ============================================================================
-- Auditoria automática em usuarios e campanhas (exemplo do padrão; expansível)
-- ============================================================================
create or replace function registrar_auditoria()
returns trigger language plpgsql as $$
declare
  v_farmacia_id uuid;
begin
  v_farmacia_id := coalesce(new.farmacia_id, old.farmacia_id);
  insert into logs_auditoria (farmacia_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
  values (
    v_farmacia_id,
    lower(tg_op),
    tg_table_name,
    coalesce(new.id, old.id)::text,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_auditoria_campanhas after insert or update or delete on campanhas
  for each row execute function registrar_auditoria();
create trigger trg_auditoria_integracoes after insert or update or delete on integracoes
  for each row execute function registrar_auditoria();

-- ============================================================================
-- FARMA MARKETING — Migration 002: Row Level Security
-- Todo acesso é isolado por farmacia_id. Isso já prepara o sistema para
-- múltiplas farmácias: um usuário só enxerga dados da sua própria farmácia.
-- ============================================================================

-- Helper: farmacia_id do usuário autenticado
create or replace function auth_farmacia_id()
returns uuid language sql stable security definer as $$
  select farmacia_id from usuarios where id = auth.uid();
$$;

-- Helper: papel do usuário autenticado
create or replace function auth_papel()
returns papel_usuario language sql stable security definer as $$
  select papel from usuarios where id = auth.uid();
$$;

alter table farmacias enable row level security;
alter table usuarios enable row level security;
alter table modulos enable row level security;
alter table permissoes enable row level security;
alter table arquivos enable row level security;
alter table notificacoes enable row level security;
alter table logs_auditoria enable row level security;
alter table consentimentos_lgpd enable row level security;
alter table integracoes enable row level security;
alter table campanhas enable row level security;

-- FARMACIAS: usuário só vê a própria farmácia
create policy farmacias_select on farmacias for select
  using (id = auth_farmacia_id());
create policy farmacias_update_admin on farmacias for update
  using (id = auth_farmacia_id() and auth_papel() = 'admin');

-- USUARIOS: só vê colegas da mesma farmácia; só admin edita outros usuários
create policy usuarios_select on usuarios for select
  using (farmacia_id = auth_farmacia_id());
create policy usuarios_update_self_or_admin on usuarios for update
  using (farmacia_id = auth_farmacia_id() and (id = auth.uid() or auth_papel() = 'admin'));
create policy usuarios_insert_admin on usuarios for insert
  with check (auth_papel() = 'admin');

-- MODULOS: catálogo global, leitura livre para autenticados
create policy modulos_select on modulos for select using (auth.uid() is not null);

-- PERMISSOES: leitura livre para autenticados; escrita só admin
create policy permissoes_select on permissoes for select using (auth.uid() is not null);
create policy permissoes_admin_write on permissoes for all
  using (auth_papel() = 'admin') with check (auth_papel() = 'admin');

-- ARQUIVOS
create policy arquivos_select on arquivos for select
  using (farmacia_id = auth_farmacia_id());
create policy arquivos_insert on arquivos for insert
  with check (farmacia_id = auth_farmacia_id());
create policy arquivos_delete on arquivos for delete
  using (farmacia_id = auth_farmacia_id() and (enviado_por = auth.uid() or auth_papel() = 'admin'));

-- NOTIFICACOES: só as suas (ou as gerais da farmácia)
create policy notificacoes_select on notificacoes for select
  using (farmacia_id = auth_farmacia_id() and (usuario_id = auth.uid() or usuario_id is null));
create policy notificacoes_update on notificacoes for update
  using (farmacia_id = auth_farmacia_id() and (usuario_id = auth.uid() or auth_papel() = 'admin'));
create policy notificacoes_insert on notificacoes for insert
  with check (farmacia_id = auth_farmacia_id());

-- LOGS_AUDITORIA: só leitura, só admin/gestor
create policy auditoria_select on logs_auditoria for select
  using (farmacia_id = auth_farmacia_id() and auth_papel() in ('admin','gestor'));

-- LGPD: admin e gestor
create policy lgpd_select on consentimentos_lgpd for select
  using (farmacia_id = auth_farmacia_id() and auth_papel() in ('admin','gestor'));
create policy lgpd_write on consentimentos_lgpd for all
  using (farmacia_id = auth_farmacia_id() and auth_papel() in ('admin','gestor'))
  with check (farmacia_id = auth_farmacia_id());

-- INTEGRACOES: leitura para todos da farmácia; escrita só admin
create policy integracoes_select on integracoes for select
  using (farmacia_id = auth_farmacia_id());
create policy integracoes_write on integracoes for all
  using (farmacia_id = auth_farmacia_id() and auth_papel() = 'admin')
  with check (farmacia_id = auth_farmacia_id());

-- CAMPANHAS: leitura pra farmácia toda; escrita conforme matriz de permissões;
-- aprovação só quem tem pode_aprovar = true no módulo 'campanhas'
create policy campanhas_select on campanhas for select
  using (farmacia_id = auth_farmacia_id());
create policy campanhas_insert on campanhas for insert
  with check (
    farmacia_id = auth_farmacia_id()
    and exists (
      select 1 from permissoes
      where papel = auth_papel() and modulo_id = 'campanhas' and pode_editar
    )
  );
create policy campanhas_update on campanhas for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (
      select 1 from permissoes
      where papel = auth_papel() and modulo_id = 'campanhas' and pode_editar
    )
  );

-- ============================================================================
-- FARMA MARKETING — Migration 022: Notificações Operacionais (Sprint 15)
-- Não edita 001-021. Sprint de CONSOLIDAÇÃO, não de módulo novo.
--
-- ANÁLISE DE LACUNA (por que esta é a Sprint 15, não uma escolha arbitrária):
-- A tabela `notificacoes` existe desde a migration 001, com RLS completa
-- desde a migration 002 (select/update/insert) e um enum `tipo_notificacao`
-- que já incluía o valor 'aprovacao_pendente' — o desenho original do
-- Sprint 1 já previa notificar aprovações pendentes. O frontend também já
-- tinha `SinoNotificacoes.jsx`, com subscription realtime em
-- `postgres_changes` para INSERT em `notificacoes`, contando não-lidas.
--
-- Busca em todas as migrations 002-021 confirma: NENHUMA delas nunca
-- inseriu uma linha em `notificacoes`. Depois de 14 módulos construídos em
-- cima da fundação, essa peça compartilhada ficou parada — o sino sempre
-- mostrou zero, e o componente nem tinha um clique que abrisse algo. Essa é
-- a lacuna estrutural mais objetiva encontrada entre Dashboard/módulos/
-- navegação: uma conexão que já devia existir e nunca foi feita.
--
-- Esta migration não cria tabela nova, não duplica nada — só adiciona
-- triggers em 5 tabelas já existentes (campanhas, anuncios, leads,
-- oportunidades, conteudos) para os eventos de maior sinal (aprovação
-- pendente + conclusões-chave), reaproveitando a RLS/schema já prontos.
-- Cada trigger só lê farmacia_id/responsavel_id/criado_por de NEW — campos
-- que a própria trigger de identidade daquela tabela já protegeu e validou
-- antes (AFTER UPDATE roda depois que a linha está definitivamente gravada
-- e validada), então não há necessidade de revalidar cross-tenant aqui.
-- ============================================================================

create or replace function notificar_campanha()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'revisao' then
      insert into notificacoes (farmacia_id, usuario_id, tipo, titulo, mensagem, link)
      values (new.farmacia_id, null, 'aprovacao_pendente', 'Campanha aguardando aprovação', new.titulo, '/campanhas/' || new.id);
    elsif new.status = 'publicada' then
      insert into notificacoes (farmacia_id, usuario_id, tipo, titulo, mensagem, link)
      values (new.farmacia_id, coalesce(new.responsavel_id, new.criado_por), 'info', 'Campanha publicada', new.titulo, '/campanhas/' || new.id);
    end if;
  end if;
  return new;
end;
$$;

alter function notificar_campanha() set search_path = public;

create trigger trg_notificar_campanha
  after update on campanhas
  for each row execute function notificar_campanha();

create or replace function notificar_anuncio()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'revisao' then
      insert into notificacoes (farmacia_id, usuario_id, tipo, titulo, mensagem, link)
      values (new.farmacia_id, null, 'aprovacao_pendente', 'Anúncio aguardando aprovação', new.titulo, '/anuncios');
    elsif new.status = 'aprovado' then
      insert into notificacoes (farmacia_id, usuario_id, tipo, titulo, mensagem, link)
      values (new.farmacia_id, coalesce(new.responsavel_id, new.criado_por), 'info', 'Anúncio aprovado', new.titulo, '/anuncios');
    end if;
  end if;
  return new;
end;
$$;

alter function notificar_anuncio() set search_path = public;

create trigger trg_notificar_anuncio
  after update on anuncios
  for each row execute function notificar_anuncio();

create or replace function notificar_lead()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status and new.status = 'convertido' then
    insert into notificacoes (farmacia_id, usuario_id, tipo, titulo, mensagem, link)
    values (new.farmacia_id, coalesce(new.responsavel_id, new.criado_por), 'oportunidade', 'Lead convertido', new.nome, '/leads/' || new.id);
  end if;
  return new;
end;
$$;

alter function notificar_lead() set search_path = public;

create trigger trg_notificar_lead
  after update on leads
  for each row execute function notificar_lead();

create or replace function notificar_oportunidade()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status and new.status = 'concluida' then
    insert into notificacoes (farmacia_id, usuario_id, tipo, titulo, mensagem, link)
    values (new.farmacia_id, coalesce(new.responsavel_id, new.criado_por), 'info', 'Oportunidade concluída', new.titulo, '/oportunidades');
  end if;
  return new;
end;
$$;

alter function notificar_oportunidade() set search_path = public;

create trigger trg_notificar_oportunidade
  after update on oportunidades
  for each row execute function notificar_oportunidade();

create or replace function notificar_conteudo()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status and new.status = 'aprovado' then
    insert into notificacoes (farmacia_id, usuario_id, tipo, titulo, mensagem, link)
    values (new.farmacia_id, coalesce(new.responsavel_id, new.criado_por), 'info', 'Conteúdo aprovado', new.titulo, '/conteudo/' || new.id);
  end if;
  return new;
end;
$$;

alter function notificar_conteudo() set search_path = public;

create trigger trg_notificar_conteudo
  after update on conteudos
  for each row execute function notificar_conteudo();

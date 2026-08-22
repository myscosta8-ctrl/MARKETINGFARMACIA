-- ============================================================================
-- FARMA MARKETING — Migration 010: Correção S4-01
-- Integridade multi-tenant de eventos_calendario.responsavel_id.
-- Escopo estrito: só este campo, só esta tabela. Não altera 001-009, não
-- toca em Campanhas, Produtos, RBAC, autenticação ou Dashboard.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Problema: RLS protege o ACESSO ao evento, mas nada garantia que
-- responsavel_id apontasse para um usuário da MESMA farmácia do evento —
-- um usuário de outra farmácia podia ser referenciado como responsável.
--
-- Solução: estende a função já existente proteger_farmacia_evento_calendario()
-- (migration 009), que já fazia essa validação para produto_id e
-- campanha_id — mesmo padrão, mesmo mecanismo, nenhuma trigger nova.
--
-- A checagem roda em INSERT e UPDATE (a função já é BEFORE INSERT OR
-- UPDATE), e cobre automaticamente o caso de tentar trocar farmacia_id pra
-- "quebrar" a relação: farmacia_id já é imutável (bloqueado antes desta
-- correção) e a validação de responsavel_id sempre compara contra o
-- new.farmacia_id final — não há combinação que escape.
--
-- Não precisa de SECURITY DEFINER: a função roda como o usuário autenticado
-- (invoker), e a própria RLS de `usuarios` (só enxerga a própria farmácia)
-- já faz o trabalho — se responsavel_id for de outra farmácia, o SELECT
-- abaixo não retorna nenhuma linha (por RLS), e a checagem de "não
-- encontrado" rejeita a operação. O mesmo mecanismo que já protegia
-- produto_id/campanha_id.
-- ----------------------------------------------------------------------------
create or replace function proteger_farmacia_evento_calendario()
returns trigger language plpgsql as $$
declare
  v_farmacia_produto uuid;
  v_farmacia_campanha uuid;
  v_farmacia_responsavel uuid;
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

  -- NOVO nesta migration: mesma validação, agora para responsavel_id.
  if new.responsavel_id is not null then
    select farmacia_id into v_farmacia_responsavel from usuarios where id = new.responsavel_id;
    if v_farmacia_responsavel is null or v_farmacia_responsavel <> new.farmacia_id then
      raise exception 'Responsável não pertence à mesma farmácia do evento.';
    end if;
  end if;

  return new;
end;
$$;

alter function proteger_farmacia_evento_calendario() set search_path = public;

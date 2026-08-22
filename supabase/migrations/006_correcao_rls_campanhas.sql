-- ============================================================================
-- FARMA MARKETING — Migration 006: Correção de RLS (auditoria Sprint 2)
-- Escopo estrito: 2 achados objetivos. Não toca em 001-005, não altera a
-- máquina de estados, não altera a regra de edição pós-aprovação (pendente
-- de definição de negócio — registrado no relatório, não decidido aqui).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) campanha_produtos / campanha_conteudos — UPDATE sem WITH CHECK
--
-- A política antiga só tinha USING (valida a linha ANTES do update). Sem
-- WITH CHECK, nada garantia que a linha RESULTANTE do update continuasse na
-- farmácia do usuário. Reaproveita a trigger de sincronização já existente
-- (sincronizar_farmacia_filho_campanha, da migration 005) — ela roda BEFORE
-- UPDATE e recalcula farmacia_id a partir do campanha_id antes da RLS
-- avaliar o WITH CHECK, então basta o WITH CHECK exigir que o resultado
-- final continue igual a auth_farmacia_id() para fechar a brecha (inclusive
-- se alguém tentar apontar campanha_id para uma campanha de outra farmácia:
-- a trigger recalcularia farmacia_id para o da OUTRA farmácia, e o WITH
-- CHECK abaixo rejeitaria por não bater com auth_farmacia_id()).
-- ----------------------------------------------------------------------------
drop policy if exists campanha_produtos_update on campanha_produtos;

create policy campanha_produtos_update on campanha_produtos for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (
      select 1 from permissoes
      where papel = auth_papel() and modulo_id = 'campanhas' and pode_editar
    )
  )
  with check (
    farmacia_id = auth_farmacia_id()
    and exists (
      select 1 from campanhas c
      where c.id = campanha_id and c.farmacia_id = auth_farmacia_id()
    )
  );

drop policy if exists campanha_conteudos_update on campanha_conteudos;

create policy campanha_conteudos_update on campanha_conteudos for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (
      select 1 from permissoes
      where papel = auth_papel() and modulo_id = 'campanhas' and pode_editar
    )
  )
  with check (
    farmacia_id = auth_farmacia_id()
    and exists (
      select 1 from campanhas c
      where c.id = campanha_id and c.farmacia_id = auth_farmacia_id()
    )
  );

-- ----------------------------------------------------------------------------
-- 2) SELECT de campanhas/campanha_produtos/campanha_conteudos exigia só
-- farmacia_id = auth_farmacia_id(), sem checar pode_ver. Corrige para exigir
-- também a permissão do módulo — sem conceder pode_ver automaticamente por
-- ter pode_editar/pode_aprovar (checagem é sempre em pode_ver, isolada).
-- ----------------------------------------------------------------------------
drop policy if exists campanhas_select on campanhas;

create policy campanhas_select on campanhas for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (
      select 1 from permissoes
      where papel = auth_papel() and modulo_id = 'campanhas' and pode_ver
    )
  );

drop policy if exists campanha_produtos_select on campanha_produtos;

create policy campanha_produtos_select on campanha_produtos for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (
      select 1 from permissoes
      where papel = auth_papel() and modulo_id = 'campanhas' and pode_ver
    )
  );

drop policy if exists campanha_conteudos_select on campanha_conteudos;

create policy campanha_conteudos_select on campanha_conteudos for select
  using (
    farmacia_id = auth_farmacia_id()
    and exists (
      select 1 from permissoes
      where papel = auth_papel() and modulo_id = 'campanhas' and pode_ver
    )
  );

-- ----------------------------------------------------------------------------
-- NÃO alterado nesta migration (fora de escopo, registrado no relatório):
-- edição de conteúdo/produto após campanha aprovada/publicada continua
-- possível para quem tem pode_editar — é decisão de negócio pendente, não
-- um bug de RLS.
-- ----------------------------------------------------------------------------

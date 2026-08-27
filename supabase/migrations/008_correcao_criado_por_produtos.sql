-- ============================================================================
-- FARMA MARKETING — Migration 012: Correção dos achados M1 e B1
-- (AUDITORIA_SPRINT_5.md, seção 27 — Pendências)
-- Escopo estrito: só os dois pontos abaixo. Não edita 001-011, não altera
-- nenhuma outra funcionalidade.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- M1 — blindagem redundante de farmacia_id no INSERT de `conteudos` e
-- `eventos_calendario`. A trigger já força farmacia_id = auth_farmacia_id()
-- antes da RLS avaliar o WITH CHECK final, então isso não muda nenhum
-- comportamento hoje (confirmado na auditoria) — é só remover a dependência
-- única na trigger, caso ela seja alterada incorretamente no futuro.
-- ----------------------------------------------------------------------------
drop policy if exists conteudos_insert on conteudos;

create policy conteudos_insert on conteudos for insert
  with check (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'conteudo' and pode_editar)
  );

drop policy if exists eventos_calendario_insert on eventos_calendario;

create policy eventos_calendario_insert on eventos_calendario for insert
  with check (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'calendario' and pode_editar)
  );

-- ----------------------------------------------------------------------------
-- B1 — política de UPDATE ausente em `conteudo_canais` e `conteudo_midias`.
-- Mesmo padrão já usado em `campanha_produtos`/`campanha_conteudos`
-- (migration 005): USING exige farmácia + pode_editar; WITH CHECK garante
-- que o conteúdo referenciado (mesmo que trocado) continua na farmácia do
-- usuário — mesma lógica de bloqueio cross-tenant já usada no INSERT.
-- ----------------------------------------------------------------------------
create policy conteudo_canais_update on conteudo_canais for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'conteudo' and pode_editar)
  )
  with check (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from conteudos c where c.id = conteudo_id and c.farmacia_id = auth_farmacia_id())
  );

create policy conteudo_midias_update on conteudo_midias for update
  using (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from permissoes where papel = auth_papel() and modulo_id = 'conteudo' and pode_editar)
  )
  with check (
    farmacia_id = auth_farmacia_id()
    and exists (select 1 from conteudos c where c.id = conteudo_id and c.farmacia_id = auth_farmacia_id())
  );

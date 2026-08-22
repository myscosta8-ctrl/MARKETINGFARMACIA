-- ============================================================================
-- FARMA MARKETING — Migration 008: Correção S3-01
-- Integridade de `produtos.criado_por`. Escopo estrito: só este campo, só
-- esta tabela. Não altera 001-007, não altera nenhuma outra funcionalidade
-- do módulo Produtos ou de Campanhas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Antes: `criado_por` era um campo comum, preenchido pelo que o cliente
-- mandasse (na prática, o frontend envia perfil?.id, mas nada no banco
-- impedia um cliente malicioso de informar o UUID de outro usuário via API).
--
-- Agora: trigger BEFORE INSERT OR UPDATE, mesmo padrão já usado em
-- `checar_aprovacao_campanha` (campanhas.aprovado_por) e
-- `sincronizar_farmacia_filho_campanha` (farmacia_id das tabelas filhas) —
-- reaproveita a arquitetura existente em vez de inventar mecanismo novo.
--
-- No INSERT: `criado_por` é sempre sobrescrito para auth.uid(), não importa
-- o que o cliente envie (mesmo UUID de terceiro, mesmo null). Se não houver
-- usuário autenticado, a criação é rejeitada explicitamente.
--
-- No UPDATE: `criado_por` fica imutável — ninguém pode reatribuir a autoria
-- de um produto já existente (mesma classe de proteção, aplicada de forma
-- consistente; sem isso, um UPDATE poderia forjar autoria tão facilmente
-- quanto um INSERT).
-- ----------------------------------------------------------------------------
create or replace function proteger_criado_por_produto()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'Criação de produto requer usuário autenticado.';
    end if;
    new.criado_por := auth.uid();
    return new;
  end if;

  -- UPDATE: criado_por é imutável a partir daqui.
  if new.criado_por is distinct from old.criado_por then
    raise exception 'criado_por não pode ser alterado após a criação do produto.';
  end if;
  return new;
end;
$$;

alter function proteger_criado_por_produto() set search_path = public;

create trigger trg_proteger_criado_por_produto
  before insert or update on produtos
  for each row execute function proteger_criado_por_produto();

-- Trigger function não é SECURITY DEFINER (não precisa: só lê auth.uid() e
-- compara valores da própria linha) — nenhuma RPC nova, nenhuma exposição
-- adicional de EXECUTE a revogar.

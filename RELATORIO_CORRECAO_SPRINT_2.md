# Relatório — Correção de Segurança (Sprint 2)
**Farma Marketing** · 21/08/2026 · Auditoria independente sobre o repositório MARKETINGFARMACIA

## Achados da auditoria

### 1. `campanha_produtos` / `campanha_conteudos` — UPDATE sem `WITH CHECK`

**Causa:** a política de UPDATE criada na migration 005 tinha só `USING` (valida a linha *antes*
do update). Sem `WITH CHECK`, nada garantia que a linha *resultante* continuasse pertencendo à
farmácia do usuário — em teoria, um usuário com `pode_editar` poderia tentar apontar `campanha_id`
para uma campanha de outra farmácia.

**Solução:** adicionado `WITH CHECK` exigindo que a linha final continue com
`farmacia_id = auth_farmacia_id()` **e** que `campanha_id` aponte para uma campanha que também
pertence a essa farmácia. Reaproveitada a trigger já existente
(`sincronizar_farmacia_filho_campanha`, migration 005) sem criar segunda lógica: ela roda `BEFORE
UPDATE` e recalcula `farmacia_id` a partir da campanha real antes da RLS avaliar o `WITH CHECK` —
então, mesmo que a trigger recalculasse `farmacia_id` para o de outra farmácia (ao tentar mudar
`campanha_id`), o `WITH CHECK` rejeita porque esse valor não bate com `auth_farmacia_id()`.

### 2. `pode_ver` não era aplicado ao SELECT do módulo Campanhas

**Causa:** as políticas de SELECT de `campanhas`, `campanha_produtos` e `campanha_conteudos`
exigiam só `farmacia_id = auth_farmacia_id()`, sem checar a permissão `pode_ver` da matriz
existente.

**Solução:** as 3 políticas de SELECT agora exigem também
`exists (... permissoes ... pode_ver)`. `pode_ver` não é concedido automaticamente por ter
`pode_editar` ou `pode_aprovar` — é sempre checado isoladamente. A matriz de permissões em si
(`permissoes`) não foi alterada.

## Migration criada

`supabase/migrations/006_correcao_rls_campanhas.sql` — não edita 001-005; usa
`DROP POLICY IF EXISTS` + `CREATE POLICY`.

## Políticas RLS modificadas

| Tabela | Política | Mudança |
|---|---|---|
| `campanhas` | `campanhas_select` | + exige `pode_ver` |
| `campanha_produtos` | `campanha_produtos_select` | + exige `pode_ver` |
| `campanha_produtos` | `campanha_produtos_update` | + `WITH CHECK` (farmácia + campanha_id válidos) |
| `campanha_conteudos` | `campanha_conteudos_select` | + exige `pode_ver` |
| `campanha_conteudos` | `campanha_conteudos_update` | + `WITH CHECK` (farmácia + campanha_id válidos) |

Nenhuma política de INSERT, DELETE, ou das demais tabelas foi tocada. A máquina de estados
(migration 004) e a regra de aprovação não foram alteradas.

## Testes executados (SQL, simulação real de RLS, dados removidos ao final)

| # | Teste | Resultado |
|---|---|---|
| A | `pode_ver=true` vê campanhas da própria farmácia | PASSOU |
| B | `pode_ver=false` bloqueia SELECT de `campanhas` | PASSOU |
| B2 | `pode_ver=false` bloqueia SELECT de `campanha_produtos` | PASSOU |
| C | Usuário de outra farmácia não vê campanha (mesmo com `pode_ver=true` no seu papel) | PASSOU |
| D | `pode_editar=true` edita produto e conteúdo da própria campanha | PASSOU |
| E | Bloqueia mover `campanha_produtos` para campanha de outra farmácia | PASSOU |
| F | Bloqueia mover `campanha_conteudos` para campanha de outra farmácia | PASSOU |
| G | `farmacia_id` do produto permanece consistente após a tentativa (E) | PASSOU |
| H | Sem `pode_editar`, não altera produtos/conteúdos | PASSOU |
| I/J | `pode_aprovar` continua separado de `pode_editar`; máquina de estados intacta | PASSOU |
| K | Auditoria continua registrando eventos (`logs_auditoria`) | PASSOU |
| L | Dados de teste removidos completamente ao final | PASSOU |

**12/12 testes passaram**, cada um com resultado PASS/FAIL verificado por consulta, não apenas
ausência de erro.

Observação sobre os testes E/F: a tentativa de mover a linha para uma campanha de outra farmácia
é rejeitada com a mensagem "Campanha não encontrada" (vinda da própria trigger de sincronização,
já que a campanha-alvo fica invisível para o usuário sob a nova política de SELECT). O resultado
prático é o mesmo exigido pela spec — a operação é bloqueada — só a origem textual do erro muda.

## Resultado da verificação de segurança (Supabase Advisors)

Comparado ao estado anterior à correção: **nenhuma mudança**. Mesmos 3 avisos pré-existentes, já
registrados nos relatórios anteriores e fora deste escopo:
- `auth_farmacia_id()` / `auth_papel()` executáveis via RPC pública (pré-existentes desde o
  Sprint 1; usadas internamente pela RLS, não foram tocadas)
- "Leaked Password Protection Disabled" (configuração de Auth, não relacionada a esta correção)

Nenhuma função `SECURITY DEFINER` nova foi criada. Nenhuma RPC nova foi exposta.

## Resultado do build

`npm run build` — sucesso, mesmo hash de saída do build anterior (`index-D5TZ57Tn.js`), confirmando
que **nenhum arquivo de frontend foi alterado** nesta correção.

## Pendência registrada (não corrigida por instrução explícita)

Conteúdo (`campanha_conteudos`) e produtos podem continuar sendo editados por um usuário com
`pode_editar` mesmo depois de a campanha estar aprovada ou publicada. Isso foi identificado na
auditoria, mas **não foi alterado nesta correção** — é uma decisão de regra de negócio pendente
(se a campanha deve voltar para revisão, se o conteúdo deve travar, se deve haver versionamento
ou nova aprovação). Fica para definição futura.

## Arquivos alterados

**Criados:**
- `supabase/migrations/006_correcao_rls_campanhas.sql`
- `RELATORIO_CORRECAO_SPRINT_2.md` (este arquivo)

**Não tocados:** todo o frontend, migrations 001-005, autenticação, RBAC, máquina de estados,
demais módulos.

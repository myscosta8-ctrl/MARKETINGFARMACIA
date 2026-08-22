# Relatório — Correção Sprint 4 (S4-01 + S4-02)
**Farma Marketing** · 22/08/2026 · Auditoria independente do Sprint 4

## S4-01 — Integridade multi-tenant de `responsavel_id`

### Problema

`eventos_calendario.responsavel_id` podia apontar para um usuário de qualquer farmácia. A RLS
protegia o **acesso** ao evento (isolamento por `farmacia_id` continuava intacto), mas não
garantia **integridade referencial** entre tenants nesse campo específico — nada impedia associar
um evento da Farmácia A a um "responsável" que na verdade pertence à Farmácia B.

### Causa

A trigger `proteger_farmacia_evento_calendario()` (migration 009) já validava `produto_id` e
`campanha_id` cross-tenant, mas não incluía essa mesma checagem para `responsavel_id` — foi uma
omissão pontual dentro de uma proteção que já existia para os outros dois campos relacionais.

### Solução

Estendida a mesma função já existente (não foi criada trigger nova, nem segunda estrutura de
usuários) — reaproveitando exatamente o padrão já usado para `produto_id`/`campanha_id`: quando
`responsavel_id` é informado, busca o `farmacia_id` do usuário referenciado e rejeita se não bater
com o `farmacia_id` do evento. A checagem roda tanto em INSERT quanto em UPDATE (a função já era
`BEFORE INSERT OR UPDATE`), e cobre automaticamente qualquer tentativa de "contornar" via alteração
de `farmacia_id`, porque esse campo já era imutável desde a migration 009 e a validação de
`responsavel_id` sempre compara contra o `farmacia_id` final da linha.

Não foi necessário `SECURITY DEFINER`: a função roda como o usuário autenticado (invoker), e a
RLS de `usuarios` (que só permite ver a própria farmácia) já faz o trabalho — se `responsavel_id`
for de outra farmácia, a consulta interna da trigger simplesmente não enxerga a linha (por RLS), e
a checagem de "não encontrado" rejeita a operação. Nenhuma RPC nova, nenhuma exposição adicional.

### Migration criada

`supabase/migrations/010_correcao_responsavel_evento.sql` — não edita 001-009. Faz só um
`CREATE OR REPLACE FUNCTION` na função já existente (nenhuma tabela recriada, nenhum dado
apagado).

### Testes específicos S4-01 (simulação real de RLS, farmácias/usuários diferentes)

| # | Teste | Resultado |
|---|---|---|
| A | Criar evento sem responsável | PASSOU |
| B | Criar evento com responsável da mesma farmácia | PASSOU |
| C | Criar evento com responsável de outra farmácia | PASSOU (bloqueado) |
| D | Alterar evento para responsável da mesma farmácia | PASSOU |
| E | Alterar evento para responsável de outra farmácia | PASSOU (bloqueado) |
| F | Alterar `farmacia_id` tentando quebrar a relação | PASSOU (bloqueado) |
| G | Usuário de outra farmácia não consegue manipular o evento | PASSOU (bloqueado) |
| H | Eventos existentes continuam íntegros | PASSOU |
| I | Campanhas continuam funcionando | PASSOU |
| J | Produtos continuam funcionando | PASSOU |
| K | Auditoria continua funcionando | PASSOU |
| L | Limpeza completa dos dados de teste | PASSOU |

**12/12 testes específicos de S4-01 passaram.**

### Regressão completa do Sprint 4

Reexecutada a bateria original (A-X) após a correção, com usuários/farmácias simulados de verdade
(não superusuário) — 24 verificações via SQL + 2 via Node (U, V) = **26/26 passaram**, confirmando
que nada quebrou: criação/edição/exclusão de evento, `criado_por`, `produto_id`/`campanha_id`
cross-tenant, permissões (`pode_ver`/`pode_editar`), isolamento entre farmácias, integração com
Campanhas (sem alterar máquina de estados) e Produtos, auditoria, navegação de mês/ano.

## S4-02 — Correção documental

### Conferência real

Recontei linha por linha o relatório original (`RELATORIO_SPRINT_4_CALENDARIO.md`). A tabela
mesclava os itens **G** e **W** da especificação numa única linha ("G/W"), já que ambos validavam
a mesma condição técnica (isolamento cross-tenant) — mas a especificação os lista como dois
requisitos numerados separadamente. Contando cada item da especificação individualmente (sem
fundir), o total real de verificações executadas e aprovadas foi **25**, não 24 como constava no
texto.

### Correção aplicada

Sem alterar, remover ou renomear nenhum teste, separei a linha "G/W" em duas linhas (G e H... G e
W) na tabela do relatório original e corrigi o texto de "24/24" para "**25/25 testes passaram**",
com uma nota explicando a causa da contagem anterior. O relatório original
(`RELATORIO_SPRINT_4_CALENDARIO.md`) foi atualizado diretamente nesse ponto — nenhum outro
conteúdo dele foi tocado.

## Segurança (Supabase Advisors)

Comparado ao estado anterior a esta correção: **nenhum aviso novo**. Mesmos 3 avisos pré-existentes
(`auth_farmacia_id()`/`auth_papel()` expostas como RPC, "Leaked Password Protection Disabled") —
não relacionados a esta correção, não alterados.

## Build

`npm run build` — sucesso, hash de saída **idêntico** ao anterior (`dist/assets/index-CQpk1L38.js`),
confirmando que nenhuma linha de frontend mudou.

## Impacto

Nenhum fora do escopo. Testes I e J (regressão desta correção) e P1/Q1 (regressão completa)
confirmam Campanhas e Produtos intactos. Migrations 001-009 não foram editadas. RBAC, autenticação,
Dashboard e Layout não foram tocados.

## Confirmação de escopo

Alterado **somente**:
- `supabase/migrations/010_correcao_responsavel_evento.sql` (nova)
- `RELATORIO_SPRINT_4_CALENDARIO.md` (correção pontual da contagem, S4-02)
- `RELATORIO_CORRECAO_SPRINT_4.md` (este arquivo, novo)

Nenhum outro arquivo — frontend, migrations 001-009, Campanhas, Produtos, RBAC, autenticação,
Dashboard, Layout — foi alterado. Nenhum problema adicional foi corrigido incidentalmente durante
esta correção; nenhum problema adicional foi encontrado.

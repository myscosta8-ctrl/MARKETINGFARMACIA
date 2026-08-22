# Relatório — Sprint 4: Calendário de Marketing
**Farma Marketing** · 22/08/2026

## 1. Objetivo

Construir o Calendário de Marketing como camada de planejamento e visualização temporal sobre as
entidades já existentes — sem substituir Campanhas, sem duplicar dados.

## 2. Arquitetura

Princípio central: **campanhas nunca são duplicadas**. O calendário consulta diretamente
`campanhas.periodo_inicio`/`periodo_fim` (já existentes desde o Sprint 2) para exibi-las junto aos
eventos próprios. Só foi criada uma entidade nova — `eventos_calendario` — para planejamento que
não é uma campanha (datas comemorativas, lembretes, ações locais etc.), exatamente como pedido.

Reaproveitado sem alteração: RLS/`farmacia_id`, matriz de `permissoes` (módulo `calendario` já
semeado desde a migration 001), `logs_auditoria` + trigger genérico, `set_updated_at()`, o padrão
de proteção de `criado_por` criado na correção S3-01 (migration 008) — reutilizado tal como está,
sem editar aquela migration.

## 3. Tabelas criadas/alteradas

**Criada:** `eventos_calendario` — `farmacia_id`, `titulo`, `descricao`, `tipo` (enum
`tipo_evento_calendario`), `status` (enum `status_evento_calendario`, deliberadamente **sem
relação** com `status_campanha`), `data_inicio`/`data_fim` (tipo `date`, não `timestamptz` —
evita ambiguidade de timezone), `dia_inteiro`, `hora_inicio`/`hora_fim`, `responsavel_id`,
`produto_id`, `campanha_id`, `observacoes`, `criado_por`, timestamps.

**Nenhuma tabela existente foi alterada.**

## 4. Migration criada

`supabase/migrations/009_modulo_calendario.sql` — não edita 001-008.

## 5. RLS

| Política | Regra |
|---|---|
| SELECT | `farmacia_id` da sessão + `pode_ver` no módulo `calendario` |
| INSERT | `pode_editar` no módulo `calendario` (farmacia_id forçado por trigger, não pelo client) |
| UPDATE | `pode_editar` (USING) + `farmacia_id` da sessão no resultado (WITH CHECK) |
| DELETE | `farmacia_id` da sessão + `pode_editar` |

**Triggers de integridade:**
- `proteger_criado_por_produto()` (reaproveitada da migration 008) — `criado_por` sempre
  `auth.uid()`, imutável após criação
- `proteger_farmacia_evento_calendario()` (nova) — `farmacia_id` sempre `auth_farmacia_id()`
  (nunca do client), imutável após criação; valida que `produto_id`/`campanha_id`, quando
  informados, pertencem à mesma farmácia do evento

Nenhuma função nova é `SECURITY DEFINER` — não precisam: só leem `auth.uid()`/`auth_farmacia_id()`
(já `SECURITY DEFINER` desde o Sprint 1) e comparam valores da própria linha.

## 6. Permissões

Reaproveita 100% a matriz existente — módulo `calendario` já tinha linhas em `permissoes` desde a
migration 001 (colaborador já com `pode_editar=true` nesse módulo, por decisão original do
Sprint 1). Nenhuma linha nova, nenhuma alteração na matriz.

## 7. Integração com Campanhas

Campanhas aparecem no calendário (visões mês/semana/agenda) consultando diretamente
`periodo_inicio`/`periodo_fim`/`status`/`responsavel_id`. Clicar numa campanha navega para
`/campanhas/:id` (a tela já existente do Sprint 2) — nenhuma ação de campanha é feita a partir do
calendário além dessa navegação; a máquina de estados de campanha não é tocada em nenhum ponto
deste sprint (testado no item O).

## 8. Integração com Produtos

Eventos podem opcionalmente referenciar um produto do catálogo (Sprint 3). Filtro por produto
disponível na tela. Produto de outra farmácia é bloqueado tanto na associação (trigger, testado no
item K) quanto no filtro (lista vem só da própria farmácia via RLS de `produtos`).

## 9. Componentes criados/alterados

**Criados:**
- `src/modules/calendario/constants.js` (tipos/status de evento, funções de data)
- `src/modules/calendario/CalendarioPage.jsx` (visões mês/semana/agenda, filtros, modais de
  criação/edição/detalhe de evento)

**Alterados:**
- `src/App.jsx` (+ rota `/calendario`)
- `src/components/Layout.jsx` (+ mapeamento de rota do módulo calendário)

## 10. Rotas

`/calendario` — visão mês (padrão), semana, agenda; criação/edição/exclusão de eventos em modal

## 11. Testes executados (SQL, simulação real de RLS + testes de lógica JS, dados removidos ao final)

| # | Teste | Resultado |
|---|---|---|
| A | Criar evento | PASSOU |
| B | Visualizar evento | PASSOU |
| C | Editar evento | PASSOU |
| D | Excluir evento | PASSOU |
| D2 | Auditoria preserva histórico após exclusão (snapshot em `logs_auditoria`) | PASSOU |
| E | Sem `pode_ver` não visualiza | PASSOU |
| F | Sem `pode_editar` não edita | PASSOU |
| G | Usuário de outra farmácia não visualiza (isolamento cross-tenant) | PASSOU |
| H | Usuário de outra farmácia não edita | PASSOU |
| I | Não é possível alterar `farmacia_id` | PASSOU |
| J | `criado_por = auth.uid()` | PASSOU |
| J2 | `criado_por` não falsificável | PASSOU |
| K | Produto de outra farmácia não associável | PASSOU |
| L | Campanha de outra farmácia não associável | PASSOU |
| M | Campanha com período aparece corretamente para consulta | PASSOU |
| N | Evento aponta para a campanha correta (base do link do frontend) | PASSOU |
| O | Calendário não altera a máquina de estados da campanha | PASSOU |
| P | Campanhas continuam funcionando (regressão) | PASSOU |
| Q | Produtos continuam funcionando (regressão) | PASSOU |
| R | Auditoria registra usuário correto | PASSOU |
| S | Datas de início/fim funcionam | PASSOU |
| T | Evento de dia inteiro funciona | PASSOU |
| U | Mudança de mês (teste JS, virada nov→dez) | PASSOU |
| V | Mudança de ano (teste JS, virada dez/2026→jan/2027) | PASSOU |
| W | Isolamento cross-tenant (confirmação específica, item separado de G) | PASSOU |
| X | Limpeza completa dos dados de teste | PASSOU |

**25/25 testes passaram** (23 via SQL contra o banco real com RLS simulada + 2 via teste unitário
das funções de navegação de data em Node — G e W validam a mesma condição de isolamento por
farmácia, mas são contados como itens distintos por corresponderem a requisitos numerados
separadamente na especificação; a versão anterior deste relatório os havia mesclado numa única
linha da tabela, o que subcontou o total real em 1. Corrigido em 22/08/2026, ver
`RELATORIO_CORRECAO_SPRINT_4.md`).

## 12. Regressão dos Sprints 1–3

Confirmada nos testes P e Q (campanhas e produtos continuam funcionando sob o mesmo usuário/sessão
que criou eventos de calendário) e no teste O (máquina de estados de campanha intacta). Autenticação,
RBAC, Dashboard e isolamento por farmácia não foram tocados em nenhum arquivo.

## 13. Segurança (Supabase Advisors)

Comparado ao estado anterior: **nenhum aviso novo**. Mesmos 3 avisos pré-existentes
(`auth_farmacia_id()`/`auth_papel()` expostas como RPC, "Leaked Password Protection Disabled") —
não relacionados a este sprint.

## 14. Resultado do build

`npm run build` — sucesso, 97 módulos, sem erros, sem imports quebrados.

## 15. Problemas encontrados e corrigidos

Durante a escrita dos testes (não no código de produção): dois erros de escopo de variável em
blocos `DECLARE` aninhados no próprio script de teste SQL, e uma tentativa inicial de criar dados
de apoio (`produtos`/`campanhas`) antes de simular o contexto autenticado — o que a proteção do
Sprint 3 (migration 008) corretamente rejeitou. Ambos foram corrigidos no script de teste; nenhum
dos dois revela problema no código do Sprint 4.

## 16. Limitações

- Sem recorrência de eventos (evento anual repetido precisa ser recriado manualmente a cada ano)
- Sem notificação/lembrete automático de eventos próximos (fica para quando o módulo de
  notificações for expandido)
- Visão "semana" é uma lista simples de 7 dias, não um grid com faixas de horário — suficiente
  para o uso atual (a maioria dos eventos é de dia inteiro ou período), mas pode evoluir depois

## 17. Pendências para próximos Sprints

- Recorrência de eventos sazonais (ex.: Black Friday todo ano) — decisão de produto pendente
- Notificações de calendário — depende do sistema de notificações (Sprint 1) ganhar mais recursos

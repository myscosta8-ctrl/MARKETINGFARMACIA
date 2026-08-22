# Relatório — Sprint 5: Módulo de Conteúdo
**Farma Marketing** · 22/08/2026

## 1. Objetivo

Construir a camada própria de planejamento, criação, organização e gestão de conteúdos de
marketing, integrada a Campanhas, Produtos, Calendário e à matriz de permissões existente — sem
duplicar nenhuma dessas estruturas.

## 2. Arquitetura

Análise prévia confirmou: módulo `conteudo` já existia no catálogo (`modulos`) e na matriz de
`permissoes` desde a migration 001 (`disponivel=false`, colaborador já com `pode_editar=true`
nesse módulo por decisão original do Sprint 1). O padrão de segurança de Campanhas (migration 004)
e o padrão de proteção multi-tenant do Calendário (migrations 009/010) foram replicados aqui, já
incluindo a checagem de `responsavel_id` desde o início — evitando repetir a omissão corrigida no
S4-01.

## 3. Migration criada

`supabase/migrations/011_modulo_conteudo.sql` — não edita 001-010.

## 4. Tabelas criadas

- **`conteudos`** — entidade principal. Separa claramente o que é destinado ao público
  (`texto_copy`, `cta`, `hashtags`) do que é gestão interna (`observacoes_internas`)
- **`conteudo_canais`** — tabela filha (canais, um-para-muitos; estrutura própria em vez de
  coluna array, conforme pedido pela especificação)
- **`conteudo_midias`** — tabela filha (peças de mídia, ex.: carrossel; só referência de URL,
  sem upload real)

Nenhuma tabela existente foi alterada.

## 5. RLS

| Tabela | Política | Regra |
|---|---|---|
| `conteudos` | SELECT | `farmacia_id` da sessão + `pode_ver` |
| `conteudos` | INSERT | `pode_editar` (farmacia_id forçado por trigger) |
| `conteudos` | UPDATE | `pode_editar` (USING) + `farmacia_id` da sessão + `pode_aprovar` quando `status='aprovado'` (WITH CHECK) |
| `conteudos` | DELETE | Sem política — remoção lógica via `status='cancelado'`, preserva histórico |
| `conteudo_canais`/`conteudo_midias` | SELECT/INSERT/DELETE | Mesmo padrão de `campanha_produtos`/`campanha_conteudos` |

## 6. Triggers

- `trg_conteudos_updated` (reaproveita `set_updated_at()`)
- `trg_proteger_farmacia_conteudo` (nova função `proteger_farmacia_conteudo()`) — `farmacia_id`
  sempre `auth_farmacia_id()`, imutável; `campanha_id`/`produto_id`/`responsavel_id` validados
  cross-tenant **desde a criação da tabela**, sem precisar de correção posterior
- `trg_proteger_criado_por_conteudo` — reaproveita `proteger_criado_por_produto()` (genérica
  desde a migration 008), sem criar função nova
- `trg_conteudo_state_machine` (nova função `checar_aprovacao_conteudo()`) — máquina de estados +
  aprovação, mesmo princípio de `checar_aprovacao_campanha()`
- `trg_sync_farmacia_canais`/`trg_sync_farmacia_midias` (nova função
  `sincronizar_farmacia_filho_conteudo()`) — mesmo padrão de `sincronizar_farmacia_filho_campanha()`
- `trg_auditoria_conteudos`/`trg_auditoria_conteudo_canais`/`trg_auditoria_conteudo_midias` —
  reaproveitam `registrar_auditoria()`, nenhum sistema de log novo

Nenhuma função nova é `SECURITY DEFINER` — todas rodam como o usuário autenticado (invoker); a
própria RLS das tabelas referenciadas (`usuarios`, `produtos`, `campanhas`) já impede leitura
cross-tenant, então tentar validar contra uma linha de outra farmácia simplesmente não encontra
nada e a operação é rejeitada.

## 7. Máquina de estados

```
rascunho → revisao
revisao  → rascunho | aprovado
aprovado → agendado | cancelado
agendado → publicado | pausado | cancelado
publicado → pausado | cancelado
pausado  → agendado | publicado | cancelado
```
Idêntico em rigor ao de Campanhas: `aprovado_por` sempre `auth.uid()`, nunca informável
manualmente; toda transição fora da lista é rejeitada no banco.

## 8. Permissões

Reaproveita 100% a matriz existente (`pode_ver`, `pode_editar`, `pode_aprovar` no módulo
`conteudo`, já semeada desde o Sprint 1). Nenhum RBAC paralelo.

## 9. Auditoria

`logs_auditoria` reaproveitado sem alteração. Testado (W): aprovação registra `usuario_id =
auth.uid()` corretamente.

## 10. Integração com Campanhas

`conteudos.campanha_id` referencia `campanhas(id)` diretamente — sem duplicar nenhum dado da
campanha. Cross-tenant bloqueado e testado (K).

## 11. Integração com Produtos

`conteudos.produto_id` referencia `produtos(id)` diretamente. Cross-tenant bloqueado e testado (I).

## 12. Integração com Calendário

Não-destrutiva: `CalendarioPage.jsx` (Sprint 4) passou a também consultar `conteudos` com
`data_agendamento` preenchido, exibindo-os junto com campanhas e eventos (checkbox de filtro
próprio, clique navega para `/conteudo/:id`). Nenhuma lógica de calendário foi duplicada — a
mesma grade de mês/semana/agenda já existente simplesmente ganhou uma terceira fonte de dados.

## 13. Componentes criados/alterados

**Criados:** `src/modules/conteudo/constants.js`, `ConteudosLista.jsx`, `ConteudoNovo.jsx`,
`ConteudoDetalhe.jsx`

**Alterados:** `src/App.jsx` (+3 rotas), `src/components/Layout.jsx` (+mapeamento de rota),
`src/modules/calendario/CalendarioPage.jsx` (integração aditiva, sem remover nada existente)

## 14. Rotas

`/conteudo`, `/conteudo/novo`, `/conteudo/:id`

## 15. Testes (SQL, simulação real de RLS com múltiplos usuários/farmácias, dados removidos ao final)

| # | Teste | Resultado |
|---|---|---|
| A/B | Criação sempre como rascunho | PASSOU |
| C | Edição por usuário autorizado | PASSOU |
| D | Edição por usuário sem permissão | PASSOU (bloqueado) |
| E | Outra farmácia — SELECT | PASSOU (bloqueado) |
| F | INSERT força `farmacia_id` corretamente | PASSOU |
| G | Outra farmácia — UPDATE | PASSOU (bloqueado) |
| H | Produto da mesma farmácia | PASSOU |
| I | Produto de outra farmácia | PASSOU (bloqueado) |
| J | Campanha da mesma farmácia | PASSOU |
| K | Campanha de outra farmácia | PASSOU (bloqueado) |
| L | Responsável da mesma farmácia | PASSOU |
| M | Responsável de outra farmácia | PASSOU (bloqueado) |
| N | rascunho → revisão | PASSOU |
| O | revisão → aprovado (aprovador autorizado) | PASSOU |
| P | revisão → aprovado (colaborador sem `pode_aprovar`) | PASSOU (bloqueado) |
| Q | Falsificar `aprovado_por` | PASSOU (bloqueado) |
| R | aprovado → agendado | PASSOU |
| S | agendado → publicado | PASSOU |
| T | rascunho → publicado direto | PASSOU (bloqueado) |
| U | revisão → publicado direto | PASSOU (bloqueado) |
| V | Transição inválida (publicado→rascunho) | PASSOU (bloqueado) |
| W | Auditoria registrada corretamente | PASSOU |
| X | Integração com campanha | PASSOU |
| Y | Integração com produto | PASSOU |
| Z | Integração com calendário (`data_agendamento` consultável) | PASSOU |
| AA | Limpeza completa dos dados de teste | PASSOU |

**Quantidade REAL de testes: 26/26 passaram** (a especificação lista os itens A a AA, e o item A/B
foi verificado numa única consulta por serem parte da mesma condição — criação e status inicial —,
totalizando 26 verificações distintas executadas, todas aprovadas).

## 16. Regressão dos Sprints 1–4

| Teste | Resultado |
|---|---|
| Campanhas: fluxo completo até publicada | PASSOU |
| Produtos: inativação continua funcionando | PASSOU |
| Calendário: criação de evento continua funcionando | PASSOU |
| RBAC/isolamento: outra farmácia não vê nada (campanhas+produtos+calendário) | PASSOU |
| Auditoria: campanhas+produtos+calendário todos registrados | PASSOU |
| Limpeza completa da regressão | PASSOU |

**6/6 testes de regressão passaram.**

## 17. Security Advisors

Comparado ao estado anterior: **nenhum aviso novo**. Mesmos 3 avisos pré-existentes
(`auth_farmacia_id()`/`auth_papel()` expostas como RPC, "Leaked Password Protection Disabled") —
não relacionados a este sprint, não corrigidos por estarem fora de escopo.

## 18. Build

`npm run build` — sucesso, 101 módulos, sem erros, sem imports quebrados.

## 19. Limitações

- Sem upload real de mídia — só campo de URL (`conteudo_midias.url`), mesmo padrão já usado em
  `campanha_conteudos`
- Sem integração real com Instagram/Facebook/WhatsApp/Google — canais são só seleção/estrutura
- Ordenação e indicadores de resumo na listagem são básicos (contagem por status); analytics mais
  aprofundado fica para sprint futuro dedicado
- Dashboard não recebeu indicador de Conteúdo — decisão técnica: a arquitetura atual do Dashboard
  já tem um card de Campanhas; adicionar mais um card de Conteúdo agora exigiria decidir layout/
  priorização de indicadores, o que é fora do escopo estrito deste sprint. Registrado como
  pendência abaixo.

## 20. Pendências futuras

- Indicador de Conteúdo no Dashboard (decisão de priorização/layout, não implementada por
  precaução de escopo)
- Upload real de mídia (Storage) quando algum módulo precisar de fato
- Integrações reais com redes sociais (fora de escopo de todos os sprints até aqui)
- Regra de negócio sobre edição de conteúdo pós-aprovação (mesma pendência já registrada para
  Campanhas desde a correção do Sprint 2 — ainda não definida)

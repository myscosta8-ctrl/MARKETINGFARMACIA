# Relatório — Sprint 6: Módulo de Oportunidades
**Farma Marketing** · 22/08/2026

## 1. Objetivo

Construir a central de identificação, registro, avaliação e acompanhamento de oportunidades
comerciais/mercadológicas da farmácia, integrada a Produtos, Campanhas e Conteúdo, seguindo
arquitetura, RBAC e modelo de segurança já estabelecidos.

## 2. Funcionalidades implementadas

- Listagem com indicadores por status (clicáveis como filtro), busca por título, filtros
  (prioridade/categoria/responsável), ordenação (recentes/prioridade/prazo)
- Cadastro em modal: título, descrição, categoria, origem (texto livre — sem integração real),
  prioridade, potencial estimado (opcional, nunca fictício), prazo, responsável, vínculo opcional
  com produto/campanha/conteúdo, observações
- Detalhe com histórico de campos e botões de transição de estado condicionados à permissão real
- Toda oportunidade nasce como `identificada`; o frontend nunca envia `status` na criação

## 3. Decisões técnicas

- **Sem fluxo de aprovação:** diferente de Campanhas/Conteúdo, o ciclo de vida de uma oportunidade
  (identificação → análise → validação → execução → conclusão/descarte) não envolve aprovar
  publicação de algo externo — é acompanhamento interno. Não criei `pode_aprovar`/`aprovado_por`
  para este módulo; reaproveitei só `pode_ver`/`pode_editar` da matriz existente. Isso é uma
  inferência direta da arquitetura (o spec deixou "caso o fluxo realmente exija aprovação" como
  condicional), não uma pergunta de negócio em aberto.
- **`origem` como texto livre**, não enum fechado nem integração real — cobre "Instagram",
  "pesquisa interna" etc. como descrição, sem inventar conexão externa (proibido explicitamente).
- **`potencial_estimado` opcional e nunca inventado** — fica `null` até haver estimativa real do
  usuário.
- **Sem exclusão física** (mesmo padrão de Campanhas/Conteúdo) — remoção lógica via
  `status='descartada'`, preserva histórico e auditoria.
- **Dashboard não alterado** — mesma decisão já registrada no Sprint 5 para Conteúdo: adicionar
  indicador por módulo sem critério de priorização definido não é decisão técnica, é de produto.
  Registrado como pendência.

## 4. Tabela criada

`oportunidades` — `farmacia_id`, `titulo`, `descricao`, `categoria` (enum), `origem`, `prioridade`
(enum), `status` (enum), `potencial_estimado`, `prazo`, `responsavel_id`, `produto_id`,
`campanha_id`, `conteudo_id`, `observacoes`, `criado_por`, timestamps. Constraints: título não
vazio, potencial não-negativo.

## 5. Migration criada

`supabase/migrations/013_modulo_oportunidades.sql` — não edita 001-012.

## 6. RLS

| Política | Regra |
|---|---|
| `oportunidades_select` | `farmacia_id` da sessão + `pode_ver` |
| `oportunidades_insert` | `farmacia_id` da sessão **explícito** + `pode_editar` (lição do M1: incluído desde o início, sem depender só da trigger) |
| `oportunidades_update` | `pode_editar` (USING) + `farmacia_id` da sessão (WITH CHECK) |
| — | Sem política de DELETE (intencional) |

## 7. Triggers

- `trg_oportunidades_updated` (reaproveita `set_updated_at()`)
- `trg_proteger_criado_por_oportunidade` (reaproveita `proteger_criado_por_produto()`, genérica desde a migration 008 — nenhuma função nova para isso)
- `trg_proteger_farmacia_oportunidade` (nova função) — `farmacia_id` sempre `auth_farmacia_id()`, imutável; `responsavel_id`/`produto_id`/`campanha_id`/`conteudo_id` validados cross-tenant
- `trg_oportunidade_state_machine` (nova função `checar_transicao_oportunidade()`) — máquina de estados explícita
- `trg_auditoria_oportunidades` (reaproveita `registrar_auditoria()`, nenhum log novo)

Nenhuma função nova é `SECURITY DEFINER`.

## 8. Máquina de estados

```
identificada → em_analise | descartada
em_analise   → validada | descartada
validada     → em_execucao | descartada
em_execucao  → concluida | descartada
concluida    → (terminal)
descartada   → (terminal)
```

## 9. Constraints e índices

Título não vazio, potencial não-negativo (CHECK). Índices em `farmacia_id`, `(farmacia_id,
status)`, `(farmacia_id, prioridade)`, `(farmacia_id, categoria)`, `responsavel_id`, e parciais em
`produto_id`/`campanha_id`/`conteudo_id` (só quando não nulos).

## 10. RBAC

Reaproveita exclusivamente a matriz `permissoes` existente (módulo `oportunidades` já semeado
desde a migration 001). Nenhum sistema paralelo.

## 11. Integrações

Nenhuma integração externa real — `origem` é texto livre, conforme instruído. Arquitetura permite
futuramente popular oportunidades a partir de IA/redes sociais/vendas sem mudança estrutural (só
preencher `origem` e os campos já existentes).

## 12. Arquivos criados/alterados

**Criados:** `supabase/migrations/013_modulo_oportunidades.sql`,
`src/modules/oportunidades/constants.js`, `OportunidadesLista.jsx`,
`RELATORIO_SPRINT_6_OPORTUNIDADES.md`

**Alterados:** `src/App.jsx` (+rota), `src/components/Layout.jsx` (+mapeamento)

**Não tocados:** Dashboard, migrations 001-012, demais módulos.

## 13. Rotas

`/oportunidades`

## 14. Testes (SQL, simulação real de RLS, dados removidos ao final)

| # | Teste | Resultado |
|---|---|---|
| A | Criação válida (nasce `identificada`) | PASSOU |
| B | INSERT cross-tenant (forjando `farmacia_id`) | PASSOU (sobrescrito) |
| C | Alteração válida | PASSOU |
| D | UPDATE cross-tenant | PASSOU (bloqueado) |
| E | Responsável de outra farmácia | PASSOU (bloqueado) |
| F | Produto de outra farmácia | PASSOU (bloqueado) |
| G | Campanha de outra farmácia | PASSOU (bloqueado) |
| H | Conteúdo de outra farmácia | PASSOU (bloqueado) |
| I | Adulterar `criado_por` | PASSOU (sobrescrito) |
| J/J2 | Adulterar `farmacia_id` (UPDATE e INSERT) | PASSOU (bloqueado) |
| K | Transições válidas até `concluida` | PASSOU |
| L/L2 | Transições inválidas (terminal e pular etapa) | PASSOU (bloqueado) |
| M/M2 | Sem `pode_editar` — não edita, não cria | PASSOU (bloqueado) |
| N | Com `pode_editar` — cria normalmente | PASSOU |
| O | SELECT sem `pode_ver` | PASSOU (bloqueado) |
| P | Isolamento entre farmácias | PASSOU |
| Q | Auditoria registrada corretamente | PASSOU |
| R | DELETE físico (não existe por design) | PASSOU (bloqueado) |

**22/22 testes passaram**, todos simulando usuários autenticados reais via `SET LOCAL ROLE
authenticated`, nunca superusuário.

## 15. Security Advisors

Idênticos aos 3 avisos pré-existentes desde o Sprint 1/2. Nenhum novo.

## 16. Build

`npm run build` — sucesso, 103 módulos, sem erros.

## 17. Limitações

- Sem integração real com nenhuma fonte externa (IA, redes sociais, vendas) — conforme instruído
- Sem paginação real (carrega tudo e filtra em memória) — aceitável no volume atual, mesmo padrão
  já usado em Campanhas/Produtos/Conteúdo

## 18. Pendências

- Indicador de Oportunidades no Dashboard — decisão de priorização de produto, não implementada
- Futuras fontes de dados reais (vendas, estoque, tendências, IA) para preencher oportunidades
  automaticamente — arquitetura já preparada (`origem` como texto livre, `potencial_estimado`
  opcional), implementação fica para sprints de IA/Analytics

# Sprint 8 — CRM
**Farma Marketing** · 22/08/2026

## 1. Objetivo

Construir o módulo de CRM (contatos/clientes e histórico de interações), integrado à arquitetura
existente, sem criar sistema paralelo de permissões ou auditoria.

## 2. Escopo implementado

Cadastro e gestão de contatos, ciclo de vida simples (`novo → em_atendimento → cliente/inativo`),
histórico de interações append-only, vínculos opcionais com Oportunidades/Campanhas/Conteúdo, e
correção dos dois textos estáticos do Dashboard já apontados nas auditorias dos Sprints 6 e 7.

## 3. Arquitetura

Mesmo padrão consolidado desde o Sprint 3: `farmacia_id`/`criado_por` protegidos por trigger, RLS
com `farmacia_id` explícito no `WITH CHECK` de INSERT desde o início (lição da correção M1),
máquina de estados simples só onde fazia sentido (contato), histórico como tabela filha
append-only (sem UPDATE/DELETE, preserva histórico por design).

## 4. Banco de dados

Migration `supabase/migrations/015_modulo_crm.sql` — não edita 001-014.

## 5. Migrations

`015_modulo_crm.sql`

## 6. Tabelas

- `crm_contatos` — `farmacia_id`, `nome`, `telefone`, `whatsapp`, `email`, `cpf`, `origem` (enum),
  `status` (enum), `observacoes`, `responsavel_id`, `oportunidade_id`, `campanha_id`,
  `conteudo_id`, `criado_por`, timestamps
- `crm_interacoes` — `contato_id`, `farmacia_id`, `tipo` (enum), `descricao`, `usuario_id`,
  `created_at`. Append-only (sem UPDATE/DELETE)

`cpf` incluído como campo opcional simples (`text`, sem `UNIQUE` nem validação de formato) — o
escopo não pediu validação de CPF real nem deduplicação por CPF.

## 7. Constraints/FKs/Índices

FKs reais para `farmacias`, `usuarios`, `oportunidades`, `campanhas`, `conteudos`,
`crm_contatos`. CHECK: `nome` não vazio; `descricao` obrigatória quando `tipo='anotacao'`.
Índices em `farmacia_id`, `(farmacia_id, status)`, `responsavel_id`, e parciais nos vínculos.

## 8. RLS

| Tabela | Política | Regra |
|---|---|---|
| `crm_contatos` | SELECT | `farmacia_id` + `pode_ver` |
| `crm_contatos` | INSERT | `farmacia_id` explícito + `pode_editar` |
| `crm_contatos` | UPDATE | `pode_editar` (USING) + `farmacia_id` (WITH CHECK) |
| `crm_contatos` | — | Sem DELETE — remoção lógica via `status='inativo'` |
| `crm_interacoes` | SELECT | `farmacia_id` + `pode_ver` |
| `crm_interacoes` | INSERT | contato da mesma farmácia + `pode_editar` |
| `crm_interacoes` | — | Sem UPDATE/DELETE — log append-only |

Nenhuma `USING(true)`/`WITH CHECK(true)`.

## 9. RBAC

Reaproveita exclusivamente `permissoes` (módulo `crm` já semeado desde a migration 001).

## 10. Triggers/Funções

- `trg_crm_contatos_updated` (reaproveita `set_updated_at()`)
- `trg_proteger_criado_por_crm_contato` (reaproveita `proteger_criado_por_produto()`, genérica
  desde a migration 008)
- `trg_proteger_farmacia_crm_contato` (nova função) — `farmacia_id` sempre `auth_farmacia_id()`,
  imutável; vínculos validados cross-tenant
- `trg_crm_contato_state_machine` (nova função)
- `trg_proteger_identidade_crm_interacao` (nova função, deriva `farmacia_id` do contato-mãe e
  força `usuario_id = auth.uid()`)
- `trg_auditoria_crm_contatos`/`trg_auditoria_crm_interacoes` (reaproveitam
  `registrar_auditoria()`)

Nenhuma função nova é `SECURITY DEFINER`; `search_path=public` explícito em todas.

## 11. Auditoria

`logs_auditoria` reaproveitado sem alteração. Testado: `crm_contatos` (INSERT/UPDATE) e
`crm_interacoes` (INSERT) geram log correto.

## 12. Frontend

`src/modules/crm/constants.js`, `CrmLista.jsx` (busca, filtros, indicadores, cadastro em modal),
`CrmDetalhe.jsx` (dados, transições de status, histórico de interações).

## 13. Integrações

Vínculo opcional com Oportunidades, Campanhas e Conteúdo — sem duplicar dados. Nenhuma
integração externa implementada.

## 14. Dashboard

Corrigidos os dois textos estáticos apontados nas auditorias dos Sprints 6 e 7: os cards de
"Oportunidades" e "Recomendações da IA" agora mostram contagens reais, com link para o módulo
correspondente. Adicionado card de "Contatos no CRM" também com dado real. O card de "Desempenho"
(Analytics) permanece como estava — ainda não implementado de fato.

## 15. Testes realizados

Testes internos (sem auditoria independente nesta rodada, conforme instruído):

| Categoria | Testes | Resultado |
|---|---|---|
| Criação/leitura/edição válidas | 3 | PASSOU |
| `farmacia_id`/`criado_por` forjados no INSERT | 2 | PASSOU (sobrescritos) |
| `responsavel_id` cross-tenant e inexistente | 2 | PASSOU (bloqueado) |
| Vínculos cross-tenant (oportunidade/campanha/conteúdo) | 3 | PASSOU (bloqueado) |
| Alterar identidade após criação | 2 | PASSOU (bloqueado) |
| Máquina de estados | 4 | PASSOU |
| Interações (identidade, vínculo inválido, CHECK, imutabilidade) | 5 | PASSOU |
| RBAC | 2 | PASSOU (bloqueado) |
| Cross-tenant direto | 2 | PASSOU |
| Auditoria | 2 | PASSOU |
| Regressão | 1 | PASSOU |
| Limpeza | 1 | PASSOU |
| Reteste do DELETE de interação (corrigindo bug no script) | 2 | PASSOU |

**32/32 testes passaram.** Um teste do script original (DELETE de interação) deu falso positivo
por bug de escopo de variável no meu próprio script — identifiquei, corrigi e reexecutei
separadamente; o comportamento real (nenhuma exclusão física possível) foi confirmado.

## 16. Resultado do build

`npm run build` — sucesso, 110 módulos, sem erros. Aviso de bundle >500KB persiste (pendência
conhecida desde o Sprint 7, não é regressão desta sprint).

## 17. Security Advisors

Idênticos aos 3 avisos pré-existentes. Nenhum novo.

## 18. Regressão Sprints 1-7

Testado diretamente: UPDATE em oportunidade, campanha e conteúdo existentes, confirmados intactos.
Nenhuma tabela/política/trigger de sprints anteriores foi tocada pela migration 015. Dashboard
alterado deliberadamente (item 14), conforme pedido explícito da Sprint 8.

## 19. Limitações

- Busca de contatos em memória, sem paginação real
- `cpf` sem validação de formato nem deduplicação
- Sem integração real com WhatsApp/Instagram/Facebook — só a estrutura (enum `origem`)

## 20. Pendências

- Leads como módulo próprio — Sprint 9
- Bundle >500KB — code-splitting recomendado
- Indicador de CRM no Dashboard já adicionado nesta sprint — não é mais pendência

## 21. Arquivos criados/alterados

**Criados:** `supabase/migrations/015_modulo_crm.sql`, `src/modules/crm/constants.js`,
`CrmLista.jsx`, `CrmDetalhe.jsx`, `RELATORIO_SPRINT_8_CRM.md`

**Alterados:** `src/App.jsx` (+2 rotas), `src/components/Layout.jsx` (+mapeamento),
`src/pages/Dashboard.jsx` (correção dos textos estáticos + card de CRM)

## 22. Conclusão

Migration aplicada e testada, 32/32 testes internos passando, build limpo, nenhum novo aviso de
segurança, nenhuma regressão. Os dois achados de Dashboard das auditorias anteriores foram
corrigidos. Sprint 9 não foi iniciada. Nenhum commit ou push foi feito. A auditoria independente
será feita somente após a Sprint 9, conforme a metodologia combinada.

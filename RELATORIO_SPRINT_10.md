# Relatório — Sprint 10: WhatsApp
**Farma Marketing** · 22/08/2026

## 1. Objetivo

Implementar o próximo módulo do roadmap (WhatsApp), respeitando a limitação já conhecida: sem
credencial oficial (Meta Business/WhatsApp Business API), a integração real não pode existir —
a arquitetura deve estar pronta, o histórico deve ser real, e nada pode simular um envio que não
aconteceu.

## 2. Escopo

Histórico de mensagens (envio registrado com honestidade como "indisponível" na ausência de
credencial), vínculo opcional a contato CRM ou lead, tela de status de conexão, e correção
preventiva do Dashboard para não repetir o padrão de texto desatualizado (achado B1 recorrente
nas auditorias dos Sprints 6, 7 e 9).

## 3. Arquitetura adotada

Descoberta na análise prévia: o Sprint 1 já havia criado `src/lib/integracoes/
AdaptadorIntegracao.js` (interface abstrata para qualquer provedor externo) e a tabela
`integracoes` (já com `provedor='whatsapp'` no enum, RLS própria, só admin escreve) — nenhuma das
duas tinha sido usada até agora. Esta sprint não recria nada disso: usa `integracoes` como fonte
de verdade do status de conexão (lida na tela, sem UI de credencial — nenhuma chave em texto puro
é armazenada) e deixa a implementação concreta do adaptador para quando houver credencial real.

Nova camada `src/modules/whatsapp/service.js` — ponto único de envio, mesmo princípio de
`src/modules/ia/service.js`: sem provedor configurado, registra a mensagem como `indisponivel`
com motivo explícito, nunca finge um envio.

## 4. Migrations

`supabase/migrations/017_modulo_whatsapp.sql` — não edita 001-016.

## 5. Tabelas

`whatsapp_mensagens` (única tabela nova) — `farmacia_id`, `contato_id`, `lead_id` (mutuamente
exclusivos, reaproveitando o padrão já usado em `crm_interacoes`), `telefone_destino`, `direcao`,
`conteudo`, `status`, `erro_mensagem`, `usuario_id`, `created_at`.

## 6. Constraints

`conteudo`/`telefone_destino` não vazios; `num_nonnulls(contato_id, lead_id) <= 1` (mensagem pode
não ter vínculo — número avulso — mas nunca os dois ao mesmo tempo).

## 7. Índices

`farmacia_id`, `(farmacia_id, status)`, `usuario_id`, e parciais em `contato_id`/`lead_id`.

## 8. RLS

| Política | Regra |
|---|---|
| `whatsapp_mensagens_select` | `farmacia_id` + `pode_ver` |
| `whatsapp_mensagens_insert` | `farmacia_id` explícito + `pode_editar` |
| `whatsapp_mensagens_update` | `pode_editar` (USING) + `farmacia_id` (WITH CHECK) |
| — | Sem DELETE — preserva histórico |

## 9. Triggers/Funções

- `proteger_identidade_whatsapp_mensagem()` (nova) — `farmacia_id`/`usuario_id` sempre de
  `auth_farmacia_id()`/`auth.uid()`, imutáveis; `contato_id`/`lead_id` validados cross-tenant
- `checar_transicao_whatsapp_mensagem()` (nova) — INSERT só nasce `pendente` ou `indisponivel`;
  progressão `pendente → enviada → entregue → lida`, sem saltos
- `trg_auditoria_whatsapp_mensagens` (reaproveita `registrar_auditoria()`)

Nenhuma função nova é `SECURITY DEFINER`; `search_path=public` explícito em ambas.

## 10. RBAC

Reaproveita exclusivamente `permissoes` (módulo `whatsapp` já semeado desde a migration 001).

## 11. Integrações

Vínculo opcional com CRM e Leads (validado cross-tenant). Tela de status lê a tabela `integracoes`
já existente. Nenhuma chamada real à API do WhatsApp.

## 12. Frontend

`constants.js`, `service.js`, `WhatsAppPage.jsx` — status de conexão, formulário de registro de
mensagem (seleção opcional de contato/lead, telefone preenchido automaticamente), histórico.
Estados de loading/vazio/erro presentes. Botão de envio só aparece com `pode_editar`.

## 13. Dashboard

Revisado por completo (não só o card novo): subtítulo e lista "O que já funciona" corrigidos para
incluir Leads (que já estava faltando desde o Sprint 9 — achado B1 da auditoria combinada 8+9) e
WhatsApp. Card "Mensagens WhatsApp" adicionado com contagem real.

## 14. Auditoria

`logs_auditoria` reaproveitado sem alteração. Testado: INSERT gera log completo e correto.

## 15. Testes

Testes internos (sem auditoria independente nesta rodada, conforme instruído):

| # | Categoria | Resultado |
|---|---|---|
| 1 | CRUD válido | PASSOU |
| 2/3 | RLS + SELECT cross-tenant | PASSOU |
| 4/6 | INSERT forjando `farmacia_id` | PASSOU (sobrescrito) |
| 7 | Forjamento de `usuario_id` | PASSOU (sobrescrito) — corrigido: o teste original esperava exceção; o comportamento correto é sobrescrita silenciosa (mesmo padrão dos outros módulos). Reexecutei separadamente confirmando o valor real gravado antes de contabilizar. |
| 5 | UPDATE cross-tenant | PASSOU (bloqueado) |
| — | DELETE físico (sem policy) | PASSOU (bloqueado) |
| 8 | Vínculos cross-tenant | PASSOU (bloqueado) |
| 9 | FKs/constraints (dois vínculos, sem vínculo, conteúdo vazio, UUID inexistente) | PASSOU |
| 10 | RBAC | PASSOU (bloqueado) |
| 11 | Máquina de estados (criação inválida, avanço completo, salto, 2 terminais) | PASSOU |
| — | Identidade imutável após criação | PASSOU (bloqueado) |
| 12 | Auditoria | PASSOU |
| 13 | Regressão (CRM/Leads intactos) | PASSOU |
| — | Limpeza | PASSOU |

**26/26 verificações passaram** (25 da bateria principal + 1 reteste do item 7, corrigido antes de
ser contabilizado, conforme instruído).

## 16. Build

`npm run build` — sucesso, 116 módulos, sem erros. Bundle segue >500KB (pendência conhecida desde
o Sprint 7, não é regressão desta sprint).

## 17. Security Advisors

Idênticos aos 3 avisos pré-existentes. Nenhum novo.

## 18. Regressão

Testado diretamente: UPDATE em contato CRM e lead existentes, ambos confirmados intactos. Nenhuma
tabela/política/trigger de sprints anteriores foi tocada pela migration 017.

## 19. Pendências

- Registrar um adaptador real quando houver credencial oficial — arquitetura já pronta
- Recebimento de mensagens (webhook) — arquitetura já contempla no schema, sem endpoint real
- Bundle >500KB — code-splitting recomendado

## 20. Limitações

- Nenhum envio real acontece — toda mensagem fica `indisponivel`, conforme instruído
- Tela de configuração de credencial não foi construída nesta sprint (só leitura de status)

## 21. Arquivos criados/alterados

**Criados:** `supabase/migrations/017_modulo_whatsapp.sql`, `src/modules/whatsapp/constants.js`,
`service.js`, `WhatsAppPage.jsx`, `RELATORIO_SPRINT_10.md`

**Alterados:** `src/App.jsx` (+rota), `src/components/Layout.jsx` (+mapeamento),
`src/pages/Dashboard.jsx` (card novo + correção completa de subtítulo/lista, incluindo o débito
de Leads deixado pelo Sprint 9)

**Reaproveitados sem alteração:** `src/lib/integracoes/AdaptadorIntegracao.js` (Sprint 1), tabela
`integracoes` (Sprint 1)

## 22. Conclusão

Migration aplicada e testada, 26/26 verificações passando, build limpo, nenhum novo aviso de
segurança, nenhuma regressão. Dashboard revisado por completo, incluindo a correção de um débito
de sprint anterior. Sprint 11 não foi iniciada. Nenhum commit ou push foi feito.

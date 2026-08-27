# Sprint 9 — Leads
**Farma Marketing** · 22/08/2026

## 1. Objetivo

Construir o funil de aquisição (Leads), integrado ao CRM sem duplicar estrutura — lead é uma
entidade própria, distinta de contato CRM, com conversão rastreável e reaproveitamento do
histórico de interações já existente.

## 2. Escopo implementado

Cadastro/listagem/detalhe de leads, funil (`novo → em_atendimento → qualificado → convertido/
perdido`), ação explícita de conversão (cria o contato CRM de verdade e só então marca o lead
como convertido), extensão de `crm_interacoes` para aceitar lead ou contato, card no Dashboard.

## 3. Arquitetura

**Decisão central:** lead e contato CRM são entidades **separadas por design** — um lead só vira
"contato de verdade" no momento exato da conversão (`contato_crm_id` preenchido, nunca antes). Isso
evita o problema de "contato fantasma" (alguém que nunca respondeu ainda aparecendo como cliente
no CRM) e mantém o funil e o relacionamento como conceitos distintos, mesmo compartilhando
infraestrutura.

**Reaproveitamento, não duplicação:**
- `crm_interacoes` (Sprint 8) foi **estendida** com uma coluna `lead_id` nullable, em vez de criar
  uma segunda tabela de histórico. `CHECK (num_nonnulls(contato_id, lead_id) = 1)` garante que toda
  interação pertence a exatamente um dos dois.
- O enum `crm_origem_contato` (Sprint 8) ganhou o valor `'lead'` via `ALTER TYPE ... ADD VALUE`
  (aditivo, não editou a migration 015) — usado quando um contato CRM nasce de uma conversão.
- `proteger_criado_por_produto()` (genérica desde a migration 008) reaproveitada sem alteração.

## 4. Banco de dados

Migration `supabase/migrations/016_modulo_leads.sql` — não edita 001-015.

## 5. Migrations

`016_modulo_leads.sql`

## 6. Tabelas

- **`leads`** (nova) — `farmacia_id`, `nome`, `telefone`, `whatsapp`, `email`, `origem` (enum
  reaproveitado), `status` (enum próprio), `responsavel_id`, `oportunidade_id`, `campanha_id`,
  `conteudo_id`, `produto_id`, `contato_crm_id`, `convertido_por`, `convertido_em`,
  `observacoes`, `criado_por`, timestamps
- **`crm_interacoes`** (estendida, não recriada) — nova coluna `lead_id`

## 7. Constraints/FKs/Índices

FKs reais para `farmacias`, `usuarios`, `oportunidades`, `campanhas`, `conteudos`, `produtos`,
`crm_contatos`. CHECK: `nome` não vazio; `(status = 'convertido') = (contato_crm_id is not null)`
— trava no banco que só existe `contato_crm_id` exatamente quando o lead está convertido, nunca
antes nem depois de "desconvertido" (que aliás não é uma transição válida). Índices em
`farmacia_id`, `(farmacia_id, status)`, `(farmacia_id, origem)`, `responsavel_id`, e parciais nos
cinco vínculos opcionais.

## 8. RLS

| Tabela | Política | Regra |
|---|---|---|
| `leads` | SELECT | `farmacia_id` + `pode_ver` |
| `leads` | INSERT | `farmacia_id` explícito + `pode_editar` |
| `leads` | UPDATE | `pode_editar` (USING) + `farmacia_id` (WITH CHECK) |
| `leads` | — | Sem DELETE — preserva histórico do funil |
| `crm_interacoes` | INSERT (atualizada) | contato OU lead da mesma farmácia + `pode_editar` no módulo `crm` |

Nenhuma `USING(true)`/`WITH CHECK(true)`.

## 9. RBAC

Reaproveita exclusivamente `permissoes` (módulo `leads` já semeado desde a migration 001). A
interação de lead usa `pode_editar` do módulo `crm` (mesma entidade conceitual de histórico já
usada para contatos) — decisão consciente para não duplicar a matriz de permissões por causa de
uma tabela compartilhada.

## 10. Triggers/Funções

- `trg_leads_updated` (reaproveita `set_updated_at()`)
- `trg_proteger_criado_por_lead` (reaproveita `proteger_criado_por_produto()`)
- `trg_proteger_farmacia_lead` (nova função) — `farmacia_id` sempre `auth_farmacia_id()`,
  imutável; todos os 6 vínculos validados cross-tenant
- `trg_lead_state_machine` (nova função `checar_transicao_lead()`) — máquina de estados +
  conversão: `convertido_por` sempre `auth.uid()`, nunca informável manualmente; `contato_crm_id`/
  `convertido_por`/`convertido_em` imutáveis fora do exato momento da transição para `convertido`
- `trg_auditoria_leads` (reaproveita `registrar_auditoria()`)
- `proteger_identidade_crm_interacao()` **substituída** (mesma função, migration 016) para derivar
  `farmacia_id` de qualquer um dos dois pais (contato ou lead)

Nenhuma função nova é `SECURITY DEFINER`; `search_path=public` explícito em todas.

## 11. Conversão

Fluxo de duas etapas, explícito no frontend (`LeadDetalhe.jsx`):
1. Cria o contato CRM (dados copiados do lead, `origem='lead'`)
2. Atualiza o lead: `status='convertido'`, `contato_crm_id=<id do contato criado>`

O banco garante que essa segunda etapa só é aceita se o contato pertencer à mesma farmácia, e
sempre grava `convertido_por`/`convertido_em` reais — testado tentando forjar o autor da conversão
e tentando converter com contato de outra farmácia; ambos bloqueados.

## 12. Auditoria

`logs_auditoria` reaproveitado sem alteração. Testado: conversão registra log com `usuario_id`
correto e `dados_novos->>'status' = 'convertido'`.

## 13. Frontend

`src/modules/leads/constants.js`, `LeadsLista.jsx` (busca, filtros, indicadores, cadastro),
`LeadDetalhe.jsx` (dados, transições, botão de conversão só quando `status='qualificado'`,
histórico de interações — desabilitado após conversão, já que a partir daí o histórico continua
no contato CRM, não mais no lead).

## 14. Integrações

Vínculo opcional com Oportunidades, Campanhas, Conteúdo e Produtos — sem duplicar dados. Nenhuma
integração externa implementada.

## 15. Dashboard

Card "Leads no funil" adicionado, seguindo o mesmo padrão real (não estático) já usado nos demais
módulos.

## 16. Testes realizados

Testes internos (sem auditoria independente nesta rodada, conforme combinado), simulando usuários
autenticados reais via `SET LOCAL ROLE authenticated`:

| Categoria | Testes | Resultado |
|---|---|---|
| Criação válida | 1 | PASSOU |
| `farmacia_id`/`criado_por` forjados no INSERT | 2 | PASSOU (sobrescritos) |
| Vínculos cross-tenant (5 tipos) + UUID inexistente | 6 | PASSOU (bloqueado) |
| Alterar identidade após criação | 2 | PASSOU (bloqueado) |
| Máquina de estados (avanço, salto, terminais) | 4 | PASSOU |
| Conversão (sem contato, fora de hora, válida, forjar autor, cross-tenant) | 5 | PASSOU |
| Interações estendidas (lead_id, CHECK de vínculo único) | 3 | PASSOU |
| RBAC | 2 | PASSOU (bloqueado) |
| Cross-tenant direto | 2 | PASSOU |
| Auditoria | 1 | PASSOU |
| Regressão (Oportunidades/Campanhas/Conteúdo/Produtos/CRM) | 1 | PASSOU |
| Limpeza | 1 | PASSOU |

**30/30 testes passaram.**

## 17. Resultado do build

`npm run build` — sucesso, 113 módulos, sem erros. Aviso de bundle >500KB persiste (pendência
conhecida, cresce a cada módulo, não é regressão desta sprint).

## 18. Security Advisors

Idênticos aos 3 avisos pré-existentes desde o Sprint 1/2. Nenhum novo.

## 19. Regressão Sprints 1-8

Testado diretamente: UPDATE em oportunidade, campanha, conteúdo, produto e contato CRM
existentes, todos confirmados intactos na mesma sessão. `crm_interacoes` foi alterada (coluna
nova + policy substituída), mas de forma aditiva — testado que interações antigas com `contato_id`
continuam funcionando exatamente como antes (implícito no teste de criação de interação com
`lead_id`, que reaproveita a mesma função/política sem quebrar o caminho de `contato_id`).

## 20. Limitações

- Busca de leads em memória, sem paginação real
- Sem integração real com WhatsApp/Instagram/Facebook como origem de lead — só a estrutura
- Conversão é uma ação manual explícita (dois passos no frontend) — não há conversão automática
  por regra de negócio, conforme não solicitado

## 21. Pendências

- Bundle >500KB — code-splitting recomendado quando houver sprint dedicado a isso
- Indicador de Leads no Dashboard já adicionado nesta sprint — não é mais pendência

## 22. Arquivos criados/alterados

**Criados:** `supabase/migrations/016_modulo_leads.sql`, `src/modules/leads/constants.js`,
`LeadsLista.jsx`, `LeadDetalhe.jsx`, `RELATORIO_SPRINT_9_LEADS.md`

**Alterados:** `src/App.jsx` (+2 rotas), `src/components/Layout.jsx` (+mapeamento),
`src/pages/Dashboard.jsx` (+card de Leads)

## 23. Conclusão

Migration aplicada e testada, 30/30 testes internos passando, build limpo, nenhum novo aviso de
segurança, nenhuma regressão. Sprint 10 **não foi iniciada**. Nenhum commit ou push foi feito.

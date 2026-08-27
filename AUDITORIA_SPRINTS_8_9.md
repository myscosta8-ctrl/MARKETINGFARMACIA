# Auditoria Independente — Sprints 8 e 9 (CRM e Leads)
**Farma Marketing** · 22/08/2026

## 1. Escopo

Auditoria técnica e de segurança combinada dos Sprints 8 (CRM) e 9 (Leads): migrations
`015_modulo_crm.sql` e `016_modulo_leads.sql`, tabelas `crm_contatos`, `crm_interacoes`, `leads`,
e especialmente o ponto de integração entre os dois módulos (conversão de lead em contato,
histórico compartilhado) — onde erros de dois sprints construídos em sequência mais provavelmente
apareceriam. Nenhuma alteração foi feita — só investigação, teste e classificação.

## 2. Metodologia

- Inspeção direta do schema real no banco de produção.
- 12 testes SQL novos, escritos nesta auditoria, com foco deliberado nos vetores de ataque
  específicos da integração CRM↔Leads: conversão usando contato de outra farmácia, escrita de
  interação em lead/contato de outra farmácia.
- Tentativa de invocar as funções trigger novas diretamente via SQL.
- `npm run build` e Security Advisors reexecutados de forma independente.
- Revisão de código do frontend e do `Dashboard.jsx`.

## 3. Banco analisado

Projeto Supabase `farma-marketing` (`ylboxdybkcpeusgrymkv`), estado atual de produção.

---

## 4. Achados positivos 🟢

- Schema real de `crm_contatos`, `crm_interacoes` e `leads` idêntico ao declarado nas migrations.
- Teste crítico específico desta auditoria: tentei converter um lead da Farmácia B usando
  `contato_crm_id` de um contato da Farmácia A — bloqueado corretamente pela trigger
  `proteger_farmacia_lead()`.
- Teste crítico específico desta auditoria: tentei registrar `crm_interacoes` num lead e num
  contato de outra farmácia (dois vetores de escrita cross-tenant, já que a tabela agora aceita
  dois tipos de pai). Ambos bloqueados.
- SELECT/UPDATE cross-tenant testados nas 3 tabelas — todos bloqueados.
- Fluxo completo de conversão legítima testado do zero ao fim — `origem='lead'` corretamente
  registrada, `convertido_por` correto, interação pós-conversão registrada no contato.
- Auditoria confirmada nas 3 tabelas simultaneamente numa única consulta.
- Nenhuma função nova é `SECURITY DEFINER`; `search_path=public` explícito em todas as 5 funções
  conferidas.
- Nenhuma função invocável via RPC direto.
- Build limpo, 113 módulos, sem imports quebrados.
- Frontend nunca envia campos de identidade/conversão manualmente.
- Dashboard: cards de CRM e Leads com dados reais; textos antigos corrigidos (Sprints 6/7) seguem
  corretos.

## 5. Achados críticos 🔴

Nenhum.

## 6. Achados altos 🟠

Nenhum.

## 7. Achados médios 🟡

Nenhum.

## 8. Achados baixos 🔵

**B1 — Subtítulo e lista "O que já funciona" do Dashboard não mencionam Leads.**
O card de "Leads no funil" foi adicionado corretamente, mas o texto
`"Campanhas, Produtos, Calendário, Conteúdo, Oportunidades, IA e CRM disponíveis"` e a lista de
bullets não foram atualizados para incluir Leads. Mesmo tipo de achado (B1) já apontado nas
auditorias dos Sprints 6 e 7, agora nascido já na própria Sprint 9. Terceira ocorrência — sugiro
tratar como item de processo (checklist ao final de cada sprint que adiciona módulo).

**B2 — FK de `crm_interacoes.lead_id` sem `ON DELETE CASCADE`, diferente de `contato_id`.**
`contato_id` tem `ON DELETE CASCADE`; `lead_id` não tem. Como não existe DELETE em nenhuma das
tabelas-mãe, isso é hoje inalcançável — inconsistência de schema, não risco ativo.

---

## 9. Segurança multi-tenant

Testado com dois usuários reais de farmácias diferentes, incluindo os dois vetores de ataque
específicos da integração entre os módulos. Nenhum vazamento encontrado.

## 10. RLS

Confirmado: sem política de DELETE nas 3 tabelas. `crm_interacoes_insert` corretamente valida
contato OU lead (nunca ambos, nunca nenhum) contra a farmácia do usuário.

## 11. Máquina de estados e conversão

Confirmado que a conversão só é aceita com `contato_crm_id` da mesma farmácia, que
`convertido_por`/`convertido_em` nunca são informáveis manualmente, e que o CHECK
`(status='convertido') = (contato_crm_id is not null)` está de fato no banco.

## 12. Auditoria

`logs_auditoria` confirmado correto simultaneamente nas 3 tabelas numa única consulta.

## 13. Frontend

Nenhum dos dois módulos envia campos de identidade/conversão manualmente. Nenhum componente
duplicado, nenhum import quebrado.

## 14. Regressão

Build confirma que a extensão de `crm_interacoes` (Sprint 9) não quebrou o caminho de
`contato_id` já usado pelo CRM (Sprint 8).

## 15. Security Advisors

Idênticos aos 3 avisos pré-existentes. Nenhum novo.

## 16. Build

`npm run build` — sucesso, 113 módulos, sem erros.

## 17. Testes independentes

**12/12 testes escritos nesta auditoria passaram**, com foco deliberado na integração entre os
dois sprints. Dois erros de sintaxe no meu próprio script (variável fora de escopo) foram
corrigidos antes da execução final — não revelaram problema no sistema.

## 18. Comparação com os relatórios das Sprints 8 e 9

| Afirmação | Classificação |
|---|---|
| "32/32 testes" (Sprint 8) e "30/30 testes" (Sprint 9) | CONFIRMADO |
| Nenhuma função nova é `SECURITY DEFINER` | CONFIRMADO |
| Sem política de DELETE em nenhuma das 3 tabelas | CONFIRMADO |
| Conversão preserva rastreabilidade | CONFIRMADO, testado contra tentativa cross-tenant |
| `crm_interacoes` estendida, não duplicada | CONFIRMADO |
| Dashboard corrigido (Sprint 8) | CONFIRMADO, mas ver B1 sobre omissão de Leads |
| Security Advisors sem novidade | CONFIRMADO |
| Build sem erros | CONFIRMADO |

Nenhuma afirmação foi classificada como PARCIALMENTE CONFIRMADO, NÃO CONFIRMADO ou INCORRETO.

## 19. Pendências

1. B1 — atualizar subtítulo/lista do Dashboard para incluir Leads (terceira ocorrência do padrão).
2. B2 — considerar `ON DELETE CASCADE` em `crm_interacoes.lead_id` por consistência (não é risco
   ativo hoje).
3. Pendência de bundle >500KB permanece válida.

## 20. Veredito final

# APROVADOS (Sprints 8 e 9)

Nenhum achado crítico, alto ou médio foi encontrado em nenhum dos dois sprints, nem no ponto de
integração entre eles — foco principal desta auditoria combinada. Os dois vetores de ataque mais
específicos desta integração (conversão cross-tenant e escrita de interação cross-tenant) foram
testados especificamente e bloqueados corretamente pelo banco. Os dois achados baixos são
cosméticos/estruturais sem exploração possível hoje. Sprints 8 e 9 podem ser consideradas
aprovadas sem ressalvas de segurança.

# Relatório — Sprint 12: Facebook
**Farma Marketing** · 22/08/2026

## 1. Objetivo

Implementar o módulo Facebook do roadmap, seguindo exatamente o padrão arquitetural já validado
no Instagram (Sprint 11): publicação de Conteúdo já existente, sem inventar integração real e sem
duplicar estrutura.

## 2. Escopo

Registro de tentativas de publicação de Conteúdos marcados com o canal Facebook, histórico com
métricas nunca fabricadas, tela de status de conexão, revisão completa do Dashboard.

## 3. Arquivos criados/alterados

**Criados:** `supabase/migrations/019_modulo_facebook.sql`, `src/modules/facebook/constants.js`,
`service.js`, `FacebookPage.jsx`, `RELATORIO_SPRINT_12.md`

**Alterados:** `src/App.jsx` (+rota), `src/components/Layout.jsx` (+mapeamento),
`src/pages/Dashboard.jsx` (revisão completa, card novo)

## 4. Migration criada

`supabase/migrations/019_modulo_facebook.sql` — não edita 001-018.

## 5. Tabelas/colunas

`facebook_publicacoes` (única tabela nova) — `id`, `farmacia_id`, `conteudo_id`, `status`,
`link_publicado`, `curtidas`, `comentarios`, `alcance`, `erro_mensagem`, `usuario_id`,
`created_at`, `updated_at`. Estrutura idêntica a `instagram_publicacoes` (Sprint 11).

## 6. Triggers

- `trg_facebook_publicacoes_updated` (reaproveita `set_updated_at()`)
- `trg_proteger_identidade_facebook_publicacao` (nova, mesmo padrão da versão Instagram)
- `trg_facebook_publicacao_state_machine` (nova, mesmo padrão)
- `trg_auditoria_facebook_publicacoes` (reaproveita `registrar_auditoria()`)

## 7. FKs

`farmacia_id → farmacias`, `conteudo_id → conteudos`, `usuario_id → usuarios`.

## 8. Constraints

`link_publicado` obrigatório quando `status='publicada'`; métricas nunca negativas.

## 9. Índices

`farmacia_id`, `(farmacia_id, status)`, `conteudo_id`, `usuario_id`.

## 10. RLS

| Política | Regra |
|---|---|
| `facebook_publicacoes_select` | `farmacia_id` + `pode_ver` |
| `facebook_publicacoes_insert` | `farmacia_id` explícito + `pode_editar` |
| `facebook_publicacoes_update` | `pode_editar` (USING) + `farmacia_id` (WITH CHECK) |
| — | Sem DELETE — preserva histórico |

Nenhuma `USING(true)`/`WITH CHECK(true)`.

## 11. RBAC

Reaproveita exclusivamente `permissoes` (módulo `facebook` já semeado desde a migration 001).

## 12. Máquina de estados

```
pendente → publicada | erro | indisponivel
publicada → (terminal)
erro → (terminal)
indisponivel → (terminal)
```
INSERT só nasce `pendente` ou `indisponivel`.

## 13. Auditoria

`logs_auditoria` reaproveitado sem alteração.

## 14. Integrações

`conteudo_id` obrigatório, validado cross-tenant e contra a presença real do canal Facebook em
`conteudo_canais` (Sprint 5) — mesmo mecanismo já usado pelo Instagram, testado também em conjunto
(um mesmo conteúdo marcado com os dois canais simultaneamente, sem conflito).

## 15. Frontend

`constants.js`, `service.js`, `FacebookPage.jsx` — lista de conteúdos elegíveis, ação de publicar,
histórico. Mesmo padrão visual e funcional do módulo Instagram.

## 16. Dashboard

Revisado por completo (não só o card novo): subtítulo e lista "O que já funciona" atualizados
para incluir Facebook. Card "Publicações Facebook" com contagem real.

## 17. Testes realizados

| Categoria | Resultado |
|---|---|
| INSERT/SELECT válidos | PASSOU |
| Integração: conteúdo sem canal Facebook | PASSOU (bloqueado) |
| DELETE (sem policy) | PASSOU (bloqueado) |
| SELECT/UPDATE cross-tenant | PASSOU (bloqueado) |
| INSERT forjando `farmacia_id` | PASSOU (sobrescrito) |
| `conteudo_id` de outra farmácia / inexistente | PASSOU (bloqueado) |
| CHECK constraints (link obrigatório, métricas negativas) | PASSOU |
| Criação direta em estado proibido | PASSOU (bloqueado) |
| Identidade imutável após criação | PASSOU (bloqueado) |
| RBAC | PASSOU (bloqueado) |
| Auditoria | PASSOU |
| Estado terminal `publicada` não permite saída | PASSOU (bloqueado) |
| Regressão completa (Conteúdo, WhatsApp/S10, Instagram/S11, CRM, Leads) | PASSOU |
| Limpeza | PASSOU |

## 18. Resultado dos testes

**Quantidade total:** 20 (bateria final, válida)
**Aprovados:** 20
**Reprovados:** 0
**Descartados/reexecutados:** 1 bateria completa foi descartada e reexecutada — o teste de
regressão original tentou inserir em `instagram_publicacoes` usando um conteúdo que só tinha o
canal `facebook` marcado, e a trigger de integridade do Instagram (Sprint 11) corretamente
rejeitou — isso não foi falha do sistema, foi erro no meu script de teste (faltava marcar o
conteúdo também com canal `instagram`). Corrigi o script e reexecutei a bateria inteira antes de
contabilizar qualquer resultado.

## 19. Regressão dos módulos anteriores

Testado diretamente: `descricao` de conteúdo existente, inserção em `whatsapp_mensagens` (Sprint
10), inserção em `instagram_publicacoes` (Sprint 11) no mesmo conteúdo agora com os dois canais,
`crm_contatos` e `leads` — todos funcionando na mesma sessão. Migrations 001-018 confirmadas
intactas (só `CREATE` novo na migration 019).

## 20. Security Advisors

Idênticos aos 3 avisos pré-existentes. Nenhum novo.

## 21. Build

`npm run build` — sucesso, 122 módulos, sem erros, sem imports quebrados. Bundle segue >500KB
(pendência conhecida, não é regressão desta sprint).

## 22. Limitações/pendências

- Nenhuma publicação real acontece — toda tentativa fica `indisponivel`
- Métricas ficam permanentemente `null` até haver integração real
- Registrar um adaptador real quando houver credencial oficial
- Bundle >500KB — code-splitting recomendado

## 23. Decisões arquiteturais importantes

- Reaproveitamento estrutural máximo: `facebook_publicacoes` é estruturalmente idêntica a
  `instagram_publicacoes` — mesma decisão de design, mesmas métricas, mesma máquina de estados.
  Não criei uma abstração genérica "publicacoes_redes_sociais" única porque exigiria uma coluna de
  "provedor" discriminando o tipo, complicando RLS/triggers sem ganho real — duas tabelas simples
  e paralelas são mais fáceis de auditar.
- Usei o teste de regressão desta sprint para confirmar ativamente que a integridade de canal do
  Instagram continua valendo mesmo depois da Sprint 12 mexer na mesma tabela `conteudo_canais`
  (compartilhada entre os dois módulos).

## 24. Confirmação

Sprint 13 não foi iniciada. Nenhum git add/commit/push foi executado por mim.

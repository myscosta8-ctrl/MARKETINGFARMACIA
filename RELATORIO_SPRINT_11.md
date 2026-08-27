# Relatório — Sprint 11: Instagram
**Farma Marketing** · 22/08/2026

## 1. Objetivo

Implementar o módulo Instagram do roadmap, complementando a fundação existente sem dívida técnica
desnecessária: sem credencial oficial (Meta Business), a publicação real não pode existir — a
arquitetura deve estar pronta, o histórico deve ser real, e nenhuma métrica pode ser inventada.

## 2. Escopo

Registro de tentativas de publicação de Conteúdos já marcados com o canal Instagram (Sprint 5),
histórico com métricas nunca fabricadas, tela de status de conexão, e revisão completa do
Dashboard.

## 3. Estado inicial analisado

Migrations 001-017 lidas. Confirmado: módulo `instagram` já semeado em `modulos`/`permissoes`
desde a migration 001; tabela `integracoes` (Sprint 1) já cobre status de conexão do provedor
`instagram`; `AdaptadorIntegracao.js` (Sprint 1) é a interface a implementar quando houver
credencial; `conteudo_canais` (Sprint 5) já modela quais conteúdos estão marcados para qual canal.

## 4. Arquitetura adotada

Decisão central: uma publicação no Instagram é sempre a publicação de um Conteúdo que já existe —
nunca um texto/mídia novo e paralelo. `instagram_publicacoes.conteudo_id` é obrigatório (diferente
de `whatsapp_mensagens`, que aceita número avulso), e uma trigger valida que o conteúdo
referenciado já está marcado com `canal='instagram'` em `conteudo_canais` antes de aceitar a
publicação — reaproveitando a estrutura do Sprint 5 em vez de duplicar o conceito de canal.

Mesma camada de serviço já usada em IA/WhatsApp: sem provedor configurado, registra a tentativa
como `indisponivel`, nunca fabrica link ou métricas.

## 5. Funcionalidades implementadas

- Lista de conteúdos elegíveis (marcados com canal Instagram, sem tentativa de publicação ainda)
- Ação de publicar (registra a tentativa; hoje sempre fica `indisponivel`)
- Histórico com status, link (quando houver), métricas (quando houver) e autor
- Status de conexão lido de `integracoes`

## 6. Migration

`supabase/migrations/018_modulo_instagram.sql` — não edita 001-017.

## 7. Tabelas

`instagram_publicacoes` (única tabela nova).

## 8. Colunas

`id`, `farmacia_id`, `conteudo_id`, `status`, `link_publicado`, `curtidas`, `comentarios`,
`alcance`, `erro_mensagem`, `usuario_id`, `created_at`, `updated_at`.

## 9. Constraints

`link_publicado` obrigatório quando `status='publicada'`; métricas nunca negativas quando
preenchidas.

## 10. FKs

`farmacia_id → farmacias`, `conteudo_id → conteudos`, `usuario_id → usuarios`.

## 11. Índices

`farmacia_id`, `(farmacia_id, status)`, `conteudo_id`, `usuario_id`.

## 12. RLS

| Política | Regra |
|---|---|
| `instagram_publicacoes_select` | `farmacia_id` + `pode_ver` |
| `instagram_publicacoes_insert` | `farmacia_id` explícito + `pode_editar` |
| `instagram_publicacoes_update` | `pode_editar` (USING) + `farmacia_id` (WITH CHECK) |
| — | Sem DELETE — preserva histórico |

## 13. Policies

Detalhadas no item 12. Nenhuma `USING(true)`/`WITH CHECK(true)`.

## 14. Triggers

- `trg_instagram_publicacoes_updated` (reaproveita `set_updated_at()`)
- `trg_proteger_identidade_instagram_publicacao` (nova) — identidade + integridade de canal
- `trg_instagram_publicacao_state_machine` (nova) — máquina de estados
- `trg_auditoria_instagram_publicacoes` (reaproveita `registrar_auditoria()`)

## 15. Funções

`proteger_identidade_instagram_publicacao()` e `checar_transicao_instagram_publicacao()` — ambas
novas, nenhuma `SECURITY DEFINER`, `search_path=public` explícito, funções trigger não invocáveis
diretamente por design do Postgres.

## 16. Máquina de estados

```
pendente → publicada | erro | indisponivel
publicada → (terminal)
erro → (terminal)
indisponivel → (terminal)
```
INSERT só nasce `pendente` ou `indisponivel`.

## 17. RBAC

Reaproveita exclusivamente `permissoes` (módulo `instagram` já semeado).

## 18. Auditoria

`logs_auditoria` reaproveitado sem alteração.

## 19. Integrações

`conteudo_id` validado cross-tenant e contra a presença real do canal Instagram em
`conteudo_canais`. Nenhuma duplicação de texto/mídia do Conteúdo.

## 20. Frontend

`src/modules/instagram/constants.js`, `service.js`, `InstagramPage.jsx`.

## 21. Dashboard

Revisado por completo novamente (não só o card novo, seguindo a exigência explícita desta
sprint): subtítulo e lista "O que já funciona" atualizados para incluir Instagram. Card
"Publicações Instagram" com contagem real.

## 22. Rotas

`/instagram`.

## 23. Testes

Testes internos (sem auditoria independente nesta rodada, conforme instruído):

| Categoria | Resultado |
|---|---|
| INSERT/SELECT válidos | PASSOU |
| Integração específica: conteúdo sem canal Instagram | PASSOU (bloqueado) |
| DELETE (sem policy) | PASSOU (bloqueado) |
| SELECT/UPDATE cross-tenant | PASSOU (bloqueado) |
| INSERT forjando `farmacia_id` | PASSOU (sobrescrito) |
| `conteudo_id` de outra farmácia / inexistente | PASSOU (bloqueado) |
| CHECK constraints (link obrigatório, métricas negativas) | PASSOU |
| RBAC | PASSOU (bloqueado) |
| Máquina de estados (criação inválida, transição válida, 2 terminais) | PASSOU |
| Identidade imutável após criação | PASSOU (bloqueado) |
| Auditoria | PASSOU |
| Regressão (Conteúdo, WhatsApp, CRM, Leads) | PASSOU |
| Limpeza | PASSOU |

**Quantidade total de testes executados na bateria principal:** 24 (23 válidos + 1 com erro no
próprio script).

**Erro de script identificado:** o teste "estado terminal `publicada` não permite saída" usava uma
variável (`v_pub_fluxo`) declarada num bloco `DECLARE` anterior que já havia saído de escopo — o
erro resultante ("column does not exist") não é uma falha de segurança, é erro de sintaxe do meu
script. Identifiquei, descartei esse resultado, escrevi um teste novo isolando exatamente esse
cenário, e reexecutei — confirmando o comportamento correto (bloqueado).

**Quantidade aprovada (contagem final válida):** 24 (23 da bateria original + 1 reteste correto)
**Quantidade reprovada:** 0
**Quantidade retestada por erro de script:** 1

## 24. Regressão

Testado diretamente: `descricao` de um conteúdo existente, uma mensagem de WhatsApp (Sprint 10),
um contato CRM e um lead — todos criados/atualizados com sucesso na mesma sessão.

## 25. Build

`npm run build` — sucesso, 119 módulos, sem erros. Bundle segue >500KB (pendência conhecida, não é
regressão desta sprint).

## 26. Security Advisors

Idênticos aos 3 avisos pré-existentes. Nenhum novo.

## 27. Arquivos criados

`supabase/migrations/018_modulo_instagram.sql`, `src/modules/instagram/constants.js`, `service.js`,
`InstagramPage.jsx`, `RELATORIO_SPRINT_11.md`

## 28. Arquivos alterados

`src/App.jsx` (+rota), `src/components/Layout.jsx` (+mapeamento), `src/pages/Dashboard.jsx`
(revisão completa, card novo)

## 29. Pendências

- Registrar um adaptador real quando houver credencial oficial
- Sincronização de métricas reais — arquitetura já pronta, sem endpoint real ainda
- Bundle >500KB — code-splitting recomendado

## 30. Limitações

- Nenhuma publicação real acontece — toda tentativa fica `indisponivel`, conforme instruído
- Métricas ficam permanentemente `null` até haver integração real

## 31. Conclusão

Migration aplicada e testada, 24 verificações finais válidas passando (0 reprovadas, 1 corrigida
por erro de script antes de ser contabilizada), build limpo, nenhum novo aviso de segurança,
nenhuma regressão em Conteúdo, WhatsApp, CRM ou Leads. Dashboard revisado por completo. Sprint 12
não foi iniciada. Nenhum git add/commit/push foi executado.

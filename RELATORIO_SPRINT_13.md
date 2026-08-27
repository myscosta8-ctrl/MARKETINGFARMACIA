# Relatório — Sprint 13: Anúncios
**Farma Marketing** · 22/08/2026

## 1. Escopo

Módulo de gestão de anúncios pagos: planejamento, fluxo de aprovação (admin-only, regra herdada
do Sprint 1), e tentativa honesta de ativação (sem credencial real, nunca finge que um anúncio
está no ar). Confirmei antes de começar que, entre os módulos do catálogo, só `analytics` seguia
com `disponivel=false` além de `anuncios` — Anúncios era de fato a próxima peça correta.

## 2. Objetivo

Implementar a Sprint 13 reaproveitando ao máximo a arquitetura já consolidada: um anúncio é
sempre a execução paga de uma Campanha já existente, com o mesmo padrão de aprovação já usado em
Campanhas — e usando uma regra de permissão que já existia desde o Sprint 1 e nunca tinha sido
exercida: `gestor` tem `pode_aprovar=false` especificamente no módulo `anuncios`.

## 3. Arquivos criados/alterados

**Criados:** `supabase/migrations/020_modulo_anuncios.sql`, `src/modules/anuncios/constants.js`,
`service.js`, `AnunciosLista.jsx`, `RELATORIO_SPRINT_13.md`

**Alterados:** `src/App.jsx` (+rota), `src/components/Layout.jsx` (+mapeamento),
`src/pages/Dashboard.jsx` (revisão completa, card novo)

## 4. Migration criada

`supabase/migrations/020_modulo_anuncios.sql` — não edita 001-019. Aplicada e confirmada no banco
de produção (schema real conferido coluna a coluna após aplicação).

## 5. Tabelas/estruturas criadas ou alteradas

`anuncios` (única tabela nova) — `farmacia_id`, `campanha_id` (obrigatório), `produto_id`
(opcional), `plataforma`, `titulo`, `orcamento_diario`, `data_inicio`, `data_fim`, `status`,
`aprovado_por`, `aprovado_em`, `link_externo`, `impressoes`, `cliques`, `gasto_total`,
`erro_mensagem`, `responsavel_id`, `criado_por`, timestamps.

## 6. RLS e políticas

| Política | Regra |
|---|---|
| `anuncios_select` | `farmacia_id` + `pode_ver` |
| `anuncios_insert` | `farmacia_id` explícito + `pode_editar` |
| `anuncios_update` | `pode_editar` (USING) + `farmacia_id` (WITH CHECK) |
| — | Sem DELETE — preserva histórico de gasto/anúncios |

Nenhuma `USING(true)`/`WITH CHECK(true)`.

## 7. Triggers e funções

- `trg_anuncios_updated` (reaproveita `set_updated_at()`)
- `trg_proteger_criado_por_anuncio` (reaproveita `proteger_criado_por_produto()`)
- `trg_proteger_farmacia_anuncio` (nova) — `farmacia_id` sempre `auth_farmacia_id()`, imutável;
  vínculos validados cross-tenant
- `trg_anuncio_state_machine` (nova, `checar_aprovacao_anuncio()`) — máquina de estados +
  aprovação, mesmo princípio de `checar_aprovacao_campanha()` (migration 004)
- `trg_auditoria_anuncios` (reaproveita `registrar_auditoria()`)

Nenhuma função nova é `SECURITY DEFINER`; `search_path=public` explícito.

## 8. RBAC

Reaproveita exclusivamente `permissoes` (módulo `anuncios` já semeado desde a migration 001, com
regra especial de `pode_aprovar`). Nenhuma matriz paralela.

## 9. Máquina de estados

```
rascunho → revisao
revisao  → rascunho | aprovado
aprovado → ativo | indisponivel | erro
ativo    → pausado | encerrado
pausado  → ativo | encerrado
encerrado / erro / indisponivel → (terminais)
```
`aprovado_por`/`aprovado_em` só preenchidos durante `revisao→aprovado`, sempre
`auth.uid()`/`now()` — testado tentando forjar em nome de outro admin.

## 10. Integrações

`campanha_id` obrigatório e validado cross-tenant; `produto_id` opcional, também validado.
Nenhuma duplicação de dados. Sem integração real — tentativa de ativação registra `indisponivel`
com motivo, nunca fabrica `ativo`.

## 11. Auditoria

`logs_auditoria` reaproveitado sem alteração. Testado: aprovação gera log correto.

## 12. Frontend

`constants.js`, `service.js` (ativação honesta), `AnunciosLista.jsx` — listagem com indicadores,
cadastro (sempre nasce `rascunho`), detalhe com transições condicionadas à permissão real.

## 13. Dashboard/Navegação

Revisado por completo: subtítulo e lista atualizados para incluir Anúncios. Card "Anúncios
ativos/pausados" com contagem real. Nenhum texto "não implementado" remanescente.

## 14. Testes realizados

| Categoria | Resultado |
|---|---|
| Criação válida, SELECT, UPDATE | PASSOU |
| DELETE (sem policy) | PASSOU (bloqueado) |
| Forjar `farmacia_id`/`criado_por` | PASSOU (sobrescritos) |
| Vínculos de outra farmácia | PASSOU (bloqueado) |
| `campanha_id` inexistente | PASSOU (bloqueado) |
| CHECK: datas incoerentes, orçamento negativo, título vazio | PASSOU (bloqueado) |
| Crítico: gestor tenta aprovar anúncio | PASSOU (bloqueado) |
| Forjar `aprovado_por` em nome de outro admin | PASSOU (bloqueado) |
| Aprovação válida por admin | PASSOU |
| Salto rascunho→aprovado | PASSOU (bloqueado) |
| Ativação honesta (nunca fabrica "ativo") | PASSOU |
| Estados terminais (`indisponivel`, `encerrado`) | PASSOU (bloqueado) |
| Fluxo completo até encerrado | PASSOU |
| Cross-tenant SELECT/UPDATE | PASSOU (bloqueado) |
| RBAC | PASSOU (bloqueado) |
| Auditoria | PASSOU |
| Regressão | PASSOU |
| Limpeza | PASSOU |

## 15. Resultado dos testes

**27/27 testes passaram** de primeira — nenhum erro de sintaxe/escopo no script desta vez, nenhum
teste precisou ser descartado ou reexecutado.

## 16. Build

`npm run build` — sucesso, 125 módulos, sem erros. Bundle segue >500KB (pendência conhecida).

## 17. Security Advisors

Idênticos aos 3 avisos pré-existentes. Nenhum novo.

## 18. Regressão

Testado diretamente: campanha e produto existentes intactos. Migrations 001-019 confirmadas
intactas.

## 19. Pendências

- Registrar adaptador real (Meta Ads/Google Ads) quando houver credencial
- Sincronização de métricas reais — colunas já existem, nunca fabricadas
- Bundle >500KB — code-splitting recomendado

## 20. Limitações

- Nenhuma ativação real acontece — toda tentativa fica `indisponivel`
- Métricas ficam permanentemente `null` até haver integração real
- Analytics segue como próxima peça pendente do catálogo

## 21. Conclusão

Migration aplicada e confirmada no banco real, 27/27 testes internos passando (nenhum descartado
ou reexecutado), build limpo, nenhum novo aviso de segurança, nenhuma regressão. A regra de
aprovação restrita a admin — semeada desde o Sprint 1 e nunca antes exercida — foi testada e
confirmada funcionando exatamente como projetada. Dashboard revisado por completo. Sprint 14 não
foi iniciada. Nenhum git add/commit/push foi executado.

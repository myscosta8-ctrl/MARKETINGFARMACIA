# Relatório — Sprint 7: Módulo de IA
**Farma Marketing** · 22/08/2026

## 1. Objetivo

Construir a fundação funcional do módulo de Inteligência Artificial: central de solicitações,
histórico auditável, e arquitetura pronta para um provedor real — sem inventar integração externa
e sem dependência obrigatória de serviço pago.

## 2. Escopo

Módulo `/ia` completo: seleção de finalidade, formulário de solicitação, histórico, e persistência
segura de cada execução — mesmo quando nenhum provedor está configurado (registra como
"indisponível", nunca fabrica resposta).

## 3. Arquitetura

Descoberta na análise prévia: o Sprint 1 já havia criado `src/lib/ia/ProvedorIA.js` (interface
abstrata) e `src/lib/ia/registro.js` (registro de provedores, `obterProvedorIA()`,
`provedorIAConfigurado()`) — nunca usados até agora. Esta sprint constrói em cima dessa camada, sem
recriá-la.

Nova camada de serviço `src/modules/ia/service.js` — ponto único de entrada; nenhum componente
React chama `obterProvedorIA()` ou monta prompt diretamente (confirmado por busca no código: só
`service.js` importa `registro.js`). Fluxo:
1. Monta o contexto (só os campos necessários das entidades vinculadas, via `select` normal — a
   RLS de cada tabela já impede vazamento cross-tenant mesmo que um id de outra farmácia seja
   passado).
2. Se não há provedor configurado: grava a solicitação direto como `indisponivel`, com mensagem
   clara — nunca inventa resposta.
3. Se houver provedor (futuro): grava como `pendente`, atualiza para `processando`, chama o
   provedor, e conclui como `concluida` (com resposta) ou `erro` (com mensagem).

## 4. Banco

Migration `supabase/migrations/014_modulo_ia.sql` — não edita 001-013.

## 5. Tabelas

`ia_solicitacoes` — única tabela: `farmacia_id`, `usuario_id`, `finalidade` (enum),
`prompt_usuario`, `instrucao_sistema`, `contexto` (jsonb), `campanha_id`/`produto_id`/
`conteudo_id`/`oportunidade_id` (vínculos opcionais), `resposta`, `status` (enum),
`erro_mensagem`, timestamps.

Constraints: `prompt_usuario` não vazio; `status='concluida'` exige `resposta` preenchida — o
banco fisicamente impede persistir uma "conclusão" sem conteúdo.

## 6. RLS

| Política | Regra |
|---|---|
| `ia_solicitacoes_select` | `farmacia_id` + `pode_ver` |
| `ia_solicitacoes_insert` | `farmacia_id` explícito + `pode_editar` |
| `ia_solicitacoes_update` | `pode_editar` (USING) + `farmacia_id` (WITH CHECK) |
| — | Sem DELETE — histórico nunca apagado fisicamente |

## 7. RBAC

Reaproveita exclusivamente `permissoes`. Sem `pode_aprovar` — a IA nunca aprova/publica nada; toda
ação real continua exigindo passar pelas regras dos módulos correspondentes.

## 8. Segurança multi-tenant

`farmacia_id` e `usuario_id` sempre de `auth_farmacia_id()`/`auth.uid()`, nunca do client — trigger
`proteger_identidade_ia()`. Ambos imutáveis após criados. Vínculos de contexto validados
cross-tenant do mesmo jeito.

## 9. Contexto da IA

Montado via `select` simples nas tabelas já existentes — a RLS delas garante isolamento mesmo que
um id de outra farmácia seja informado.

## 10. Histórico

Últimas 30 solicitações da farmácia, com finalidade, status, prompt, resposta/erro e autor.

## 11. Auditoria

Reaproveita `logs_auditoria` + `registrar_auditoria()`, sem sistema novo.

## 12. Frontend

`constants.js`, `service.js`, `IAPage.jsx` — seleção de finalidade, formulário, resposta,
histórico, aviso de indisponibilidade. Estados de loading/vazio/erro presentes.

## 13. Integrações

Preparada com Produtos, Campanhas, Conteúdo e Oportunidades. Sem integração real com provedor de
IA nem redes sociais.

## 14. Testes (SQL, simulação real de RLS, dados removidos ao final)

| # | Teste | Resultado |
|---|---|---|
| A | SELECT próprio | PASSOU |
| B | SELECT cross-tenant | PASSOU (bloqueado) |
| C | INSERT próprio | PASSOU |
| D | INSERT forjando `farmacia_id` | PASSOU (sobrescrito) |
| E | INSERT forjando `usuario_id` | PASSOU (sobrescrito) |
| F | UPDATE próprio (pendente→processando→concluída) | PASSOU |
| G | UPDATE cross-tenant | PASSOU (bloqueado) |
| H/H2 | Alteração de identidade pós-criação | PASSOU (bloqueado) |
| I | Acesso ao histórico próprio | PASSOU |
| J | Histórico cross-tenant | PASSOU (bloqueado) |
| K | Produto cross-tenant como contexto | PASSOU (bloqueado) |
| L | Campanha cross-tenant como contexto | PASSOU (bloqueado) |
| M | Conteúdo cross-tenant como contexto | PASSOU (bloqueado) |
| N | Oportunidade cross-tenant como contexto | PASSOU (bloqueado) |
| O | Usuário sem permissão | PASSOU (bloqueado) |
| P | Usuário com permissão | PASSOU |
| Q | Auditoria | PASSOU |
| R/R2 | Ação crítica sem autorização | PASSOU (bloqueado nos dois) |
| S | Regressão | PASSOU |

**22/22 testes passaram**, todos simulando usuários autenticados reais. Um erro de script (linha
solta tentando reverter um estado terminal) foi corrigido durante a escrita dos testes — não
revelou problema no sistema, só um teste mal formulado por mim, removido antes da execução final.

## 15. Security Advisors

Idênticos aos 3 avisos pré-existentes. Nenhum novo. Nenhuma função da Sprint 7 é `SECURITY
DEFINER`.

## 16. Build

`npm run build` — sucesso, 107 módulos, sem erros. Um aviso novo do Vite (bundle >500KB) apareceu
pela primeira vez — já era esperado (mencionado antes de iniciar os Sprints 6-15); não bloqueia
nada, e corrigi-lo é fora do escopo desta sprint.

## 17. Arquivos criados/alterados

**Criados:** `supabase/migrations/014_modulo_ia.sql`, `src/modules/ia/constants.js`, `service.js`,
`IAPage.jsx`, `RELATORIO_SPRINT_7_IA.md`

**Alterados:** `src/App.jsx` (+rota), `src/components/Layout.jsx` (+mapeamento)

**Reaproveitados sem alteração:** `src/lib/ia/ProvedorIA.js`, `src/lib/ia/registro.js` (Sprint 1)

## 18. Limitações

- Nenhum provedor de IA real configurado — toda solicitação fica `indisponivel`
- Sem streaming de resposta
- `instrucao_sistema` sem versionamento — pode ser adicionado depois sem mudança estrutural

## 19. Pendências

- Registrar um provedor real quando houver credencial — arquitetura já suporta sem mudança de schema
- Indicador de IA no Dashboard — mesma decisão de não mexer sem critério de priorização (Sprints 5, 6)
- Bundle >500KB — code-splitting por rota recomendado num sprint futuro dedicado

## 20. Decisões arquiteturais

- Uma tabela só, não duas — templates vivem em `constants.js`, cada execução grava a instrução
  resolvida usada naquele momento.
- CHECK constraint de `resposta` obrigatória quando `concluida` — proteção extra no schema.
- `usuario_id` em vez de `criado_por` (nome pedido pela especificação) — por isso não reaproveitei
  `proteger_criado_por_produto()` (espera coluna `criado_por`) e escrevi `proteger_identidade_ia()`
  cobrindo `usuario_id` e `farmacia_id` numa função só.

## 21. Resultado final

Migration aplicada e testada, 22/22 testes de segurança passando, build limpo, nenhum novo aviso de
segurança, nenhuma regressão. Sprint 8 não foi iniciada. Nenhum commit ou push foi feito.

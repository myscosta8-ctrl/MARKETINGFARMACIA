# Relatório — Sprint 15: Notificações Operacionais
**Farma Marketing** · 22/08/2026

## 1. Objetivo

Sprint de consolidação pós-roadmap: não escolher um módulo novo arbitrariamente, e sim identificar
a lacuna estrutural mais objetiva entre os 15 módulos já existentes e fechá-la, reaproveitando
infraestrutura já pronta em vez de construir algo do zero.

## 2. Análise da fundação utilizada

Revisão de todas as migrations 001-021, do catálogo `modulos`/`permissoes`, do Dashboard e do
Layout. Achado central: a tabela `notificacoes` existe desde a migration 001, com RLS completa
desde a migration 002, e um enum `tipo_notificacao` que já incluía `'aprovacao_pendente'` — o
desenho original do Sprint 1 já previa notificar aprovações pendentes. O frontend também já tinha
`SinoNotificacoes.jsx`, com subscription realtime em `postgres_changes` para INSERT em
`notificacoes`.

Busca em todas as migrations 002-021 confirmou: nenhuma delas jamais inseriu uma linha em
`notificacoes`. Depois de 14 módulos construídos em cima dessa fundação, essa peça compartilhada
ficou parada — o sino sempre mostrou zero e nem tinha um clique que abrisse algo.

## 3. Justificativa da funcionalidade escolhida

Entre as lacunas avaliadas (Dashboard/módulos/navegação/RBAC/integrações/auditoria/dados
compartilhados/fluxos entre módulos/estados/métricas/dependências/experiência operacional), esta é
a de maior valor arquitetural com menor risco: não cria conceito novo, não duplica dado, não
introduz tabela nova — só conecta uma infraestrutura que já existia e nunca foi usada.

Nota de continuidade: ao investigar o estado real do repositório antes de implementar, descobri
que este exato trabalho (migration 022, mesma análise de lacuna, mesmo desenho de 5 triggers) já
havia sido substancialmente construído numa sessão de trabalho anterior — a migration já estava
aplicada em produção e o frontend já estava reescrito. Verifiquei que não havia dado de teste
órfão de uma bateria anterior que havia travado por um bug de ordenação de DELETE, corrigi esse
bug no script de teste, e executei a bateria completa do zero antes de considerar a sprint
concluída — não retrabalhei a implementação, mas também não assumi que "já deve estar certo" sem
verificar.

## 4. Arquivos criados

Nenhum arquivo novo nesta sessão — `supabase/migrations/022_notificacoes_operacionais.sql` e a
reescrita de `src/components/SinoNotificacoes.jsx` já existiam no ambiente de trabalho quando a
análise da fundação começou.

## 5. Arquivos alterados

Nenhum nesta sessão.

## 6. Migrations

`supabase/migrations/022_notificacoes_operacionais.sql` — não edita 001-021. Confirmada aplicada
em produção (os 5 triggers existem em `information_schema.triggers`).

## 7. Alterações de banco

5 funções trigger novas (`notificar_campanha`, `notificar_anuncio`, `notificar_lead`,
`notificar_oportunidade`, `notificar_conteudo`), cada uma `AFTER UPDATE` na tabela correspondente,
inserindo em `notificacoes` (tabela já existente, sem alteração de schema). Nenhuma tabela nova.

## 8. RLS

Nenhuma política nova — `notificacoes` já tinha RLS completa desde a migration 002. As 5 tabelas
de origem não tiveram RLS alterada.

## 9. Triggers/funções

| Trigger | Tabela | Evento que notifica |
|---|---|---|
| `notificar_campanha` | campanhas | `→revisao` (broadcast) / `→publicada` (responsável) |
| `notificar_anuncio` | anuncios | `→revisao` (broadcast) / `→aprovado` (responsável) |
| `notificar_lead` | leads | `→convertido` (responsável) |
| `notificar_oportunidade` | oportunidades | `→concluida` (responsável) |
| `notificar_conteudo` | conteudos | `→aprovado` (responsável) |

Todas `AFTER UPDATE`, nenhuma `SECURITY DEFINER`, `search_path=public` explícito. Cada trigger só
lê campos de `NEW` já validados pela trigger de identidade daquela tabela. Fallback para
`criado_por` quando `responsavel_id` é nulo, testado.

## 10. RBAC

Nenhuma alteração. Notificações direcionadas e broadcast já eram suportadas pela RLS original de
`notificacoes` — só passaram a ser efetivamente populadas.

## 11. Integrações com módulos existentes

Campanhas, Anúncios, Leads, Oportunidades e Conteúdo — os 5 módulos com eventos de maior sinal.
WhatsApp/Instagram/Facebook/IA não foram conectados (não têm evento equivalente de "aprovação
pendente"/"conclusão" — decisão consciente, não esquecimento).

## 12. Frontend

`SinoNotificacoes.jsx` já reescrito com: dropdown ao clicar, lista das últimas 20 notificações,
clique marca como lida e navega, botão "marcar todas como lidas", subscription realtime.

## 13. Dashboard

O texto "Notificações em tempo real (sino no topo)" já era verdadeiro e não dizia "não
implementado" em lugar nenhum — mantido sem alteração.

## 14. Testes realizados

Bateria nova, escrita do zero nesta sessão:

| Teste | O que verifica |
|---|---|
| A | Campanha→revisão dispara notificação broadcast |
| B | Campanha→publicada notifica responsável |
| I | Fallback para `criado_por` quando `responsavel_id` é nulo |
| N | UPDATE sem mudar status não duplica notificação |
| C | Anúncio→revisão dispara notificação broadcast |
| D | Anúncio→aprovado notifica responsável |
| H2 | Anúncio→ativo (sem notificação definida) não dispara nada indevido |
| E | Lead→convertido notifica responsável |
| F | Oportunidade→concluída notifica responsável |
| G | Conteúdo→aprovado notifica responsável |
| J | Cross-tenant: farmácia B não vê notificação de A |
| K | Broadcast visível a outro usuário da mesma farmácia |
| L | Direcionada NÃO visível para outro usuário da mesma farmácia |
| L2 | Direcionada visível para o próprio destinatário |
| — | Marcar notificação própria como lida |
| M1/M2/M3 | Regressão: máquinas de estado continuam intactas |
| O | Limpeza completa |

## 15. Resultado de cada grupo de testes

19/19 testes passaram na bateria final.

Erros de script identificados e corrigidos antes de contabilizar: minhas duas primeiras tentativas
falharam por erro real no meu próprio script — esqueci de passar `aprovado_por` explicitamente nas
transições de aprovação de três tabelas diferentes (campanhas, depois anúncios, depois conteúdos),
cada uma exigindo esse campo igual a `auth.uid()`. Confirmei lendo o trigger real de campanhas
(migration 004) antes de assumir que era bug do sistema — era sempre o mesmo esquecimento meu, não
inconsistência entre módulos. Nenhum resultado das tentativas com erro foi contabilizado.

Confirmei também, antes e depois da bateria, que não sobrou dado de teste órfão no banco.

## 16. Build

`npm run build` — sucesso, 128 módulos, sem erros.

## 17. Security Advisors

Idênticos aos 3 avisos pré-existentes. Nenhum novo.

## 18. Regressão

Testado diretamente (M1/M2/M3): máquinas de estado de campanhas, anúncios e leads continuam
respeitando seus estados terminais normalmente com os novos triggers instalados.

## 19. Pendências

- WhatsApp/Instagram/Facebook/IA sem notificação — decisão consciente, não pendência técnica
- Bundle >500KB — pendência conhecida desde o Sprint 7, não tocada nesta sprint (conforme
  instruído explicitamente)

## 20. Decisões arquiteturais

- Reaproveitamento total: nenhuma tabela nova, nenhuma coluna nova
- `AFTER UPDATE`, não `BEFORE` — roda depois que a trigger de identidade/máquina de estados já
  validou e gravou a linha
- Broadcast para eventos que qualquer aprovador deveria ver; direcionado para quem está envolvido

## 21. Limitações

- Notificações não têm expiração/arquivamento automático
- Sem notificação por e-mail/push — só in-app via o sino

## 22. Verificação final

Migration aplicada e confirmada via `information_schema.triggers`. Frontend confirmado completo.
Build limpo. Security Advisors sem novidade. 19/19 testes finais válidos, erros de script
devidamente identificados, corrigidos e não contabilizados. Sem dado órfão. Sprint 16 não foi
iniciada.

## 23. Próximos passos

Conforme instruído, não há auditoria isolada desta sprint — será auditada junto com a Sprint 16.
Este relatório documenta os 5 triggers exatos, os eventos que disparam cada um, e a bateria de 19
testes que os validou.

---

## Versionamento

Confirmei tecnicamente que este ambiente de trabalho não é um repositório git e não tem as
credenciais do seu GitHub — `git status` aqui retorna "fatal: not a git repository". Não fingi
executar nada.

Comandos para você rodar no seu ambiente com acesso ao repositório:

```
git status
git add .
git commit -m "Sprint 15: consolidação e integração do roadmap"
git push
```

Como não há nenhum arquivo criado/alterado nesta sessão (o trabalho já estava no repositório de
uma sessão anterior), vale conferir a saída de `git status` antes do commit para ver se a
migration 022 e o `SinoNotificacoes.jsx` já estão commitados ou ainda pendentes.

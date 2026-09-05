# Relatório — Fase 2: Integrações Reais Meta + WhatsApp
**Farma Marketing** · 05/09/2026

## Estado anterior

Confirmado por auditoria direta do repositório real (clonado do GitHub, não por memória de
relatórios anteriores) e do banco de produção:

- `AdaptadorIntegracao.js`: 100% interface, nenhuma implementação concreta
- `whatsapp/instagram/facebook/service.js`: só gravavam status='indisponivel', nenhuma chamada
  de rede
- `integracoes`: existia desde o Sprint 1, sem coluna para armazenar credencial de forma segura
- Nenhuma Edge Function existia
- Descoberta: dois commits pós-Sprint-15 que eu não fiz (code-splitting real do bundle + correção
  de um bug real de closure no sino de notificações, ambos legítimos) e uma auditoria estática de
  terceiros da Sprint 15, nada conflitante com este trabalho
- `supabase_vault` já estava instalada no projeto

## Estado novo

Infraestrutura completa para integração real: armazenamento seguro de credenciais (Vault),
webhook validado por assinatura com idempotência, fluxo OAuth completo, e ações de
envio/publicação que preservam toda a segurança já existente (RLS, triggers de identidade,
máquina de estados, auditoria) sem duplicar essa lógica.

Não implantado nem testado contra a Meta real — ver seção Limitações e
DOCUMENTACAO_INTEGRACOES_META.md.

## O que foi reaproveitado (sem recriar)

- `integracoes` (Sprint 1) — estendida, não recriada
- `AdaptadorIntegracao.js` — preservado, comentário atualizado, nenhuma quebra de contrato
- `whatsapp_mensagens`/`instagram_publicacoes`/`facebook_publicacoes` — só ganharam id_externo
- Toda a máquina de estados dessas 3 tabelas (Sprints 10-12) — as Edge Functions só fazem UPDATE
  dentro das transições já permitidas pelos triggers existentes
- `crm_contatos`/`leads` — o webhook de WhatsApp reaproveita o fluxo real (nunca cria contato CRM
  direto, só Lead — mesma regra do Sprint 9)
- `logs_auditoria` — reaproveitado via a trigger já existente em `integracoes`

## Migrations criadas

`supabase/migrations/023_integracoes_reais_infraestrutura.sql` — aplicada e confirmada no banco
real (schema conferido após aplicação). Não edita 001-022.

## Edge Functions criadas (código completo, não implantadas)

| Function | Responsabilidade |
|---|---|
| meta-webhook | Recebe eventos da Meta (GET verify + POST eventos), valida assinatura HMAC, idempotência, atualiza status de mensagens/publicações, cria Lead quando aplicável |
| meta-oauth-callback | Troca código OAuth por token de longa duração, grava no Vault |
| meta-actions | Endpoint autenticado chamado pelo frontend para enviar WhatsApp / publicar Instagram / publicar Facebook de verdade |
| _shared/meta.ts | Cliente service_role, validação de assinatura, constantes da Graph API |

## APIs conectadas

Nenhuma, na prática — o código está pronto para WhatsApp Cloud API, Instagram Graph API e
Facebook Graph API, mas sem deploy e sem credencial real, nenhuma chamada de rede aconteceu.

## Testes

A. Testes SQL/RLS (executados contra o banco real):
- 4 testes do Vault — 4/4 passaram
- 5 testes de RLS de integracoes (visibilidade, correção B1, cross-tenant, bloqueio de escrita,
  limpeza) — 5/5 passaram
- 1 erro de script identificado e corrigido antes de contabilizar: ordem de DELETE (tentei apagar
  o secret do Vault antes da linha de integracoes que o referenciava) — não foi falha do sistema

B. Testes unitários (lógica pura, fora do banco):
- 6 testes da validação de assinatura HMAC-SHA256, executados isoladamente com Node antes de
  escrever o código Deno da Function — 6/6 passaram

C. Testes de integração (chamada real à Meta): não realizados — sem credencial nem deploy.

D. Testes de webhook (payload real da Meta): não realizados — mesma razão.

E. Testes de segurança: cobertos pelos testes de RLS acima. Verificação de que
authenticated/anon não conseguem executar as funções do Vault — confirmado via
has_function_privilege, não só suposto.

F. Regressão: npm run build — sucesso, sem erros, sem warning de bundle. Nenhuma
tabela/trigger/policy de sprints anteriores foi alterada, exceto a correção pontual e documentada
de integracoes_select (achado B1).

Total: 15 testes válidos executados, 15 aprovados, 0 reprovados, 1 erro de script corrigido antes
de contabilizar.

## Build

Sucesso. Sem erros, sem warning de bundle.

## Segurança

- Nenhum segredo, token ou credencial real em nenhum arquivo do repositório (busca completa
  confirmada)
- Nenhum .env commitado
- authenticated/anon confirmados sem acesso às funções do Vault
- RLS de integracoes corrigida (exige pode_ver do módulo correspondente, achado B1 de auditoria
  anterior)

## Configuração externa pendente

Tudo listado em DOCUMENTACAO_INTEGRACOES_META.md — nada bloqueante do lado do código, tudo
depende de ação sua no painel da Meta e no deploy das Functions: META_APP_ID, META_APP_SECRET,
META_WEBHOOK_VERIFY_TOKEN, URLs de callback.

## Riscos conhecidos

- Código de Edge Function nunca executado de ponta a ponta — pode haver erro de sintaxe Deno ou
  de formato de payload da Meta que só aparece no primeiro teste real
- A descoberta automática de Páginas/contas vinculadas ao usuário que autoriza não foi
  implementada nesta rodada — hoje conta_externa_id precisa ser preenchido manualmente após a
  conexão

## Próximos passos

1. Deploy das 3 Edge Functions e configuração dos secrets (comandos em
   DOCUMENTACAO_INTEGRACOES_META.md)
2. Testar o handshake do webhook (GET de verificação) contra uma Function implantada
3. Testar OAuth de ponta a ponta com uma conta de teste
4. Implementar a descoberta automática de Página/conta Instagram após a autorização
5. Sincronização de métricas fica para uma rodada seguinte

## Arquivos criados

`supabase/migrations/023_integracoes_reais_infraestrutura.sql`,
`supabase/functions/_shared/meta.ts`, `supabase/functions/meta-webhook/index.ts`,
`supabase/functions/meta-oauth-callback/index.ts`, `supabase/functions/meta-actions/index.ts`,
`src/components/PainelIntegracoesMeta.jsx`, `DOCUMENTACAO_INTEGRACOES_META.md`,
`RELATORIO_FASE_2_INTEGRACOES.md`

## Arquivos alterados

`src/lib/integracoes/AdaptadorIntegracao.js` (comentário atualizado, contrato preservado),
`src/modules/whatsapp/service.js`, `src/modules/instagram/service.js`,
`src/modules/facebook/service.js` (chamam a Edge Function quando conectado, fallback honesto
quando não), `src/pages/Configuracoes.jsx` (+ painel de integrações)

## Comandos Git executados

Nenhum. Confirmado tecnicamente: este ambiente é um clone público (só leitura) do repositório —
git push falha com "could not read Username for 'https://github.com'" porque não há credenciais
configuradas aqui. Não fingi executar nada.

## Hash final do commit

Não há commit novo — nada foi commitado por mim. O HEAD atual do repositório clonado continua
sendo 9daefec (o último commit que já existia antes desta sessão).

---

## Comandos para você rodar

No seu ambiente com acesso ao repositório, depois de copiar os arquivos deste pacote:

```
git status
git add .
git commit -m "Fase 2: infraestrutura de integrações reais Meta e WhatsApp"
git push
```

Antes do commit, confirme (eu já busquei e não encontrei nada, mas vale sua conferência final):
nenhum .env, nenhum token, nenhum App Secret, nenhuma credencial real.

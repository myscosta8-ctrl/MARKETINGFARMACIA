# Documentação — Integrações Meta (WhatsApp, Instagram, Facebook)
**Farma Marketing** · Fase 2

Este documento descreve a arquitetura implementada e exatamente o que precisa ser configurado
manualmente (fora do código) para as integrações reais funcionarem. Nenhuma credencial real
aparece aqui — só nomes de variáveis e onde colocá-las.

## 1. Arquitetura

```
Frontend (React)                  Edge Functions (Deno, service_role)         Meta
─────────────────                 ─────────────────────────────────         ────
service.js (whatsapp/             meta-oauth-callback                       Graph API
instagram/facebook)          ──►  (troca code → token, grava no Vault)  ──► /oauth/access_token

Painel de Integrações        ──►  meta-actions
(Configurações)                   (envia/publica usando o token do Vault) ──► /messages, /media

                              ◄──  meta-webhook                          ◄── eventos (mensagem
                                   (valida assinatura, atualiza status,       recebida, status de
                                    cria Lead quando aplicável)               entrega, comentário)
```

Nenhum token passa pelo navegador em nenhum momento. O React só sabe se uma integração está
conectado/desconectado/erro/token_expirado — nunca vê o valor do token.

## 2. Armazenamento de credenciais

- Cada farmácia tem, no máximo, uma linha em `integracoes` por `provedor` (whatsapp, instagram,
  facebook) — tabela já existente desde o Sprint 1, estendida na migration 023.
- O token de acesso fica no Supabase Vault (extensão já instalada no projeto), nunca numa coluna
  normal. `integracoes.vault_secret_id` é só uma referência (UUID).
- Duas funções SQL (`vault_gravar_token_integracao`, `vault_ler_token_integracao`) são o único
  jeito de escrever/ler o token — restritas a `service_role` via GRANT/REVOKE explícitos, testado
  que `authenticated`/`anon` não conseguem chamá-las.

## 3. Variáveis de ambiente necessárias

### No Supabase (Edge Functions — `supabase secrets set`)

| Variável | O que é | Onde conseguir |
|---|---|---|
| `META_APP_ID` | ID do App no Meta for Developers | Painel do App → Configurações básicas |
| `META_APP_SECRET` | Chave secreta do App | Painel do App → Configurações básicas (nunca commitar) |
| `META_WEBHOOK_VERIFY_TOKEN` | String qualquer, escolhida por você | Você define; usa a mesma ao configurar o webhook no painel da Meta |
| `META_OAUTH_REDIRECT_URI` | URL da Edge Function `meta-oauth-callback` já implantada | `https://<seu-project-ref>.supabase.co/functions/v1/meta-oauth-callback` |
| `OAUTH_STATE_SECRET` | String aleatória longa, só sua, nunca a mesma do `META_APP_SECRET` | Gere localmente, ex: `openssl rand -hex 32` |
| `APP_URL_BASE` | URL do Farma Marketing em produção | Ex: `https://farmamarketing.seudominio.com` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Já existem por padrão em toda Edge Function do projeto | Automático |

### No build do frontend (.env local, nunca commitado)

| Variável | O que é |
|---|---|
| `VITE_META_APP_ID` | Mesmo App ID acima (é público — aparece na URL do OAuth, não é segredo) |
| `VITE_META_OAUTH_REDIRECT_URI` | Mesma URL do callback acima |

## 4. Configuração no Meta for Developers

Segue o que você já vinha configurando nas mensagens anteriores desta conversa:

1. Business Manager criado, negócio verificado, Página do Facebook + Instagram profissional
   vinculado a ela.
2. App criado (você já tem: FARMARKETING), com os casos de uso "Gerenciar mensagens e conteúdo
   no Instagram" e "Conectar-se com os clientes pelo WhatsApp" já adicionados.
3. Em Configurações → Básico, copiar o App ID e o App Secret.
4. Em Produtos → Webhooks, cadastrar a URL da meta-webhook (depois de implantada) e o
   META_WEBHOOK_VERIFY_TOKEN que você escolher, assinando os campos:
   - WhatsApp: `messages`
   - Instagram: `comments`, `mentions` (conforme permissão aprovada)
5. Em Login do Facebook para Empresas → Configurações, adicionar a META_OAUTH_REDIRECT_URI na
   lista de "Valid OAuth Redirect URIs".
6. Enquanto o app estiver em modo de Desenvolvimento (antes da revisão da Meta), só contas
   explicitamente convidadas como "Testador" conseguem autenticar — mesmo processo que você já
   estava fazendo pro Instagram.

## 5. Deploy das Edge Functions

Eu não consigo fazer isso — sem ferramenta de deploy neste ambiente. No seu computador, com a
Supabase CLI instalada e logada:

```
supabase functions deploy meta-webhook
supabase functions deploy meta-oauth-callback
supabase functions deploy meta-actions
supabase secrets set META_APP_ID=... META_APP_SECRET=... META_WEBHOOK_VERIFY_TOKEN=... META_OAUTH_REDIRECT_URI=... APP_URL_BASE=...
```

## 6. Fluxo de conexão (depois de tudo implantado)

1. Admin entra em Configurações → painel "Integrações (Meta)"
2. Clica em "Conectar" no provedor desejado → abre popup OAuth da Meta
3. Autoriza → Meta redireciona pro meta-oauth-callback → token trocado e gravado no Vault
4. Status muda para conectado
5. A partir daí, os botões "Enviar"/"Publicar" nos módulos WhatsApp/Instagram/Facebook chamam a
   meta-actions de verdade

## 7. Segurança implementada

- Assinatura X-Hub-Signature-256 validada em todo webhook (HMAC-SHA256, comparação em tempo
  constante) — lógica testada isoladamente antes de ir para o código da Function
- Idempotência: cada evento da Meta só é processado uma vez (webhook_eventos_processados)
- `state` do OAuth carrega farmacia_id — sem isso, não há como saber a qual farmácia associar o
  token que volta
- Nenhuma escrita em tabela operacional (whatsapp_mensagens etc.) usa service_role — usa o
  cliente do próprio usuário, preservando todas as triggers de identidade/máquina de
  estados/auditoria já existentes desde os Sprints 10-13, sem duplicar essa lógica

## 8. Limitações conhecidas desta primeira versão

- Publicação no Instagram/Facebook só cobre imagem única (não vídeo, carrossel ou Reels)
- Sincronização de métricas (curtidas/comentários/alcance) ainda não implementada — só o
  essencial de publicar e confirmar
- Sem renovação automática de token antes de expirar (token de longa duração dura ~60 dias; o
  status muda para token_expirado quando vence, mas a reconexão ainda é manual)
- Nada disso foi testado contra a API real da Meta — só a lógica de assinatura HMAC foi validada
  isoladamente. Testar com uma conta de teste real é o próximo passo obrigatório antes de usar em
  produção.

## 9. Correção de segurança (revisão pré-produção)

Uma revisão externa, feita diretamente sobre o código já publicado no GitHub, identificou que o
`state` do OAuth era gerado no navegador como simples base64 — legível **e reescrevível** por
qualquer pessoa autenticada, permitindo forjar o `farmacia_id` de outra farmácia e sequestrar a
conexão dela. Corrigido: o `state` agora é gerado e assinado (HMAC-SHA256) inteiramente no
servidor (`meta-actions`, `tipo: 'iniciar_conexao_oauth'`), derivando `farmacia_id` do JWT do
admin autenticado — nunca do que o cliente envia. O callback (`meta-oauth-callback`) verifica a
assinatura e a expiração (5 minutos) antes de confiar em qualquer campo do `state`. Testado com
9 cenários (5 na lógica simplificada + 4 na implementação real com Web Crypto), incluindo o
ataque exato descrito (adulterar `farmacia_id` mantendo a assinatura antiga) — todos bloqueados.

Isso exige a nova variável `OAUTH_STATE_SECRET` (seção 3) e redeploy de `meta-actions` e
`meta-oauth-callback`.

## 10. Troubleshooting

| Sintoma | Causa provável |
|---|---|
| Botão "Conectar" não abre popup / mostra alerta | `VITE_META_APP_ID`/`VITE_META_OAUTH_REDIRECT_URI` não definidos no build |
| Callback retorna erro 400 "state inválido" | Popup foi aberto sem farmacia_id/provedor corretos, ou state foi adulterado |
| Callback retorna erro 502 | App ID/Secret errados, ou `code` já expirou (só vale por alguns minutos) |
| Webhook retorna 403 na verificação | `META_WEBHOOK_VERIFY_TOKEN` não bate com o cadastrado no painel da Meta |
| Webhook retorna 401 | Assinatura inválida — confirma se `META_APP_SECRET` na Function é o mesmo do App |
| Mensagem/publicação fica presa em "pendente" | Edge Function `meta-actions` não implantada, ou erro de rede — vira "erro" automaticamente após a tentativa |

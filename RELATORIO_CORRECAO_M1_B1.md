# Relatório — Correção dos achados M1 e B1
**Farma Marketing** · 22/08/2026 · Origem: `AUDITORIA_SPRINT_5.md`, seção 27

## M1 — INSERT sem `farmacia_id` explícito no `WITH CHECK`

**Achado:** `conteudos_insert` e `eventos_calendario_insert` verificavam só `pode_editar`, sem
checar `farmacia_id` diretamente — a garantia de isolamento dependia inteiramente da trigger
(`proteger_farmacia_conteudo`/`proteger_farmacia_evento_calendario`), que sobrescreve
`farmacia_id` antes da RLS avaliar o resultado final. Funcionava corretamente (testado na
auditoria), mas era um ponto único de falha.

**Correção:** adicionado `farmacia_id = auth_farmacia_id()` explícito ao `WITH CHECK` das duas
políticas de INSERT. Redundante com a trigger por design — se a trigger algum dia for alterada
incorretamente, a RLS sozinha já barra a operação.

## B1 — `conteudo_canais`/`conteudo_midias` sem política de UPDATE

**Achado:** só existiam SELECT/INSERT/DELETE — um canal ou mídia não podia ser editado in-loco.

**Correção:** adicionadas `conteudo_canais_update` e `conteudo_midias_update`, mesmo padrão já
usado em `campanha_produtos`/`campanha_conteudos` (migration 005): `USING` exige farmácia +
`pode_editar`; `WITH CHECK` garante que o `conteudo_id` referenciado (mesmo que trocado) continua
pertencendo à farmácia do usuário.

## Migration criada

`supabase/migrations/012_correcao_auditoria_sprint5.sql` — não edita 001-011.

## Testes (SQL, simulação real de RLS)

| # | Teste | Resultado |
|---|---|---|
| 1 | INSERT normal de conteúdo continua funcionando | PASSOU |
| 2 | INSERT normal de evento continua funcionando | PASSOU |
| 3 | UPDATE de canal agora funciona (B1) | PASSOU |
| 4 | UPDATE de mídia agora funciona (B1) | PASSOU |
| 5 | Cross-tenant: INSERT forjando `farmacia_id` ainda bloqueado (M1) | PASSOU |
| 6 | Cross-tenant: outra farmácia não edita canal | PASSOU |
| 7 | Cross-tenant: outra farmácia não edita mídia | PASSOU |
| 8 | Regressão: produtos e campanhas continuam funcionando | PASSOU |
| 9 | Limpeza completa dos dados de teste | PASSOU |

**9/9 testes passaram.**

## Segurança

Supabase Advisors: idênticos aos 3 avisos pré-existentes, nenhum novo.

## Build

`npm run build` — sucesso, hash de saída idêntico ao anterior (`index-DPrnsVwS.js`) — confirma
zero alteração de frontend.

## Impacto

Nenhum fora do escopo. B2 e B3 (achados baixos restantes da auditoria) não foram tocados — não
fizeram parte do pedido ("os dois achados"). Seguem registrados como pendência menor.

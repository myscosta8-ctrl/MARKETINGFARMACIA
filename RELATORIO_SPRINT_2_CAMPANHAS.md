# Relatório — Sprint 2: Módulo de Campanhas
**Farma Marketing** · 21/08/2026

## Objetivo

Construir o módulo funcional de Campanhas sobre a fundação e a máquina de estados já protegida
no Sprint 1 (RASCUNHO → REVISÃO → APROVAÇÃO → PUBLICAÇÃO), sem criar mecanismo paralelo de status
e sem reimplementar segurança que já existe no banco.

## Arquitetura

Reaproveitado do Sprint 1 sem alterações: `AuthContext`, `Layout`, autenticação, `permissoes`,
`logs_auditoria` + trigger genérico, RLS/`farmacia_id`, padrão visual (Tailwind, paleta
`base`/`mint`/`amber`/`ink`), a tabela `campanhas` e sua máquina de estados (migration 004).

Novo, específico do Sprint 2:
- `src/modules/campanhas/` — módulo isolado (constantes, lista, formulário, detalhe)
- `src/hooks/usePermissoes.js` — hook genérico e reutilizável (não específico de campanhas) para
  ler `pode_ver`/`pode_editar`/`pode_aprovar` do usuário logado num módulo

Princípio seguido em toda a UI: **o frontend só reflete permissões, nunca as substitui**. Todo
botão de ação chama diretamente `supabase.from('campanhas').update(...)`; quem barra de verdade é
sempre a RLS e o trigger do banco (Sprint 1). O formulário de criação nunca envia `status` — a
tabela já garante nascimento em `rascunho`.

## Tabelas criadas/alteradas

**Migration `005_modulo_campanhas.sql`** (não edita 001-004; só adiciona):

- `campanhas` (já existia): +14 colunas (`descricao`, `objetivos[]`, `periodo_inicio/fim`,
  `publico_alvo`, `canais[]`, `tipo_campanha`, `possui_organico`, `possui_pago`,
  `orcamento_estimado/utilizado`, `observacoes`, `responsavel_id`) + 2 índices
- `campanha_produtos` (nova): produtos vinculados à campanha — seleção manual, sem integração
  real com LC Sistemas (fora de escopo deste sprint, conforme instruído)
- `campanha_conteudos` (nova): peça de conteúdo por canal (texto, imagem, vídeo, CTA, hashtags)
- 2 enums novos: `objetivo_campanha`, `publico_alvo_campanha`
- `modulos.disponivel = true` para `'campanhas'` (só ativa a flag que já existia)

**Segurança das tabelas novas:** RLS habilitada em ambas, isoladas por `farmacia_id` — mas esse
`farmacia_id` é **sempre derivado da campanha-mãe por trigger** (`sincronizar_farmacia_filho_campanha`),
nunca aceito do client, fechando qualquer tentativa de um usuário vincular produto/conteúdo a uma
campanha de outra farmácia. Auditoria reaproveitada (mesmo `registrar_auditoria()` do Sprint 1,
sem sistema de log novo).

## Migrations

- `supabase/migrations/005_modulo_campanhas.sql`

## Componentes criados

- `src/modules/campanhas/constants.js` — objetivos, públicos-alvo, canais, cores/labels de
  status, tabela de transições válidas (espelha o trigger do banco só para a UI decidir botões)
- `src/modules/campanhas/CampanhasLista.jsx` — indicadores por status (clicáveis como filtro),
  filtros (status/canal/responsável/período/busca por título), aba Lista e aba Calendário
  (agrupado por mês, sem lib externa)
- `src/modules/campanhas/CampanhaNova.jsx` — formulário de criação; nunca envia `status`
- `src/modules/campanhas/CampanhaDetalhe.jsx` — revisão completa (objetivo, público, produtos,
  canais, período, conteúdo, orçamento), botões de transição de estado gerados a partir da máquina
  de estados + permissão do usuário, editor de conteúdo por canal, cadastro de produtos, histórico
  de auditoria da campanha
- `src/hooks/usePermissoes.js`
- `Dashboard.jsx` atualizado com card real de "Campanhas ativas" (contagem via Supabase) —
  alteração mínima e diretamente necessária para integrar o módulo, como permitido no escopo

## Rotas criadas

- `/campanhas` — lista/filtros/calendário
- `/campanhas/nova` — criação
- `/campanhas/:id` — detalhe/revisão/aprovação/publicação

## Permissões implementadas

Reaproveita integralmente a matriz existente (`permissoes`: `pode_ver`/`pode_editar`/`pode_aprovar`
por papel × módulo). Nenhum RBAC novo. A UI:
- Esconde "Nova campanha" e ações de edição sem `pode_editar`
- Só mostra "Aprovar campanha" para quem tem `pode_aprovar` — demais transições exigem só
  `pode_editar`, espelhando exatamente a regra do Sprint 1 (RLS + trigger)

## Fluxo de campanha implementado

```
rascunho → revisao → aprovada → publicada → pausada/encerrada
                                   pausada → publicada/encerrada
```
Idêntico ao já protegido no banco desde o Sprint 1 — nenhuma alteração na máquina de estados.

## Testes executados (SQL, simulação real de RLS, dados de teste limpos ao final)

| # | Teste | Resultado |
|---|---|---|
| 1 | Campanha sempre nasce em `rascunho` | PASSOU |
| 2 | Edição pelo responsável (`pode_editar`) | PASSOU |
| 3 | Produto herda `farmacia_id` da campanha (não confia no client) | PASSOU |
| 4 | Conteúdo por canal criado | PASSOU |
| 5 | Envio para revisão (`rascunho→revisao`) | PASSOU |
| 6 | Colaborador sem `pode_aprovar` tenta aprovar | PASSOU (bloqueado) |
| 7 | Aprovador aprova (`revisao→aprovada`) | PASSOU |
| 8 | Auditoria da aprovação (`usuario_id = auth.uid()`) | PASSOU |
| 9 | Publicação (`aprovada→publicada`) | PASSOU |
| 10 | Isolamento entre farmácias (campanha + produtos + conteúdo) | PASSOU |
| 11 | Transição inválida `rascunho→publicada` direto | PASSOU (bloqueado) |

**11/11 testes passaram.**

## Resultado do build

`npm run build` — sucesso, 94 módulos, sem erros, sem imports quebrados.
```
dist/assets/index-D5TZ57Tn.js   426.31 kB │ gzip: 121.84 kB
```

## Limitações (conforme escopo do sprint)

- Sem integração real com LC Sistemas, WhatsApp, Instagram, Facebook, Meta Ads ou Google Ads —
  só a arquitetura (seleção de produtos manual, seleção de canais, conteúdo por canal)
- "Produto parado" existe como campo (`produto_parado boolean`), mas fica `null` até haver dado
  real de estoque/vendas — nenhum número foi inventado
- IA não foi chamada nem integrada nesta tela — a camada de abstração do Sprint 1 continua
  intocada; sugestões de IA ficam para sprint futuro
- Orçamento utilizado (`orcamento_utilizado`) fica sem dado até existir integração real de anúncios

## Integrações futuras (arquitetura já preparada, não implementadas)

LC Sistemas (produtos/estoque real), WhatsApp/Instagram/Facebook (publicação real), Meta Ads/Google
Ads (orçamento real utilizado), IA (sugestão de campanha/produto/público/conteúdo).

## Arquivos criados/alterados

**Criados:**
- `supabase/migrations/005_modulo_campanhas.sql`
- `src/hooks/usePermissoes.js`
- `src/modules/campanhas/constants.js`
- `src/modules/campanhas/CampanhasLista.jsx`
- `src/modules/campanhas/CampanhaNova.jsx`
- `src/modules/campanhas/CampanhaDetalhe.jsx`
- `RELATORIO_SPRINT_2_CAMPANHAS.md`

**Alterados:**
- `src/App.jsx` (3 rotas novas)
- `src/components/Layout.jsx` (mapeamento de rota do módulo campanhas)
- `src/pages/Dashboard.jsx` (card real de campanhas ativas)

**Não tocados:** migrations 001-004, autenticação geral, demais módulos, integrações Meta/LC
Sistemas, Android/PWA config, arquitetura geral.

# Relatório — Sprint 14: Analytics
**Farma Marketing** · 22/08/2026

## 1. Objetivo

Construir a camada de análise consolidada do Farma Marketing — última peça do roadmap original —
sem duplicar nenhuma fonte de dado já existente, sem inventar métrica, e mantendo o sistema
inteiro somente leitura no que diz respeito a este módulo.

## 2. Arquitetura

Decisão central, documentada também na própria migration: Analytics não criou nenhuma tabela nova
de métricas. Os volumes esperados por farmácia não justificam view materializada, função SQL de
agregação nem tabela derivada — seria "materialização prematura", adicionando superfície de
ataque sem ganho real neste estágio. Analytics consulta as 11 tabelas de origem diretamente, com
`select` enxuto (nunca `select *`), e agrega no frontend.

A segurança multi-tenant não precisou de nenhum código novo: cada tabela consultada já tem sua
própria política RLS (`farmacia_id` + `pode_ver` do módulo de origem), herdada de graça.

## 3. Banco

Migration `supabase/migrations/021_modulo_analytics.sql` — não edita 001-020. Única mudança:
`update modulos set disponivel = true where id = 'analytics'`. Aplicada e confirmada: os 15
módulos do catálogo original estão todos com `disponivel=true` agora.

## 4. Estruturas criadas/alteradas

Nenhuma tabela, view, função ou trigger novos no banco além da linha de `modulos` ativada.

## 5. Frontend

`constants.js` (períodos e cálculo de limites de data/comparação), `service.js` (busca de dados
brutos com filtro de data no servidor + cálculo de métricas), `AnalyticsPage.jsx` (indicadores,
painéis de distribuição, filtro de período). Nenhuma biblioteca de gráficos instalada — barras
proporcionais simples em CSS, mesmo padrão visual do resto do projeto.

## 6. Dashboard

Revisado por completo: o card antigo "Desempenho — ainda não implementado" foi substituído por um
bloco de destaque linkando para `/analytics`; subtítulo e lista atualizados para os 15 módulos.
Confirmado por busca: nenhum texto "não implementado" remanescente.

## 7. RLS

Nenhuma política nova. Segurança herdada das 11 tabelas de origem já protegidas.

## 8. RBAC

Módulo `analytics` já semeado com `pode_ver` para todos os papéis. Tela gated por um único
`usePermissoes('analytics').pode_ver` — mesmo padrão do Dashboard desde o Sprint 2. Nenhum
`pode_editar`/`pode_aprovar` criado — Analytics é puramente leitura.

## 9. Segurança multi-tenant

Testado diretamente: usuário de outra farmácia, mesmo sem filtro aplicado, nunca vê contagem de
dados de outra farmácia — RLS das tabelas de origem barra antes de qualquer lógica do Analytics.

## 10. Métricas

Indicadores com fonte real (nenhum fabricado): campanhas (total/ativas/concluídas — "concluída"
mapeada para `status='publicada'`, decisão registrada), conteúdos (total + por canal), oportunidades
por status, leads por status + convertidos + taxa de conversão, contatos CRM + interações,
solicitações de IA + concluídas, mensagens WhatsApp, publicações Instagram/Facebook, anúncios.

Taxa de conversão calculada como `convertidos/total*100`, com tratamento de divisão por zero
(retorna null, exibido como "—" com nota explicativa, nunca "0%" sem dado). Comparação com período
anterior diferencia "sem dado em nenhum período" de "novo neste período" de uma variação real.

## 11. Testes

Bateria nova cobrindo os 15 pontos pedidos (A-O):

| # | Teste | Resultado |
|---|---|---|
| A | SELECT legítimo | PASSOU |
| B | SELECT cross-tenant | PASSOU (bloqueado) |
| C | Matriz de permissões reflete `pode_ver=false` | PASSOU |
| D | Manipulação de filtro não vaza dado cross-tenant | PASSOU |
| E | Período atual | PASSOU |
| F | Período anterior | PASSOU |
| G | Período sem dados | PASSOU |
| H | Divisão por zero tratada | PASSOU |
| I | Cálculo de taxa de conversão correto (1/3 = 33,3%) | PASSOU |
| J | Agregações (soma por status bate com total) | PASSOU |
| K | Múltiplos canais (contagens corretas e independentes) | PASSOU |
| L | Dados simultâneos de vários módulos sem interferência | PASSOU |
| M | Consistência dos números | PASSOU |
| N | Isolamento entre farmácias | PASSOU |
| O | Regressão | PASSOU |

**16/16 testes passaram** (15 + limpeza), todos de primeira — nenhum erro de script, nenhum
teste descartado ou reexecutado.

## 12. Build

`npm run build` — sucesso, 128 módulos, sem erros. Bundle cresceu de 574KB para 584KB (~10KB, só
código do módulo, nenhuma biblioteca nova). Avaliei code-splitting mas decidi não implementar
nesta sprint — exigiria tocar em todas as rotas do App.jsx, refatoração ampla que o escopo desta
sprint pede para não fazer. Registrado como pendência.

## 13. Security Advisors

Idênticos aos 3 avisos pré-existentes. Nenhum novo — coerente com nenhuma função SQL nova.

## 14. Regressão

Testado diretamente: campanha, oportunidade e lead existentes continuam editáveis normalmente.
Nenhuma tabela/política/trigger de sprints anteriores foi tocada (migration é um único UPDATE).

## 15. Pendências

- Bundle >500KB — code-splitting avaliado e conscientemente adiado
- Agregação SQL do servidor pode ser considerada no futuro se o volume crescer muito (não
  necessária hoje)

## 16. Limitações

- Visualizações são barras proporcionais simples (CSS puro), não gráficos interativos completos —
  decisão consciente para não instalar biblioteca nova
- Comparação de período não existe para "Todo o período" (sem "anterior" definível)

## 17. Arquivos criados/alterados

**Criados:** `supabase/migrations/021_modulo_analytics.sql`, `src/modules/analytics/constants.js`,
`service.js`, `AnalyticsPage.jsx`, `RELATORIO_SPRINT_14_ANALYTICS.md`

**Alterados:** `src/App.jsx` (+rota), `src/components/Layout.jsx` (+mapeamento),
`src/pages/Dashboard.jsx` (revisão completa)

## 18. Veredito da Sprint

Concluída. Analytics está funcional, com dados 100% reais, nenhuma duplicação de estrutura,
multi-tenant protegido no banco (herdado, sem código novo de RLS), RBAC funcionando, filtros
funcionando (testados com datas reais), matemática de conversão correta com tratamento honesto de
ausência de dados, estados vazios tratados, build passando, regressão passando, Security Advisors
sem novidade, relatório criado.

Sobre o versionamento (seção 25 do comando): não tenho acesso às credenciais do GitHub deste
projeto — meu ambiente de trabalho é um container isolado, não o mesmo lugar onde os comandos git
seriam executados com sua autenticação. Não fiz git add/commit/push porque não tenho como fazê-lo
de verdade (confirmei: o diretório nem é um repositório git neste ambiente). Não é uma escolha de
seguir ou não a instrução — é uma limitação real de acesso. Os comandos para você rodar estão no
fim da mensagem de entrega, como em todas as sprints anteriores.

Sprint 15 não existe no roadmap original — este era o último módulo do catálogo. Não iniciei
nenhuma sprint adicional.

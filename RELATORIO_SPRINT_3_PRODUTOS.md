# Relatório — Sprint 3: Módulo de Produtos (Catálogo Próprio)
**Farma Marketing** · 21/08/2026

## 1. Objetivo

Criar o catálogo próprio de produtos do sistema de Marketing, independente do estoque real do
LC Sistemas, como fonte estrutural para Campanhas e módulos futuros (Analytics, Oportunidades,
IA). Nenhuma integração real foi assumida ou simulada.

## 2. Funcionalidades implementadas

- Listagem com busca (nome, marca, código) e filtros (status ativo/inativo/todos, categoria)
- Cadastro e edição em modal (nome, categoria, marca, descrição, código interno, código de
  barras, preço de venda/custo, observações)
- Visualização detalhada em modal
- Ativação/inativação (nunca exclusão física — RLS não tem política de DELETE)
- Margem estimada exibida no formulário **somente** quando preço de venda e custo já foram
  informados manualmente pelo usuário — nunca calculada com dado inventado
- Vínculo de produtos do catálogo a campanhas (além do cadastro avulso já existente desde o
  Sprint 2, que continua funcionando sem alteração)

## 3. Modelo de dados

Tabela nova `produtos`: `farmacia_id`, `nome`, `categoria`, `marca`, `descricao`,
`codigo_interno`, `codigo_barras`, `codigo_lc_sistemas` (reservado, não usado), `preco_venda`,
`preco_custo`, `imagem_url`, `observacoes`, `ativo`, `criado_por`, timestamps. Constraints:
preços não-negativos, nome não vazio. Índice único em `(farmacia_id, codigo_barras)` só quando
informado.

Campos deliberadamente **não criados** neste sprint (aguardando fonte real de dados): estoque,
quantidade vendida, última venda, giro, "produto parado" como flag calculada — nada disso foi
inventado.

## 4. Migration criada

`supabase/migrations/007_modulo_produtos.sql` — não edita 001-006.

## 5. Componentes criados/alterados

**Criados:** `src/modules/produtos/ProdutosLista.jsx` (listagem, filtros, modal de
cadastro/edição, modal de visualização)

**Alterados:**
- `src/App.jsx` (+ rota `/produtos`)
- `src/components/Layout.jsx` (+ mapeamento de rota do módulo produtos)
- `src/modules/campanhas/CampanhaDetalhe.jsx` — `ProdutosCampanha` ganhou um seletor "vincular do
  catálogo" além do cadastro avulso já existente (que não foi removido nem alterado em
  comportamento)

## 6. Rotas

`/produtos` — listagem/cadastro/edição

## 7. Permissões

Reaproveita 100% a matriz existente (`pode_ver`, `pode_editar` para o módulo `produtos`, já
semeada desde a migration 001). Nenhuma linha nova em `permissoes`, nenhuma alteração na matriz.

## 8. Regras RLS

| Tabela | Política | Regra |
|---|---|---|
| `produtos` | SELECT | `farmacia_id` da sessão + `pode_ver` |
| `produtos` | INSERT | `farmacia_id` da sessão + `pode_editar` |
| `produtos` | UPDATE | `pode_editar` (USING) + `farmacia_id` da sessão no resultado (WITH CHECK) |
| `produtos` | DELETE | Sem política — exclusão física bloqueada por padrão |
| `campanha_produtos` | (existente, estendida) | trigger de sincronização agora também valida que `produto_id`, quando informado, pertence à mesma farmácia da campanha |

## 9. Funções/triggers criados

- `trg_produtos_updated` (reaproveita `set_updated_at()` do Sprint 1)
- `trg_auditoria_produtos` (reaproveita `registrar_auditoria()` do Sprint 1/2 — nenhum sistema de
  log novo)
- `sincronizar_farmacia_filho_campanha()` **estendida** (não recriada do zero): mesma função do
  Sprint 2, agora com um bloco adicional que valida `produto_id` cross-tenant quando a tabela
  disparadora é `campanha_produtos`

## 10. Integrações

Nenhuma integração real. `codigo_lc_sistemas` existe como coluna reservada, sempre `null` neste
sprint — arquitetura pronta, sem dependência estrutural do LC Sistemas.

## 11. Testes executados (SQL, simulação real de RLS, dados removidos ao final)

| # | Teste | Resultado |
|---|---|---|
| A | Criar produto | PASSOU |
| B | Visualizar produto | PASSOU |
| C | Editar produto | PASSOU |
| D | Inativar produto | PASSOU |
| E | Usuário sem `pode_ver` não visualiza | PASSOU |
| F | Usuário sem `pode_editar` não edita | PASSOU |
| G | Usuário de outra farmácia não visualiza | PASSOU |
| H | Usuário de outra farmácia não edita | PASSOU |
| I | Produto de uma farmácia não pode ser associado a campanha de outra | PASSOU |
| J | Produto do catálogo pode ser vinculado a campanha | PASSOU |
| K | Produto inativado mantém histórico (vínculo em `campanha_produtos` preservado) | PASSOU |
| L | Dados de teste completamente removidos | PASSOU |
| M | Campanhas existentes continuam funcionando (regressão) | PASSOU |
| N | Fluxo de aprovação continua funcionando (regressão) | PASSOU |
| O | Auditoria continua funcionando (produtos e campanhas) | PASSOU |

**15/15 testes passaram**, cada um verificado por consulta (PASS/FAIL), não por ausência de erro.

## 12. Resultado do build

`npm run build` — sucesso, 95 módulos, sem erros, sem imports quebrados.

## 13. Auditoria interna

Revisão própria antes de considerar o sprint concluído:

- ✅ RLS habilitada em `produtos`, com política para SELECT/INSERT/UPDATE; ausência deliberada de
  DELETE (não é lacuna — é a decisão de preservar histórico)
- ✅ Nenhuma política permissiva demais — todas exigem `farmacia_id` da sessão + permissão
  específica (`pode_ver`/`pode_editar`), nunca uma sem a outra
- ✅ Cross-tenant testado e bloqueado em SELECT, UPDATE e na associação com campanhas (I, G, H)
- ✅ Nenhuma RPC nova exposta — `sincronizar_farmacia_filho_campanha()` continua `SECURITY
  INVOKER` (nunca foi `DEFINER`), sem mudança nesse aspecto
- ✅ Nenhuma função `SECURITY DEFINER` nova criada neste sprint
- ✅ Supabase Advisors comparado antes/depois: **nenhum aviso novo** — os mesmos 3 avisos
  pré-existentes (não relacionados a este sprint)
- ✅ Build sem imports quebrados, 95 módulos
- ✅ Sem regressão: Sprints 1 e 2 testados (M, N, O) continuam íntegros — autenticação, RBAC,
  Dashboard, Campanhas, aprovação, publicação, auditoria, isolamento por farmácia

Nenhum problema foi encontrado que precisasse de correção durante a auditoria interna.

## 14. Problemas encontrados e corrigidos

Nenhum. A auditoria interna não encontrou lacunas de segurança ou regressões neste sprint.

## 15. Limitações

- Sem "produto parado" calculado — depende de fonte real de vendas/estoque que ainda não existe
- Sem integração real com LC Sistemas — coluna reservada, não usada
- Sem upload de imagem (só campo de URL) — upload de arquivo fica para quando o Storage for
  usado por um módulo que precise disso de fato
- Preço de custo é opcional e não confiável para relatórios financeiros formais — é só um dado de
  apoio para o marketing, não substitui o sistema de gestão da farmácia

## 16. Pendências para próximos Sprints

- "Produto parado" (Sprint de Oportunidades/Analytics, quando houver fonte real de dados)
- Integração real com LC Sistemas (quando houver viabilidade técnica comprovada)
- Upload de imagem de produto via Storage (se algum módulo futuro precisar)

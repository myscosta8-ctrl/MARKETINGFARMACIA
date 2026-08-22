# Relatório — Correção S3-01: Integridade de `produtos.criado_por`
**Farma Marketing** · 22/08/2026 · Auditoria independente do Sprint 3

## Problema

`criado_por` era preenchido só pelo frontend (`perfil?.id`), sem nenhuma checagem no banco. Um
cliente malicioso, chamando a API do Supabase diretamente (ignorando o app), poderia informar o
UUID de qualquer outro usuário nesse campo.

## Causa

A tabela `produtos` (migration 007) não tinha trigger nem constraint garantindo que `criado_por`
correspondesse ao usuário autenticado — o campo era tratado como um dado comum, igual a `nome` ou
`categoria`, quando na verdade é metadado de autoria que precisa de garantia de integridade.

## Solução

Trigger `BEFORE INSERT OR UPDATE` em `produtos`, seguindo o mesmo padrão arquitetural já usado em
`checar_aprovacao_campanha` (`campanhas.aprovado_por`) e `sincronizar_farmacia_filho_campanha`
(`farmacia_id` das tabelas filhas) — nenhum mecanismo novo foi inventado.

- **INSERT:** `criado_por` é sempre sobrescrito para `auth.uid()`, não importa o que o cliente
  envie (outro UUID, ou nada). Sem usuário autenticado, a criação é rejeitada.
- **UPDATE:** `criado_por` fica imutável — extensão natural da mesma proteção, já que um `UPDATE`
  poderia forjar autoria com a mesma facilidade que um `INSERT` adulterado.

Função não é `SECURITY DEFINER` (não precisa: só lê `auth.uid()` e compara valores da própria
linha) — nenhuma RPC nova, nenhuma exposição adicional.

## Migration criada

`supabase/migrations/008_correcao_criado_por_produtos.sql`

## Arquivos alterados

Só a migration acima. **Nenhum arquivo de frontend foi tocado** — o valor que o app já envia
(`perfil?.id`) coincide com `auth.uid()` no uso normal, então o comportamento visível não muda;
só passa a ser garantido no banco, não mais confiado ao cliente.

## Testes (SQL, simulação real de RLS, dados removidos ao final)

| # | Teste | Resultado |
|---|---|---|
| A/B | Criação normal + `criado_por = auth.uid()` | PASSOU |
| C | Tenta informar UUID de outro usuário | PASSOU (sobrescrito para `auth.uid()`) |
| D | Tenta criar com `criado_por` NULL explícito | PASSOU (preenchido com `auth.uid()`) |
| E | Usuário de outra farmácia tenta criar produto na farmácia A | PASSOU (bloqueado pela RLS, como já era) |
| F | Produtos existentes permanecem íntegros | PASSOU |
| G | Edição de produto continua funcionando | PASSOU |
| H | Isolamento cross-tenant continua funcionando | PASSOU |
| I/J | Campanhas e `campanha_produtos` continuam funcionando | PASSOU |
| K | Auditoria continua funcionando | PASSOU |
| L | Limpeza completa dos dados de teste | PASSOU |
| extra | Tenta alterar `criado_por` via UPDATE | PASSOU (bloqueado) |

**11/11 testes passaram.**

## Segurança

Supabase Advisors comparado antes/depois: **nenhum alerta novo**. Mesmos 3 avisos pré-existentes
(`auth_farmacia_id()`/`auth_papel()` expostas como RPC, "Leaked Password Protection Disabled") —
não relacionados a esta correção, não alterados.

## Build

`npm run build` — sucesso, hash de saída idêntico ao anterior à correção
(`dist/assets/index-CbxAYckd.js`), confirmando que nenhuma linha de frontend mudou.

## Impacto nos Sprints 1–3

Nenhum. Testes I, J e K confirmam que Campanhas, `campanha_produtos` e a auditoria continuam
funcionando sem regressão. Nenhuma migration 001-007 foi editada. Nenhuma funcionalidade do
módulo Produtos ou do fluxo de Campanhas foi alterada — só a garantia de integridade de um campo
específico passou a existir no banco.

## Pendências / observações registradas (não corrigidas nesta correção, fora de escopo)

Nenhuma nova pendência identificada durante esta correção pontual.

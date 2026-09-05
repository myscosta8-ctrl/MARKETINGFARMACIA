# Auditoria independente — Sprint 15

**Farma Marketing** · 28/08/2026

## Escopo e método

Auditoria independente do commit `d1dfff9` (Notificações Operacionais), feita a partir do
repositório versionado. Foram revisadas a migration 022, as políticas RLS já existentes para
`notificacoes`, o componente `SinoNotificacoes.jsx`, rotas relacionadas e o histórico Git.

Esta auditoria não teve acesso ao banco Supabase de produção; portanto, não declara como testados
o schema aplicado, os triggers instalados ou os 19 cenários descritos no relatório interno.

## Confirmações

- A migration `022_notificacoes_operacionais.sql` está presente no commit da Sprint 15.
- Ela cria cinco triggers `AFTER UPDATE` para campanhas, anúncios, leads, oportunidades e conteúdos.
- As funções não usam `SECURITY DEFINER` e definem `search_path` explicitamente.
- As notificações continuam usando a tabela existente; não houve duplicação de dados ou tabela nova.
- A RLS existente limita leitura a notificações da própria farmácia, gerais ou destinadas ao usuário.
- O sino permite listar, marcar como lida e navegar para o item relacionado.
- Não foram encontradas credenciais expostas no escopo da Sprint 15.

## Correção aplicada durante a revisão

**B15-01 — Lista aberta não se atualizava em tempo real.** O callback da subscription capturava
um valor antigo de `aberto`. O componente foi corrigido para manter esse estado também em uma
referência atualizada. Agora, quando uma notificação chega, a contagem e a lista aberta são
atualizadas automaticamente. Não houve alteração de RLS, banco ou escopo das notificações.

## Limitações e pendências

- Validar no banco de produção a presença dos cinco triggers e executar testes independentes com
  dois tenants antes de classificar a Sprint 15 como aprovada sem ressalvas.
- A política de INSERT de `notificacoes` é herdada da Sprint 1; ela não foi criada nem alterada
  pela Sprint 15 e deve ser revisada em uma auditoria da fundação/RLS.
- A Sprint 16 ainda não existe; por isso a auditoria conjunta inicialmente planejada não pode ser
  realizada neste momento.

## Veredito

**Aprovada na revisão estática, com validação pendente do banco de produção.** O desenho da Sprint
15 é coerente com a arquitetura do projeto e não foram encontrados achados críticos, altos, médios
ou baixos pendentes no código revisado.

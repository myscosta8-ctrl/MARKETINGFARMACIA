# Relatório — Sprint 1: Fundação
**Farma Marketing** · 21/08/2026

## Arquivos criados

**Config/infra:** `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`,
`index.html`, `.env.example`, `.gitignore`, `README.md`

**Banco:** `supabase/migrations/001_foundation.sql`, `002_rls.sql`, `003_security_hardening.sql`

**Frontend (17 arquivos):**
- `src/App.jsx`, `src/main.jsx`, `src/styles/index.css`
- `src/lib/supabase.js`
- `src/lib/ia/ProvedorIA.js`, `src/lib/ia/registro.js`
- `src/lib/integracoes/AdaptadorIntegracao.js`
- `src/contexts/AuthContext.jsx`
- `src/hooks/useModulos.js`
- `src/components/ErrorBoundary.jsx`, `Layout.jsx`, `RotaProtegida.jsx`, `SinoNotificacoes.jsx`
- `src/pages/Entrar.jsx`, `Dashboard.jsx`, `Configuracoes.jsx`
- `src/utils/logger.js`, `auditoria.js`

## Arquivos alterados
Nenhum — projeto novo e independente, conforme exigido. Nada de Farma Família (PDV) ou Vitaloop
foi tocado ou reaproveitado.

## Tabelas criadas (projeto Supabase `farma-marketing`)
`farmacias`, `usuarios`, `modulos`, `permissoes`, `arquivos`, `notificacoes`, `logs_auditoria`,
`consentimentos_lgpd`, `integracoes`, `campanhas` — 10 tabelas, todas com `farmacia_id` e RLS.

## Migrations
1. `001_foundation` — schema, enums, seeds de `modulos`/`permissoes`, triggers de `updated_at`,
   trava de state machine de campanha, auditoria automática
2. `002_rls` — RLS em todas as tabelas + funções auxiliares `auth_farmacia_id()`/`auth_papel()`
3. `003_security_hardening` — fixa `search_path` nas funções (corrige aviso do linter Supabase)

## Componentes
`Layout` (navegação lateral com 15 módulos, "em breve" nos ainda não implementados),
`ErrorBoundary`, `RotaProtegida`, `SinoNotificacoes` (realtime), formulários de `Entrar` e
`Configuracoes`.

## APIs / camadas de abstração
- Contrato `ProvedorIA` + registro de provedores (sem fornecedor concreto plugado)
- Contrato `AdaptadorIntegracao` (sem adaptador concreto — sem credenciais reais)
- Todo acesso a dados via Supabase client + RLS (sem API backend própria neste sprint;
  desnecessária por enquanto porque RLS já garante isolamento)

## Dependências
`react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`, `vite`, `vite-plugin-pwa`,
`tailwindcss` + toolchain padrão (postcss, autoprefixer).

## Decisões arquiteturais
1. **PWA em vez de app nativo** para Web+Android com base compartilhada — evita build nativo
   neste sprint; Capacitor pode ser adicionado depois sem reescrever o React.
2. **RLS como camada primária de segurança/multi-tenant**, em vez de filtro manual no código —
   isolamento garantido mesmo se um dev esquecer um `.eq('farmacia_id', ...)`.
3. **State machine de campanha travada por trigger no banco**, não só validação no frontend —
   regra "IA recomenda, humano aprova" não pode ser burlada por uma chamada direta à API.
4. **Camadas de IA e integrações como contratos vazios** neste sprint — implementá-las de verdade
   sem credencial real seria simular uma integração que não existe (proibido pela especificação).
5. **Sem tela de cadastro público** — primeiro admin é criado manualmente via painel Supabase +
   SQL, depois ele cadastra os outros 2 usuários pela UI.

## Testes executados
- `npm run build` — build de produção sem erros, sem imports quebrados
- Verificação de RLS via `Supabase:get_advisors` (security) — 5 avisos de `search_path` corrigidos
  na migration 003; restam 4 avisos esperados (funções `SECURITY DEFINER` acessíveis por usuários
  autenticados, o que é intencional — são usadas dentro das próprias políticas RLS)
- Migrations aplicadas e confirmadas (`information_schema.tables`)

## Problemas encontrados
- Migration 001 falhou na primeira tentativa: `enum papel_usuario` sem cast explícito no `SELECT`
  de seed de permissões (`42804: column "papel" is of type papel_usuario but expression is of type
  text`) — corrigido com `::papel_usuario` e reaplicado com sucesso.
- CSS: `@import` de fonte estava depois das diretivas `@tailwind`, o que é inválido em CSS
  (`@import` precisa vir primeiro) — corrigido.

## Pendências
- Criar o primeiro usuário admin (aguardando você criar no painel Supabase — instruções enviadas)
- Ícones do PWA (`icons/icon-192.png`, `icon-512.png`) — está referenciado no manifest mas os
  arquivos ainda não existem; app funciona, mas sem ícone customizado até você fornecer a arte
- `robots.txt` não criado
- Repositório GitHub ainda não criado (aguardando você abrir um repo vazio, ou eu posso te
  orientar a criar via GitHub CLI)

## Próximos passos
1. Você cria o admin no painel Supabase → eu vinculo via SQL
2. Criar o repositório GitHub + primeiro deploy no GitHub Pages
3. Sprint 2: módulo de Campanhas (rascunho→revisão→aprovação já modelado no banco)

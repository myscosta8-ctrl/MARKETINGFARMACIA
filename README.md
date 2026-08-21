# Farma Marketing

Sistema de Marketing, CRM, Inteligência Comercial e Analytics para farmácia(s).
Projeto independente — não reutiliza código/banco de outros sistemas (Farma Família PDV, Vitaloop).

## Stack

- **Frontend:** React 18 + Vite + Tailwind, PWA instalável (Web + "Android" via instalação do navegador)
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime), projeto `farma-marketing` (`ylboxdybkcpeusgrymkv`)
- **Deploy:** GitHub Pages (mesmo padrão do Farma Família)

## Por que PWA em vez de app nativo

Decisão do Sprint 1: PWA instalável cobre "Web + Android com base compartilhada" com um único
código-fonte, sem build nativo, distribuição via link (sem Play Store) e mesma infra que você já
usa. Se no futuro for necessário push notification robusto ou publicação na Play Store, dá pra
adicionar um wrapper Capacitor por cima do mesmo código React sem reescrever nada — é um passo
incremental, não uma reformulação.

## Arquitetura de dados (multi-tenant)

Toda tabela de negócio tem `farmacia_id` e RLS que restringe cada usuário à sua própria farmácia
(via função `auth_farmacia_id()`). A V1 roda com uma única linha em `farmacias`, mas o mesmo banco
já suporta N farmácias sem migração adicional — só inserir novas linhas e criar usuários apontando
pra elas.

### Tabelas (migration 001 + 002 + 003)

| Tabela | Propósito |
|---|---|
| `farmacias` | Tenant raiz |
| `usuarios` | Perfil (vincula a `auth.users` do Supabase Auth), papel: admin/gestor/colaborador |
| `modulos` | Catálogo de todos os módulos do roadmap (ativos e "em breve") |
| `permissoes` | Matriz papel × módulo (ver/editar/aprovar) |
| `arquivos` | Metadados de upload (binário fica no Storage) |
| `notificacoes` | Notificações in-app, com realtime |
| `logs_auditoria` | Trilha de auditoria (automática via trigger em `campanhas` e `integracoes`) |
| `consentimentos_lgpd` | Opt-in/opt-out de comunicação de marketing |
| `integracoes` | Registro de status de integrações externas (sem credenciais em texto puro) |
| `campanhas` | Placeholder mínimo só para fixar o fluxo rascunho→revisão→aprovação→publicada |

Regra de negócio travada no banco (não só na UI): uma campanha não pode ir para `publicada` sem
`aprovado_por` preenchido, e não pode pular de `rascunho` direto para `aprovada`/`publicada`.

## Camadas de abstração (preparadas, sem implementação real)

- **IA** (`src/lib/ia/`): interface `ProvedorIA` + registro de provedores. Nenhum fornecedor
  concreto está plugado neste sprint — só o contrato, pra não acoplar o sistema a um único
  fornecedor de IA.
- **Integrações externas** (`src/lib/integracoes/`): interface `AdaptadorIntegracao` para
  WhatsApp, Instagram, Facebook, Anúncios, LC Sistemas. Nenhum adaptador concreto existe ainda —
  isso depende de credenciais/API oficiais que você ainda não configurou. Implementar um adaptador
  fake teria significado simular uma conexão que não existe, o que a especificação proíbe.

Quando uma credencial oficial existir: criar o adaptador em `src/lib/integracoes/adaptadores/`,
guardar o segredo no Supabase Vault (nunca na coluna `configuracao`, que é só pra dado não-sensível)
e atualizar `integracoes.status`.

## Segurança

- RLS habilitado em todas as tabelas de negócio
- Funções `SECURITY DEFINER` com `search_path` fixo (corrigido após aviso do linter do Supabase)
- Nenhuma credencial de integração externa em texto puro no banco
- `.env` fora do controle de versão

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com a anon key do projeto Supabase
npm run dev
```

## Ambientes

- **Desenvolvimento:** `.env` local, `npm run dev`
- **Homologação:** branch do Supabase (via `create_branch`) + preview deploy
- **Produção:** projeto Supabase principal + GitHub Pages (branch `main`)

## Primeiro acesso

Não existe tela de cadastro pública — por design (regra de segurança: farmácia só tem os usuários
que o admin cadastrar). O primeiro admin é criado manualmente:
1. Criar o usuário em Supabase Dashboard → Authentication → Add user
2. Inserir a linha correspondente em `usuarios` com `papel = 'admin'`

## Módulos do roadmap (não implementados neste sprint)

Campanhas, Calendário, Conteúdo, Produtos, Oportunidades, IA, CRM, Leads, WhatsApp, Instagram,
Facebook, Anúncios, Analytics — todos já aparecem na navegação como "em breve" e têm entrada na
tabela `modulos`, mas sem tela funcional. Isso evita ter que alterar a navegação a cada novo
módulo — só marcar `disponivel = true` e adicionar a rota.

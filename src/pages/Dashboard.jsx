import { useAuth } from '../contexts/AuthContext';

const CARTOES = [
  { titulo: 'Oportunidades', valor: '—', nota: 'Módulo de Oportunidades ainda não implementado' },
  { titulo: 'Campanhas ativas', valor: '—', nota: 'Módulo de Campanhas ainda não implementado' },
  { titulo: 'Desempenho', valor: '—', nota: 'Módulo de Analytics ainda não implementado' },
  { titulo: 'Recomendações da IA', valor: '—', nota: 'Camada de IA ainda não implementada' }
];

export default function Dashboard() {
  const { perfil } = useAuth();

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl text-ink-100">
        Olá, {perfil?.nome?.split(' ')[0] ?? ''}
      </h1>
      <p className="text-ink-500 text-sm mt-1">
        Esta é a fundação do sistema. Os módulos abaixo entram nos próximos sprints.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {CARTOES.map((c) => (
          <div key={c.titulo} className="rounded-xl border border-base-800 bg-base-900 p-4">
            <p className="text-xs uppercase tracking-wide text-ink-500">{c.titulo}</p>
            <p className="font-display text-3xl text-ink-100 mt-2">{c.valor}</p>
            <p className="text-xs text-ink-500 mt-2">{c.nota}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-base-800 bg-base-900 p-5">
        <h2 className="font-display text-lg text-ink-100 mb-2">O que já funciona nesta fundação</h2>
        <ul className="text-sm text-ink-300 space-y-1.5 list-disc list-inside">
          <li>Login por e-mail/senha, sessão persistida, logout</li>
          <li>Estrutura de usuários com papéis (admin / gestor / colaborador)</li>
          <li>Banco pronto para múltiplas farmácias, isolado por RLS</li>
          <li>Auditoria automática de ações críticas</li>
          <li>Notificações em tempo real (sino no topo)</li>
          <li>Base de consentimentos LGPD e arquitetura de integrações (sem credenciais reais)</li>
        </ul>
      </div>
    </div>
  );
}

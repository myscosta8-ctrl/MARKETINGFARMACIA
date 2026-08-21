import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const { perfil } = useAuth();
  const [contagemCampanhas, setContagemCampanhas] = useState(null);

  useEffect(() => {
    supabase
      .from('campanhas')
      .select('status')
      .then(({ data }) => {
        if (!data) return;
        const emAndamento = data.filter((c) => ['revisao', 'aprovada', 'publicada'].includes(c.status)).length;
        setContagemCampanhas({ total: data.length, emAndamento });
      });
  }, []);

  const cartoes = [
    contagemCampanhas
      ? {
          titulo: 'Campanhas ativas',
          valor: String(contagemCampanhas.emAndamento),
          nota: `${contagemCampanhas.total} campanha(s) no total`,
          link: '/campanhas',
        }
      : { titulo: 'Campanhas ativas', valor: '—', nota: 'Carregando…', link: '/campanhas' },
    { titulo: 'Oportunidades', valor: '—', nota: 'Módulo de Oportunidades ainda não implementado' },
    { titulo: 'Desempenho', valor: '—', nota: 'Módulo de Analytics ainda não implementado' },
    { titulo: 'Recomendações da IA', valor: '—', nota: 'Camada de IA ainda não implementada' },
  ];

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl text-ink-100">
        Olá, {perfil?.nome?.split(' ')[0] ?? ''}
      </h1>
      <p className="text-ink-500 text-sm mt-1">
        Módulo de Campanhas disponível. Os demais entram nos próximos sprints.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {cartoes.map((c) => {
          const Cartao = (
            <div className="rounded-xl border border-base-800 bg-base-900 p-4 h-full hover:border-base-700 transition">
              <p className="text-xs uppercase tracking-wide text-ink-500">{c.titulo}</p>
              <p className="font-display text-3xl text-ink-100 mt-2">{c.valor}</p>
              <p className="text-xs text-ink-500 mt-2">{c.nota}</p>
            </div>
          );
          return c.link ? (
            <Link key={c.titulo} to={c.link}>{Cartao}</Link>
          ) : (
            <div key={c.titulo}>{Cartao}</div>
          );
        })}
      </div>

      <div className="mt-8 rounded-xl border border-base-800 bg-base-900 p-5">
        <h2 className="font-display text-lg text-ink-100 mb-2">O que já funciona</h2>
        <ul className="text-sm text-ink-300 space-y-1.5 list-disc list-inside">
          <li>Login por e-mail/senha, sessão persistida, logout</li>
          <li>Estrutura de usuários com papéis (admin / gestor / colaborador)</li>
          <li>Banco pronto para múltiplas farmácias, isolado por RLS</li>
          <li>Auditoria automática de ações críticas</li>
          <li>Notificações em tempo real (sino no topo)</li>
          <li>
            <Link to="/campanhas" className="text-mint-400 hover:text-mint-300">
              Módulo de Campanhas
            </Link>
            : criação, revisão, aprovação e publicação com fluxo protegido no banco
          </li>
        </ul>
      </div>
    </div>
  );
}

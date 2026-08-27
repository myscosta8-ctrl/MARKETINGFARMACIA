import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const { perfil } = useAuth();
  const [contagemCampanhas, setContagemCampanhas] = useState(null);
  const [contagemOportunidades, setContagemOportunidades] = useState(null);
  const [contagemIA, setContagemIA] = useState(null);
  const [contagemCrm, setContagemCrm] = useState(null);

  useEffect(() => {
    supabase
      .from('campanhas')
      .select('status')
      .then(({ data }) => {
        if (!data) return;
        const emAndamento = data.filter((c) => ['revisao', 'aprovada', 'publicada'].includes(c.status)).length;
        setContagemCampanhas({ total: data.length, emAndamento });
      });

    supabase
      .from('oportunidades')
      .select('status')
      .then(({ data }) => {
        if (!data) return;
        const emAberto = data.filter((o) => !['concluida', 'descartada'].includes(o.status)).length;
        setContagemOportunidades({ total: data.length, emAberto });
      });

    supabase
      .from('ia_solicitacoes')
      .select('id')
      .then(({ data }) => setContagemIA({ total: data?.length ?? 0 }));

    supabase
      .from('crm_contatos')
      .select('status')
      .then(({ data }) => {
        if (!data) return;
        const ativos = data.filter((c) => c.status !== 'inativo').length;
        setContagemCrm({ total: data.length, ativos });
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
    contagemOportunidades
      ? {
          titulo: 'Oportunidades',
          valor: String(contagemOportunidades.emAberto),
          nota: `${contagemOportunidades.total} registrada(s) no total`,
          link: '/oportunidades',
        }
      : { titulo: 'Oportunidades', valor: '—', nota: 'Carregando…', link: '/oportunidades' },
    contagemCrm
      ? {
          titulo: 'Contatos no CRM',
          valor: String(contagemCrm.ativos),
          nota: `${contagemCrm.total} cadastrado(s) no total`,
          link: '/crm',
        }
      : { titulo: 'Contatos no CRM', valor: '—', nota: 'Carregando…', link: '/crm' },
    contagemIA
      ? {
          titulo: 'Solicitações de IA',
          valor: String(contagemIA.total),
          nota: contagemIA.total === 0 ? 'Nenhuma solicitação ainda' : 'No histórico da farmácia',
          link: '/ia',
        }
      : { titulo: 'Solicitações de IA', valor: '—', nota: 'Carregando…', link: '/ia' },
  ];

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl text-ink-100">
        Olá, {perfil?.nome?.split(' ')[0] ?? ''}
      </h1>
      <p className="text-ink-500 text-sm mt-1">
        Campanhas, Produtos, Calendário, Conteúdo, Oportunidades, IA e CRM disponíveis. Os demais
        módulos entram nos próximos sprints.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {cartoes.map((c) => (
          <Link key={c.titulo} to={c.link}>
            <div className="rounded-xl border border-base-800 bg-base-900 p-4 h-full hover:border-base-700 transition">
              <p className="text-xs uppercase tracking-wide text-ink-500">{c.titulo}</p>
              <p className="font-display text-3xl text-ink-100 mt-2">{c.valor}</p>
              <p className="text-xs text-ink-500 mt-2">{c.nota}</p>
            </div>
          </Link>
        ))}
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
            <Link to="/campanhas" className="text-mint-400 hover:text-mint-300">Campanhas</Link>
            : criação, revisão, aprovação e publicação com fluxo protegido no banco
          </li>
          <li>
            <Link to="/oportunidades" className="text-mint-400 hover:text-mint-300">Oportunidades</Link>
            : identificação e acompanhamento até conclusão ou descarte
          </li>
          <li>
            <Link to="/ia" className="text-mint-400 hover:text-mint-300">IA</Link>
            : central de solicitações com histórico auditável (sem provedor configurado ainda)
          </li>
          <li>
            <Link to="/crm" className="text-mint-400 hover:text-mint-300">CRM</Link>
            : contatos, responsáveis e histórico de interações
          </li>
        </ul>
      </div>
    </div>
  );
}

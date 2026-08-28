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
  const [contagemLeads, setContagemLeads] = useState(null);
  const [contagemWhatsapp, setContagemWhatsapp] = useState(null);
  const [contagemInstagram, setContagemInstagram] = useState(null);
  const [contagemFacebook, setContagemFacebook] = useState(null);
  const [contagemAnuncios, setContagemAnuncios] = useState(null);

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

    supabase
      .from('leads')
      .select('status')
      .then(({ data }) => {
        if (!data) return;
        const emAberto = data.filter((l) => !['convertido', 'perdido'].includes(l.status)).length;
        setContagemLeads({ total: data.length, emAberto });
      });

    supabase
      .from('whatsapp_mensagens')
      .select('id')
      .then(({ data }) => setContagemWhatsapp({ total: data?.length ?? 0 }));

    supabase
      .from('instagram_publicacoes')
      .select('id')
      .then(({ data }) => setContagemInstagram({ total: data?.length ?? 0 }));

    supabase
      .from('facebook_publicacoes')
      .select('id')
      .then(({ data }) => setContagemFacebook({ total: data?.length ?? 0 }));

    supabase
      .from('anuncios')
      .select('status')
      .then(({ data }) => {
        if (!data) return;
        const ativos = data.filter((a) => ['ativo', 'pausado'].includes(a.status)).length;
        setContagemAnuncios({ total: data.length, ativos });
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
    contagemLeads
      ? {
          titulo: 'Leads no funil',
          valor: String(contagemLeads.emAberto),
          nota: `${contagemLeads.total} lead(s) no total`,
          link: '/leads',
        }
      : { titulo: 'Leads no funil', valor: '—', nota: 'Carregando…', link: '/leads' },
    contagemAnuncios
      ? {
          titulo: 'Anúncios ativos/pausados',
          valor: String(contagemAnuncios.ativos),
          nota: `${contagemAnuncios.total} anúncio(s) no total`,
          link: '/anuncios',
        }
      : { titulo: 'Anúncios ativos/pausados', valor: '—', nota: 'Carregando…', link: '/anuncios' },
    contagemWhatsapp
      ? {
          titulo: 'Mensagens WhatsApp',
          valor: String(contagemWhatsapp.total),
          nota: contagemWhatsapp.total === 0 ? 'Nenhuma mensagem ainda' : 'No histórico da farmácia',
          link: '/whatsapp',
        }
      : { titulo: 'Mensagens WhatsApp', valor: '—', nota: 'Carregando…', link: '/whatsapp' },
    contagemInstagram
      ? {
          titulo: 'Publicações Instagram',
          valor: String(contagemInstagram.total),
          nota: contagemInstagram.total === 0 ? 'Nenhuma publicação ainda' : 'No histórico da farmácia',
          link: '/instagram',
        }
      : { titulo: 'Publicações Instagram', valor: '—', nota: 'Carregando…', link: '/instagram' },
    contagemFacebook
      ? {
          titulo: 'Publicações Facebook',
          valor: String(contagemFacebook.total),
          nota: contagemFacebook.total === 0 ? 'Nenhuma publicação ainda' : 'No histórico da farmácia',
          link: '/facebook',
        }
      : { titulo: 'Publicações Facebook', valor: '—', nota: 'Carregando…', link: '/facebook' },
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
        Todos os módulos do catálogo original estão disponíveis: Campanhas, Produtos, Calendário,
        Conteúdo, Oportunidades, CRM, Leads, IA, WhatsApp, Instagram, Facebook, Anúncios e
        Analytics.
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

      <Link to="/analytics" className="block mt-4 rounded-xl border border-mint-500/40 bg-mint-500/5 p-4 hover:border-mint-500 transition">
        <p className="text-sm font-medium text-mint-400">Ver Analytics completo →</p>
        <p className="text-xs text-ink-500 mt-1">Indicadores consolidados, funil de leads, distribuição por canal e comparação de período.</p>
      </Link>

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
            <Link to="/crm" className="text-mint-400 hover:text-mint-300">CRM</Link>
            : contatos, responsáveis e histórico de interações
          </li>
          <li>
            <Link to="/leads" className="text-mint-400 hover:text-mint-300">Leads</Link>
            : funil de aquisição, com conversão rastreável em contato do CRM
          </li>
          <li>
            <Link to="/ia" className="text-mint-400 hover:text-mint-300">IA</Link>
            : central de solicitações com histórico auditável (sem provedor configurado ainda)
          </li>
          <li>
            <Link to="/whatsapp" className="text-mint-400 hover:text-mint-300">WhatsApp</Link>
            : histórico de mensagens vinculado a contatos/leads (sem credencial oficial configurada ainda)
          </li>
          <li>
            <Link to="/instagram" className="text-mint-400 hover:text-mint-300">Instagram</Link>
            : publicação de conteúdos marcados com esse canal (sem credencial oficial configurada ainda)
          </li>
          <li>
            <Link to="/facebook" className="text-mint-400 hover:text-mint-300">Facebook</Link>
            : publicação de conteúdos marcados com esse canal (sem credencial oficial configurada ainda)
          </li>
          <li>
            <Link to="/anuncios" className="text-mint-400 hover:text-mint-300">Anúncios</Link>
            : planejamento e aprovação de anúncios pagos vinculados a campanhas (ativação real depende de credencial oficial)
          </li>
          <li>
            <Link to="/analytics" className="text-mint-400 hover:text-mint-300">Analytics</Link>
            : indicadores consolidados de todos os módulos acima, com filtro de período e comparação — só leitura, dados reais
          </li>
        </ul>
      </div>
    </div>
  );
}

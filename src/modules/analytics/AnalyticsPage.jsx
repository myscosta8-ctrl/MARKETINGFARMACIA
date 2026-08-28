import { useEffect, useMemo, useState } from 'react';
import { usePermissoes } from '../../hooks/usePermissoes';
import { logger } from '../../utils/logger';
import { buscarDadosAnalytics, calcularMetricas } from './service';
import { PERIODOS, limitesPeriodo, limitesPeriodoAnterior, formatarVariacao } from './constants';

export default function AnalyticsPage() {
  const { pode_ver, carregando: carregandoPermissoes } = usePermissoes('analytics');

  const [periodo, setPeriodo] = useState('todos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [metricas, setMetricas] = useState(null);
  const [metricasAnteriores, setMetricasAnteriores] = useState(null);

  useEffect(() => {
    if (!pode_ver) return;
    carregar();
  }, [pode_ver, periodo]);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const atual = limitesPeriodo(periodo);
      const dadosAtuais = await buscarDadosAnalytics(atual ?? {});
      setMetricas(calcularMetricas(dadosAtuais));

      const anterior = limitesPeriodoAnterior(periodo);
      if (anterior) {
        const dadosAnteriores = await buscarDadosAnalytics(anterior);
        setMetricasAnteriores(calcularMetricas(dadosAnteriores));
      } else {
        setMetricasAnteriores(null);
      }
    } catch (err) {
      logger.error('Falha ao carregar Analytics', err);
      setErro('Não foi possível carregar os dados. Confira suas permissões.');
    } finally {
      setCarregando(false);
    }
  }

  const semDadoNenhum = useMemo(() => {
    if (!metricas) return false;
    return metricas.campanhas.total === 0 && metricas.conteudos.total === 0 &&
      metricas.oportunidades.total === 0 && metricas.leads.total === 0 &&
      metricas.crm.contatos === 0 && metricas.ia.total === 0 &&
      metricas.whatsapp.total === 0 && metricas.instagram.total === 0 &&
      metricas.facebook.total === 0 && metricas.anuncios.total === 0;
  }, [metricas]);

  if (carregandoPermissoes) return <p className="text-ink-500 text-sm">Carregando…</p>;

  if (!pode_ver) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl text-ink-100">Analytics</h1>
        <p className="text-ink-500 text-sm mt-2">Você não tem permissão para visualizar Analytics.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-100">Analytics</h1>
          <p className="text-ink-500 text-sm mt-1">Visão consolidada de todos os módulos — só leitura, dados reais.</p>
        </div>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="rounded-lg bg-base-800 border border-base-700 px-3 py-1.5 text-sm text-ink-100">
          {PERIODOS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {erro && <p className="text-sm text-red-400 mt-4">{erro}</p>}

      {carregando ? (
        <p className="text-ink-500 text-sm mt-8">Carregando…</p>
      ) : semDadoNenhum ? (
        <p className="text-ink-500 text-sm mt-8">Nenhum dado registrado neste período. Experimente "Todo o período" ou ajuste o filtro.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-6">
            <Indicador titulo="Campanhas" valor={metricas.campanhas.total} nota={`${metricas.campanhas.ativas} em andamento`} anterior={metricasAnteriores?.campanhas.total} />
            <Indicador titulo="Conteúdos" valor={metricas.conteudos.total} nota="produzidos" anterior={metricasAnteriores?.conteudos.total} />
            <Indicador titulo="Oportunidades" valor={metricas.oportunidades.total} nota="registradas" anterior={metricasAnteriores?.oportunidades.total} />
            <Indicador titulo="Leads" valor={metricas.leads.total} nota={`${metricas.leads.convertidos} convertidos`} anterior={metricasAnteriores?.leads.total} />
            <IndicadorTaxa titulo="Taxa de conversão de leads" taxa={metricas.leads.taxaConversao} total={metricas.leads.total} />
            <Indicador titulo="Contatos CRM" valor={metricas.crm.contatos} nota={`${metricas.crm.interacoes} interações`} anterior={metricasAnteriores?.crm.contatos} />
            <Indicador titulo="Solicitações de IA" valor={metricas.ia.total} nota={`${metricas.ia.concluidas} concluídas`} anterior={metricasAnteriores?.ia.total} />
            <Indicador titulo="Anúncios" valor={metricas.anuncios.total} nota={`${metricas.anuncios.emExecucao} em execução`} anterior={metricasAnteriores?.anuncios.total} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <Painel titulo="Funil de Leads">
              <BarrasStatus dados={metricas.leads.porStatus} ordem={['novo', 'em_atendimento', 'qualificado', 'convertido', 'perdido']} />
            </Painel>
            <Painel titulo="Oportunidades por status">
              <BarrasStatus dados={metricas.oportunidades.porStatus} ordem={['identificada', 'em_analise', 'validada', 'em_execucao', 'concluida', 'descartada']} />
            </Painel>
            <Painel titulo="Campanhas por status">
              <BarrasStatus dados={metricas.campanhas.porStatus} ordem={['rascunho', 'revisao', 'aprovada', 'publicada']} />
            </Painel>
            <Painel titulo="Conteúdo por canal">
              <BarrasStatus dados={metricas.conteudos.porCanal} />
            </Painel>
            <Painel titulo="Atividade por canal (WhatsApp / Instagram / Facebook)">
              <BarrasStatus dados={{ WhatsApp: metricas.whatsapp.total, Instagram: metricas.instagram.total, Facebook: metricas.facebook.total }} />
            </Painel>
            <Painel titulo="Anúncios por status">
              <BarrasStatus dados={metricas.anuncios.porStatus} ordem={['rascunho', 'revisao', 'aprovado', 'ativo', 'pausado', 'encerrado', 'erro', 'indisponivel']} />
            </Painel>
          </div>
        </>
      )}
    </div>
  );
}

function Indicador({ titulo, valor, nota, anterior }) {
  const variacao = anterior !== undefined ? formatarVariacao(valor, anterior) : null;
  return (
    <div className="rounded-xl border border-base-800 bg-base-900 p-4">
      <p className="text-xs uppercase tracking-wide text-ink-500">{titulo}</p>
      <p className="font-display text-2xl text-ink-100 mt-1">{valor}</p>
      <p className="text-xs text-ink-500 mt-1">{nota}</p>
      {variacao && (
        <p className={`text-xs mt-1 ${variacao.positiva ? 'text-mint-400' : 'text-red-400'}`}>{variacao.texto} vs. período anterior</p>
      )}
      {anterior !== undefined && !variacao && (
        <p className="text-xs text-ink-500 mt-1">dados insuficientes para comparação</p>
      )}
    </div>
  );
}

function IndicadorTaxa({ titulo, taxa, total }) {
  return (
    <div className="rounded-xl border border-base-800 bg-base-900 p-4">
      <p className="text-xs uppercase tracking-wide text-ink-500">{titulo}</p>
      <p className="font-display text-2xl text-ink-100 mt-1">{taxa != null ? `${taxa.toFixed(1)}%` : '—'}</p>
      <p className="text-xs text-ink-500 mt-1">{total > 0 ? `de ${total} lead(s)` : 'sem leads neste período'}</p>
    </div>
  );
}

function Painel({ titulo, children }) {
  return (
    <div className="rounded-xl border border-base-800 bg-base-900 p-4">
      <h2 className="text-sm font-medium text-ink-100 mb-3">{titulo}</h2>
      {children}
    </div>
  );
}

function BarrasStatus({ dados, ordem }) {
  const entradas = ordem
    ? ordem.filter((k) => dados[k] != null).map((k) => [k, dados[k]])
    : Object.entries(dados);
  const max = Math.max(1, ...entradas.map(([, v]) => v));

  if (entradas.length === 0 || entradas.every(([, v]) => v === 0)) {
    return <p className="text-sm text-ink-500">Sem dados neste período.</p>;
  }

  return (
    <div className="space-y-2">
      {entradas.map(([chave, valor]) => (
        <div key={chave}>
          <div className="flex justify-between text-xs text-ink-400 mb-0.5">
            <span className="capitalize">{chave.replace(/_/g, ' ')}</span>
            <span>{valor}</span>
          </div>
          <div className="h-2 rounded-full bg-base-800 overflow-hidden">
            <div className="h-full bg-mint-500 rounded-full" style={{ width: `${(valor / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePermissoes } from '../../hooks/usePermissoes';
import { logger } from '../../utils/logger';
import { provedorIAConfigurado } from '../../lib/ia/registro';
import { executarSolicitacaoIA } from './service';
import { FINALIDADES, labelFinalidade, descricaoFinalidade, labelStatus, corStatus } from './constants';

export default function IAPage() {
  const { pode_ver, pode_editar, carregando: carregandoPermissoes } = usePermissoes('ia');

  const [finalidade, setFinalidade] = useState(FINALIDADES[0].value);
  const [prompt, setPrompt] = useState('');
  const [campanhaId, setCampanhaId] = useState('');
  const [produtoId, setProdutoId] = useState('');
  const [conteudoId, setConteudoId] = useState('');
  const [oportunidadeId, setOportunidadeId] = useState('');

  const [campanhas, setCampanhas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [conteudos, setConteudos] = useState([]);
  const [oportunidades, setOportunidades] = useState([]);

  const [executando, setExecutando] = useState(false);
  const [ultimaExecucao, setUltimaExecucao] = useState(null);
  const [erro, setErro] = useState('');

  const [historico, setHistorico] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);

  const configurado = provedorIAConfigurado();

  useEffect(() => {
    if (!pode_ver) return;
    carregarHistorico();
    supabase.from('campanhas').select('id, titulo').then(({ data }) => setCampanhas(data ?? []));
    supabase.from('produtos').select('id, nome').eq('ativo', true).then(({ data }) => setProdutos(data ?? []));
    supabase.from('conteudos').select('id, titulo').then(({ data }) => setConteudos(data ?? []));
    supabase.from('oportunidades').select('id, titulo').then(({ data }) => setOportunidades(data ?? []));
  }, [pode_ver]);

  async function carregarHistorico() {
    setCarregandoHistorico(true);
    const { data, error } = await supabase
      .from('ia_solicitacoes')
      .select('*, usuarios:usuario_id(nome)')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) logger.error('Falha ao carregar histórico de IA', error);
    setHistorico(data ?? []);
    setCarregandoHistorico(false);
  }

  async function enviar(e) {
    e.preventDefault();
    if (!prompt.trim()) { setErro('Descreva o que você precisa.'); return; }
    setErro('');
    setExecutando(true);
    setUltimaExecucao(null);
    try {
      const resultado = await executarSolicitacaoIA({
        finalidade,
        promptUsuario: prompt.trim(),
        campanhaId: campanhaId || null,
        produtoId: produtoId || null,
        conteudoId: conteudoId || null,
        oportunidadeId: oportunidadeId || null,
      });
      setUltimaExecucao(resultado);
      await carregarHistorico();
    } catch {
      setErro('Não foi possível registrar a solicitação. Confira suas permissões.');
    } finally {
      setExecutando(false);
    }
  }

  if (carregandoPermissoes) return <p className="text-ink-500 text-sm">Carregando…</p>;

  if (!pode_ver) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl text-ink-100">IA</h1>
        <p className="text-ink-500 text-sm mt-2">Você não tem permissão para acessar o módulo de IA.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl text-ink-100">Central de IA</h1>
      <p className="text-ink-500 text-sm mt-1">
        Sugestões assistidas por IA para marketing — sempre revisadas por um humano antes de virar ação.
      </p>

      {!configurado && (
        <div className="mt-4 rounded-lg border border-amber-400/40 bg-amber-400/5 p-3 text-sm text-amber-400">
          Nenhum provedor de IA está configurado ainda. Você pode registrar suas solicitações mesmo
          assim — elas ficam no histórico como "Indisponível" até uma credencial ser configurada em
          Integrações. Nenhuma resposta é inventada.
        </div>
      )}

      {pode_editar ? (
        <form onSubmit={enviar} className="mt-6 space-y-4 bg-base-900 border border-base-800 rounded-xl p-5">
          <Campo label="O que você quer fazer?">
            <select value={finalidade} onChange={(e) => setFinalidade(e.target.value)} className="campo">
              {FINALIDADES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <p className="text-xs text-ink-500 mt-1">{descricaoFinalidade(finalidade)}</p>
          </Campo>

          <Campo label="Descreva o pedido">
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="campo" rows={4} placeholder="Ex: sugestão de campanha para o Dia das Mães focada em cosméticos" />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Campanha relacionada (opcional)">
              <select value={campanhaId} onChange={(e) => setCampanhaId(e.target.value)} className="campo">
                <option value="">—</option>
                {campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
              </select>
            </Campo>
            <Campo label="Produto relacionado (opcional)">
              <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className="campo">
                <option value="">—</option>
                {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Conteúdo relacionado (opcional)">
              <select value={conteudoId} onChange={(e) => setConteudoId(e.target.value)} className="campo">
                <option value="">—</option>
                {conteudos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
              </select>
            </Campo>
            <Campo label="Oportunidade relacionada (opcional)">
              <select value={oportunidadeId} onChange={(e) => setOportunidadeId(e.target.value)} className="campo">
                <option value="">—</option>
                {oportunidades.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
              </select>
            </Campo>
          </div>

          {erro && <p className="text-sm text-red-400">{erro}</p>}

          <button type="submit" disabled={executando} className="rounded-lg bg-mint-500 hover:bg-mint-600 disabled:opacity-60 text-base-950 font-medium px-4 py-2 text-sm transition">
            {executando ? 'Enviando…' : 'Enviar solicitação'}
          </button>

          <style>{`.campo { width: 100%; border-radius: 0.5rem; background: #16213a; border: 1px solid #1f2d4d; padding: 0.5rem 0.75rem; color: #eef2f8; outline: none; font-size: 0.875rem; } .campo:focus { border-color: #2fb894; }`}</style>
        </form>
      ) : (
        <p className="text-sm text-ink-500 mt-6">Você não tem permissão para enviar solicitações — pode visualizar o histórico abaixo.</p>
      )}

      {ultimaExecucao && (
        <div className="mt-4 rounded-xl border border-base-800 bg-base-900 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink-100">Resultado</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full ${corStatus(ultimaExecucao.status)}`}>{labelStatus(ultimaExecucao.status)}</span>
          </div>
          {ultimaExecucao.status === 'concluida' && (
            <p className="text-sm text-ink-300 mt-2 whitespace-pre-wrap">{ultimaExecucao.resposta}</p>
          )}
          {ultimaExecucao.erro_mensagem && (
            <p className="text-sm text-amber-400 mt-2">{ultimaExecucao.erro_mensagem}</p>
          )}
        </div>
      )}

      <h2 className="font-display text-lg text-ink-100 mt-8 mb-3">Histórico</h2>
      {carregandoHistorico ? (
        <p className="text-ink-500 text-sm">Carregando…</p>
      ) : historico.length === 0 ? (
        <p className="text-ink-500 text-sm">Nenhuma solicitação registrada ainda.</p>
      ) : (
        <div className="space-y-2">
          {historico.map((h) => (
            <div key={h.id} className="rounded-lg border border-base-800 bg-base-900 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-100 font-medium">{labelFinalidade(h.finalidade)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${corStatus(h.status)}`}>{labelStatus(h.status)}</span>
              </div>
              <p className="text-xs text-ink-500 mt-1">{h.prompt_usuario}</p>
              {h.resposta && <p className="text-sm text-ink-300 mt-2 whitespace-pre-wrap">{h.resposta}</p>}
              {h.erro_mensagem && <p className="text-xs text-amber-400 mt-1">{h.erro_mensagem}</p>}
              <p className="text-[11px] text-ink-500 mt-2">{h.usuarios?.nome} · {new Date(h.created_at).toLocaleString('pt-BR')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="block text-sm text-ink-300 mb-1">{label}</label>
      {children}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { usePermissoes } from '../../hooks/usePermissoes';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../utils/logger';
import { publicarConteudoInstagram } from './service';
import { labelStatus, corStatus, STATUS_INTEGRACAO_LABEL } from './constants';

export default function InstagramPage() {
  const { perfil } = useAuth();
  const { pode_ver, pode_editar, carregando: carregandoPermissoes } = usePermissoes('instagram');

  const [integracao, setIntegracao] = useState(null);
  const [carregandoIntegracao, setCarregandoIntegracao] = useState(true);

  const [conteudosElegiveis, setConteudosElegiveis] = useState([]);
  const [carregandoConteudos, setCarregandoConteudos] = useState(true);
  const [publicandoId, setPublicandoId] = useState(null);
  const [erro, setErro] = useState('');

  const [historico, setHistorico] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);

  useEffect(() => {
    if (!pode_ver) return;
    carregarIntegracao();
    carregarConteudosElegiveis();
    carregarHistorico();
  }, [pode_ver]);

  async function carregarIntegracao() {
    setCarregandoIntegracao(true);
    const { data, error } = await supabase.from('integracoes').select('*').eq('provedor', 'instagram').maybeSingle();
    if (error) logger.error('Falha ao carregar status de integração do Instagram', error);
    setIntegracao(data);
    setCarregandoIntegracao(false);
  }

  async function carregarConteudosElegiveis() {
    setCarregandoConteudos(true);
    // Conteúdos com canal 'instagram' já marcado (Sprint 5) e ainda sem
    // publicação registrada — evita duplicar a lista com o que já foi
    // tentado (esses aparecem só no histórico).
    const { data: canais, error: eCanais } = await supabase
      .from('conteudo_canais')
      .select('conteudo_id, conteudos(id, titulo, status, texto_copy)')
      .eq('canal', 'instagram');
    if (eCanais) logger.error('Falha ao carregar conteúdos elegíveis', eCanais);

    const { data: jaPublicados } = await supabase.from('instagram_publicacoes').select('conteudo_id');
    const idsJaTentados = new Set((jaPublicados ?? []).map((p) => p.conteudo_id));

    const elegiveis = (canais ?? [])
      .map((c) => c.conteudos)
      .filter((c) => c && !idsJaTentados.has(c.id));
    setConteudosElegiveis(elegiveis);
    setCarregandoConteudos(false);
  }

  async function carregarHistorico() {
    setCarregandoHistorico(true);
    const { data, error } = await supabase
      .from('instagram_publicacoes')
      .select('*, conteudos(titulo), usuarios:usuario_id(nome)')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) logger.error('Falha ao carregar histórico de publicações', error);
    setHistorico(data ?? []);
    setCarregandoHistorico(false);
  }

  async function publicar(conteudoId) {
    setErro('');
    setPublicandoId(conteudoId);
    try {
      await publicarConteudoInstagram({ conteudoId });
      await Promise.all([carregarConteudosElegiveis(), carregarHistorico()]);
    } catch {
      setErro('Não foi possível registrar a publicação. Confira suas permissões.');
    } finally {
      setPublicandoId(null);
    }
  }

  if (carregandoPermissoes) return <p className="text-ink-500 text-sm">Carregando…</p>;

  if (!pode_ver) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl text-ink-100">Instagram</h1>
        <p className="text-ink-500 text-sm mt-2">Você não tem permissão para acessar o módulo de Instagram.</p>
      </div>
    );
  }

  const statusIntegracao = integracao?.status ?? 'nao_configurado';

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl text-ink-100">Instagram</h1>
      <p className="text-ink-500 text-sm mt-1">Publicação de conteúdos marcados com o canal Instagram — sem credencial oficial configurada ainda.</p>

      {carregandoIntegracao ? (
        <p className="text-ink-500 text-sm mt-4">Carregando status…</p>
      ) : (
        <div className={`mt-4 rounded-lg border p-3 text-sm ${statusIntegracao === 'conectado' ? 'border-mint-500/40 bg-mint-500/5 text-mint-400' : 'border-amber-400/40 bg-amber-400/5 text-amber-400'}`}>
          Status da integração: <strong>{STATUS_INTEGRACAO_LABEL[statusIntegracao] ?? statusIntegracao}</strong>.
          {statusIntegracao === 'nao_configurado' && perfil?.papel === 'admin' && (
            <> Configuração de credencial oficial (Meta Business) fica em Configurações — nenhuma chave é guardada em texto puro nesta tela.</>
          )}
          {statusIntegracao === 'nao_configurado' && perfil?.papel !== 'admin' && (
            <> Fale com um administrador da farmácia para configurar.</>
          )}
        </div>
      )}

      <h2 className="font-display text-lg text-ink-100 mt-8 mb-3">Conteúdos prontos para publicar</h2>
      <p className="text-xs text-ink-500 mb-3">
        Só aparecem aqui conteúdos já marcados com o canal Instagram em{' '}
        <Link to="/conteudo" className="text-mint-400 hover:text-mint-300">Conteúdo</Link>.
      </p>
      {carregandoConteudos ? (
        <p className="text-ink-500 text-sm">Carregando…</p>
      ) : conteudosElegiveis.length === 0 ? (
        <p className="text-ink-500 text-sm">Nenhum conteúdo elegível no momento.</p>
      ) : (
        <div className="space-y-2">
          {conteudosElegiveis.map((c) => (
            <div key={c.id} className="rounded-lg border border-base-800 bg-base-900 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Link to={`/conteudo/${c.id}`} className="text-sm text-ink-100 font-medium hover:text-mint-400">{c.titulo}</Link>
                {c.texto_copy && <p className="text-xs text-ink-500 mt-0.5 truncate">{c.texto_copy}</p>}
              </div>
              {pode_editar && (
                <button
                  disabled={publicandoId === c.id}
                  onClick={() => publicar(c.id)}
                  className="shrink-0 text-sm px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-60 bg-mint-500 hover:bg-mint-600 text-base-950"
                >
                  {publicandoId === c.id ? 'Registrando…' : 'Publicar'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {erro && <p className="text-sm text-red-400 mt-3">{erro}</p>}

      <h2 className="font-display text-lg text-ink-100 mt-8 mb-3">Histórico</h2>
      {carregandoHistorico ? (
        <p className="text-ink-500 text-sm">Carregando…</p>
      ) : historico.length === 0 ? (
        <p className="text-ink-500 text-sm">Nenhuma publicação registrada ainda.</p>
      ) : (
        <div className="space-y-2">
          {historico.map((p) => (
            <div key={p.id} className="rounded-lg border border-base-800 bg-base-900 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-100 font-medium">{p.conteudos?.titulo || 'Conteúdo removido'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${corStatus(p.status)}`}>{labelStatus(p.status)}</span>
              </div>
              {p.link_publicado && (
                <a href={p.link_publicado} target="_blank" rel="noreferrer" className="text-xs text-mint-400 hover:text-mint-300 mt-1 block">{p.link_publicado}</a>
              )}
              {(p.curtidas != null || p.comentarios != null || p.alcance != null) && (
                <p className="text-xs text-ink-500 mt-1">
                  {p.curtidas != null && `${p.curtidas} curtida(s)`}
                  {p.comentarios != null && ` · ${p.comentarios} comentário(s)`}
                  {p.alcance != null && ` · ${p.alcance} de alcance`}
                </p>
              )}
              {p.erro_mensagem && <p className="text-xs text-amber-400 mt-1">{p.erro_mensagem}</p>}
              <p className="text-[11px] text-ink-500 mt-2">{p.usuarios?.nome} · {new Date(p.created_at).toLocaleString('pt-BR')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

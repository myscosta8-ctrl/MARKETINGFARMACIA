import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissoes } from '../../hooks/usePermissoes';
import { logger } from '../../utils/logger';
import {
  labelStatus, corStatus, labelTipo, labelCanal, CANAIS_CONTEUDO,
  TRANSICOES_VALIDAS, exigeAprovacao,
} from './constants';

const ACAO_POR_TRANSICAO = {
  'rascunho->revisao': 'Enviar para revisão',
  'revisao->rascunho': 'Voltar para rascunho',
  'revisao->aprovado': 'Aprovar conteúdo',
  'aprovado->agendado': 'Agendar',
  'aprovado->cancelado': 'Cancelar',
  'agendado->publicado': 'Marcar como publicado',
  'agendado->pausado': 'Pausar',
  'agendado->cancelado': 'Cancelar',
  'publicado->pausado': 'Pausar',
  'publicado->cancelado': 'Cancelar',
  'pausado->agendado': 'Reagendar',
  'pausado->publicado': 'Retomar publicação',
  'pausado->cancelado': 'Cancelar',
};

export default function ConteudoDetalhe() {
  const { id } = useParams();
  const { perfil } = useAuth();
  const { pode_editar, pode_aprovar } = usePermissoes('conteudo');

  const [conteudo, setConteudo] = useState(null);
  const [canais, setCanais] = useState([]);
  const [logs, setLogs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [canalNovo, setCanalNovo] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [{ data: c, error: eC }, { data: ca }, { data: lg }] = await Promise.all([
      supabase.from('conteudos').select('*, campanhas(titulo), produtos(nome), usuarios:responsavel_id(nome)').eq('id', id).single(),
      supabase.from('conteudo_canais').select('*').eq('conteudo_id', id),
      supabase
        .from('logs_auditoria')
        .select('id, acao, created_at, dados_novos, usuarios:usuario_id(nome)')
        .eq('entidade', 'conteudos')
        .eq('entidade_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    if (eC) logger.error('Falha ao carregar conteúdo', eC);
    setConteudo(c ?? null);
    setCanais(ca ?? []);
    setLogs(lg ?? []);
    setCarregando(false);
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function transicionar(novoStatus) {
    setAcaoEmAndamento(true);
    setMensagem('');
    const payload = { status: novoStatus };
    if (novoStatus === 'aprovado') payload.aprovado_por = perfil?.id;

    const { error } = await supabase.from('conteudos').update(payload).eq('id', id);
    setAcaoEmAndamento(false);
    if (error) {
      logger.error('Falha ao transicionar conteúdo', error);
      setMensagem(`Não foi possível concluir: ${error.message}`);
      return;
    }
    await carregar();
  }

  async function adicionarCanal(e) {
    e.preventDefault();
    if (!canalNovo) return;
    const { error } = await supabase.from('conteudo_canais').insert({ conteudo_id: id, canal: canalNovo });
    if (error) {
      logger.error('Falha ao adicionar canal', error);
      return;
    }
    setCanalNovo('');
    await carregar();
  }

  async function removerCanal(canalId) {
    const { error } = await supabase.from('conteudo_canais').delete().eq('id', canalId);
    if (error) {
      logger.error('Falha ao remover canal', error);
      return;
    }
    await carregar();
  }

  if (carregando) return <p className="text-ink-500 text-sm">Carregando…</p>;
  if (!conteudo) return <p className="text-ink-500 text-sm">Conteúdo não encontrado.</p>;

  const transicoesPossiveis = TRANSICOES_VALIDAS[conteudo.status] ?? [];
  const canaisDisponiveis = CANAIS_CONTEUDO.filter((c) => !canais.some((x) => x.canal === c.value));

  return (
    <div className="max-w-3xl">
      <Link to="/conteudo" className="text-sm text-ink-500 hover:text-ink-300">← Conteúdo</Link>

      <div className="flex items-start justify-between flex-wrap gap-3 mt-2">
        <div>
          <h1 className="font-display text-2xl text-ink-100">{conteudo.titulo}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${corStatus(conteudo.status)}`}>{labelStatus(conteudo.status)}</span>
            <span className="text-xs text-ink-500">{labelTipo(conteudo.tipo)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {transicoesPossiveis.map((novoStatus) => {
            const precisaAprovar = exigeAprovacao(conteudo.status, novoStatus);
            const autorizado = precisaAprovar ? pode_aprovar : pode_editar;
            if (!autorizado) return null;
            return (
              <button
                key={novoStatus}
                disabled={acaoEmAndamento}
                onClick={() => transicionar(novoStatus)}
                className={`text-sm px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-60 ${
                  precisaAprovar ? 'bg-mint-500 hover:bg-mint-600 text-base-950' : 'border border-base-700 text-ink-300 hover:text-ink-100'
                }`}
              >
                {ACAO_POR_TRANSICAO[`${conteudo.status}->${novoStatus}`] ?? novoStatus}
              </button>
            );
          })}
        </div>
      </div>

      {mensagem && <p className="text-sm text-red-400 mt-3">{mensagem}</p>}
      {!pode_aprovar && transicoesPossiveis.includes('aprovado') && (
        <p className="text-xs text-ink-500 mt-2">Aguardando aprovação de um usuário autorizado (pode_aprovar).</p>
      )}

      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        <Bloco titulo="Relacionamentos">
          <Linha rotulo="Campanha" valor={conteudo.campanhas?.titulo || '—'} />
          <Linha rotulo="Produto" valor={conteudo.produtos?.nome || '—'} />
          <Linha rotulo="Responsável" valor={conteudo.usuarios?.nome || '—'} />
        </Bloco>
        <Bloco titulo="Agendamento">
          <Linha rotulo="Data" valor={conteudo.data_agendamento || '—'} />
          <Linha rotulo="Hora" valor={conteudo.hora_agendamento || '—'} />
          <Linha rotulo="Aprovado em" valor={conteudo.aprovado_em ? new Date(conteudo.aprovado_em).toLocaleString('pt-BR') : '—'} />
        </Bloco>
      </div>

      {conteudo.descricao && (
        <Bloco titulo="Descrição" className="mt-4"><p className="text-sm text-ink-300 whitespace-pre-wrap">{conteudo.descricao}</p></Bloco>
      )}

      {(conteudo.texto_copy || conteudo.cta || conteudo.hashtags) && (
        <Bloco titulo="Texto/copy (público)" className="mt-4">
          {conteudo.texto_copy && <p className="text-sm text-ink-300 whitespace-pre-wrap">{conteudo.texto_copy}</p>}
          {conteudo.cta && <p className="text-sm text-mint-400 mt-2">CTA: {conteudo.cta}</p>}
          {conteudo.hashtags && <p className="text-sm text-ink-500 mt-1">{conteudo.hashtags}</p>}
        </Bloco>
      )}

      <Bloco titulo="Canais" className="mt-4">
        {canais.length === 0 ? (
          <p className="text-sm text-ink-500 mb-2">Nenhum canal selecionado.</p>
        ) : (
          <ul className="text-sm text-ink-300 space-y-1 mb-3">
            {canais.map((c) => (
              <li key={c.id} className="flex justify-between items-center">
                <span>{labelCanal(c.canal)}</span>
                {pode_editar && <button onClick={() => removerCanal(c.id)} className="text-xs text-red-400 hover:text-red-300">remover</button>}
              </li>
            ))}
          </ul>
        )}
        {pode_editar && canaisDisponiveis.length > 0 && (
          <form onSubmit={adicionarCanal} className="flex gap-2">
            <select value={canalNovo} onChange={(e) => setCanalNovo(e.target.value)} className="rounded-lg bg-base-800 border border-base-700 px-2 py-1 text-xs text-ink-100">
              <option value="">Adicionar canal…</option>
              {canaisDisponiveis.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <button className="text-xs bg-mint-500 hover:bg-mint-600 text-base-950 font-medium px-3 py-1.5 rounded-lg transition">Adicionar</button>
          </form>
        )}
      </Bloco>

      {conteudo.observacoes_internas && (
        <Bloco titulo="Observações internas (equipe)" className="mt-4">
          <p className="text-sm text-ink-300 whitespace-pre-wrap">{conteudo.observacoes_internas}</p>
        </Bloco>
      )}

      <Bloco titulo="Histórico" className="mt-4">
        {logs.length === 0 ? (
          <p className="text-sm text-ink-500">Sem eventos registrados ainda.</p>
        ) : (
          <ul className="text-sm text-ink-300 space-y-1.5">
            {logs.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span>
                  <span className="text-ink-100 capitalize">{l.acao}</span>
                  {l.usuarios?.nome ? ` por ${l.usuarios.nome}` : ''}
                  {l.dados_novos?.status ? ` → ${labelStatus(l.dados_novos.status)}` : ''}
                </span>
                <span className="text-ink-500 text-xs shrink-0">{new Date(l.created_at).toLocaleString('pt-BR')}</span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <p className="text-xs text-ink-500 mt-6">
        Nenhuma publicação real acontece nas redes — este sprint só prepara a estrutura. Toda
        transição de estado passa pela validação do banco de dados.
      </p>
    </div>
  );
}

function Bloco({ titulo, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-base-800 bg-base-900 p-4 ${className}`}>
      <h2 className="text-sm font-medium text-ink-100 mb-2">{titulo}</h2>
      {children}
    </div>
  );
}

function Linha({ rotulo, valor }) {
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-ink-500">{rotulo}</span>
      <span className="text-ink-200 text-right">{valor}</span>
    </div>
  );
}

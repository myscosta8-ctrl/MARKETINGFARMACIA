import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissoes } from '../../hooks/usePermissoes';
import { logger } from '../../utils/logger';
import {
  labelStatus, corStatus, labelObjetivo, labelPublico, labelCanal,
  TRANSICOES_VALIDAS,
} from './constants';

const ACAO_POR_TRANSICAO = {
  'rascunho->revisao': 'Enviar para revisão',
  'revisao->rascunho': 'Voltar para rascunho',
  'revisao->aprovada': 'Aprovar campanha',
  'aprovada->publicada': 'Publicar campanha',
  'publicada->pausada': 'Pausar campanha',
  'pausada->publicada': 'Retomar campanha',
  'publicada->encerrada': 'Encerrar campanha',
  'pausada->encerrada': 'Encerrar campanha',
};

// Transições que exigem pode_aprovar (espelha a RLS/trigger do banco —
// a UI só usa isso para decidir o que mostrar; quem barra de verdade é o banco).
const TRANSICOES_QUE_EXIGEM_APROVACAO = new Set(['revisao->aprovada']);

export default function CampanhaDetalhe() {
  const { id } = useParams();
  const { perfil } = useAuth();
  const { pode_editar, pode_aprovar } = usePermissoes('campanhas');

  const [campanha, setCampanha] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [conteudos, setConteudos] = useState([]);
  const [logs, setLogs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [{ data: c, error: eC }, { data: p }, { data: co }, { data: lg }] = await Promise.all([
      supabase.from('campanhas').select('*, usuarios:responsavel_id(nome)').eq('id', id).single(),
      supabase.from('campanha_produtos').select('*').eq('campanha_id', id).order('created_at'),
      supabase.from('campanha_conteudos').select('*').eq('campanha_id', id).order('created_at'),
      supabase
        .from('logs_auditoria')
        .select('id, acao, created_at, usuario_id, dados_novos, usuarios:usuario_id(nome)')
        .eq('entidade', 'campanhas')
        .eq('entidade_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    if (eC) logger.error('Falha ao carregar campanha', eC);
    setCampanha(c ?? null);
    setProdutos(p ?? []);
    setConteudos(co ?? []);
    setLogs(lg ?? []);
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function transicionar(novoStatus) {
    setAcaoEmAndamento(true);
    setMensagem('');

    const payload = { status: novoStatus };
    // Só preenche aprovado_por quando é de fato uma aprovação — o banco
    // exige que seja exatamente auth.uid(); nunca inventamos outro valor.
    if (novoStatus === 'aprovada') payload.aprovado_por = perfil?.id;

    const { error } = await supabase.from('campanhas').update(payload).eq('id', id);
    setAcaoEmAndamento(false);

    if (error) {
      logger.error('Falha ao transicionar campanha', error);
      setMensagem(`Não foi possível concluir: ${error.message}`);
      return;
    }
    await carregar();
  }

  if (carregando) return <p className="text-ink-500 text-sm">Carregando…</p>;
  if (!campanha) return <p className="text-ink-500 text-sm">Campanha não encontrada.</p>;

  const transicoesPossiveis = TRANSICOES_VALIDAS[campanha.status] ?? [];

  return (
    <div className="max-w-3xl">
      <Link to="/campanhas" className="text-sm text-ink-500 hover:text-ink-300">← Campanhas</Link>

      <div className="flex items-start justify-between flex-wrap gap-3 mt-2">
        <div>
          <h1 className="font-display text-2xl text-ink-100">{campanha.titulo}</h1>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${corStatus(campanha.status)}`}>
            {labelStatus(campanha.status)}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {transicoesPossiveis.map((novoStatus) => {
            const chave = `${campanha.status}->${novoStatus}`;
            const exigeAprovacao = TRANSICOES_QUE_EXIGEM_APROVACAO.has(chave);
            const autorizado = exigeAprovacao ? pode_aprovar : pode_editar;
            if (!autorizado) return null;
            return (
              <button
                key={novoStatus}
                disabled={acaoEmAndamento}
                onClick={() => transicionar(novoStatus)}
                className={`text-sm px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-60 ${
                  exigeAprovacao
                    ? 'bg-mint-500 hover:bg-mint-600 text-base-950'
                    : 'border border-base-700 text-ink-300 hover:text-ink-100'
                }`}
              >
                {ACAO_POR_TRANSICAO[chave] ?? novoStatus}
              </button>
            );
          })}
        </div>
      </div>

      {mensagem && <p className="text-sm text-red-400 mt-3">{mensagem}</p>}

      {!pode_aprovar && transicoesPossiveis.includes('aprovada') && (
        <p className="text-xs text-ink-500 mt-2">Aguardando aprovação de um usuário autorizado (pode_aprovar).</p>
      )}

      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        <Bloco titulo="Objetivo e público">
          <Linha rotulo="Objetivos" valor={(campanha.objetivos ?? []).map(labelObjetivo).join(', ') || '—'} />
          <Linha rotulo="Público-alvo" valor={labelPublico(campanha.publico_alvo)} />
          <Linha rotulo="Tipo" valor={campanha.tipo_campanha || '—'} />
          <Linha rotulo="Responsável" valor={campanha.usuarios?.nome || '—'} />
        </Bloco>

        <Bloco titulo="Período e orçamento">
          <Linha rotulo="Início" valor={campanha.periodo_inicio || '—'} />
          <Linha rotulo="Término" valor={campanha.periodo_fim || '—'} />
          <Linha
            rotulo="Divulgação"
            valor={[campanha.possui_organico && 'Orgânica', campanha.possui_pago && 'Paga'].filter(Boolean).join(' + ') || '—'}
          />
          {campanha.possui_pago && (
            <>
              <Linha
                rotulo="Orçamento estimado"
                valor={campanha.orcamento_estimado ? `R$ ${Number(campanha.orcamento_estimado).toFixed(2)}` : '—'}
              />
              <Linha
                rotulo="Orçamento utilizado"
                valor={campanha.orcamento_utilizado ? `R$ ${Number(campanha.orcamento_utilizado).toFixed(2)}` : 'sem dado ainda'}
              />
            </>
          )}
        </Bloco>
      </div>

      {campanha.descricao && (
        <Bloco titulo="Descrição" className="mt-4">
          <p className="text-sm text-ink-300 whitespace-pre-wrap">{campanha.descricao}</p>
        </Bloco>
      )}

      {campanha.observacoes && (
        <Bloco titulo="Observações" className="mt-4">
          <p className="text-sm text-ink-300 whitespace-pre-wrap">{campanha.observacoes}</p>
        </Bloco>
      )}

      <Bloco titulo="Canais e conteúdo" className="mt-4">
        {(campanha.canais ?? []).length === 0 ? (
          <p className="text-sm text-ink-500">Nenhum canal selecionado.</p>
        ) : (
          <div className="space-y-3">
            {(campanha.canais ?? []).map((canal) => (
              <ConteudoPorCanal
                key={canal}
                canal={canal}
                campanhaId={id}
                conteudo={conteudos.find((c) => c.canal === canal)}
                podeEditar={pode_editar}
                onSalvo={carregar}
              />
            ))}
          </div>
        )}
      </Bloco>

      <Bloco titulo="Produtos da campanha" className="mt-4">
        <ProdutosCampanha campanhaId={id} produtos={produtos} podeEditar={pode_editar} onSalvo={carregar} />
      </Bloco>

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
        Nenhuma publicação real acontece nas redes — este sprint só prepara a estrutura. IA não
        aprova nem publica; toda transição de estado passa pela validação do banco de dados.
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

function ConteudoPorCanal({ canal, campanhaId, conteudo, podeEditar, onSalvo }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(conteudo?.texto ?? '');
  const [chamada, setChamada] = useState(conteudo?.chamada ?? '');
  const [cta, setCta] = useState(conteudo?.cta ?? '');
  const [hashtags, setHashtags] = useState(conteudo?.hashtags ?? '');
  const [imagemUrl, setImagemUrl] = useState(conteudo?.imagem_url ?? '');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    const payload = { texto, chamada, cta, hashtags, imagem_url: imagemUrl };
    const { error } = conteudo
      ? await supabase.from('campanha_conteudos').update(payload).eq('id', conteudo.id)
      : await supabase.from('campanha_conteudos').insert({ campanha_id: campanhaId, canal, ...payload });
    setSalvando(false);
    if (error) {
      logger.error('Falha ao salvar conteúdo do canal', error);
      return;
    }
    setEditando(false);
    onSalvo();
  }

  return (
    <div className="rounded-lg border border-base-800 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-100 font-medium">{labelCanal(canal)}</span>
        {podeEditar && (
          <button onClick={() => setEditando((v) => !v)} className="text-xs text-mint-400 hover:text-mint-300">
            {editando ? 'Fechar' : conteudo ? 'Editar' : 'Adicionar conteúdo'}
          </button>
        )}
      </div>

      {!editando && conteudo && (
        <div className="mt-2 text-xs text-ink-400 space-y-1">
          {conteudo.texto && <p>{conteudo.texto}</p>}
          {conteudo.cta && <p className="text-mint-400">CTA: {conteudo.cta}</p>}
          {conteudo.hashtags && <p className="text-ink-500">{conteudo.hashtags}</p>}
        </div>
      )}

      {editando && (
        <div className="mt-3 space-y-2">
          <textarea placeholder="Texto/legenda" value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} className="campo-mini" />
          <input placeholder="Chamada" value={chamada} onChange={(e) => setChamada(e.target.value)} className="campo-mini" />
          <input placeholder="CTA (ex: Compre agora)" value={cta} onChange={(e) => setCta(e.target.value)} className="campo-mini" />
          <input placeholder="Hashtags" value={hashtags} onChange={(e) => setHashtags(e.target.value)} className="campo-mini" />
          <input placeholder="URL da imagem" value={imagemUrl} onChange={(e) => setImagemUrl(e.target.value)} className="campo-mini" />
          <button
            onClick={salvar}
            disabled={salvando}
            className="text-xs bg-mint-500 hover:bg-mint-600 text-base-950 font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-60"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          <style>{`.campo-mini { width: 100%; border-radius: 0.375rem; background: #0f172a; border: 1px solid #1f2d4d; padding: 0.4rem 0.6rem; color: #eef2f8; outline: none; font-size: 0.8rem; }`}</style>
        </div>
      )}
    </div>
  );
}

function ProdutosCampanha({ campanhaId, produtos, podeEditar, onSalvo }) {
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [marca, setMarca] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [catalogo, setCatalogo] = useState([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState('');
  const [vinculando, setVinculando] = useState(false);

  useEffect(() => {
    supabase
      .from('produtos')
      .select('id, nome, categoria, marca')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setCatalogo(data ?? []));
  }, []);

  async function vincularDoCatalogo(e) {
    e.preventDefault();
    if (!produtoSelecionado) return;
    const p = catalogo.find((c) => c.id === produtoSelecionado);
    if (!p) return;
    setVinculando(true);
    const { error } = await supabase
      .from('campanha_produtos')
      .insert({ campanha_id: campanhaId, produto_id: p.id, nome_produto: p.nome, categoria: p.categoria, marca: p.marca });
    setVinculando(false);
    if (error) {
      logger.error('Falha ao vincular produto do catálogo', error);
      return;
    }
    setProdutoSelecionado('');
    onSalvo();
  }

  async function adicionar(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setAdicionando(true);
    const { error } = await supabase
      .from('campanha_produtos')
      .insert({ campanha_id: campanhaId, nome_produto: nome.trim(), categoria: categoria.trim() || null, marca: marca.trim() || null });
    setAdicionando(false);
    if (error) {
      logger.error('Falha ao adicionar produto', error);
      return;
    }
    setNome('');
    setCategoria('');
    setMarca('');
    onSalvo();
  }

  return (
    <div>
      {produtos.length === 0 ? (
        <p className="text-sm text-ink-500 mb-3">Nenhum produto vinculado ainda.</p>
      ) : (
        <ul className="text-sm text-ink-300 space-y-1 mb-3">
          {produtos.map((p) => (
            <li key={p.id} className="flex justify-between">
              <span>
                {p.nome_produto}{p.marca ? ` — ${p.marca}` : ''}
                {p.produto_id && <span className="text-mint-400 text-xs ml-1.5">· catálogo</span>}
              </span>
              <span className="text-ink-500 text-xs">{p.categoria}</span>
            </li>
          ))}
        </ul>
      )}
      {podeEditar && (
        <div className="space-y-2">
          {catalogo.length > 0 && (
            <form onSubmit={vincularDoCatalogo} className="flex flex-wrap gap-2">
              <select
                value={produtoSelecionado}
                onChange={(e) => setProdutoSelecionado(e.target.value)}
                className="campo-mini flex-1 min-w-[160px]"
              >
                <option value="">Selecionar do catálogo…</option>
                {catalogo.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}{p.marca ? ` — ${p.marca}` : ''}</option>
                ))}
              </select>
              <button
                disabled={vinculando || !produtoSelecionado}
                className="text-xs bg-mint-500 hover:bg-mint-600 disabled:opacity-60 text-base-950 font-medium px-3 py-1.5 rounded-lg transition"
              >
                Vincular
              </button>
            </form>
          )}
          <form onSubmit={adicionar} className="flex flex-wrap gap-2">
            <input placeholder="Produto avulso (sem catálogo)" value={nome} onChange={(e) => setNome(e.target.value)} className="campo-mini flex-1 min-w-[140px]" />
            <input placeholder="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="campo-mini w-32" />
            <input placeholder="Marca" value={marca} onChange={(e) => setMarca(e.target.value)} className="campo-mini w-32" />
            <button
              disabled={adicionando}
              className="text-xs border border-base-700 text-ink-300 hover:text-ink-100 px-3 py-1.5 rounded-lg transition disabled:opacity-60"
            >
              Adicionar avulso
            </button>
          </form>
          <style>{`.campo-mini { border-radius: 0.375rem; background: #0f172a; border: 1px solid #1f2d4d; padding: 0.4rem 0.6rem; color: #eef2f8; outline: none; font-size: 0.8rem; }`}</style>
        </div>
      )}
    </div>
  );
}

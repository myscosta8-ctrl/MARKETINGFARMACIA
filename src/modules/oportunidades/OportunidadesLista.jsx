import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissoes } from '../../hooks/usePermissoes';
import { logger } from '../../utils/logger';
import {
  CATEGORIAS, PRIORIDADES, STATUS,
  labelCategoria, labelPrioridade, corPrioridade, labelStatus, corStatus,
  TRANSICOES_VALIDAS, labelAcao,
} from './constants';

const VAZIO = {
  id: null, titulo: '', descricao: '', categoria: 'outra', origem: '', prioridade: 'media',
  potencial_estimado: '', prazo: '', responsavel_id: '', produto_id: '', campanha_id: '',
  conteudo_id: '', observacoes: '',
};

export default function OportunidadesLista() {
  const { perfil } = useAuth();
  const { pode_ver, pode_editar, carregando: carregandoPermissoes } = usePermissoes('oportunidades');

  const [itens, setItens] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [conteudos, setConteudos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [ordenacao, setOrdenacao] = useState('recentes');

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(VAZIO);
  const [detalhe, setDetalhe] = useState(null);

  useEffect(() => {
    if (!carregandoPermissoes && pode_ver) carregar();
    supabase.from('usuarios').select('id, nome').then(({ data }) => setUsuarios(data ?? []));
    supabase.from('produtos').select('id, nome').eq('ativo', true).then(({ data }) => setProdutos(data ?? []));
    supabase.from('campanhas').select('id, titulo').then(({ data }) => setCampanhas(data ?? []));
    supabase.from('conteudos').select('id, titulo').then(({ data }) => setConteudos(data ?? []));
  }, [carregandoPermissoes, pode_ver]);

  async function carregar() {
    setCarregando(true);
    setErro('');
    const { data, error } = await supabase
      .from('oportunidades')
      .select('*, usuarios:responsavel_id(nome), produtos(nome), campanhas(titulo), conteudos(titulo)')
      .order('created_at', { ascending: false });
    if (error) {
      logger.error('Falha ao carregar oportunidades', error);
      setErro('Não foi possível carregar. Confira suas permissões.');
    }
    setItens(data ?? []);
    setCarregando(false);
  }

  const indicadores = useMemo(() => {
    const contagem = Object.fromEntries(STATUS.map((s) => [s.value, 0]));
    for (const o of itens) contagem[o.status] = (contagem[o.status] ?? 0) + 1;
    return contagem;
  }, [itens]);

  const filtrados = useMemo(() => {
    let lista = itens.filter((o) => {
      if (filtroStatus && o.status !== filtroStatus) return false;
      if (filtroPrioridade && o.prioridade !== filtroPrioridade) return false;
      if (filtroCategoria && o.categoria !== filtroCategoria) return false;
      if (filtroResponsavel && o.responsavel_id !== filtroResponsavel) return false;
      if (busca && !o.titulo.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
    const ordemPrioridade = { urgente: 0, alta: 1, media: 2, baixa: 3 };
    if (ordenacao === 'prioridade') lista = [...lista].sort((a, b) => ordemPrioridade[a.prioridade] - ordemPrioridade[b.prioridade]);
    else if (ordenacao === 'prazo') lista = [...lista].sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));
    return lista;
  }, [itens, filtroStatus, filtroPrioridade, filtroCategoria, filtroResponsavel, busca, ordenacao]);

  function abrirNovo() {
    setEditando({ ...VAZIO, responsavel_id: perfil?.id ?? '' });
    setModalAberto(true);
  }

  async function salvar(dados) {
    const payload = {
      titulo: dados.titulo.trim(),
      descricao: dados.descricao.trim() || null,
      categoria: dados.categoria,
      origem: dados.origem.trim() || null,
      prioridade: dados.prioridade,
      potencial_estimado: dados.potencial_estimado !== '' ? Number(dados.potencial_estimado) : null,
      prazo: dados.prazo || null,
      responsavel_id: dados.responsavel_id || null,
      produto_id: dados.produto_id || null,
      campanha_id: dados.campanha_id || null,
      conteudo_id: dados.conteudo_id || null,
      observacoes: dados.observacoes.trim() || null,
    };
    const { error } = await supabase.from('oportunidades').insert(payload);
    if (error) { logger.error('Falha ao criar oportunidade', error); throw error; }
    setModalAberto(false);
    await carregar();
  }

  async function transicionar(id, novoStatus) {
    const { error } = await supabase.from('oportunidades').update({ status: novoStatus }).eq('id', id);
    if (error) { logger.error('Falha ao transicionar oportunidade', error); return; }
    setDetalhe(null);
    await carregar();
  }

  if (carregandoPermissoes) return <p className="text-ink-500 text-sm">Carregando…</p>;

  if (!pode_ver) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl text-ink-100">Oportunidades</h1>
        <p className="text-ink-500 text-sm mt-2">Você não tem permissão para visualizar oportunidades.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-100">Oportunidades</h1>
          <p className="text-ink-500 text-sm mt-1">Identificação e acompanhamento de oportunidades comerciais.</p>
        </div>
        {pode_editar && (
          <button onClick={abrirNovo} className="rounded-lg bg-mint-500 hover:bg-mint-600 text-base-950 font-medium px-4 py-2 text-sm transition">
            + Nova oportunidade
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-6">
        {STATUS.map((s) => (
          <button
            key={s.value}
            onClick={() => setFiltroStatus((v) => (v === s.value ? '' : s.value))}
            className={`rounded-lg border p-2.5 text-left transition ${filtroStatus === s.value ? 'border-mint-500' : 'border-base-800 hover:border-base-700'} bg-base-900`}
          >
            <p className="text-[10px] text-ink-500 truncate">{s.label}</p>
            <p className="font-display text-lg text-ink-100">{indicadores[s.value] ?? 0}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <input placeholder="Buscar por título…" value={busca} onChange={(e) => setBusca(e.target.value)} className="flex-1 min-w-[180px] rounded-lg bg-base-800 border border-base-700 px-3 py-1.5 text-sm text-ink-100 focus:border-mint-500 outline-none" />
        <select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)} className="rounded-lg bg-base-800 border border-base-700 px-2 py-1.5 text-sm text-ink-100">
          <option value="">Todas prioridades</option>
          {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="rounded-lg bg-base-800 border border-base-700 px-2 py-1.5 text-sm text-ink-100">
          <option value="">Todas categorias</option>
          {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)} className="rounded-lg bg-base-800 border border-base-700 px-2 py-1.5 text-sm text-ink-100">
          <option value="">Todos responsáveis</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        <select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)} className="rounded-lg bg-base-800 border border-base-700 px-2 py-1.5 text-sm text-ink-100">
          <option value="recentes">Mais recentes</option>
          <option value="prioridade">Prioridade</option>
          <option value="prazo">Prazo</option>
        </select>
      </div>

      {erro && <p className="text-sm text-red-400 mt-4">{erro}</p>}

      {carregando ? (
        <p className="text-ink-500 text-sm mt-6">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="text-ink-500 text-sm mt-8">{itens.length === 0 ? 'Nenhuma oportunidade registrada ainda.' : 'Nenhuma oportunidade encontrada com esses filtros.'}</p>
      ) : (
        <div className="mt-4 rounded-xl border border-base-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-base-900 text-ink-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Oportunidade</th>
                <th className="text-left px-4 py-2.5 hidden sm:table-cell">Categoria</th>
                <th className="text-left px-4 py-2.5">Prioridade</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5 hidden md:table-cell">Prazo</th>
                <th className="text-left px-4 py-2.5 hidden lg:table-cell">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-800">
              {filtrados.map((o) => (
                <tr key={o.id} className="hover:bg-base-900/60 transition">
                  <td className="px-4 py-3">
                    <button onClick={() => setDetalhe(o)} className="text-ink-100 hover:text-mint-400 font-medium text-left">{o.titulo}</button>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-ink-300">{labelCategoria(o.categoria)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${corPrioridade(o.prioridade)}`}>{labelPrioridade(o.prioridade)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${corStatus(o.status)}`}>{labelStatus(o.status)}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-300">{o.prazo || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-ink-300">{o.usuarios?.nome || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <ModalOportunidade
          dados={editando}
          usuarios={usuarios}
          produtos={produtos}
          campanhas={campanhas}
          conteudos={conteudos}
          onFechar={() => setModalAberto(false)}
          onSalvar={salvar}
        />
      )}

      {detalhe && (
        <ModalDetalhe
          oportunidade={detalhe}
          podeEditar={pode_editar}
          onFechar={() => setDetalhe(null)}
          onTransicionar={(novoStatus) => transicionar(detalhe.id, novoStatus)}
        />
      )}
    </div>
  );
}

function ModalOportunidade({ dados: inicial, usuarios, produtos, campanhas, conteudos, onFechar, onSalvar }) {
  const [dados, setDados] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function set(campo, valor) { setDados((d) => ({ ...d, [campo]: valor })); }

  async function enviar(e) {
    e.preventDefault();
    if (!dados.titulo.trim()) { setErro('Dê um título à oportunidade.'); return; }
    setErro('');
    setSalvando(true);
    try {
      await onSalvar(dados);
    } catch {
      setErro('Não foi possível salvar. Confira suas permissões.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-base-900 border border-base-800 rounded-xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-xl text-ink-100 mb-4">Nova oportunidade</h2>
        <form onSubmit={enviar} className="space-y-3">
          <Campo label="Título *"><input value={dados.titulo} onChange={(e) => set('titulo', e.target.value)} className="campo" autoFocus /></Campo>
          <Campo label="Descrição"><textarea value={dados.descricao} onChange={(e) => set('descricao', e.target.value)} className="campo" rows={2} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Categoria">
              <select value={dados.categoria} onChange={(e) => set('categoria', e.target.value)} className="campo">
                {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Campo>
            <Campo label="Prioridade">
              <select value={dados.prioridade} onChange={(e) => set('prioridade', e.target.value)} className="campo">
                {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Origem (ex.: Instagram, pesquisa interna…)"><input value={dados.origem} onChange={(e) => set('origem', e.target.value)} className="campo" /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Potencial estimado (R$, opcional)">
              <input type="number" min="0" step="0.01" value={dados.potencial_estimado} onChange={(e) => set('potencial_estimado', e.target.value)} className="campo" />
            </Campo>
            <Campo label="Prazo"><input type="date" value={dados.prazo} onChange={(e) => set('prazo', e.target.value)} className="campo" /></Campo>
          </div>
          <Campo label="Responsável">
            <select value={dados.responsavel_id} onChange={(e) => set('responsavel_id', e.target.value)} className="campo">
              <option value="">—</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </Campo>
          <div className="grid grid-cols-3 gap-2">
            <Campo label="Produto">
              <select value={dados.produto_id} onChange={(e) => set('produto_id', e.target.value)} className="campo">
                <option value="">—</option>
                {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Campanha">
              <select value={dados.campanha_id} onChange={(e) => set('campanha_id', e.target.value)} className="campo">
                <option value="">—</option>
                {campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
              </select>
            </Campo>
            <Campo label="Conteúdo">
              <select value={dados.conteudo_id} onChange={(e) => set('conteudo_id', e.target.value)} className="campo">
                <option value="">—</option>
                {conteudos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Observações"><textarea value={dados.observacoes} onChange={(e) => set('observacoes', e.target.value)} className="campo" rows={2} /></Campo>

          {erro && <p className="text-sm text-red-400">{erro}</p>}

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={salvando} className="rounded-lg bg-mint-500 hover:bg-mint-600 disabled:opacity-60 text-base-950 font-medium px-4 py-2 text-sm transition">
              {salvando ? 'Salvando…' : 'Registrar'}
            </button>
            <button type="button" onClick={onFechar} className="rounded-lg border border-base-700 text-ink-300 hover:text-ink-100 px-4 py-2 text-sm transition">Cancelar</button>
          </div>
        </form>
        <style>{`.campo { width: 100%; border-radius: 0.5rem; background: #16213a; border: 1px solid #1f2d4d; padding: 0.5rem 0.75rem; color: #eef2f8; outline: none; font-size: 0.875rem; } .campo:focus { border-color: #2fb894; }`}</style>
      </div>
    </div>
  );
}

function ModalDetalhe({ oportunidade: o, podeEditar, onFechar, onTransicionar }) {
  const transicoesPossiveis = TRANSICOES_VALIDAS[o.status] ?? [];
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-base-900 border border-base-800 rounded-xl p-5 w-full max-w-md">
        <h2 className="font-display text-xl text-ink-100">{o.titulo}</h2>
        <div className="flex gap-2 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${corStatus(o.status)}`}>{labelStatus(o.status)}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${corPrioridade(o.prioridade)}`}>{labelPrioridade(o.prioridade)}</span>
        </div>
        <div className="mt-3 space-y-1.5 text-sm">
          <Linha rotulo="Categoria" valor={labelCategoria(o.categoria)} />
          <Linha rotulo="Origem" valor={o.origem || '—'} />
          <Linha rotulo="Potencial estimado" valor={o.potencial_estimado != null ? `R$ ${Number(o.potencial_estimado).toFixed(2)}` : 'sem estimativa'} />
          <Linha rotulo="Prazo" valor={o.prazo || '—'} />
          <Linha rotulo="Responsável" valor={o.usuarios?.nome || '—'} />
          <Linha rotulo="Produto" valor={o.produtos?.nome || '—'} />
          <Linha rotulo="Campanha" valor={o.campanhas?.titulo || '—'} />
          <Linha rotulo="Conteúdo" valor={o.conteudos?.titulo || '—'} />
        </div>
        {o.descricao && <p className="text-sm text-ink-300 mt-3 whitespace-pre-wrap">{o.descricao}</p>}
        {o.observacoes && <p className="text-xs text-ink-500 mt-2 whitespace-pre-wrap">{o.observacoes}</p>}

        {podeEditar && transicoesPossiveis.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {transicoesPossiveis.map((novoStatus) => (
              <button
                key={novoStatus}
                onClick={() => onTransicionar(novoStatus)}
                className={`text-sm px-3 py-1.5 rounded-lg font-medium transition ${novoStatus === 'descartada' ? 'border border-base-700 text-ink-300 hover:text-ink-100' : 'bg-mint-500 hover:bg-mint-600 text-base-950'}`}
              >
                {labelAcao(o.status, novoStatus)}
              </button>
            ))}
          </div>
        )}
        <button onClick={onFechar} className="mt-4 text-sm text-ink-400 hover:text-ink-100 block">Fechar</button>
      </div>
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

function Linha({ rotulo, valor }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-500">{rotulo}</span>
      <span className="text-ink-200 text-right">{valor}</span>
    </div>
  );
}

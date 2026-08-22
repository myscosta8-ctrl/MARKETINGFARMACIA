import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { usePermissoes } from '../../hooks/usePermissoes';
import { STATUS_CONTEUDO, TIPOS_CONTEUDO, labelStatus, corStatus, labelTipo } from './constants';

const FILTRO_VAZIO = { status: '', tipo: '', responsavel: '', busca: '' };

export default function ConteudosLista() {
  const { pode_editar, carregando: carregandoPermissoes } = usePermissoes('conteudo');
  const [conteudos, setConteudos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState(FILTRO_VAZIO);

  useEffect(() => {
    carregar();
    supabase.from('usuarios').select('id, nome').then(({ data }) => setUsuarios(data ?? []));
  }, []);

  async function carregar() {
    setCarregando(true);
    setErro('');
    const { data, error } = await supabase
      .from('conteudos')
      .select('id, titulo, tipo, status, data_agendamento, created_at, campanhas(titulo), produtos(nome), usuarios:responsavel_id(nome)')
      .order('created_at', { ascending: false });
    if (error) {
      logger.error('Falha ao carregar conteúdos', error);
      setErro('Não foi possível carregar. Confira suas permissões.');
    }
    setConteudos(data ?? []);
    setCarregando(false);
  }

  const filtrados = useMemo(() => {
    return conteudos.filter((c) => {
      if (filtro.status && c.status !== filtro.status) return false;
      if (filtro.tipo && c.tipo !== filtro.tipo) return false;
      if (filtro.busca && !c.titulo.toLowerCase().includes(filtro.busca.toLowerCase())) return false;
      return true;
    });
  }, [conteudos, filtro]);

  const indicadores = useMemo(() => {
    const contagem = Object.fromEntries(STATUS_CONTEUDO.map((s) => [s.value, 0]));
    for (const c of conteudos) contagem[c.status] = (contagem[c.status] ?? 0) + 1;
    return contagem;
  }, [conteudos]);

  if (carregandoPermissoes) return <p className="text-ink-500 text-sm">Carregando…</p>;

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-100">Conteúdo</h1>
          <p className="text-ink-500 text-sm mt-1">Planejamento e produção de conteúdo de marketing.</p>
        </div>
        {pode_editar && (
          <Link to="/conteudo/novo" className="rounded-lg bg-mint-500 hover:bg-mint-600 text-base-950 font-medium px-4 py-2 text-sm transition">
            + Novo conteúdo
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-6">
        {STATUS_CONTEUDO.map((s) => (
          <button
            key={s.value}
            onClick={() => setFiltro((f) => ({ ...f, status: f.status === s.value ? '' : s.value }))}
            className={`rounded-lg border p-2.5 text-left transition ${filtro.status === s.value ? 'border-mint-500' : 'border-base-800 hover:border-base-700'} bg-base-900`}
          >
            <p className="text-[10px] text-ink-500 truncate">{s.label}</p>
            <p className="font-display text-lg text-ink-100">{indicadores[s.value] ?? 0}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <input
          placeholder="Buscar por título…"
          value={filtro.busca}
          onChange={(e) => setFiltro((f) => ({ ...f, busca: e.target.value }))}
          className="flex-1 min-w-[180px] rounded-lg bg-base-800 border border-base-700 px-3 py-1.5 text-sm text-ink-100 focus:border-mint-500 outline-none"
        />
        <select value={filtro.tipo} onChange={(e) => setFiltro((f) => ({ ...f, tipo: e.target.value }))} className="rounded-lg bg-base-800 border border-base-700 px-2 py-1.5 text-sm text-ink-100">
          <option value="">Todos os tipos</option>
          {TIPOS_CONTEUDO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {(filtro.status || filtro.tipo || filtro.busca) && (
          <button onClick={() => setFiltro(FILTRO_VAZIO)} className="text-sm text-ink-500 hover:text-ink-300 px-2">Limpar filtros</button>
        )}
      </div>

      {erro && <p className="text-sm text-red-400 mt-4">{erro}</p>}

      {carregando ? (
        <p className="text-ink-500 text-sm mt-6">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="text-ink-500 text-sm mt-8">
          {conteudos.length === 0 ? 'Nenhum conteúdo cadastrado ainda.' : 'Nenhum conteúdo encontrado com esses filtros.'}
        </p>
      ) : (
        <div className="mt-4 rounded-xl border border-base-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-base-900 text-ink-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Conteúdo</th>
                <th className="text-left px-4 py-2.5 hidden sm:table-cell">Tipo</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5 hidden md:table-cell">Campanha</th>
                <th className="text-left px-4 py-2.5 hidden md:table-cell">Agendamento</th>
                <th className="text-left px-4 py-2.5 hidden lg:table-cell">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-800">
              {filtrados.map((c) => (
                <tr key={c.id} className="hover:bg-base-900/60 transition">
                  <td className="px-4 py-3">
                    <Link to={`/conteudo/${c.id}`} className="text-ink-100 hover:text-mint-400 font-medium">{c.titulo}</Link>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-ink-300">{labelTipo(c.tipo)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${corStatus(c.status)}`}>{labelStatus(c.status)}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-300">{c.campanhas?.titulo || '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-300">{c.data_agendamento || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-ink-300">{c.usuarios?.nome || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

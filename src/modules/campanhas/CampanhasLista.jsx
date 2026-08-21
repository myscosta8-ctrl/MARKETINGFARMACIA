import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { usePermissoes } from '../../hooks/usePermissoes';
import { STATUS_CAMPANHA, CANAIS, labelStatus, corStatus, labelCanal } from './constants';

const FILTRO_VAZIO = { status: '', canal: '', responsavel: '', periodo: 'todas', busca: '' };

export default function CampanhasLista() {
  const { pode_editar } = usePermissoes('campanhas');
  const [campanhas, setCampanhas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState(FILTRO_VAZIO);
  const [aba, setAba] = useState('lista'); // 'lista' | 'calendario'

  useEffect(() => {
    carregar();
    supabase
      .from('usuarios')
      .select('id, nome')
      .then(({ data }) => setUsuarios(data ?? []));
  }, []);

  async function carregar() {
    setCarregando(true);
    const { data, error } = await supabase
      .from('campanhas')
      .select('id, titulo, status, periodo_inicio, periodo_fim, publico_alvo, canais, responsavel_id, created_at, usuarios:responsavel_id(nome)')
      .order('created_at', { ascending: false });
    if (error) logger.error('Falha ao carregar campanhas', error);
    setCampanhas(data ?? []);
    setCarregando(false);
  }

  const hoje = new Date().toISOString().slice(0, 10);

  const campanhasFiltradas = useMemo(() => {
    return campanhas.filter((c) => {
      if (filtro.status && c.status !== filtro.status) return false;
      if (filtro.canal && !(c.canais ?? []).includes(filtro.canal)) return false;
      if (filtro.responsavel && c.responsavel_id !== filtro.responsavel) return false;
      if (filtro.busca && !c.titulo.toLowerCase().includes(filtro.busca.toLowerCase())) return false;
      if (filtro.periodo === 'ativas') {
        const ativa = c.periodo_inicio <= hoje && (c.periodo_fim ?? '9999-12-31') >= hoje && !['encerrada', 'pausada'].includes(c.status);
        if (!ativa) return false;
      }
      if (filtro.periodo === 'encerradas' && c.status !== 'encerrada') return false;
      return true;
    });
  }, [campanhas, filtro, hoje]);

  const indicadores = useMemo(() => {
    const contagem = Object.fromEntries(STATUS_CAMPANHA.map((s) => [s.value, 0]));
    for (const c of campanhas) contagem[c.status] = (contagem[c.status] ?? 0) + 1;
    return contagem;
  }, [campanhas]);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-100">Campanhas</h1>
          <p className="text-ink-500 text-sm mt-1">Planeje, revise, aprove e acompanhe campanhas de marketing.</p>
        </div>
        {pode_editar && (
          <Link
            to="/campanhas/nova"
            className="rounded-lg bg-mint-500 hover:bg-mint-600 text-base-950 font-medium px-4 py-2 text-sm transition"
          >
            + Nova campanha
          </Link>
        )}
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
        {STATUS_CAMPANHA.map((s) => (
          <button
            key={s.value}
            onClick={() => setFiltro((f) => ({ ...f, status: f.status === s.value ? '' : s.value }))}
            className={`rounded-lg border p-3 text-left transition ${
              filtro.status === s.value ? 'border-mint-500' : 'border-base-800 hover:border-base-700'
            } bg-base-900`}
          >
            <p className="text-xs text-ink-500">{s.label}</p>
            <p className="font-display text-xl text-ink-100 mt-1">{indicadores[s.value] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Abas */}
      <div className="flex gap-1 mt-6 border-b border-base-800">
        {[
          ['lista', 'Lista'],
          ['calendario', 'Calendário'],
        ].map(([valor, label]) => (
          <button
            key={valor}
            onClick={() => setAba(valor)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition ${
              aba === valor ? 'border-mint-500 text-ink-100' : 'border-transparent text-ink-500 hover:text-ink-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mt-4">
        <input
          placeholder="Buscar por título…"
          value={filtro.busca}
          onChange={(e) => setFiltro((f) => ({ ...f, busca: e.target.value }))}
          className="flex-1 min-w-[180px] rounded-lg bg-base-800 border border-base-700 px-3 py-1.5 text-sm text-ink-100 focus:border-mint-500 outline-none"
        />
        <select
          value={filtro.canal}
          onChange={(e) => setFiltro((f) => ({ ...f, canal: e.target.value }))}
          className="rounded-lg bg-base-800 border border-base-700 px-2 py-1.5 text-sm text-ink-100"
        >
          <option value="">Todos os canais</option>
          {CANAIS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select
          value={filtro.responsavel}
          onChange={(e) => setFiltro((f) => ({ ...f, responsavel: e.target.value }))}
          className="rounded-lg bg-base-800 border border-base-700 px-2 py-1.5 text-sm text-ink-100"
        >
          <option value="">Todos os responsáveis</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>{u.nome}</option>
          ))}
        </select>
        <select
          value={filtro.periodo}
          onChange={(e) => setFiltro((f) => ({ ...f, periodo: e.target.value }))}
          className="rounded-lg bg-base-800 border border-base-700 px-2 py-1.5 text-sm text-ink-100"
        >
          <option value="todas">Todos os períodos</option>
          <option value="ativas">Ativas agora</option>
          <option value="encerradas">Encerradas</option>
        </select>
        {(filtro.status || filtro.canal || filtro.responsavel || filtro.busca || filtro.periodo !== 'todas') && (
          <button onClick={() => setFiltro(FILTRO_VAZIO)} className="text-sm text-ink-500 hover:text-ink-300 px-2">
            Limpar filtros
          </button>
        )}
      </div>

      {carregando ? (
        <p className="text-ink-500 text-sm mt-6">Carregando…</p>
      ) : aba === 'lista' ? (
        <ListaCampanhas campanhas={campanhasFiltradas} />
      ) : (
        <CalendarioCampanhas campanhas={campanhasFiltradas} />
      )}
    </div>
  );
}

function ListaCampanhas({ campanhas }) {
  if (campanhas.length === 0) {
    return <p className="text-ink-500 text-sm mt-8">Nenhuma campanha encontrada com esses filtros.</p>;
  }
  return (
    <div className="mt-4 rounded-xl border border-base-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-base-900 text-ink-500 text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-2.5">Campanha</th>
            <th className="text-left px-4 py-2.5">Status</th>
            <th className="text-left px-4 py-2.5 hidden sm:table-cell">Período</th>
            <th className="text-left px-4 py-2.5 hidden md:table-cell">Canais</th>
            <th className="text-left px-4 py-2.5 hidden md:table-cell">Responsável</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-base-800">
          {campanhas.map((c) => (
            <tr key={c.id} className="hover:bg-base-900/60 transition">
              <td className="px-4 py-3">
                <Link to={`/campanhas/${c.id}`} className="text-ink-100 hover:text-mint-400 font-medium">
                  {c.titulo}
                </Link>
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${corStatus(c.status)}`}>{labelStatus(c.status)}</span>
              </td>
              <td className="px-4 py-3 hidden sm:table-cell text-ink-300">
                {c.periodo_inicio ? `${c.periodo_inicio} → ${c.periodo_fim ?? '—'}` : '—'}
              </td>
              <td className="px-4 py-3 hidden md:table-cell text-ink-300">
                {(c.canais ?? []).map(labelCanal).join(', ') || '—'}
              </td>
              <td className="px-4 py-3 hidden md:table-cell text-ink-300">{c.usuarios?.nome ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarioCampanhas({ campanhas }) {
  const comPeriodo = campanhas.filter((c) => c.periodo_inicio);
  const porMes = useMemo(() => {
    const grupos = {};
    for (const c of comPeriodo) {
      const mes = c.periodo_inicio.slice(0, 7); // AAAA-MM
      grupos[mes] = grupos[mes] ?? [];
      grupos[mes].push(c);
    }
    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
  }, [comPeriodo]);

  if (porMes.length === 0) {
    return <p className="text-ink-500 text-sm mt-8">Nenhuma campanha com período definido ainda.</p>;
  }

  return (
    <div className="mt-4 space-y-4">
      {porMes.map(([mes, itens]) => (
        <div key={mes} className="rounded-xl border border-base-800 bg-base-900 p-4">
          <h3 className="font-display text-ink-100 mb-2">
            {new Date(`${mes}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="space-y-1.5">
            {itens
              .sort((a, b) => a.periodo_inicio.localeCompare(b.periodo_inicio))
              .map((c) => (
                <Link
                  key={c.id}
                  to={`/campanhas/${c.id}`}
                  className="flex items-center justify-between text-sm px-3 py-2 rounded-lg hover:bg-base-800 transition"
                >
                  <span className="text-ink-100">{c.titulo}</span>
                  <span className="text-ink-500 text-xs">
                    {c.periodo_inicio} → {c.periodo_fim ?? '—'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${corStatus(c.status)}`}>{labelStatus(c.status)}</span>
                </Link>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { usePermissoes } from '../../hooks/usePermissoes';
import { logger } from '../../utils/logger';
import { labelStatus as labelStatusCampanha, corStatus as corStatusCampanha } from '../campanhas/constants';
import { labelStatus as labelStatusConteudo, corStatus as corStatusConteudo } from '../conteudo/constants';
import {
  TIPOS_EVENTO, STATUS_EVENTO, labelTipoEvento, labelStatusEvento, corStatusEvento,
  formatarDataISO, gradeMes, diasDaSemana,
} from './constants';

const EVENTO_VAZIO = {
  id: null,
  titulo: '',
  descricao: '',
  tipo: 'outro',
  status: 'planejado',
  data_inicio: '',
  data_fim: '',
  dia_inteiro: true,
  hora_inicio: '',
  hora_fim: '',
  responsavel_id: '',
  produto_id: '',
  campanha_id: '',
  observacoes: '',
};

export default function CalendarioPage() {
  const { pode_ver, pode_editar, carregando: carregandoPermissoes } = usePermissoes('calendario');

  const [visao, setVisao] = useState('mes');
  const [cursor, setCursor] = useState(new Date());
  const [campanhas, setCampanhas] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [mostrarCampanhas, setMostrarCampanhas] = useState(true);
  const [mostrarEventos, setMostrarEventos] = useState(true);
  const [mostrarConteudos, setMostrarConteudos] = useState(true);
  const [conteudos, setConteudos] = useState([]);
  const [filtroProduto, setFiltroProduto] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [eventoEditando, setEventoEditando] = useState(EVENTO_VAZIO);
  const [detalheEvento, setDetalheEvento] = useState(null);

  useEffect(() => {
    if (!carregandoPermissoes && pode_ver) carregar();
  }, [carregandoPermissoes, pode_ver]);

  async function carregar() {
    setCarregando(true);
    setErro('');
    const [{ data: c, error: eC }, { data: ev, error: eE }, { data: u }, { data: p }, { data: ct }] = await Promise.all([
      supabase.from('campanhas').select('id, titulo, status, periodo_inicio, periodo_fim, responsavel_id, usuarios:responsavel_id(nome)'),
      supabase.from('eventos_calendario').select('*, produtos(nome), campanhas(titulo), usuarios:responsavel_id(nome)'),
      supabase.from('usuarios').select('id, nome'),
      supabase.from('produtos').select('id, nome').eq('ativo', true),
      supabase.from('conteudos').select('id, titulo, status, data_agendamento, responsavel_id').not('data_agendamento', 'is', null),
    ]);
    if (eC || eE) {
      logger.error('Falha ao carregar calendário', eC || eE);
      setErro('Não foi possível carregar o calendário. Confira suas permissões.');
    }
    setCampanhas((c ?? []).filter((x) => x.periodo_inicio));
    setEventos(ev ?? []);
    setUsuarios(u ?? []);
    setProdutos(p ?? []);
    setConteudos(ct ?? []);
    setCarregando(false);
  }

  const itensCombinados = useMemo(() => {
    const itens = [];
    if (mostrarCampanhas) {
      for (const c of campanhas) {
        if (filtroResponsavel && c.responsavel_id !== filtroResponsavel) continue;
        itens.push({
          tipoItem: 'campanha',
          id: c.id,
          titulo: c.titulo,
          dataInicio: c.periodo_inicio,
          dataFim: c.periodo_fim || c.periodo_inicio,
          status: c.status,
          responsavelNome: c.usuarios?.nome,
        });
      }
    }
    if (mostrarEventos) {
      for (const ev of eventos) {
        if (filtroProduto && ev.produto_id !== filtroProduto) continue;
        if (filtroResponsavel && ev.responsavel_id !== filtroResponsavel) continue;
        itens.push({
          tipoItem: 'evento',
          id: ev.id,
          titulo: ev.titulo,
          dataInicio: ev.data_inicio,
          dataFim: ev.data_fim || ev.data_inicio,
          status: ev.status,
          tipo: ev.tipo,
          responsavelNome: ev.usuarios?.nome,
          raw: ev,
        });
      }
    }
    if (mostrarConteudos) {
      for (const ct of conteudos) {
        if (filtroResponsavel && ct.responsavel_id !== filtroResponsavel) continue;
        itens.push({
          tipoItem: 'conteudo',
          id: ct.id,
          titulo: ct.titulo,
          dataInicio: ct.data_agendamento,
          dataFim: ct.data_agendamento,
          status: ct.status,
        });
      }
    }
    return itens;
  }, [campanhas, eventos, conteudos, mostrarCampanhas, mostrarEventos, mostrarConteudos, filtroProduto, filtroResponsavel]);

  function itensNoDia(diaISO) {
    return itensCombinados.filter((i) => i.dataInicio <= diaISO && i.dataFim >= diaISO);
  }

  function abrirDetalhe(item) {
    if (item.tipoItem === 'evento') setDetalheEvento(item.raw);
  }

  function abrirNovoEvento(dataISO) {
    setEventoEditando({ ...EVENTO_VAZIO, data_inicio: dataISO || formatarDataISO(new Date()) });
    setModalAberto(true);
  }

  function abrirEdicaoEvento(ev) {
    setEventoEditando({
      id: ev.id,
      titulo: ev.titulo ?? '',
      descricao: ev.descricao ?? '',
      tipo: ev.tipo ?? 'outro',
      status: ev.status ?? 'planejado',
      data_inicio: ev.data_inicio ?? '',
      data_fim: ev.data_fim ?? '',
      dia_inteiro: ev.dia_inteiro ?? true,
      hora_inicio: ev.hora_inicio ?? '',
      hora_fim: ev.hora_fim ?? '',
      responsavel_id: ev.responsavel_id ?? '',
      produto_id: ev.produto_id ?? '',
      campanha_id: ev.campanha_id ?? '',
      observacoes: ev.observacoes ?? '',
    });
    setDetalheEvento(null);
    setModalAberto(true);
  }

  async function salvarEvento(dados) {
    const payload = {
      titulo: dados.titulo.trim(),
      descricao: dados.descricao.trim() || null,
      tipo: dados.tipo,
      status: dados.status,
      data_inicio: dados.data_inicio,
      data_fim: dados.data_fim || null,
      dia_inteiro: dados.dia_inteiro,
      hora_inicio: dados.dia_inteiro ? null : dados.hora_inicio || null,
      hora_fim: dados.dia_inteiro ? null : dados.hora_fim || null,
      responsavel_id: dados.responsavel_id || null,
      produto_id: dados.produto_id || null,
      campanha_id: dados.campanha_id || null,
      observacoes: dados.observacoes.trim() || null,
    };
    const { error } = dados.id
      ? await supabase.from('eventos_calendario').update(payload).eq('id', dados.id)
      : await supabase.from('eventos_calendario').insert(payload);
    if (error) {
      logger.error('Falha ao salvar evento', error);
      throw error;
    }
    setModalAberto(false);
    await carregar();
  }

  async function excluirEvento(id) {
    const { error } = await supabase.from('eventos_calendario').delete().eq('id', id);
    if (error) {
      logger.error('Falha ao excluir evento', error);
      return;
    }
    setDetalheEvento(null);
    await carregar();
  }

  function navegar(direcao) {
    const novo = new Date(cursor);
    if (visao === 'mes') novo.setMonth(novo.getMonth() + direcao);
    else if (visao === 'semana') novo.setDate(novo.getDate() + direcao * 7);
    else novo.setDate(novo.getDate() + direcao * 30);
    setCursor(novo);
  }

  if (carregandoPermissoes) return <p className="text-ink-500 text-sm">Carregando…</p>;

  if (!pode_ver) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl text-ink-100">Calendário</h1>
        <p className="text-ink-500 text-sm mt-2">
          Você não tem permissão para visualizar o calendário. Fale com um administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-100">Calendário de Marketing</h1>
          <p className="text-ink-500 text-sm mt-1">Campanhas e eventos de planejamento, num só lugar.</p>
        </div>
        {pode_editar && (
          <button
            onClick={() => abrirNovoEvento()}
            className="rounded-lg bg-mint-500 hover:bg-mint-600 text-base-950 font-medium px-4 py-2 text-sm transition"
          >
            + Novo evento
          </button>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mt-6">
        <div className="flex items-center gap-2">
          <button onClick={() => navegar(-1)} className="h-8 w-8 rounded-lg border border-base-700 text-ink-300 hover:text-ink-100 flex items-center justify-center">‹</button>
          <button onClick={() => setCursor(new Date())} className="text-sm px-3 py-1.5 rounded-lg border border-base-700 text-ink-300 hover:text-ink-100">Hoje</button>
          <button onClick={() => navegar(1)} className="h-8 w-8 rounded-lg border border-base-700 text-ink-300 hover:text-ink-100 flex items-center justify-center">›</button>
          <span className="text-ink-100 font-display ml-2 capitalize">
            {cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
        </div>
        <div className="flex gap-1">
          {[['mes', 'Mês'], ['semana', 'Semana'], ['agenda', 'Agenda']].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setVisao(v)}
              className={`text-sm px-3 py-1.5 rounded-lg transition ${visao === v ? 'bg-mint-500 text-base-950 font-medium' : 'text-ink-400 hover:text-ink-100'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <label className="flex items-center gap-1.5 text-xs text-ink-300 border border-base-700 rounded-lg px-2 py-1">
          <input type="checkbox" checked={mostrarCampanhas} onChange={(e) => setMostrarCampanhas(e.target.checked)} />
          Campanhas
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-300 border border-base-700 rounded-lg px-2 py-1">
          <input type="checkbox" checked={mostrarEventos} onChange={(e) => setMostrarEventos(e.target.checked)} />
          Eventos
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-300 border border-base-700 rounded-lg px-2 py-1">
          <input type="checkbox" checked={mostrarConteudos} onChange={(e) => setMostrarConteudos(e.target.checked)} />
          Conteúdo
        </label>
        <select value={filtroProduto} onChange={(e) => setFiltroProduto(e.target.value)} className="rounded-lg bg-base-800 border border-base-700 px-2 py-1 text-xs text-ink-100">
          <option value="">Todos os produtos</option>
          {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)} className="rounded-lg bg-base-800 border border-base-700 px-2 py-1 text-xs text-ink-100">
          <option value="">Todos os responsáveis</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </div>

      {erro && <p className="text-sm text-red-400 mt-4">{erro}</p>}

      {carregando ? (
        <p className="text-ink-500 text-sm mt-6">Carregando…</p>
      ) : (
        <div className="mt-4">
          {visao === 'mes' && (
            <VisaoMes cursor={cursor} itensNoDia={itensNoDia} onClickItem={abrirDetalhe} onClickDia={pode_editar ? abrirNovoEvento : undefined} />
          )}
          {visao === 'semana' && (
            <VisaoSemana cursor={cursor} itensNoDia={itensNoDia} onClickItem={abrirDetalhe} onClickDia={pode_editar ? abrirNovoEvento : undefined} />
          )}
          {visao === 'agenda' && (
            <VisaoAgenda itens={itensCombinados} onClickItem={abrirDetalhe} />
          )}
        </div>
      )}

      {modalAberto && (
        <ModalEvento
          evento={eventoEditando}
          usuarios={usuarios}
          produtos={produtos}
          onFechar={() => setModalAberto(false)}
          onSalvar={salvarEvento}
        />
      )}

      {detalheEvento && (
        <ModalDetalheEvento
          evento={detalheEvento}
          podeEditar={pode_editar}
          onFechar={() => setDetalheEvento(null)}
          onEditar={() => abrirEdicaoEvento(detalheEvento)}
          onExcluir={() => excluirEvento(detalheEvento.id)}
        />
      )}
    </div>
  );
}

function Pilula({ item }) {
  if (item.tipoItem === 'campanha') {
    return (
      <Link to={`/campanhas/${item.id}`} className="block" title={`Campanha: ${item.titulo}`}>
        <span className={`text-[11px] px-1.5 py-0.5 rounded truncate block ${corStatusCampanha(item.status)}`}>{item.titulo}</span>
      </Link>
    );
  }
  if (item.tipoItem === 'conteudo') {
    return (
      <Link to={`/conteudo/${item.id}`} className="block" title={`Conteúdo: ${item.titulo}`}>
        <span className={`text-[11px] px-1.5 py-0.5 rounded truncate block ${corStatusConteudo(item.status)}`}>{item.titulo}</span>
      </Link>
    );
  }
  return (
    <button className="block w-full text-left" title={`Evento: ${item.titulo}`}>
      <span className={`text-[11px] px-1.5 py-0.5 rounded truncate block ${corStatusEvento(item.status)}`}>{item.titulo}</span>
    </button>
  );
}

function VisaoMes({ cursor, itensNoDia, onClickItem, onClickDia }) {
  const dias = gradeMes(cursor);
  const mesAtual = cursor.getMonth();
  const hojeISO = formatarDataISO(new Date());

  return (
    <div className="rounded-xl border border-base-800 overflow-hidden">
      <div className="grid grid-cols-7 bg-base-900 text-ink-500 text-xs uppercase">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
          <div key={d} className="px-2 py-2 text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const iso = formatarDataISO(dia);
          const itens = itensNoDia(iso);
          const foraDoMes = dia.getMonth() !== mesAtual;
          return (
            <div
              key={iso}
              onClick={() => onClickDia?.(iso)}
              className={`min-h-[84px] border-t border-l border-base-800 p-1.5 ${foraDoMes ? 'bg-base-950/60' : ''} ${onClickDia ? 'cursor-pointer hover:bg-base-900/60' : ''}`}
            >
              <span className={`text-xs ${iso === hojeISO ? 'text-mint-400 font-semibold' : foraDoMes ? 'text-ink-500' : 'text-ink-300'}`}>
                {dia.getDate()}
              </span>
              <div className="mt-1 space-y-0.5">
                {itens.slice(0, 3).map((item) => (
                  <div key={`${item.tipoItem}-${item.id}`} onClick={(e) => { e.stopPropagation(); onClickItem(item); }}>
                    <Pilula item={item} />
                  </div>
                ))}
                {itens.length > 3 && <p className="text-[10px] text-ink-500">+{itens.length - 3} mais</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VisaoSemana({ cursor, itensNoDia, onClickItem, onClickDia }) {
  const dias = diasDaSemana(cursor);
  const hojeISO = formatarDataISO(new Date());

  return (
    <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
      {dias.map((dia) => {
        const iso = formatarDataISO(dia);
        const itens = itensNoDia(iso);
        return (
          <div key={iso} className="rounded-xl border border-base-800 bg-base-900 p-2 min-h-[120px]">
            <div className="flex items-center justify-between">
              <span className={`text-xs ${iso === hojeISO ? 'text-mint-400 font-semibold' : 'text-ink-300'}`}>
                {dia.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}
              </span>
              {onClickDia && (
                <button onClick={() => onClickDia(iso)} className="text-xs text-ink-500 hover:text-mint-400">+</button>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {itens.map((item) => (
                <div key={`${item.tipoItem}-${item.id}`} onClick={() => onClickItem(item)}>
                  <Pilula item={item} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VisaoAgenda({ itens, onClickItem }) {
  const ordenados = [...itens].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
  const porData = useMemo(() => {
    const grupos = {};
    for (const item of ordenados) {
      grupos[item.dataInicio] = grupos[item.dataInicio] ?? [];
      grupos[item.dataInicio].push(item);
    }
    return Object.entries(grupos);
  }, [ordenados]);

  if (porData.length === 0) return <p className="text-ink-500 text-sm">Nada planejado ainda.</p>;

  return (
    <div className="space-y-3">
      {porData.map(([data, lista]) => (
        <div key={data} className="rounded-xl border border-base-800 bg-base-900 p-4">
          <h3 className="text-sm font-medium text-ink-100 mb-2">
            {new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </h3>
          <div className="space-y-1.5">
            {lista.map((item) => (
              <div key={`${item.tipoItem}-${item.id}`} onClick={() => onClickItem(item)} className="flex items-center justify-between text-sm">
                <span className="text-ink-100">
                  {item.tipoItem === 'campanha' ? (
                    <Link to={`/campanhas/${item.id}`} className="hover:text-mint-400">{item.titulo}</Link>
                  ) : item.tipoItem === 'conteudo' ? (
                    <Link to={`/conteudo/${item.id}`} className="hover:text-mint-400">{item.titulo}</Link>
                  ) : (
                    <button className="hover:text-mint-400 text-left">{item.titulo}</button>
                  )}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  item.tipoItem === 'campanha' ? corStatusCampanha(item.status) : item.tipoItem === 'conteudo' ? corStatusConteudo(item.status) : corStatusEvento(item.status)
                }`}>
                  {item.tipoItem === 'campanha' ? labelStatusCampanha(item.status) : item.tipoItem === 'conteudo' ? labelStatusConteudo(item.status) : labelStatusEvento(item.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ModalEvento({ evento, usuarios, produtos, onFechar, onSalvar }) {
  const [dados, setDados] = useState(evento);
  const [campanhas, setCampanhas] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    supabase.from('campanhas').select('id, titulo').then(({ data }) => setCampanhas(data ?? []));
  }, []);

  function set(campo, valor) {
    setDados((d) => ({ ...d, [campo]: valor }));
  }

  async function enviar(e) {
    e.preventDefault();
    if (!dados.titulo.trim() || !dados.data_inicio) {
      setErro('Título e data de início são obrigatórios.');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      await onSalvar(dados);
    } catch {
      setErro('Não foi possível salvar. Confira as permissões e os dados informados.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-base-900 border border-base-800 rounded-xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-xl text-ink-100 mb-4">{dados.id ? 'Editar evento' : 'Novo evento'}</h2>
        <form onSubmit={enviar} className="space-y-3">
          <Campo label="Título *">
            <input value={dados.titulo} onChange={(e) => set('titulo', e.target.value)} className="campo" autoFocus />
          </Campo>
          <Campo label="Descrição">
            <textarea value={dados.descricao} onChange={(e) => set('descricao', e.target.value)} className="campo" rows={2} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Tipo">
              <select value={dados.tipo} onChange={(e) => set('tipo', e.target.value)} className="campo">
                {TIPOS_EVENTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Campo>
            <Campo label="Status">
              <select value={dados.status} onChange={(e) => set('status', e.target.value)} className="campo">
                {STATUS_EVENTO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Data início *">
              <input type="date" value={dados.data_inicio} onChange={(e) => set('data_inicio', e.target.value)} className="campo" />
            </Campo>
            <Campo label="Data fim">
              <input type="date" value={dados.data_fim} onChange={(e) => set('data_fim', e.target.value)} className="campo" />
            </Campo>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-300">
            <input type="checkbox" checked={dados.dia_inteiro} onChange={(e) => set('dia_inteiro', e.target.checked)} />
            Dia inteiro
          </label>
          {!dados.dia_inteiro && (
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Hora início">
                <input type="time" value={dados.hora_inicio} onChange={(e) => set('hora_inicio', e.target.value)} className="campo" />
              </Campo>
              <Campo label="Hora fim">
                <input type="time" value={dados.hora_fim} onChange={(e) => set('hora_fim', e.target.value)} className="campo" />
              </Campo>
            </div>
          )}
          <Campo label="Responsável">
            <select value={dados.responsavel_id} onChange={(e) => set('responsavel_id', e.target.value)} className="campo">
              <option value="">—</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </Campo>
          <Campo label="Produto relacionado">
            <select value={dados.produto_id} onChange={(e) => set('produto_id', e.target.value)} className="campo">
              <option value="">—</option>
              {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Campo>
          <Campo label="Campanha relacionada">
            <select value={dados.campanha_id} onChange={(e) => set('campanha_id', e.target.value)} className="campo">
              <option value="">—</option>
              {campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select>
          </Campo>
          <Campo label="Observações">
            <textarea value={dados.observacoes} onChange={(e) => set('observacoes', e.target.value)} className="campo" rows={2} />
          </Campo>

          {erro && <p className="text-sm text-red-400">{erro}</p>}

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={salvando} className="rounded-lg bg-mint-500 hover:bg-mint-600 disabled:opacity-60 text-base-950 font-medium px-4 py-2 text-sm transition">
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" onClick={onFechar} className="rounded-lg border border-base-700 text-ink-300 hover:text-ink-100 px-4 py-2 text-sm transition">
              Cancelar
            </button>
          </div>
        </form>
        <style>{`.campo { width: 100%; border-radius: 0.5rem; background: #16213a; border: 1px solid #1f2d4d; padding: 0.5rem 0.75rem; color: #eef2f8; outline: none; font-size: 0.875rem; } .campo:focus { border-color: #2fb894; }`}</style>
      </div>
    </div>
  );
}

function ModalDetalheEvento({ evento, podeEditar, onFechar, onEditar, onExcluir }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="bg-base-900 border border-base-800 rounded-xl p-5 w-full max-w-md">
        <h2 className="font-display text-xl text-ink-100">{evento.titulo}</h2>
        <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${corStatusEvento(evento.status)}`}>
          {labelStatusEvento(evento.status)}
        </span>
        <div className="mt-3 space-y-1.5 text-sm">
          <Linha rotulo="Tipo" valor={labelTipoEvento(evento.tipo)} />
          <Linha rotulo="Início" valor={evento.data_inicio} />
          <Linha rotulo="Fim" valor={evento.data_fim || '—'} />
          {!evento.dia_inteiro && <Linha rotulo="Horário" valor={`${evento.hora_inicio ?? '—'} às ${evento.hora_fim ?? '—'}`} />}
          <Linha rotulo="Responsável" valor={evento.usuarios?.nome || '—'} />
          <Linha rotulo="Produto" valor={evento.produtos?.nome || '—'} />
          <Linha rotulo="Campanha" valor={evento.campanhas?.titulo || '—'} />
        </div>
        {evento.descricao && <p className="text-sm text-ink-300 mt-3 whitespace-pre-wrap">{evento.descricao}</p>}
        {evento.observacoes && <p className="text-xs text-ink-500 mt-2 whitespace-pre-wrap">{evento.observacoes}</p>}

        <div className="flex gap-3 mt-4">
          {podeEditar && (
            <>
              <button onClick={onEditar} className="text-sm text-mint-400 hover:text-mint-300">Editar</button>
              <button onClick={onExcluir} className="text-sm text-red-400 hover:text-red-300">Excluir</button>
            </>
          )}
          <button onClick={onFechar} className="text-sm text-ink-400 hover:text-ink-100 ml-auto">Fechar</button>
        </div>
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
      <span className="text-ink-200">{valor}</span>
    </div>
  );
}

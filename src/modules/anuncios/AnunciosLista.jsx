import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissoes } from '../../hooks/usePermissoes';
import { logger } from '../../utils/logger';
import { ativarAnuncio } from './service';
import {
  PLATAFORMAS, STATUS, TRANSICOES_VALIDAS, labelAcao, exigeAprovacao,
  labelPlataforma, labelStatus, corStatus,
} from './constants';

const VAZIO = { campanha_id: '', produto_id: '', plataforma: 'meta_ads', titulo: '', orcamento_diario: '', data_inicio: '', data_fim: '', responsavel_id: '' };

export default function AnunciosLista() {
  const { perfil } = useAuth();
  const { pode_ver, pode_editar, pode_aprovar, carregando: carregandoPermissoes } = usePermissoes('anuncios');

  const [anuncios, setAnuncios] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [filtroStatus, setFiltroStatus] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [novo, setNovo] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');
  const [detalhe, setDetalhe] = useState(null);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState(false);

  useEffect(() => {
    if (!carregandoPermissoes && pode_ver) carregar();
    supabase.from('campanhas').select('id, titulo').then(({ data }) => setCampanhas(data ?? []));
    supabase.from('produtos').select('id, nome').eq('ativo', true).then(({ data }) => setProdutos(data ?? []));
    supabase.from('usuarios').select('id, nome').then(({ data }) => setUsuarios(data ?? []));
  }, [carregandoPermissoes, pode_ver]);

  async function carregar() {
    setCarregando(true);
    setErro('');
    const { data, error } = await supabase
      .from('anuncios')
      .select('*, campanhas(titulo), produtos(nome), usuarios:responsavel_id(nome)')
      .order('created_at', { ascending: false });
    if (error) { logger.error('Falha ao carregar anúncios', error); setErro('Não foi possível carregar. Confira suas permissões.'); }
    setAnuncios(data ?? []);
    setCarregando(false);
  }

  const indicadores = useMemo(() => {
    const contagem = Object.fromEntries(STATUS.map((s) => [s.value, 0]));
    for (const a of anuncios) contagem[a.status] = (contagem[a.status] ?? 0) + 1;
    return contagem;
  }, [anuncios]);

  const filtrados = useMemo(() => {
    if (!filtroStatus) return anuncios;
    return anuncios.filter((a) => a.status === filtroStatus);
  }, [anuncios, filtroStatus]);

  function abrirNovo() {
    setNovo({ ...VAZIO, responsavel_id: perfil?.id ?? '' });
    setErroModal('');
    setModalAberto(true);
  }

  async function salvar(e) {
    e.preventDefault();
    if (!novo.titulo.trim()) { setErroModal('Dê um título ao anúncio.'); return; }
    if (!novo.campanha_id) { setErroModal('Selecione a campanha que este anúncio executa.'); return; }
    setErroModal('');
    setSalvando(true);
    const { error } = await supabase.from('anuncios').insert({
      campanha_id: novo.campanha_id,
      produto_id: novo.produto_id || null,
      plataforma: novo.plataforma,
      titulo: novo.titulo.trim(),
      orcamento_diario: novo.orcamento_diario !== '' ? Number(novo.orcamento_diario) : null,
      data_inicio: novo.data_inicio || null,
      data_fim: novo.data_fim || null,
      responsavel_id: novo.responsavel_id || null,
    });
    setSalvando(false);
    if (error) { logger.error('Falha ao criar anúncio', error); setErroModal('Não foi possível salvar. Confira suas permissões.'); return; }
    setModalAberto(false);
    await carregar();
  }

  async function transicionar(id, novoStatus) {
    setAcaoEmAndamento(true);
    try {
      if (novoStatus === 'indisponivel') {
        await ativarAnuncio(id);
      } else {
        const payload = { status: novoStatus };
        if (novoStatus === 'aprovado') payload.aprovado_por = perfil?.id;
        const { error } = await supabase.from('anuncios').update(payload).eq('id', id);
        if (error) throw error;
      }
      const { data } = await supabase
        .from('anuncios')
        .select('*, campanhas(titulo), produtos(nome), usuarios:responsavel_id(nome)')
        .eq('id', id)
        .single();
      setDetalhe(data ?? null);
      await carregar();
    } catch (err) {
      logger.error('Falha ao transicionar anúncio', err);
    } finally {
      setAcaoEmAndamento(false);
    }
  }

  if (carregandoPermissoes) return <p className="text-ink-500 text-sm">Carregando…</p>;

  if (!pode_ver) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl text-ink-100">Anúncios</h1>
        <p className="text-ink-500 text-sm mt-2">Você não tem permissão para visualizar anúncios.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-100">Anúncios</h1>
          <p className="text-ink-500 text-sm mt-1">Gestão de anúncios pagos — execução de campanhas já existentes.</p>
        </div>
        {pode_editar && (
          <button onClick={abrirNovo} className="rounded-lg bg-mint-500 hover:bg-mint-600 text-base-950 font-medium px-4 py-2 text-sm transition">
            + Novo anúncio
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mt-6">
        {STATUS.map((s) => (
          <button
            key={s.value}
            onClick={() => setFiltroStatus((v) => (v === s.value ? '' : s.value))}
            className={`rounded-lg border p-2 text-left transition ${filtroStatus === s.value ? 'border-mint-500' : 'border-base-800 hover:border-base-700'} bg-base-900`}
          >
            <p className="text-[9px] text-ink-500 truncate">{s.label}</p>
            <p className="font-display text-lg text-ink-100">{indicadores[s.value] ?? 0}</p>
          </button>
        ))}
      </div>

      {erro && <p className="text-sm text-red-400 mt-4">{erro}</p>}

      {carregando ? (
        <p className="text-ink-500 text-sm mt-6">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="text-ink-500 text-sm mt-8">{anuncios.length === 0 ? 'Nenhum anúncio cadastrado ainda.' : 'Nenhum anúncio encontrado com esse filtro.'}</p>
      ) : (
        <div className="mt-4 rounded-xl border border-base-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-base-900 text-ink-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Anúncio</th>
                <th className="text-left px-4 py-2.5 hidden sm:table-cell">Campanha</th>
                <th className="text-left px-4 py-2.5 hidden md:table-cell">Plataforma</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5 hidden lg:table-cell">Orçamento/dia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-800">
              {filtrados.map((a) => (
                <tr key={a.id} className="hover:bg-base-900/60 transition">
                  <td className="px-4 py-3">
                    <button onClick={() => setDetalhe(a)} className="text-ink-100 hover:text-mint-400 font-medium text-left">{a.titulo}</button>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-ink-300">{a.campanhas?.titulo || '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-300">{labelPlataforma(a.plataforma)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${corStatus(a.status)}`}>{labelStatus(a.status)}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-ink-300">{a.orcamento_diario != null ? `R$ ${Number(a.orcamento_diario).toFixed(2)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setModalAberto(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-base-900 border border-base-800 rounded-xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-xl text-ink-100 mb-4">Novo anúncio</h2>
            <form onSubmit={salvar} className="space-y-3">
              <Campo label="Título *"><input value={novo.titulo} onChange={(e) => setNovo((a) => ({ ...a, titulo: e.target.value }))} className="campo" autoFocus /></Campo>
              <Campo label="Campanha (o que este anúncio executa) *">
                <select value={novo.campanha_id} onChange={(e) => setNovo((a) => ({ ...a, campanha_id: e.target.value }))} className="campo">
                  <option value="">—</option>
                  {campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
                </select>
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Produto (opcional)">
                  <select value={novo.produto_id} onChange={(e) => setNovo((a) => ({ ...a, produto_id: e.target.value }))} className="campo">
                    <option value="">—</option>
                    {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </Campo>
                <Campo label="Plataforma">
                  <select value={novo.plataforma} onChange={(e) => setNovo((a) => ({ ...a, plataforma: e.target.value }))} className="campo">
                    {PLATAFORMAS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Campo>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Campo label="Orçamento/dia (R$)">
                  <input type="number" min="0" step="0.01" value={novo.orcamento_diario} onChange={(e) => setNovo((a) => ({ ...a, orcamento_diario: e.target.value }))} className="campo" />
                </Campo>
                <Campo label="Início">
                  <input type="date" value={novo.data_inicio} onChange={(e) => setNovo((a) => ({ ...a, data_inicio: e.target.value }))} className="campo" />
                </Campo>
                <Campo label="Fim">
                  <input type="date" value={novo.data_fim} onChange={(e) => setNovo((a) => ({ ...a, data_fim: e.target.value }))} className="campo" />
                </Campo>
              </div>
              <Campo label="Responsável">
                <select value={novo.responsavel_id} onChange={(e) => setNovo((a) => ({ ...a, responsavel_id: e.target.value }))} className="campo">
                  <option value="">—</option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </Campo>

              {erroModal && <p className="text-sm text-red-400">{erroModal}</p>}

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={salvando} className="rounded-lg bg-mint-500 hover:bg-mint-600 disabled:opacity-60 text-base-950 font-medium px-4 py-2 text-sm transition">
                  {salvando ? 'Salvando…' : 'Criar rascunho'}
                </button>
                <button type="button" onClick={() => setModalAberto(false)} className="rounded-lg border border-base-700 text-ink-300 hover:text-ink-100 px-4 py-2 text-sm transition">Cancelar</button>
              </div>
            </form>
            <style>{`.campo { width: 100%; border-radius: 0.5rem; background: #16213a; border: 1px solid #1f2d4d; padding: 0.5rem 0.75rem; color: #eef2f8; outline: none; font-size: 0.875rem; } .campo:focus { border-color: #2fb894; }`}</style>
          </div>
        </div>
      )}

      {detalhe && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setDetalhe(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-base-900 border border-base-800 rounded-xl p-5 w-full max-w-md">
            <h2 className="font-display text-xl text-ink-100">{detalhe.titulo}</h2>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${corStatus(detalhe.status)}`}>{labelStatus(detalhe.status)}</span>
            <div className="mt-3 space-y-1.5 text-sm">
              <Linha rotulo="Campanha" valor={detalhe.campanhas?.titulo || '—'} />
              <Linha rotulo="Produto" valor={detalhe.produtos?.nome || '—'} />
              <Linha rotulo="Plataforma" valor={labelPlataforma(detalhe.plataforma)} />
              <Linha rotulo="Orçamento/dia" valor={detalhe.orcamento_diario != null ? `R$ ${Number(detalhe.orcamento_diario).toFixed(2)}` : 'não definido'} />
              <Linha rotulo="Período" valor={detalhe.data_inicio ? `${detalhe.data_inicio} a ${detalhe.data_fim || '—'}` : '—'} />
              <Linha rotulo="Responsável" valor={detalhe.usuarios?.nome || '—'} />
              <Linha rotulo="Impressões" valor={detalhe.impressoes ?? 'sem dado real ainda'} />
              <Linha rotulo="Cliques" valor={detalhe.cliques ?? 'sem dado real ainda'} />
              <Linha rotulo="Gasto total" valor={detalhe.gasto_total != null ? `R$ ${Number(detalhe.gasto_total).toFixed(2)}` : 'sem dado real ainda'} />
            </div>
            {detalhe.erro_mensagem && <p className="text-xs text-amber-400 mt-3">{detalhe.erro_mensagem}</p>}

            {pode_editar && (
              <div className="flex flex-wrap gap-2 mt-4">
                {(TRANSICOES_VALIDAS[detalhe.status] ?? []).map((novoStatus) => {
                  const precisaAprovar = exigeAprovacao(detalhe.status, novoStatus);
                  if (precisaAprovar && !pode_aprovar) return null;
                  return (
                    <button
                      key={novoStatus}
                      disabled={acaoEmAndamento}
                      onClick={() => transicionar(detalhe.id, novoStatus)}
                      className={`text-sm px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-60 ${precisaAprovar ? 'bg-mint-500 hover:bg-mint-600 text-base-950' : 'border border-base-700 text-ink-300 hover:text-ink-100'}`}
                    >
                      {labelAcao(detalhe.status, novoStatus)}
                    </button>
                  );
                })}
              </div>
            )}
            {!pode_aprovar && detalhe.status === 'revisao' && (
              <p className="text-xs text-ink-500 mt-2">Aguardando aprovação de um administrador (gastos com anúncio pago exigem aprovação de admin).</p>
            )}
            <button onClick={() => setDetalhe(null)} className="mt-4 text-sm text-ink-400 hover:text-ink-100 block">Fechar</button>
          </div>
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

function Linha({ rotulo, valor }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-500">{rotulo}</span>
      <span className="text-ink-200 text-right">{valor}</span>
    </div>
  );
}

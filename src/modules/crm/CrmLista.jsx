import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissoes } from '../../hooks/usePermissoes';
import { logger } from '../../utils/logger';
import { STATUS, ORIGENS, labelOrigem, labelStatus, corStatus } from './constants';

const VAZIO = { nome: '', telefone: '', whatsapp: '', email: '', origem: 'manual', responsavel_id: '', observacoes: '' };

export default function CrmLista() {
  const { perfil } = useAuth();
  const { pode_ver, pode_editar, carregando: carregandoPermissoes } = usePermissoes('crm');

  const [contatos, setContatos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [novoContato, setNovoContato] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');

  useEffect(() => {
    if (!carregandoPermissoes && pode_ver) carregar();
    supabase.from('usuarios').select('id, nome').then(({ data }) => setUsuarios(data ?? []));
  }, [carregandoPermissoes, pode_ver]);

  async function carregar() {
    setCarregando(true);
    setErro('');
    const { data, error } = await supabase
      .from('crm_contatos')
      .select('*, usuarios:responsavel_id(nome)')
      .order('created_at', { ascending: false });
    if (error) { logger.error('Falha ao carregar contatos', error); setErro('Não foi possível carregar. Confira suas permissões.'); }
    setContatos(data ?? []);
    setCarregando(false);
  }

  const indicadores = useMemo(() => {
    const contagem = Object.fromEntries(STATUS.map((s) => [s.value, 0]));
    for (const c of contatos) contagem[c.status] = (contagem[c.status] ?? 0) + 1;
    return contagem;
  }, [contatos]);

  const filtrados = useMemo(() => {
    return contatos.filter((c) => {
      if (filtroStatus && c.status !== filtroStatus) return false;
      if (filtroResponsavel && c.responsavel_id !== filtroResponsavel) return false;
      if (busca) {
        const alvo = `${c.nome} ${c.telefone ?? ''} ${c.whatsapp ?? ''} ${c.email ?? ''}`.toLowerCase();
        if (!alvo.includes(busca.toLowerCase())) return false;
      }
      return true;
    });
  }, [contatos, filtroStatus, filtroResponsavel, busca]);

  function abrirNovo() {
    setNovoContato({ ...VAZIO, responsavel_id: perfil?.id ?? '' });
    setErroModal('');
    setModalAberto(true);
  }

  async function salvar(e) {
    e.preventDefault();
    if (!novoContato.nome.trim()) { setErroModal('Dê um nome ao contato.'); return; }
    setErroModal('');
    setSalvando(true);
    const { error } = await supabase.from('crm_contatos').insert({
      nome: novoContato.nome.trim(),
      telefone: novoContato.telefone.trim() || null,
      whatsapp: novoContato.whatsapp.trim() || null,
      email: novoContato.email.trim() || null,
      origem: novoContato.origem,
      responsavel_id: novoContato.responsavel_id || null,
      observacoes: novoContato.observacoes.trim() || null,
    });
    setSalvando(false);
    if (error) { logger.error('Falha ao criar contato', error); setErroModal('Não foi possível salvar. Confira suas permissões.'); return; }
    setModalAberto(false);
    await carregar();
  }

  if (carregandoPermissoes) return <p className="text-ink-500 text-sm">Carregando…</p>;

  if (!pode_ver) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl text-ink-100">CRM</h1>
        <p className="text-ink-500 text-sm mt-2">Você não tem permissão para visualizar contatos.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink-100">CRM</h1>
          <p className="text-ink-500 text-sm mt-1">Contatos e relacionamento com clientes.</p>
        </div>
        {pode_editar && (
          <button onClick={abrirNovo} className="rounded-lg bg-mint-500 hover:bg-mint-600 text-base-950 font-medium px-4 py-2 text-sm transition">
            + Novo contato
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
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
        <input placeholder="Buscar por nome, telefone ou e-mail…" value={busca} onChange={(e) => setBusca(e.target.value)} className="flex-1 min-w-[200px] rounded-lg bg-base-800 border border-base-700 px-3 py-1.5 text-sm text-ink-100 focus:border-mint-500 outline-none" />
        <select value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)} className="rounded-lg bg-base-800 border border-base-700 px-2 py-1.5 text-sm text-ink-100">
          <option value="">Todos os responsáveis</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </div>

      {erro && <p className="text-sm text-red-400 mt-4">{erro}</p>}

      {carregando ? (
        <p className="text-ink-500 text-sm mt-6">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="text-ink-500 text-sm mt-8">{contatos.length === 0 ? 'Nenhum contato cadastrado ainda.' : 'Nenhum contato encontrado com esses filtros.'}</p>
      ) : (
        <div className="mt-4 rounded-xl border border-base-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-base-900 text-ink-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Nome</th>
                <th className="text-left px-4 py-2.5 hidden sm:table-cell">Contato</th>
                <th className="text-left px-4 py-2.5 hidden md:table-cell">Origem</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5 hidden lg:table-cell">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-800">
              {filtrados.map((c) => (
                <tr key={c.id} className="hover:bg-base-900/60 transition">
                  <td className="px-4 py-3">
                    <Link to={`/crm/${c.id}`} className="text-ink-100 hover:text-mint-400 font-medium">{c.nome}</Link>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-ink-300">{c.telefone || c.whatsapp || c.email || '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-300">{labelOrigem(c.origem)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${corStatus(c.status)}`}>{labelStatus(c.status)}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-ink-300">{c.usuarios?.nome || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setModalAberto(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-base-900 border border-base-800 rounded-xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-xl text-ink-100 mb-4">Novo contato</h2>
            <form onSubmit={salvar} className="space-y-3">
              <Campo label="Nome *"><input value={novoContato.nome} onChange={(e) => setNovoContato((c) => ({ ...c, nome: e.target.value }))} className="campo" autoFocus /></Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Telefone"><input value={novoContato.telefone} onChange={(e) => setNovoContato((c) => ({ ...c, telefone: e.target.value }))} className="campo" /></Campo>
                <Campo label="WhatsApp"><input value={novoContato.whatsapp} onChange={(e) => setNovoContato((c) => ({ ...c, whatsapp: e.target.value }))} className="campo" /></Campo>
              </div>
              <Campo label="E-mail"><input type="email" value={novoContato.email} onChange={(e) => setNovoContato((c) => ({ ...c, email: e.target.value }))} className="campo" /></Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Origem">
                  <select value={novoContato.origem} onChange={(e) => setNovoContato((c) => ({ ...c, origem: e.target.value }))} className="campo">
                    {ORIGENS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Campo>
                <Campo label="Responsável">
                  <select value={novoContato.responsavel_id} onChange={(e) => setNovoContato((c) => ({ ...c, responsavel_id: e.target.value }))} className="campo">
                    <option value="">—</option>
                    {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </Campo>
              </div>
              <Campo label="Observações"><textarea value={novoContato.observacoes} onChange={(e) => setNovoContato((c) => ({ ...c, observacoes: e.target.value }))} className="campo" rows={2} /></Campo>

              {erroModal && <p className="text-sm text-red-400">{erroModal}</p>}

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={salvando} className="rounded-lg bg-mint-500 hover:bg-mint-600 disabled:opacity-60 text-base-950 font-medium px-4 py-2 text-sm transition">
                  {salvando ? 'Salvando…' : 'Cadastrar'}
                </button>
                <button type="button" onClick={() => setModalAberto(false)} className="rounded-lg border border-base-700 text-ink-300 hover:text-ink-100 px-4 py-2 text-sm transition">Cancelar</button>
              </div>
            </form>
            <style>{`.campo { width: 100%; border-radius: 0.5rem; background: #16213a; border: 1px solid #1f2d4d; padding: 0.5rem 0.75rem; color: #eef2f8; outline: none; font-size: 0.875rem; } .campo:focus { border-color: #2fb894; }`}</style>
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

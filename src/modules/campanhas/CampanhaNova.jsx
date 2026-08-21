import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../utils/logger';
import { OBJETIVOS, PUBLICOS_ALVO, CANAIS } from './constants';

export default function CampanhaNova() {
  const { perfil } = useAuth();
  const navigate = useNavigate();

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [objetivos, setObjetivos] = useState([]);
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [publicoAlvo, setPublicoAlvo] = useState('geral');
  const [canais, setCanais] = useState([]);
  const [tipoCampanha, setTipoCampanha] = useState('');
  const [possuiOrganico, setPossuiOrganico] = useState(true);
  const [possuiPago, setPossuiPago] = useState(false);
  const [orcamentoEstimado, setOrcamentoEstimado] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    supabase.from('usuarios').select('id, nome').then(({ data }) => {
      setUsuarios(data ?? []);
      if (perfil?.id) setResponsavelId(perfil.id);
    });
  }, [perfil?.id]);

  function alternar(lista, setLista, valor) {
    setLista(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
  }

  async function salvar(e) {
    e.preventDefault();
    if (!titulo.trim()) {
      setErro('Dê um título para a campanha.');
      return;
    }
    setErro('');
    setSalvando(true);

    // IMPORTANTE: nunca envia `status` aqui. A tabela já garante (trigger do
    // Sprint 1) que toda campanha nasce em 'rascunho' — não damos ao
    // frontend a chance de tentar outra coisa.
    const { data, error } = await supabase
      .from('campanhas')
      .insert({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        objetivos,
        periodo_inicio: periodoInicio || null,
        periodo_fim: periodoFim || null,
        publico_alvo: publicoAlvo,
        canais,
        tipo_campanha: tipoCampanha.trim() || null,
        possui_organico: possuiOrganico,
        possui_pago: possuiPago,
        orcamento_estimado: orcamentoEstimado ? Number(orcamentoEstimado) : null,
        observacoes: observacoes.trim() || null,
        responsavel_id: responsavelId || null,
        criado_por: perfil?.id ?? null,
      })
      .select('id')
      .single();

    setSalvando(false);

    if (error) {
      logger.error('Falha ao criar campanha', error);
      setErro('Não foi possível criar a campanha. Confira suas permissões.');
      return;
    }

    navigate(`/campanhas/${data.id}`);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl text-ink-100">Nova campanha</h1>
      <p className="text-ink-500 text-sm mt-1">Toda campanha nova começa como rascunho.</p>

      <form onSubmit={salvar} className="mt-6 space-y-5 bg-base-900 border border-base-800 rounded-xl p-5">
        <Campo label="Nome da campanha *">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="campo"
            placeholder="Ex: Verão saudável — vitaminas em dobro"
          />
        </Campo>

        <Campo label="Descrição">
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="campo" rows={3} />
        </Campo>

        <Campo label="Objetivos (selecione um ou mais)">
          <div className="flex flex-wrap gap-2">
            {OBJETIVOS.map((o) => (
              <Chip key={o.value} ativo={objetivos.includes(o.value)} onClick={() => alternar(objetivos, setObjetivos, o.value)}>
                {o.label}
              </Chip>
            ))}
          </div>
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Início">
            <input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} className="campo" />
          </Campo>
          <Campo label="Término">
            <input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} className="campo" />
          </Campo>
        </div>

        <Campo label="Público-alvo">
          <select value={publicoAlvo} onChange={(e) => setPublicoAlvo(e.target.value)} className="campo">
            {PUBLICOS_ALVO.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </Campo>

        <Campo label="Canais (selecione um ou mais)">
          <div className="flex flex-wrap gap-2">
            {CANAIS.map((c) => (
              <Chip key={c.value} ativo={canais.includes(c.value)} onClick={() => alternar(canais, setCanais, c.value)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </Campo>

        <Campo label="Tipo de campanha">
          <input
            value={tipoCampanha}
            onChange={(e) => setTipoCampanha(e.target.value)}
            className="campo"
            placeholder="Ex: promocional, sazonal, institucional…"
          />
        </Campo>

        <Campo label="Responsável">
          <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="campo">
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        </Campo>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-ink-300">
            <input type="checkbox" checked={possuiOrganico} onChange={(e) => setPossuiOrganico(e.target.checked)} />
            Divulgação orgânica
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-300">
            <input type="checkbox" checked={possuiPago} onChange={(e) => setPossuiPago(e.target.checked)} />
            Anúncio pago
          </label>
        </div>

        {possuiPago && (
          <Campo label="Orçamento estimado (R$)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={orcamentoEstimado}
              onChange={(e) => setOrcamentoEstimado(e.target.value)}
              className="campo"
            />
          </Campo>
        )}

        <Campo label="Observações">
          <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="campo" rows={2} />
        </Campo>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={salvando}
            className="rounded-lg bg-mint-500 hover:bg-mint-600 disabled:opacity-60 text-base-950 font-medium px-4 py-2 text-sm transition"
          >
            {salvando ? 'Criando…' : 'Criar rascunho'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/campanhas')}
            className="rounded-lg border border-base-700 text-ink-300 hover:text-ink-100 px-4 py-2 text-sm transition"
          >
            Cancelar
          </button>
        </div>
      </form>

      <style>{`.campo { width: 100%; border-radius: 0.5rem; background: #16213a; border: 1px solid #1f2d4d; padding: 0.5rem 0.75rem; color: #eef2f8; outline: none; font-size: 0.875rem; } .campo:focus { border-color: #2fb894; }`}</style>
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

function Chip({ ativo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition ${
        ativo ? 'border-mint-500 bg-mint-500/10 text-mint-400' : 'border-base-700 text-ink-300 hover:border-base-600'
      }`}
    >
      {children}
    </button>
  );
}

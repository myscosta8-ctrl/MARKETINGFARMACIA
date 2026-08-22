import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../utils/logger';
import { TIPOS_CONTEUDO, CANAIS_CONTEUDO } from './constants';

export default function ConteudoNovo() {
  const { perfil } = useAuth();
  const navigate = useNavigate();

  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('post');
  const [descricao, setDescricao] = useState('');
  const [textoCopy, setTextoCopy] = useState('');
  const [cta, setCta] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [observacoesInternas, setObservacoesInternas] = useState('');
  const [canais, setCanais] = useState([]);
  const [campanhaId, setCampanhaId] = useState('');
  const [produtoId, setProdutoId] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [campanhas, setCampanhas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    supabase.from('campanhas').select('id, titulo').then(({ data }) => setCampanhas(data ?? []));
    supabase.from('produtos').select('id, nome').eq('ativo', true).then(({ data }) => setProdutos(data ?? []));
    supabase.from('usuarios').select('id, nome').then(({ data }) => {
      setUsuarios(data ?? []);
      if (perfil?.id) setResponsavelId(perfil.id);
    });
  }, [perfil?.id]);

  function alternarCanal(valor) {
    setCanais((c) => (c.includes(valor) ? c.filter((v) => v !== valor) : [...c, valor]));
  }

  async function salvar(e) {
    e.preventDefault();
    if (!titulo.trim()) {
      setErro('Dê um título ao conteúdo.');
      return;
    }
    setErro('');
    setSalvando(true);

    // Nunca envia `status` — a tabela já garante nascimento em 'rascunho'.
    const { data, error } = await supabase
      .from('conteudos')
      .insert({
        titulo: titulo.trim(),
        tipo,
        descricao: descricao.trim() || null,
        texto_copy: textoCopy.trim() || null,
        cta: cta.trim() || null,
        hashtags: hashtags.trim() || null,
        observacoes_internas: observacoesInternas.trim() || null,
        campanha_id: campanhaId || null,
        produto_id: produtoId || null,
        responsavel_id: responsavelId || null,
        data_agendamento: dataAgendamento || null,
        criado_por: perfil?.id ?? null,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Falha ao criar conteúdo', error);
      setErro('Não foi possível criar. Confira suas permissões.');
      setSalvando(false);
      return;
    }

    if (canais.length > 0) {
      const { error: eCanais } = await supabase
        .from('conteudo_canais')
        .insert(canais.map((canal) => ({ conteudo_id: data.id, canal })));
      if (eCanais) logger.error('Falha ao salvar canais do conteúdo', eCanais);
    }

    setSalvando(false);
    navigate(`/conteudo/${data.id}`);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl text-ink-100">Novo conteúdo</h1>
      <p className="text-ink-500 text-sm mt-1">Todo conteúdo novo começa como rascunho.</p>

      <form onSubmit={salvar} className="mt-6 space-y-5 bg-base-900 border border-base-800 rounded-xl p-5">
        <Campo label="Título *">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="campo" placeholder="Ex: Post — vitaminas em promoção" />
        </Campo>

        <Campo label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="campo">
            {TIPOS_CONTEUDO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Campo>

        <Campo label="Descrição">
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="campo" rows={2} />
        </Campo>

        <Campo label="Texto/copy (o que vai pro público)">
          <textarea value={textoCopy} onChange={(e) => setTextoCopy(e.target.value)} className="campo" rows={3} />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="CTA">
            <input value={cta} onChange={(e) => setCta(e.target.value)} className="campo" placeholder="Ex: Compre agora" />
          </Campo>
          <Campo label="Hashtags">
            <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} className="campo" />
          </Campo>
        </div>

        <Campo label="Canais (selecione um ou mais)">
          <div className="flex flex-wrap gap-2">
            {CANAIS_CONTEUDO.map((c) => (
              <Chip key={c.value} ativo={canais.includes(c.value)} onClick={() => alternarCanal(c.value)}>{c.label}</Chip>
            ))}
          </div>
        </Campo>

        <Campo label="Campanha relacionada">
          <select value={campanhaId} onChange={(e) => setCampanhaId(e.target.value)} className="campo">
            <option value="">—</option>
            {campanhas.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
          </select>
        </Campo>

        <Campo label="Produto relacionado">
          <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className="campo">
            <option value="">—</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </Campo>

        <Campo label="Responsável">
          <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="campo">
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </Campo>

        <Campo label="Data de agendamento (opcional)">
          <input type="date" value={dataAgendamento} onChange={(e) => setDataAgendamento(e.target.value)} className="campo" />
        </Campo>

        <Campo label="Observações internas (não vai pro público)">
          <textarea value={observacoesInternas} onChange={(e) => setObservacoesInternas(e.target.value)} className="campo" rows={2} />
        </Campo>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={salvando} className="rounded-lg bg-mint-500 hover:bg-mint-600 disabled:opacity-60 text-base-950 font-medium px-4 py-2 text-sm transition">
            {salvando ? 'Criando…' : 'Criar rascunho'}
          </button>
          <button type="button" onClick={() => navigate('/conteudo')} className="rounded-lg border border-base-700 text-ink-300 hover:text-ink-100 px-4 py-2 text-sm transition">
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
      className={`text-xs px-3 py-1.5 rounded-full border transition ${ativo ? 'border-mint-500 bg-mint-500/10 text-mint-400' : 'border-base-700 text-ink-300 hover:border-base-600'}`}
    >
      {children}
    </button>
  );
}

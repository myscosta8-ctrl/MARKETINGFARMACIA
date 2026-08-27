import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { usePermissoes } from '../../hooks/usePermissoes';
import { logger } from '../../utils/logger';
import {
  labelOrigem, labelStatus, corStatus, TRANSICOES_VALIDAS, labelAcao,
  TIPOS_INTERACAO, labelTipoInteracao,
} from './constants';

export default function CrmDetalhe() {
  const { id } = useParams();
  const { pode_editar } = usePermissoes('crm');

  const [contato, setContato] = useState(null);
  const [interacoes, setInteracoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const [tipoInteracao, setTipoInteracao] = useState('anotacao');
  const [descricaoInteracao, setDescricaoInteracao] = useState('');
  const [enviandoInteracao, setEnviandoInteracao] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [{ data: c, error: eC }, { data: it }] = await Promise.all([
      supabase.from('crm_contatos').select('*, usuarios:responsavel_id(nome)').eq('id', id).single(),
      supabase.from('crm_interacoes').select('*, usuarios:usuario_id(nome)').eq('contato_id', id).order('created_at', { ascending: false }),
    ]);
    if (eC) logger.error('Falha ao carregar contato', eC);
    setContato(c ?? null);
    setInteracoes(it ?? []);
    setCarregando(false);
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function transicionar(novoStatus) {
    setAcaoEmAndamento(true);
    setMensagem('');
    const { error } = await supabase.from('crm_contatos').update({ status: novoStatus }).eq('id', id);
    setAcaoEmAndamento(false);
    if (error) { logger.error('Falha ao transicionar contato', error); setMensagem(`Não foi possível concluir: ${error.message}`); return; }
    await carregar();
  }

  async function registrarInteracao(e) {
    e.preventDefault();
    if (!descricaoInteracao.trim() && tipoInteracao === 'anotacao') return;
    setEnviandoInteracao(true);
    const { error } = await supabase.from('crm_interacoes').insert({
      contato_id: id,
      tipo: tipoInteracao,
      descricao: descricaoInteracao.trim() || null,
    });
    setEnviandoInteracao(false);
    if (error) { logger.error('Falha ao registrar interação', error); return; }
    setDescricaoInteracao('');
    await carregar();
  }

  if (carregando) return <p className="text-ink-500 text-sm">Carregando…</p>;
  if (!contato) return <p className="text-ink-500 text-sm">Contato não encontrado.</p>;

  const transicoesPossiveis = TRANSICOES_VALIDAS[contato.status] ?? [];

  return (
    <div className="max-w-3xl">
      <Link to="/crm" className="text-sm text-ink-500 hover:text-ink-300">← CRM</Link>

      <div className="flex items-start justify-between flex-wrap gap-3 mt-2">
        <div>
          <h1 className="font-display text-2xl text-ink-100">{contato.nome}</h1>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${corStatus(contato.status)}`}>{labelStatus(contato.status)}</span>
        </div>
        {pode_editar && (
          <div className="flex flex-wrap gap-2">
            {transicoesPossiveis.map((novoStatus) => (
              <button
                key={novoStatus}
                disabled={acaoEmAndamento}
                onClick={() => transicionar(novoStatus)}
                className="text-sm px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-60 border border-base-700 text-ink-300 hover:text-ink-100"
              >
                {labelAcao(contato.status, novoStatus)}
              </button>
            ))}
          </div>
        )}
      </div>

      {mensagem && <p className="text-sm text-red-400 mt-3">{mensagem}</p>}

      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        <Bloco titulo="Contato">
          <Linha rotulo="Telefone" valor={contato.telefone || '—'} />
          <Linha rotulo="WhatsApp" valor={contato.whatsapp || '—'} />
          <Linha rotulo="E-mail" valor={contato.email || '—'} />
        </Bloco>
        <Bloco titulo="Gestão">
          <Linha rotulo="Origem" valor={labelOrigem(contato.origem)} />
          <Linha rotulo="Responsável" valor={contato.usuarios?.nome || '—'} />
          <Linha rotulo="Cadastrado em" valor={new Date(contato.created_at).toLocaleDateString('pt-BR')} />
        </Bloco>
      </div>

      {contato.observacoes && (
        <Bloco titulo="Observações" className="mt-4"><p className="text-sm text-ink-300 whitespace-pre-wrap">{contato.observacoes}</p></Bloco>
      )}

      <Bloco titulo="Histórico de interações" className="mt-4">
        {pode_editar && (
          <form onSubmit={registrarInteracao} className="flex flex-wrap gap-2 mb-4">
            <select value={tipoInteracao} onChange={(e) => setTipoInteracao(e.target.value)} className="campo-mini">
              {TIPOS_INTERACAO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input placeholder="Descrição" value={descricaoInteracao} onChange={(e) => setDescricaoInteracao(e.target.value)} className="campo-mini flex-1 min-w-[160px]" />
            <button disabled={enviandoInteracao} className="text-xs bg-mint-500 hover:bg-mint-600 disabled:opacity-60 text-base-950 font-medium px-3 py-1.5 rounded-lg transition">
              Registrar
            </button>
            <style>{`.campo-mini { border-radius: 0.375rem; background: #0f172a; border: 1px solid #1f2d4d; padding: 0.4rem 0.6rem; color: #eef2f8; outline: none; font-size: 0.8rem; }`}</style>
          </form>
        )}
        {interacoes.length === 0 ? (
          <p className="text-sm text-ink-500">Nenhuma interação registrada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {interacoes.map((i) => (
              <li key={i.id} className="text-sm border-l-2 border-base-700 pl-3">
                <div className="flex justify-between">
                  <span className="text-ink-100 font-medium">{labelTipoInteracao(i.tipo)}</span>
                  <span className="text-ink-500 text-xs">{new Date(i.created_at).toLocaleString('pt-BR')}</span>
                </div>
                {i.descricao && <p className="text-ink-300 mt-0.5">{i.descricao}</p>}
                <p className="text-ink-500 text-xs mt-0.5">{i.usuarios?.nome}</p>
              </li>
            ))}
          </ul>
        )}
      </Bloco>
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

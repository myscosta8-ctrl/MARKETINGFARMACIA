import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePermissoes } from '../../hooks/usePermissoes';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../utils/logger';
import { enviarMensagemWhatsApp } from './service';
import { labelStatus, corStatus, STATUS_INTEGRACAO_LABEL } from './constants';

export default function WhatsAppPage() {
  const { perfil } = useAuth();
  const { pode_ver, pode_editar, carregando: carregandoPermissoes } = usePermissoes('whatsapp');

  const [integracao, setIntegracao] = useState(null);
  const [carregandoIntegracao, setCarregandoIntegracao] = useState(true);

  const [contatos, setContatos] = useState([]);
  const [leads, setLeads] = useState([]);
  const [telefone, setTelefone] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [contatoId, setContatoId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const [historico, setHistorico] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);

  useEffect(() => {
    if (!pode_ver) return;
    carregarIntegracao();
    carregarHistorico();
    supabase.from('crm_contatos').select('id, nome, telefone, whatsapp').then(({ data }) => setContatos(data ?? []));
    supabase.from('leads').select('id, nome, telefone, whatsapp').then(({ data }) => setLeads(data ?? []));
  }, [pode_ver]);

  async function carregarIntegracao() {
    setCarregandoIntegracao(true);
    const { data, error } = await supabase.from('integracoes').select('*').eq('provedor', 'whatsapp').maybeSingle();
    if (error) logger.error('Falha ao carregar status de integração do WhatsApp', error);
    setIntegracao(data);
    setCarregandoIntegracao(false);
  }

  async function carregarHistorico() {
    setCarregandoHistorico(true);
    const { data, error } = await supabase
      .from('whatsapp_mensagens')
      .select('*, usuarios:usuario_id(nome), crm_contatos:contato_id(nome), leads:lead_id(nome)')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) logger.error('Falha ao carregar histórico de mensagens', error);
    setHistorico(data ?? []);
    setCarregandoHistorico(false);
  }

  function preencherDeContato(id) {
    setContatoId(id);
    setLeadId('');
    const c = contatos.find((x) => x.id === id);
    if (c) setTelefone(c.whatsapp || c.telefone || '');
  }

  function preencherDeLead(id) {
    setLeadId(id);
    setContatoId('');
    const l = leads.find((x) => x.id === id);
    if (l) setTelefone(l.whatsapp || l.telefone || '');
  }

  async function enviar(e) {
    e.preventDefault();
    if (!telefone.trim() || !conteudo.trim()) { setErro('Preencha o telefone e a mensagem.'); return; }
    setErro('');
    setEnviando(true);
    try {
      await enviarMensagemWhatsApp({
        telefoneDestino: telefone.trim(),
        conteudo: conteudo.trim(),
        contatoId: contatoId || null,
        leadId: leadId || null,
      });
      setConteudo('');
      await carregarHistorico();
    } catch {
      setErro('Não foi possível registrar a mensagem. Confira suas permissões.');
    } finally {
      setEnviando(false);
    }
  }

  if (carregandoPermissoes) return <p className="text-ink-500 text-sm">Carregando…</p>;

  if (!pode_ver) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl text-ink-100">WhatsApp</h1>
        <p className="text-ink-500 text-sm mt-2">Você não tem permissão para acessar o módulo de WhatsApp.</p>
      </div>
    );
  }

  const statusIntegracao = integracao?.status ?? 'nao_configurado';

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl text-ink-100">WhatsApp</h1>
      <p className="text-ink-500 text-sm mt-1">Mensagens e status de conexão — canal ainda sem credencial oficial configurada.</p>

      {carregandoIntegracao ? (
        <p className="text-ink-500 text-sm mt-4">Carregando status…</p>
      ) : (
        <div className={`mt-4 rounded-lg border p-3 text-sm ${statusIntegracao === 'conectado' ? 'border-mint-500/40 bg-mint-500/5 text-mint-400' : 'border-amber-400/40 bg-amber-400/5 text-amber-400'}`}>
          Status da integração: <strong>{STATUS_INTEGRACAO_LABEL[statusIntegracao] ?? statusIntegracao}</strong>.
          {statusIntegracao === 'nao_configurado' && perfil?.papel === 'admin' && (
            <> Configuração de credencial oficial (Meta Business/WhatsApp Business API) fica em Configurações — nenhuma chave é guardada em texto puro nesta tela.</>
          )}
          {statusIntegracao === 'nao_configurado' && perfil?.papel !== 'admin' && (
            <> Fale com um administrador da farmácia para configurar.</>
          )}
        </div>
      )}

      {pode_editar ? (
        <form onSubmit={enviar} className="mt-6 space-y-3 bg-base-900 border border-base-800 rounded-xl p-5">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Contato CRM (opcional)">
              <select value={contatoId} onChange={(e) => preencherDeContato(e.target.value)} className="campo">
                <option value="">—</option>
                {contatos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Lead (opcional)">
              <select value={leadId} onChange={(e) => preencherDeLead(e.target.value)} className="campo">
                <option value="">—</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Telefone/WhatsApp">
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="campo" placeholder="(00) 00000-0000" />
          </Campo>
          <Campo label="Mensagem">
            <textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} className="campo" rows={3} />
          </Campo>
          {erro && <p className="text-sm text-red-400">{erro}</p>}
          <button type="submit" disabled={enviando} className="rounded-lg bg-mint-500 hover:bg-mint-600 disabled:opacity-60 text-base-950 font-medium px-4 py-2 text-sm transition">
            {enviando ? 'Registrando…' : 'Registrar envio'}
          </button>
          <style>{`.campo { width: 100%; border-radius: 0.5rem; background: #16213a; border: 1px solid #1f2d4d; padding: 0.5rem 0.75rem; color: #eef2f8; outline: none; font-size: 0.875rem; } .campo:focus { border-color: #2fb894; }`}</style>
        </form>
      ) : (
        <p className="text-sm text-ink-500 mt-6">Você não tem permissão para enviar mensagens — pode visualizar o histórico abaixo.</p>
      )}

      <h2 className="font-display text-lg text-ink-100 mt-8 mb-3">Histórico</h2>
      {carregandoHistorico ? (
        <p className="text-ink-500 text-sm">Carregando…</p>
      ) : historico.length === 0 ? (
        <p className="text-ink-500 text-sm">Nenhuma mensagem registrada ainda.</p>
      ) : (
        <div className="space-y-2">
          {historico.map((m) => (
            <div key={m.id} className="rounded-lg border border-base-800 bg-base-900 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-100 font-medium">{m.telefone_destino}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${corStatus(m.status)}`}>{labelStatus(m.status)}</span>
              </div>
              <p className="text-sm text-ink-300 mt-1">{m.conteudo}</p>
              {m.erro_mensagem && <p className="text-xs text-amber-400 mt-1">{m.erro_mensagem}</p>}
              <p className="text-[11px] text-ink-500 mt-2">
                {m.crm_contatos?.nome || m.leads?.nome ? `${m.crm_contatos?.nome || m.leads?.nome} · ` : ''}
                {m.usuarios?.nome} · {new Date(m.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
          ))}
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

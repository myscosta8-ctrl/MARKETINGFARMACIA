import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

const PROVEDORES = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
];

const STATUS_LABEL = {
  nao_configurado: 'Não configurado',
  configurado: 'Configurado (aguardando primeira conexão)',
  conectado: 'Conectado',
  erro: 'Erro de autenticação',
  desconectado: 'Desconectado',
  token_expirado: 'Token expirado — reconexão necessária',
};

const STATUS_COR = {
  nao_configurado: 'text-ink-500 bg-ink-500/10',
  configurado: 'text-amber-400 bg-amber-400/10',
  conectado: 'text-mint-400 bg-mint-400/10',
  erro: 'text-red-400 bg-red-400/10',
  desconectado: 'text-ink-500 bg-ink-500/10',
  token_expirado: 'text-amber-400 bg-amber-400/10',
};

/**
 * Painel de status/conexão das 3 integrações Meta. Não guarda nenhum
 * segredo — só lê o status já protegido por RLS (corrigido na migration
 * 023 para exigir pode_ver do módulo correspondente). O botão "Conectar"
 * abre o popup de OAuth da Meta; a troca de código por token acontece
 * inteiramente na Edge Function `meta-oauth-callback`, nunca aqui.
 */
export function PainelIntegracoesMeta({ farmaciaId, podeEditar }) {
  const [integracoes, setIntegracoes] = useState({});
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setCarregando(true);
    const { data, error } = await supabase
      .from('integracoes')
      .select('provedor, status, conta_externa_nome, token_expira_em, ultimo_erro');
    if (error) logger.error('Falha ao carregar integrações', error);
    const porProvedor = {};
    for (const i of data ?? []) porProvedor[i.provedor] = i;
    setIntegracoes(porProvedor);
    setCarregando(false);
  }

  function conectar(provedor) {
    const appId = import.meta.env.VITE_META_APP_ID;
    const redirectUri = import.meta.env.VITE_META_OAUTH_REDIRECT_URI;
    if (!appId || !redirectUri) {
      alert('VITE_META_APP_ID / VITE_META_OAUTH_REDIRECT_URI não configurados no build do frontend. Ver DOCUMENTACAO_INTEGRACOES_META.md.');
      return;
    }
    const state = btoa(JSON.stringify({ farmacia_id: farmaciaId, provedor }));
    const escopo = provedor === 'whatsapp'
      ? 'whatsapp_business_messaging,whatsapp_business_management'
      : 'instagram_basic,instagram_content_publish,pages_manage_posts,pages_read_engagement';
    const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(escopo)}`;
    window.open(url, 'conectar-meta', 'width=600,height=700');
  }

  if (carregando) return <p className="text-ink-500 text-sm">Carregando integrações…</p>;

  return (
    <div className="mt-6 rounded-xl border border-base-800 bg-base-900 p-5">
      <h2 className="font-display text-lg text-ink-100 mb-1">Integrações (Meta)</h2>
      <p className="text-sm text-ink-500 mb-4">
        Conexão real com WhatsApp, Instagram e Facebook. Nenhum token fica no navegador — a conexão
        acontece inteiramente do lado do servidor.
      </p>
      <div className="space-y-3">
        {PROVEDORES.map((p) => {
          const integ = integracoes[p.id];
          const status = integ?.status ?? 'nao_configurado';
          return (
            <div key={p.id} className="flex items-center justify-between border border-base-800 rounded-lg p-3">
              <div>
                <p className="text-sm text-ink-100 font-medium">{p.label}</p>
                <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${STATUS_COR[status]}`}>
                  {STATUS_LABEL[status] ?? status}
                </span>
                {integ?.ultimo_erro && <p className="text-xs text-red-400 mt-1">{integ.ultimo_erro}</p>}
              </div>
              {podeEditar && (
                <button
                  onClick={() => conectar(p.id)}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium transition border border-base-700 text-ink-300 hover:text-ink-100"
                >
                  {status === 'conectado' ? 'Reconectar' : 'Conectar'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

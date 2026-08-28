import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export function SinoNotificacoes() {
  const { perfil } = useAuth();
  const navigate = useNavigate();
  const [naoLidas, setNaoLidas] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const containerRef = useRef(null);
  const abertoRef = useRef(false);

  function definirAberto(valor) {
    abertoRef.current = valor;
    setAberto(valor);
  }

  async function carregarContagem() {
    const { count } = await supabase
      .from('notificacoes')
      .select('id', { count: 'exact', head: true })
      .eq('lida', false)
      .or(`usuario_id.eq.${perfil.id},usuario_id.is.null`);
    setNaoLidas(count ?? 0);
  }

  async function carregarLista() {
    setCarregando(true);
    const { data, error } = await supabase
      .from('notificacoes')
      .select('id, tipo, titulo, mensagem, lida, link, created_at')
      .or(`usuario_id.eq.${perfil.id},usuario_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) logger.error('Falha ao carregar notificações', error);
    setNotificacoes(data ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    if (!perfil?.id) return;
    carregarContagem();

    const canal = supabase
      .channel('notificacoes-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificacoes' },
        () => {
          carregarContagem();
          if (abertoRef.current) carregarLista();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(canal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  useEffect(() => {
    function aoClicarFora(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) definirAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  function alternar() {
    const vaiAbrir = !aberto;
    definirAberto(vaiAbrir);
    if (vaiAbrir) carregarLista();
  }

  async function marcarComoLida(notif) {
    if (!notif.lida) {
      const { error } = await supabase.from('notificacoes').update({ lida: true }).eq('id', notif.id);
      if (error) { logger.error('Falha ao marcar notificação como lida', error); return; }
      setNotificacoes((lista) => lista.map((n) => (n.id === notif.id ? { ...n, lida: true } : n)));
      setNaoLidas((n) => Math.max(0, n - 1));
    }
    definirAberto(false);
    if (notif.link) navigate(notif.link);
  }

  async function marcarTodasComoLidas() {
    const idsNaoLidas = notificacoes.filter((n) => !n.lida).map((n) => n.id);
    if (idsNaoLidas.length === 0) return;
    const { error } = await supabase.from('notificacoes').update({ lida: true }).in('id', idsNaoLidas);
    if (error) { logger.error('Falha ao marcar notificações como lidas', error); return; }
    setNotificacoes((lista) => lista.map((n) => ({ ...n, lida: true })));
    setNaoLidas(0);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={alternar}
        aria-label={`Notificações${naoLidas > 0 ? ` (${naoLidas} não lidas)` : ''}`}
        className="relative h-9 w-9 rounded-lg hover:bg-base-800 flex items-center justify-center transition"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-amber-400 text-[10px] font-semibold text-base-950 flex items-center justify-center">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-base-800 bg-base-900 shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-base-800">
            <h3 className="text-sm font-medium text-ink-100">Notificações</h3>
            {naoLidas > 0 && (
              <button onClick={marcarTodasComoLidas} className="text-xs text-mint-400 hover:text-mint-300">
                Marcar todas como lidas
              </button>
            )}
          </div>
          {carregando ? (
            <p className="text-sm text-ink-500 px-4 py-6 text-center">Carregando…</p>
          ) : notificacoes.length === 0 ? (
            <p className="text-sm text-ink-500 px-4 py-6 text-center">Nenhuma notificação ainda.</p>
          ) : (
            <ul className="divide-y divide-base-800">
              {notificacoes.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => marcarComoLida(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-base-800/60 transition ${!n.lida ? 'bg-mint-500/5' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.lida && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-mint-400 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm text-ink-100 truncate">{n.titulo}</p>
                        {n.mensagem && <p className="text-xs text-ink-500 truncate">{n.mensagem}</p>}
                        <p className="text-[11px] text-ink-500 mt-0.5">{new Date(n.created_at).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

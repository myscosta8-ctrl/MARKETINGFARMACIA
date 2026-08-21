import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function SinoNotificacoes() {
  const { perfil } = useAuth();
  const [naoLidas, setNaoLidas] = useState(0);

  useEffect(() => {
    if (!perfil?.id) return;

    async function carregar() {
      const { count } = await supabase
        .from('notificacoes')
        .select('id', { count: 'exact', head: true })
        .eq('lida', false)
        .or(`usuario_id.eq.${perfil.id},usuario_id.is.null`);
      setNaoLidas(count ?? 0);
    }
    carregar();

    const canal = supabase
      .channel('notificacoes-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificacoes' },
        () => carregar()
      )
      .subscribe();

    return () => supabase.removeChannel(canal);
  }, [perfil?.id]);

  return (
    <button
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
  );
}

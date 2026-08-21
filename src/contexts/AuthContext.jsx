import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null); // linha da tabela usuarios (papel, farmacia_id, etc.)
  const [loading, setLoading] = useState(true);

  const carregarPerfil = useCallback(async (userId) => {
    if (!userId) {
      setPerfil(null);
      return;
    }
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, farmacia_id, nome, email, papel, ativo')
      .eq('id', userId)
      .single();
    if (error) {
      logger.error('Falha ao carregar perfil do usuário', error);
      setPerfil(null);
      return;
    }
    setPerfil(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      await carregarPerfil(session?.user?.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      await carregarPerfil(session?.user?.id);
    });

    return () => listener.subscription.unsubscribe();
  }, [carregarPerfil]);

  const entrar = async (email, senha) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
  };

  const sair = async () => {
    await supabase.auth.signOut();
  };

  const value = { session, perfil, loading, entrar, sair, usuario: session?.user ?? null };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

/**
 * Retorna { pode_ver, pode_editar, pode_aprovar, carregando } para o papel do
 * usuário logado no módulo informado. A UI usa isso só para mostrar/esconder
 * ações — a permissão de verdade é sempre validada de novo pelo banco (RLS +
 * triggers), então não há problema de segurança se este hook estiver
 * desatualizado por um instante.
 */
export function usePermissoes(moduloId) {
  const { perfil } = useAuth();
  const [permissoes, setPermissoes] = useState({ pode_ver: false, pode_editar: false, pode_aprovar: false });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!perfil?.papel) return;
    let ativo = true;
    supabase
      .from('permissoes')
      .select('pode_ver, pode_editar, pode_aprovar')
      .eq('papel', perfil.papel)
      .eq('modulo_id', moduloId)
      .single()
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) logger.error('Falha ao carregar permissões', error);
        setPermissoes(data ?? { pode_ver: false, pode_editar: false, pode_aprovar: false });
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [perfil?.papel, moduloId]);

  return { ...permissoes, carregando };
}

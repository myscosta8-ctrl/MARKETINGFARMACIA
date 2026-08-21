import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export function useModulos() {
  const [modulos, setModulos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    supabase
      .from('modulos')
      .select('id, nome, descricao, ordem, disponivel')
      .order('ordem')
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) logger.error('Falha ao carregar módulos', error);
        setModulos(data ?? []);
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  return { modulos, carregando };
}

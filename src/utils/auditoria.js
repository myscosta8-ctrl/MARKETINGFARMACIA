import { supabase } from '../lib/supabase';
import { logger } from './logger';

/**
 * Registra uma ação relevante na trilha de auditoria.
 * Ações estruturais (INSERT/UPDATE/DELETE em campanhas e integrações) já são
 * logadas automaticamente por trigger no banco (ver migration 001).
 * Use isto para ações que não mapeiam para uma linha de tabela, ex: login,
 * exportação de dados, aprovação manual fora do fluxo padrão.
 */
export async function registrarAuditoria({ acao, entidade, entidadeId = null, dadosNovos = null }) {
  const { data: userData } = await supabase.auth.getUser();
  const usuarioId = userData?.user?.id ?? null;

  const { data: perfil } = usuarioId
    ? await supabase.from('usuarios').select('farmacia_id').eq('id', usuarioId).single()
    : { data: null };

  const { error } = await supabase.from('logs_auditoria').insert({
    farmacia_id: perfil?.farmacia_id ?? null,
    usuario_id: usuarioId,
    acao,
    entidade,
    entidade_id: entidadeId,
    dados_novos: dadosNovos
  });

  if (error) logger.error('Falha ao registrar auditoria', error);
}

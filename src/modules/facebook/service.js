import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

/**
 * Ponto único de entrada para publicar um Conteúdo no Facebook. Mesmo
 * princípio de src/modules/instagram/service.js: sem provedor real
 * configurado, registra a tentativa como "indisponivel", nunca fabrica um
 * link publicado nem métricas que não aconteceram de verdade.
 */
export async function publicarConteudoFacebook({ conteudoId }) {
  const { data, error } = await supabase
    .from('facebook_publicacoes')
    .insert({
      conteudo_id: conteudoId,
      status: 'indisponivel',
      erro_mensagem: 'Nenhuma integração com o Facebook configurada. Configure uma credencial oficial (Meta Business) em Integrações para habilitar a publicação real.',
    })
    .select()
    .single();

  if (error) {
    logger.error('Falha ao registrar publicação no Facebook', error);
    throw error;
  }
  return data;
}

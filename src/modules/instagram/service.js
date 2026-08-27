import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

/**
 * Ponto único de entrada para publicar um Conteúdo no Instagram. Mesmo
 * princípio de src/modules/whatsapp/service.js e src/modules/ia/service.js:
 * sem provedor real configurado, registra a tentativa como "indisponivel",
 * nunca fabrica um link publicado nem métricas (curtidas/comentários/
 * alcance) que não aconteceram de verdade.
 */
export async function publicarConteudoInstagram({ conteudoId }) {
  const { data, error } = await supabase
    .from('instagram_publicacoes')
    .insert({
      conteudo_id: conteudoId,
      status: 'indisponivel',
      erro_mensagem: 'Nenhuma integração com o Instagram configurada. Configure uma credencial oficial (Meta Business) em Integrações para habilitar a publicação real.',
    })
    .select()
    .single();

  if (error) {
    logger.error('Falha ao registrar publicação no Instagram', error);
    throw error;
  }
  return data;
}

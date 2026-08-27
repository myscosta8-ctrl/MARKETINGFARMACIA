import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

/**
 * Tentativa de ativação de um anúncio aprovado. Sem provedor real (Meta
 * Ads/Google Ads) configurado neste sprint — nunca marca como "ativo" de
 * verdade, sempre registra "indisponivel" com o motivo. Mesmo princípio já
 * usado em src/modules/instagram/service.js e src/modules/whatsapp/service.js.
 */
export async function ativarAnuncio(id) {
  const { data, error } = await supabase
    .from('anuncios')
    .update({
      status: 'indisponivel',
      erro_mensagem: 'Nenhuma integração com plataforma de anúncios configurada. Configure uma credencial oficial (Meta Ads/Google Ads) em Integrações para habilitar a ativação real.',
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Falha ao tentar ativar anúncio', error);
    throw error;
  }
  return data;
}

import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

/**
 * Ponto único de entrada para enviar mensagens de WhatsApp. Nenhum
 * componente React monta a chamada ao provedor diretamente — tudo passa por
 * aqui, mesmo princípio já usado em src/modules/ia/service.js.
 *
 * Sem provedor real configurado neste sprint (nenhuma implementação
 * concreta de AdaptadorIntegracao para whatsapp existe ainda —
 * src/lib/integracoes/AdaptadorIntegracao.js continua sendo só a
 * interface). Toda mensagem é registrada como histórico; sem credencial,
 * fica "indisponivel" — nunca finge um envio que não aconteceu.
 */
export async function enviarMensagemWhatsApp({ telefoneDestino, conteudo, contatoId = null, leadId = null }) {
  const { data, error } = await supabase
    .from('whatsapp_mensagens')
    .insert({
      telefone_destino: telefoneDestino,
      conteudo,
      contato_id: contatoId,
      lead_id: leadId,
      status: 'indisponivel',
      erro_mensagem: 'Nenhuma integração de WhatsApp configurada. Configure uma credencial oficial em Integrações para habilitar o envio real.',
    })
    .select()
    .single();

  if (error) {
    logger.error('Falha ao registrar mensagem de WhatsApp', error);
    throw error;
  }
  return data;
}

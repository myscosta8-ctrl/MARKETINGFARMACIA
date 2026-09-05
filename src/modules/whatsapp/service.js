import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

/**
 * Ponto único de entrada para enviar mensagens de WhatsApp.
 *
 * Fluxo (Fase 2 — integrações reais):
 * 1. Cria a linha em whatsapp_mensagens como 'pendente' (nunca fabrica um
 *    resultado antes de tentar de verdade).
 * 2. Se a integração da farmácia estiver 'conectada', chama a Edge
 *    Function `meta-actions`, que é a ÚNICA parte do sistema que vê o
 *    token de acesso (nunca este arquivo, nunca o navegador).
 * 3. Se não estiver conectada, ou se a Function não responder (ainda não
 *    implantada, por exemplo), marca 'indisponivel' com o motivo real —
 *    nunca finge sucesso.
 */
export async function enviarMensagemWhatsApp({ telefoneDestino, conteudo, contatoId = null, leadId = null }) {
  const { data: integracao } = await supabase
    .from('integracoes')
    .select('status')
    .eq('provedor', 'whatsapp')
    .maybeSingle();

  const conectado = integracao?.status === 'conectado';

  const { data: mensagem, error } = await supabase
    .from('whatsapp_mensagens')
    .insert({
      telefone_destino: telefoneDestino,
      conteudo,
      contato_id: contatoId,
      lead_id: leadId,
      status: conectado ? 'pendente' : 'indisponivel',
      erro_mensagem: conectado ? null : 'Nenhuma integração de WhatsApp conectada. Configure em Integrações para habilitar o envio real.',
    })
    .select()
    .single();

  if (error) {
    logger.error('Falha ao registrar mensagem de WhatsApp', error);
    throw error;
  }

  if (!conectado) return mensagem;

  try {
    const { data: sessao } = await supabase.auth.getSession();
    const { data: resultado, error: erroFuncao } = await supabase.functions.invoke('meta-actions', {
      body: { tipo: 'enviar_whatsapp', mensagemId: mensagem.id },
      headers: { Authorization: `Bearer ${sessao?.session?.access_token}` },
    });
    if (erroFuncao) throw erroFuncao;
    if (!resultado?.enviado) {
      logger.error('Envio de WhatsApp não confirmado pela Meta', resultado);
    }
  } catch (err) {
    // A Edge Function pode não estar implantada ainda — não fingimos que
    // funcionou. Se a própria Function nem rodou (erro de rede/deploy),
    // marcamos aqui para a mensagem não ficar presa em "pendente" pra sempre.
    logger.error('Falha ao chamar meta-actions para WhatsApp', err);
    await supabase
      .from('whatsapp_mensagens')
      .update({ status: 'erro', erro_mensagem: 'Não foi possível comunicar com o serviço de envio.' })
      .eq('id', mensagem.id)
      .eq('status', 'pendente');
  }

  const { data: mensagemAtualizada } = await supabase.from('whatsapp_mensagens').select().eq('id', mensagem.id).single();
  return mensagemAtualizada ?? mensagem;
}

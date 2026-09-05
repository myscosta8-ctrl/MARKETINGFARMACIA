import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

/**
 * Ponto único de entrada para publicar um Conteúdo no Instagram.
 * Mesmo fluxo de src/modules/whatsapp/service.js: cria a linha como
 * 'pendente', chama a Edge Function `meta-actions` se conectado, nunca
 * fabrica publicação/link/métrica.
 */
export async function publicarConteudoInstagram({ conteudoId }) {
  const { data: integracao } = await supabase
    .from('integracoes')
    .select('status')
    .eq('provedor', 'instagram')
    .maybeSingle();

  const conectado = integracao?.status === 'conectado';

  const { data: publicacao, error } = await supabase
    .from('instagram_publicacoes')
    .insert({
      conteudo_id: conteudoId,
      status: conectado ? 'pendente' : 'indisponivel',
      erro_mensagem: conectado ? null : 'Nenhuma integração com o Instagram conectada. Configure em Integrações para habilitar a publicação real.',
    })
    .select()
    .single();

  if (error) {
    logger.error('Falha ao registrar publicação no Instagram', error);
    throw error;
  }

  if (!conectado) return publicacao;

  try {
    const { data: sessao } = await supabase.auth.getSession();
    const { data: resultado, error: erroFuncao } = await supabase.functions.invoke('meta-actions', {
      body: { tipo: 'publicar_instagram', publicacaoId: publicacao.id },
      headers: { Authorization: `Bearer ${sessao?.session?.access_token}` },
    });
    if (erroFuncao) throw erroFuncao;
    if (!resultado?.publicado) {
      logger.error('Publicação no Instagram não confirmada pela Meta', resultado);
    }
  } catch (err) {
    logger.error('Falha ao chamar meta-actions para Instagram', err);
    await supabase
      .from('instagram_publicacoes')
      .update({ status: 'erro', erro_mensagem: 'Não foi possível comunicar com o serviço de publicação.' })
      .eq('id', publicacao.id)
      .eq('status', 'pendente');
  }

  const { data: publicacaoAtualizada } = await supabase.from('instagram_publicacoes').select().eq('id', publicacao.id).single();
  return publicacaoAtualizada ?? publicacao;
}

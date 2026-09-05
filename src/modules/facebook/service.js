import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

/**
 * Ponto único de entrada para publicar um Conteúdo no Facebook.
 * Mesmo padrão de src/modules/instagram/service.js.
 */
export async function publicarConteudoFacebook({ conteudoId }) {
  const { data: integracao } = await supabase
    .from('integracoes')
    .select('status')
    .eq('provedor', 'facebook')
    .maybeSingle();

  const conectado = integracao?.status === 'conectado';

  const { data: publicacao, error } = await supabase
    .from('facebook_publicacoes')
    .insert({
      conteudo_id: conteudoId,
      status: conectado ? 'pendente' : 'indisponivel',
      erro_mensagem: conectado ? null : 'Nenhuma integração com o Facebook conectada. Configure em Integrações para habilitar a publicação real.',
    })
    .select()
    .single();

  if (error) {
    logger.error('Falha ao registrar publicação no Facebook', error);
    throw error;
  }

  if (!conectado) return publicacao;

  try {
    const { data: sessao } = await supabase.auth.getSession();
    const { data: resultado, error: erroFuncao } = await supabase.functions.invoke('meta-actions', {
      body: { tipo: 'publicar_facebook', publicacaoId: publicacao.id },
      headers: { Authorization: `Bearer ${sessao?.session?.access_token}` },
    });
    if (erroFuncao) throw erroFuncao;
    if (!resultado?.publicado) {
      logger.error('Publicação no Facebook não confirmada pela Meta', resultado);
    }
  } catch (err) {
    logger.error('Falha ao chamar meta-actions para Facebook', err);
    await supabase
      .from('facebook_publicacoes')
      .update({ status: 'erro', erro_mensagem: 'Não foi possível comunicar com o serviço de publicação.' })
      .eq('id', publicacao.id)
      .eq('status', 'pendente');
  }

  const { data: publicacaoAtualizada } = await supabase.from('facebook_publicacoes').select().eq('id', publicacao.id).single();
  return publicacaoAtualizada ?? publicacao;
}

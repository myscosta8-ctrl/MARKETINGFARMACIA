import { supabase } from '../../lib/supabase';
import { obterProvedorIA, provedorIAConfigurado } from '../../lib/ia/registro';
import { logger } from '../../utils/logger';
import { instrucaoFinalidade } from './constants';

/**
 * Ponto único de entrada para qualquer funcionalidade de IA na aplicação.
 * Nenhum componente React chama `obterProvedorIA()` diretamente nem monta
 * prompt — tudo passa por aqui. Isso é o que a especificação pede em
 * "arquitetura para provedor externo": camada de serviço desacoplada,
 * sem chamada secreta espalhada pelos componentes.
 *
 * Contrato: sempre grava um registro em ia_solicitacoes (histórico
 * completo, mesmo quando indisponível), nunca fabrica uma resposta.
 */
export async function executarSolicitacaoIA({
  finalidade,
  promptUsuario,
  campanhaId = null,
  produtoId = null,
  conteudoId = null,
  oportunidadeId = null,
}) {
  const instrucao = instrucaoFinalidade(finalidade);
  const contexto = await montarContexto({ campanhaId, produtoId, conteudoId, oportunidadeId });

  // 1) Sem provedor configurado: registra a tentativa como indisponível,
  //    numa única gravação — nunca finge uma resposta.
  if (!provedorIAConfigurado()) {
    const { data, error } = await supabase
      .from('ia_solicitacoes')
      .insert({
        finalidade,
        prompt_usuario: promptUsuario,
        instrucao_sistema: instrucao,
        contexto,
        campanha_id: campanhaId,
        produto_id: produtoId,
        conteudo_id: conteudoId,
        oportunidade_id: oportunidadeId,
        status: 'indisponivel',
        erro_mensagem: 'Nenhum provedor de IA configurado. Configure uma credencial em Integrações para habilitar esta funcionalidade.',
      })
      .select()
      .single();
    if (error) { logger.error('Falha ao registrar solicitação de IA (indisponível)', error); throw error; }
    return data;
  }

  // 2) Provedor configurado: fluxo pendente -> processando -> concluida/erro.
  const { data: solicitacao, error: erroInsert } = await supabase
    .from('ia_solicitacoes')
    .insert({
      finalidade,
      prompt_usuario: promptUsuario,
      instrucao_sistema: instrucao,
      contexto,
      campanha_id: campanhaId,
      produto_id: produtoId,
      conteudo_id: conteudoId,
      oportunidade_id: oportunidadeId,
      status: 'pendente',
    })
    .select()
    .single();
  if (erroInsert) { logger.error('Falha ao criar solicitação de IA', erroInsert); throw erroInsert; }

  await supabase.from('ia_solicitacoes').update({ status: 'processando' }).eq('id', solicitacao.id);

  try {
    const provedor = obterProvedorIA();
    const resposta = await chamarProvedorPorFinalidade(provedor, finalidade, { promptUsuario, contexto, instrucao });
    const { data: atualizada, error: erroUpdate } = await supabase
      .from('ia_solicitacoes')
      .update({ status: 'concluida', resposta })
      .eq('id', solicitacao.id)
      .select()
      .single();
    if (erroUpdate) throw erroUpdate;
    return atualizada;
  } catch (err) {
    logger.error('Falha na execução da solicitação de IA', err);
    const { data: comErro } = await supabase
      .from('ia_solicitacoes')
      .update({ status: 'erro', erro_mensagem: err?.message ?? 'Falha desconhecida ao executar a solicitação.' })
      .eq('id', solicitacao.id)
      .select()
      .single();
    return comErro;
  }
}

function chamarProvedorPorFinalidade(provedor, finalidade, { promptUsuario, contexto, instrucao }) {
  const payload = { instrucao, promptUsuario, contexto };
  switch (finalidade) {
    case 'gerar_campanha':
      return provedor.gerarRascunhoCampanha(payload).then((r) => JSON.stringify(r));
    case 'criar_conteudo':
      return provedor.gerarConteudo(payload);
    case 'analisar_desempenho':
      return provedor.analisarDesempenho(payload).then((r) => JSON.stringify(r));
    default:
      return provedor
        .gerarRecomendacoes(payload)
        .then((r) => r.map((x) => `${x.titulo}: ${x.justificativa}`).join('\n'));
  }
}

// Busca só os campos necessários das entidades de contexto — a RLS de cada
// tabela já impede vazamento cross-tenant mesmo que um id de outra farmácia
// seja informado (a consulta simplesmente não retorna nada nesse caso).
async function montarContexto({ campanhaId, produtoId, conteudoId, oportunidadeId }) {
  const contexto = {};
  if (campanhaId) {
    const { data } = await supabase.from('campanhas').select('titulo, status').eq('id', campanhaId).maybeSingle();
    if (data) contexto.campanha = data;
  }
  if (produtoId) {
    const { data } = await supabase.from('produtos').select('nome, categoria').eq('id', produtoId).maybeSingle();
    if (data) contexto.produto = data;
  }
  if (conteudoId) {
    const { data } = await supabase.from('conteudos').select('titulo, tipo, status').eq('id', conteudoId).maybeSingle();
    if (data) contexto.conteudo = data;
  }
  if (oportunidadeId) {
    const { data } = await supabase.from('oportunidades').select('titulo, categoria, status').eq('id', oportunidadeId).maybeSingle();
    if (data) contexto.oportunidade = data;
  }
  return contexto;
}

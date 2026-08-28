import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

/**
 * Busca os dados brutos mínimos (nunca "select *") de cada módulo, já
 * filtrados por período no próprio banco (.gte/.lt em created_at) — a
 * agregação (contagem por status, agrupamento por canal) acontece aqui no
 * frontend, mas o filtro de intervalo é sempre feito no servidor.
 *
 * O isolamento por farmácia não é responsabilidade deste arquivo — cada
 * tabela consultada já tem sua própria política RLS (farmacia_id +
 * pode_ver do módulo correspondente); este serviço nunca teria como ver
 * dado de outra farmácia mesmo se tentasse, porque a query roda como o
 * próprio usuário autenticado, não com privilégio elevado.
 */
export async function buscarDadosAnalytics({ inicio, fim } = {}) {
  const aplicarPeriodo = (query, coluna = 'created_at') => {
    let q = query;
    if (inicio) q = q.gte(coluna, inicio.toISOString());
    if (fim) q = q.lt(coluna, fim.toISOString());
    return q;
  };

  const [
    campanhas, conteudos, conteudoCanais, oportunidades, leads,
    crmContatos, crmInteracoes, iaSolicitacoes, whatsapp, instagram, facebook, anuncios,
  ] = await Promise.all([
    aplicarPeriodo(supabase.from('campanhas').select('status, created_at')),
    aplicarPeriodo(supabase.from('conteudos').select('created_at')),
    aplicarPeriodo(supabase.from('conteudo_canais').select('canal, created_at')),
    aplicarPeriodo(supabase.from('oportunidades').select('status, created_at')),
    aplicarPeriodo(supabase.from('leads').select('status, created_at')),
    aplicarPeriodo(supabase.from('crm_contatos').select('created_at')),
    aplicarPeriodo(supabase.from('crm_interacoes').select('created_at')),
    aplicarPeriodo(supabase.from('ia_solicitacoes').select('status, created_at')),
    aplicarPeriodo(supabase.from('whatsapp_mensagens').select('created_at')),
    aplicarPeriodo(supabase.from('instagram_publicacoes').select('created_at')),
    aplicarPeriodo(supabase.from('facebook_publicacoes').select('created_at')),
    aplicarPeriodo(supabase.from('anuncios').select('status, created_at')),
  ]);

  const erros = [
    campanhas, conteudos, conteudoCanais, oportunidades, leads,
    crmContatos, crmInteracoes, iaSolicitacoes, whatsapp, instagram, facebook, anuncios,
  ].filter((r) => r.error);
  if (erros.length > 0) {
    erros.forEach((r) => logger.error('Falha ao carregar dados de Analytics', r.error));
    throw erros[0].error;
  }

  return {
    campanhas: campanhas.data ?? [],
    conteudos: conteudos.data ?? [],
    conteudoCanais: conteudoCanais.data ?? [],
    oportunidades: oportunidades.data ?? [],
    leads: leads.data ?? [],
    crmContatos: crmContatos.data ?? [],
    crmInteracoes: crmInteracoes.data ?? [],
    iaSolicitacoes: iaSolicitacoes.data ?? [],
    whatsapp: whatsapp.data ?? [],
    instagram: instagram.data ?? [],
    facebook: facebook.data ?? [],
    anuncios: anuncios.data ?? [],
  };
}

function contarPor(lista, campo) {
  const contagem = {};
  for (const item of lista) contagem[item[campo]] = (contagem[item[campo]] ?? 0) + 1;
  return contagem;
}

/** Deriva os indicadores/agrupamentos a partir dos dados brutos já filtrados por período. */
export function calcularMetricas(dados) {
  const campanhasPorStatus = contarPor(dados.campanhas, 'status');
  const oportunidadesPorStatus = contarPor(dados.oportunidades, 'status');
  const leadsPorStatus = contarPor(dados.leads, 'status');
  const anunciosPorStatus = contarPor(dados.anuncios, 'status');
  const iaPorStatus = contarPor(dados.iaSolicitacoes, 'status');
  const conteudosPorCanal = contarPor(dados.conteudoCanais, 'canal');

  const leadsTotal = dados.leads.length;
  const leadsConvertidos = leadsPorStatus.convertido ?? 0;
  const taxaConversaoLeads = leadsTotal > 0 ? (leadsConvertidos / leadsTotal) * 100 : null;

  return {
    campanhas: {
      total: dados.campanhas.length,
      ativas: (campanhasPorStatus.revisao ?? 0) + (campanhasPorStatus.aprovada ?? 0) + (campanhasPorStatus.publicada ?? 0),
      concluidas: campanhasPorStatus.publicada ?? 0,
      porStatus: campanhasPorStatus,
    },
    conteudos: {
      total: dados.conteudos.length,
      porCanal: conteudosPorCanal,
    },
    oportunidades: {
      total: dados.oportunidades.length,
      porStatus: oportunidadesPorStatus,
    },
    leads: {
      total: leadsTotal,
      convertidos: leadsConvertidos,
      taxaConversao: taxaConversaoLeads,
      porStatus: leadsPorStatus,
    },
    crm: {
      contatos: dados.crmContatos.length,
      interacoes: dados.crmInteracoes.length,
    },
    ia: {
      total: dados.iaSolicitacoes.length,
      concluidas: iaPorStatus.concluida ?? 0,
      porStatus: iaPorStatus,
    },
    whatsapp: { total: dados.whatsapp.length },
    instagram: { total: dados.instagram.length },
    facebook: { total: dados.facebook.length },
    anuncios: {
      total: dados.anuncios.length,
      aprovados: anunciosPorStatus.aprovado ?? 0,
      emExecucao: (anunciosPorStatus.ativo ?? 0) + (anunciosPorStatus.pausado ?? 0),
      concluidos: anunciosPorStatus.encerrado ?? 0,
      porStatus: anunciosPorStatus,
    },
  };
}

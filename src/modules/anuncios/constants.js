export const PLATAFORMAS = [
  { value: 'meta_ads', label: 'Meta Ads (Instagram/Facebook)' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'outro', label: 'Outra plataforma' },
];

export const STATUS = [
  { value: 'rascunho', label: 'Rascunho', cor: 'text-ink-500 bg-ink-500/10' },
  { value: 'revisao', label: 'Em revisão', cor: 'text-amber-400 bg-amber-400/10' },
  { value: 'aprovado', label: 'Aprovado', cor: 'text-mint-400 bg-mint-400/10' },
  { value: 'ativo', label: 'Ativo', cor: 'text-mint-500 bg-mint-500/20' },
  { value: 'pausado', label: 'Pausado', cor: 'text-amber-400 bg-amber-400/10' },
  { value: 'encerrado', label: 'Encerrado', cor: 'text-ink-500 bg-ink-500/10 line-through' },
  { value: 'erro', label: 'Erro', cor: 'text-red-400 bg-red-400/10' },
  { value: 'indisponivel', label: 'Indisponível', cor: 'text-ink-500 bg-ink-500/10' },
];

export const TRANSICOES_VALIDAS = {
  rascunho: ['revisao'],
  revisao: ['rascunho', 'aprovado'],
  aprovado: ['ativo', 'indisponivel', 'erro'],
  ativo: ['pausado', 'encerrado'],
  pausado: ['ativo', 'encerrado'],
};

const TRANSICOES_QUE_EXIGEM_APROVACAO = new Set(['revisao->aprovado']);
export function exigeAprovacao(de, para) { return TRANSICOES_QUE_EXIGEM_APROVACAO.has(`${de}->${para}`); }

const ACAO_POR_TRANSICAO = {
  'rascunho->revisao': 'Enviar para revisão',
  'revisao->rascunho': 'Voltar para rascunho',
  'revisao->aprovado': 'Aprovar',
  'aprovado->ativo': 'Ativar',
  'aprovado->indisponivel': 'Ativar',
  'aprovado->erro': 'Marcar erro',
  'ativo->pausado': 'Pausar',
  'ativo->encerrado': 'Encerrar',
  'pausado->ativo': 'Retomar',
  'pausado->encerrado': 'Encerrar',
};
export function labelAcao(de, para) { return ACAO_POR_TRANSICAO[`${de}->${para}`] ?? para; }

export function labelPlataforma(v) { return PLATAFORMAS.find((p) => p.value === v)?.label ?? v; }
export function labelStatus(v) { return STATUS.find((s) => s.value === v)?.label ?? v; }
export function corStatus(v) { return STATUS.find((s) => s.value === v)?.cor ?? 'text-ink-500 bg-ink-500/10'; }

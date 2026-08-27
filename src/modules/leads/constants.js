export const ORIGENS = [
  { value: 'manual', label: 'Cadastro manual' },
  { value: 'oportunidade', label: 'Oportunidade' },
  { value: 'conteudo', label: 'Conteúdo' },
  { value: 'campanha', label: 'Campanha' },
  { value: 'ia', label: 'IA' },
  { value: 'outro', label: 'Outro' },
];

export const STATUS = [
  { value: 'novo', label: 'Novo', cor: 'text-ink-500 bg-ink-500/10' },
  { value: 'em_atendimento', label: 'Em atendimento', cor: 'text-amber-400 bg-amber-400/10' },
  { value: 'qualificado', label: 'Qualificado', cor: 'text-mint-400 bg-mint-400/10' },
  { value: 'convertido', label: 'Convertido', cor: 'text-mint-500 bg-mint-500/20' },
  { value: 'perdido', label: 'Perdido', cor: 'text-ink-500 bg-ink-500/10 line-through' },
];

// Espelha o trigger do banco (migration 016) só para a UI decidir botões.
export const TRANSICOES_VALIDAS = {
  novo: ['em_atendimento', 'perdido'],
  em_atendimento: ['qualificado', 'perdido'],
  qualificado: ['perdido'], // "convertido" é tratado como ação própria (exige criar o contato CRM antes)
};

const ACAO_POR_TRANSICAO = {
  'novo->em_atendimento': 'Iniciar atendimento',
  'novo->perdido': 'Marcar como perdido',
  'em_atendimento->qualificado': 'Qualificar',
  'em_atendimento->perdido': 'Marcar como perdido',
  'qualificado->perdido': 'Marcar como perdido',
};
export function labelAcao(de, para) { return ACAO_POR_TRANSICAO[`${de}->${para}`] ?? para; }

export const TIPOS_INTERACAO = [
  { value: 'anotacao', label: 'Anotação' },
  { value: 'contato_realizado', label: 'Contato realizado' },
  { value: 'retorno', label: 'Retorno' },
  { value: 'acompanhamento', label: 'Acompanhamento' },
];

export function labelOrigem(v) { return ORIGENS.find((o) => o.value === v)?.label ?? v; }
export function labelStatus(v) { return STATUS.find((s) => s.value === v)?.label ?? v; }
export function corStatus(v) { return STATUS.find((s) => s.value === v)?.cor ?? 'text-ink-500 bg-ink-500/10'; }
export function labelTipoInteracao(v) { return TIPOS_INTERACAO.find((t) => t.value === v)?.label ?? v; }

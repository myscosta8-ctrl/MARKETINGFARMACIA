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
  { value: 'cliente', label: 'Cliente', cor: 'text-mint-400 bg-mint-400/10' },
  { value: 'inativo', label: 'Inativo', cor: 'text-ink-500 bg-ink-500/10 line-through' },
];

export const TRANSICOES_VALIDAS = {
  novo: ['em_atendimento', 'inativo'],
  em_atendimento: ['cliente', 'inativo'],
  cliente: ['inativo'],
  inativo: ['em_atendimento'],
};

const ACAO_POR_TRANSICAO = {
  'novo->em_atendimento': 'Iniciar atendimento',
  'novo->inativo': 'Marcar como inativo',
  'em_atendimento->cliente': 'Marcar como cliente',
  'em_atendimento->inativo': 'Marcar como inativo',
  'cliente->inativo': 'Marcar como inativo',
  'inativo->em_atendimento': 'Reativar',
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

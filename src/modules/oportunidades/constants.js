export const CATEGORIAS = [
  { value: 'produto_potencial', label: 'Produto com potencial de venda' },
  { value: 'tendencia_consumo', label: 'Tendência de consumo' },
  { value: 'rede_social', label: 'Identificada em redes sociais' },
  { value: 'pesquisa_mercado', label: 'Pesquisa de mercado' },
  { value: 'sazonalidade', label: 'Sazonalidade' },
  { value: 'concorrencia', label: 'Concorrência' },
  { value: 'campanha', label: 'Oportunidade de campanha' },
  { value: 'novo_produto', label: 'Novo produto' },
  { value: 'parceria', label: 'Parceria' },
  { value: 'outra', label: 'Outra' },
];

export const PRIORIDADES = [
  { value: 'baixa', label: 'Baixa', cor: 'text-ink-500 bg-ink-500/10' },
  { value: 'media', label: 'Média', cor: 'text-amber-400 bg-amber-400/10' },
  { value: 'alta', label: 'Alta', cor: 'text-amber-400 bg-amber-400/20' },
  { value: 'urgente', label: 'Urgente', cor: 'text-red-400 bg-red-400/10' },
];

export const STATUS = [
  { value: 'identificada', label: 'Identificada', cor: 'text-ink-300 bg-ink-500/10' },
  { value: 'em_analise', label: 'Em análise', cor: 'text-amber-400 bg-amber-400/10' },
  { value: 'validada', label: 'Validada', cor: 'text-mint-400 bg-mint-400/10' },
  { value: 'em_execucao', label: 'Em execução', cor: 'text-mint-400 bg-mint-400/10' },
  { value: 'concluida', label: 'Concluída', cor: 'text-mint-500 bg-mint-500/20' },
  { value: 'descartada', label: 'Descartada', cor: 'text-ink-500 bg-ink-500/10 line-through' },
];

// Espelha o trigger do banco (migration 013) só para a UI decidir botões.
export const TRANSICOES_VALIDAS = {
  identificada: ['em_analise', 'descartada'],
  em_analise: ['validada', 'descartada'],
  validada: ['em_execucao', 'descartada'],
  em_execucao: ['concluida', 'descartada'],
};

const ACAO_POR_TRANSICAO = {
  'identificada->em_analise': 'Iniciar análise',
  'identificada->descartada': 'Descartar',
  'em_analise->validada': 'Validar',
  'em_analise->descartada': 'Descartar',
  'validada->em_execucao': 'Iniciar execução',
  'validada->descartada': 'Descartar',
  'em_execucao->concluida': 'Concluir',
  'em_execucao->descartada': 'Descartar',
};
export function labelAcao(de, para) {
  return ACAO_POR_TRANSICAO[`${de}->${para}`] ?? para;
}

export function labelCategoria(v) { return CATEGORIAS.find((c) => c.value === v)?.label ?? v; }
export function labelPrioridade(v) { return PRIORIDADES.find((p) => p.value === v)?.label ?? v; }
export function corPrioridade(v) { return PRIORIDADES.find((p) => p.value === v)?.cor ?? 'text-ink-500 bg-ink-500/10'; }
export function labelStatus(v) { return STATUS.find((s) => s.value === v)?.label ?? v; }
export function corStatus(v) { return STATUS.find((s) => s.value === v)?.cor ?? 'text-ink-500 bg-ink-500/10'; }

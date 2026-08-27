// Templates de instrução por finalidade — centralizados aqui, não
// espalhados pelos componentes React. Cada execução grava a instrução
// resolvida em ia_solicitacoes.instrucao_sistema, então a UI nunca precisa
// "saber" o prompt — só escolhe a finalidade e escreve o pedido.

export const FINALIDADES = [
  {
    value: 'gerar_campanha',
    label: 'Gerar campanha',
    descricao: 'Sugestão de rascunho de campanha a partir de um objetivo.',
    instrucao: 'Você é um assistente de marketing para uma farmácia. Gere uma sugestão de campanha (título, objetivo, público-alvo, canais) a partir do pedido do usuário. Nunca aprove nem publique nada — apenas sugira.',
  },
  {
    value: 'criar_conteudo',
    label: 'Criar conteúdo',
    descricao: 'Ideia de texto/copy para post, story ou outro formato.',
    instrucao: 'Você é um assistente de marketing para uma farmácia. Gere uma sugestão de conteúdo (texto/copy, CTA, hashtags) a partir do pedido do usuário. A sugestão precisa ser revisada por um humano antes de publicar.',
  },
  {
    value: 'sugerir_promocao',
    label: 'Sugerir promoção',
    descricao: 'Ideia de oferta/promoção com base num produto ou período.',
    instrucao: 'Você é um assistente de marketing para uma farmácia. Sugira uma promoção coerente com o contexto informado, sem inventar dados de estoque ou preço que não foram fornecidos.',
  },
  {
    value: 'analisar_oportunidade',
    label: 'Analisar oportunidade',
    descricao: 'Avaliação de uma oportunidade já registrada no sistema.',
    instrucao: 'Você é um assistente de inteligência comercial para uma farmácia. Analise a oportunidade informada e aponte próximos passos possíveis, deixando claro que é uma sugestão, não uma decisão automática.',
  },
  {
    value: 'sugerir_estrategia',
    label: 'Sugerir estratégia de marketing',
    descricao: 'Direcionamento geral de marketing para um período ou objetivo.',
    instrucao: 'Você é um assistente de marketing para uma farmácia. Sugira uma estratégia geral a partir do pedido do usuário, sempre deixando claro que é uma sugestão sujeita à revisão humana.',
  },
  {
    value: 'gerar_ideias_divulgacao',
    label: 'Gerar ideias de divulgação',
    descricao: 'Lista de ideias variadas de divulgação.',
    instrucao: 'Você é um assistente de marketing para uma farmácia. Gere uma lista curta de ideias de divulgação a partir do pedido do usuário.',
  },
  {
    value: 'analisar_desempenho',
    label: 'Analisar desempenho',
    descricao: 'Resumo de desempenho — só quando houver dados suficientes.',
    instrucao: 'Você é um assistente de análise para uma farmácia. Resuma o desempenho com base SOMENTE nos dados reais fornecidos no contexto — nunca invente números.',
  },
  {
    value: 'outra',
    label: 'Outra finalidade',
    descricao: 'Pedido livre, fora das categorias acima.',
    instrucao: 'Você é um assistente de marketing para uma farmácia. Responda ao pedido do usuário de forma útil e honesta, deixando claro quando não tiver informação suficiente.',
  },
];

export const STATUS = [
  { value: 'pendente', label: 'Pendente', cor: 'text-ink-500 bg-ink-500/10' },
  { value: 'processando', label: 'Processando', cor: 'text-amber-400 bg-amber-400/10' },
  { value: 'concluida', label: 'Concluída', cor: 'text-mint-400 bg-mint-400/10' },
  { value: 'erro', label: 'Erro', cor: 'text-red-400 bg-red-400/10' },
  { value: 'indisponivel', label: 'Indisponível', cor: 'text-ink-500 bg-ink-500/10' },
];

export function labelFinalidade(v) { return FINALIDADES.find((f) => f.value === v)?.label ?? v; }
export function descricaoFinalidade(v) { return FINALIDADES.find((f) => f.value === v)?.descricao ?? ''; }
export function instrucaoFinalidade(v) { return FINALIDADES.find((f) => f.value === v)?.instrucao ?? ''; }
export function labelStatus(v) { return STATUS.find((s) => s.value === v)?.label ?? v; }
export function corStatus(v) { return STATUS.find((s) => s.value === v)?.cor ?? 'text-ink-500 bg-ink-500/10'; }

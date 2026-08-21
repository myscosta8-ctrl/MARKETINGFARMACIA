// Espelha os enums do banco (migration 005). Mudar aqui não muda o banco —
// se precisar adicionar uma opção, criar nova migration alterando o enum
// e então atualizar esta lista.

export const OBJETIVOS = [
  { value: 'aumentar_vendas', label: 'Aumentar vendas' },
  { value: 'divulgar_produto', label: 'Divulgar produto' },
  { value: 'liquidar_estoque_parado', label: 'Liquidar estoque parado' },
  { value: 'lancamento', label: 'Lançamento' },
  { value: 'fidelizacao', label: 'Fidelização' },
  { value: 'aquisicao_clientes', label: 'Aquisição de novos clientes' },
  { value: 'presenca_digital', label: 'Aumentar presença digital' },
  { value: 'sazonal', label: 'Campanha sazonal' },
  { value: 'servico_farmacia', label: 'Serviço da farmácia' },
  { value: 'sorteio', label: 'Sorteio' },
  { value: 'institucional', label: 'Campanha institucional' },
];

export const PUBLICOS_ALVO = [
  { value: 'geral', label: 'Público geral' },
  { value: 'clientes_atuais', label: 'Clientes atuais' },
  { value: 'novos_clientes', label: 'Novos clientes' },
  { value: 'clientes_inativos', label: 'Clientes inativos' },
  { value: 'interesse', label: 'Público por interesse' },
  { value: 'local', label: 'Público local' },
  { value: 'manual', label: 'Definido manualmente' },
  { value: 'sugerido_ia', label: 'Sugerido pela IA (futuramente)' },
];

// Slugs livres — nenhuma integração real neste sprint, só seleção/arquitetura.
export const CANAIS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'anuncios', label: 'Anúncios pagos' },
  { value: 'outro', label: 'Outro canal digital' },
];

export const STATUS_CAMPANHA = [
  { value: 'rascunho', label: 'Rascunho', cor: 'text-ink-500 bg-ink-500/10' },
  { value: 'revisao', label: 'Em revisão', cor: 'text-amber-400 bg-amber-400/10' },
  { value: 'aprovada', label: 'Aprovada', cor: 'text-mint-400 bg-mint-400/10' },
  { value: 'publicada', label: 'Publicada', cor: 'text-mint-500 bg-mint-500/20' },
  { value: 'pausada', label: 'Pausada', cor: 'text-amber-400 bg-amber-400/10' },
  { value: 'encerrada', label: 'Encerrada', cor: 'text-ink-500 bg-ink-500/10' },
];

// Máquina de estados — espelha o trigger do banco (migration 004) só para a
// UI decidir quais botões mostrar. A validação de verdade é sempre no banco.
export const TRANSICOES_VALIDAS = {
  rascunho: ['revisao'],
  revisao: ['rascunho', 'aprovada'],
  aprovada: ['publicada'],
  publicada: ['pausada', 'encerrada'],
  pausada: ['publicada', 'encerrada'],
};

export function labelStatus(status) {
  return STATUS_CAMPANHA.find((s) => s.value === status)?.label ?? status;
}

export function corStatus(status) {
  return STATUS_CAMPANHA.find((s) => s.value === status)?.cor ?? 'text-ink-500 bg-ink-500/10';
}

export function labelObjetivo(value) {
  return OBJETIVOS.find((o) => o.value === value)?.label ?? value;
}

export function labelPublico(value) {
  return PUBLICOS_ALVO.find((p) => p.value === value)?.label ?? value;
}

export function labelCanal(value) {
  return CANAIS.find((c) => c.value === value)?.label ?? value;
}

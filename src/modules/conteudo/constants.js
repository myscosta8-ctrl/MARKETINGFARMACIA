export const TIPOS_CONTEUDO = [
  { value: 'post', label: 'Post' },
  { value: 'story', label: 'Story' },
  { value: 'reels', label: 'Reels' },
  { value: 'video', label: 'Vídeo' },
  { value: 'carrossel', label: 'Carrossel' },
  { value: 'arte', label: 'Arte' },
  { value: 'texto', label: 'Texto' },
  { value: 'oferta_promocao', label: 'Oferta/Promoção' },
];

export const CANAIS_CONTEUDO = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'google_perfil', label: 'Google/Perfil da Empresa' },
  { value: 'outro', label: 'Outro canal' },
];

export const STATUS_CONTEUDO = [
  { value: 'rascunho', label: 'Rascunho', cor: 'text-ink-500 bg-ink-500/10' },
  { value: 'revisao', label: 'Em revisão', cor: 'text-amber-400 bg-amber-400/10' },
  { value: 'aprovado', label: 'Aprovado', cor: 'text-mint-400 bg-mint-400/10' },
  { value: 'agendado', label: 'Agendado', cor: 'text-mint-400 bg-mint-400/10' },
  { value: 'publicado', label: 'Publicado', cor: 'text-mint-500 bg-mint-500/20' },
  { value: 'pausado', label: 'Pausado', cor: 'text-amber-400 bg-amber-400/10' },
  { value: 'cancelado', label: 'Cancelado', cor: 'text-ink-500 bg-ink-500/10 line-through' },
];

// Espelha o trigger do banco (migration 011) só para a UI decidir os
// botões — a validação de verdade é sempre no banco.
export const TRANSICOES_VALIDAS = {
  rascunho: ['revisao'],
  revisao: ['rascunho', 'aprovado'],
  aprovado: ['agendado', 'cancelado'],
  agendado: ['publicado', 'pausado', 'cancelado'],
  publicado: ['pausado', 'cancelado'],
  pausado: ['agendado', 'publicado', 'cancelado'],
};

const TRANSICOES_QUE_EXIGEM_APROVACAO = new Set(['revisao->aprovado']);
export function exigeAprovacao(deStatus, paraStatus) {
  return TRANSICOES_QUE_EXIGEM_APROVACAO.has(`${deStatus}->${paraStatus}`);
}

export function labelTipo(v) {
  return TIPOS_CONTEUDO.find((t) => t.value === v)?.label ?? v;
}
export function labelStatus(v) {
  return STATUS_CONTEUDO.find((s) => s.value === v)?.label ?? v;
}
export function corStatus(v) {
  return STATUS_CONTEUDO.find((s) => s.value === v)?.cor ?? 'text-ink-500 bg-ink-500/10';
}
export function labelCanal(v) {
  return CANAIS_CONTEUDO.find((c) => c.value === v)?.label ?? v;
}

export const STATUS = [
  { value: 'pendente', label: 'Pendente', cor: 'text-ink-500 bg-ink-500/10' },
  { value: 'publicada', label: 'Publicada', cor: 'text-mint-500 bg-mint-500/20' },
  { value: 'erro', label: 'Erro', cor: 'text-red-400 bg-red-400/10' },
  { value: 'indisponivel', label: 'Indisponível', cor: 'text-ink-500 bg-ink-500/10' },
];

export function labelStatus(v) { return STATUS.find((s) => s.value === v)?.label ?? v; }
export function corStatus(v) { return STATUS.find((s) => s.value === v)?.cor ?? 'text-ink-500 bg-ink-500/10'; }

export const STATUS_INTEGRACAO_LABEL = {
  nao_configurado: 'Não configurado',
  configurado: 'Configurado (sem teste de conexão ainda)',
  conectado: 'Conectado',
  erro: 'Erro',
  desconectado: 'Desconectado',
};

export const TIPOS_EVENTO = [
  { value: 'data_comemorativa', label: 'Data comemorativa' },
  { value: 'acao_local', label: 'Ação local' },
  { value: 'evento_sazonal', label: 'Evento sazonal' },
  { value: 'lembrete', label: 'Lembrete' },
  { value: 'periodo_promocional', label: 'Período promocional' },
  { value: 'outro', label: 'Outro' },
];

export const STATUS_EVENTO = [
  { value: 'planejado', label: 'Planejado', cor: 'text-ink-300 bg-ink-500/10' },
  { value: 'em_andamento', label: 'Em andamento', cor: 'text-amber-400 bg-amber-400/10' },
  { value: 'concluido', label: 'Concluído', cor: 'text-mint-400 bg-mint-400/10' },
  { value: 'cancelado', label: 'Cancelado', cor: 'text-ink-500 bg-ink-500/10 line-through' },
];

export function labelTipoEvento(v) {
  return TIPOS_EVENTO.find((t) => t.value === v)?.label ?? v;
}
export function labelStatusEvento(v) {
  return STATUS_EVENTO.find((s) => s.value === v)?.label ?? v;
}
export function corStatusEvento(v) {
  return STATUS_EVENTO.find((s) => s.value === v)?.cor ?? 'text-ink-500 bg-ink-500/10';
}

export function formatarDataISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function inicioDoMes(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function inicioDaSemana(date) {
  const d = new Date(date);
  const diaSemana = d.getDay(); // 0 = domingo
  d.setDate(d.getDate() - diaSemana);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Grade do mês: sempre múltiplos de 7 dias, começando no domingo da semana
// que contém o dia 1 e terminando no sábado da semana que contém o último dia.
export function gradeMes(date) {
  const primeiroDia = inicioDoMes(date);
  const ultimoDia = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const inicio = inicioDaSemana(primeiroDia);
  const fim = new Date(ultimoDia);
  fim.setDate(fim.getDate() + (6 - ultimoDia.getDay()));

  const dias = [];
  const cursor = new Date(inicio);
  while (cursor <= fim) {
    dias.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

export function diasDaSemana(date) {
  const inicio = inicioDaSemana(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    return d;
  });
}

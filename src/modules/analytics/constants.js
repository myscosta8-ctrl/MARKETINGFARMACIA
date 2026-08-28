// Períodos disponíveis para o filtro. 'todos' é o default — mostrar zero
// não deve significar "não configurei o filtro direito", e sim "não há
// dado mesmo".
export const PERIODOS = [
  { value: 'todos', label: 'Todo o período' },
  { value: 'hoje', label: 'Hoje' },
  { value: '7dias', label: 'Últimos 7 dias' },
  { value: '30dias', label: 'Últimos 30 dias' },
  { value: 'mes_atual', label: 'Mês atual' },
  { value: 'mes_anterior', label: 'Mês anterior' },
];

// Retorna { inicio, fim } (Date) para o período escolhido, ou null se for
// "todos" (sem filtro de data).
export function limitesPeriodo(periodo) {
  const agora = new Date();
  const inicioDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const fimDoDiaSeguinte = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

  switch (periodo) {
    case 'hoje':
      return { inicio: inicioDia(agora), fim: fimDoDiaSeguinte(agora) };
    case '7dias': {
      const inicio = new Date(agora); inicio.setDate(inicio.getDate() - 6);
      return { inicio: inicioDia(inicio), fim: fimDoDiaSeguinte(agora) };
    }
    case '30dias': {
      const inicio = new Date(agora); inicio.setDate(inicio.getDate() - 29);
      return { inicio: inicioDia(inicio), fim: fimDoDiaSeguinte(agora) };
    }
    case 'mes_atual': {
      const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
      return { inicio, fim: fimDoDiaSeguinte(agora) };
    }
    case 'mes_anterior': {
      const inicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
      const fim = new Date(agora.getFullYear(), agora.getMonth(), 1);
      return { inicio, fim };
    }
    default:
      return null; // 'todos'
  }
}

// Período imediatamente anterior, de mesma duração, para comparação.
// Retorna null quando o período base é 'todos' (não há "anterior" a tudo).
export function limitesPeriodoAnterior(periodo) {
  const atual = limitesPeriodo(periodo);
  if (!atual) return null;
  const duracaoMs = atual.fim.getTime() - atual.inicio.getTime();
  return { inicio: new Date(atual.inicio.getTime() - duracaoMs), fim: new Date(atual.inicio.getTime()) };
}

export function formatarVariacao(atual, anterior) {
  if (anterior === 0) {
    if (atual === 0) return null; // sem dado em nenhum dos dois períodos
    return { texto: 'novo neste período', positiva: true };
  }
  const variacao = ((atual - anterior) / anterior) * 100;
  const arredondada = Math.round(variacao * 10) / 10;
  return { texto: `${arredondada > 0 ? '+' : ''}${arredondada}%`, positiva: arredondada >= 0 };
}

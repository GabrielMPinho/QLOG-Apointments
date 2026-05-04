import { parseApiDate } from '../../utils/dates';

export function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const date = parseApiDate(value);
  if (!date) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = parseApiDate(value);
  if (!date) return value;

  return new Intl.DateTimeFormat('pt-BR').format(date);
}

export function formatMinutes(value?: number | null) {
  if (value === null || value === undefined) return '-';

  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  if (hours === 0) return `${minutes} min`;

  return `${hours}h ${minutes}m`;
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    AVAILABLE: 'Nao iniciado',
    DOING: 'Ativo',
    DONE: 'Finalizado',
    CANCELLED: 'Cancelado',
    BLOCKED: 'Bloqueado',
  };

  return labels[status] || status;
}

export function statusClass(status: string) {
  const classes: Record<string, string> = {
    AVAILABLE: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    DOING: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
    DONE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
    CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200',
    BLOCKED: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100',
  };

  return classes[status] || classes.AVAILABLE;
}

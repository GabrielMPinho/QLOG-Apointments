export function parseApiDate(value?: string | Date | null) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const dateOnlyMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const localDateTimeMatch = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (localDateTimeMatch) {
    const [, year, month, day, hour, minute, second = '0'] = localDateTimeMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
  }

  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseRequiredApiDate(value: string | Date) {
  return parseApiDate(value) || new Date(value);
}

export function formatElapsedMinutes(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-';

  const minutes = Math.max(0, Math.floor(Number(value)));
  if (minutes < 1) return 'menos de 1 min';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) return `${hours}h`;

  return `${hours}h ${remainingMinutes}min`;
}

export function normalizeElapsedMinutes(value?: number | null) {
  if (value === null || value === undefined) return null;

  const minutes = Number(value);
  return Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : null;
}

export function elapsedMinutesSinceApiLocal(value?: string | Date | null, now = new Date()) {
  if (!value) return null;
  if (value instanceof Date) return normalizeElapsedMinutes((now.getTime() - value.getTime()) / 60_000);

  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
  );

  if (!match) return null;

  const [, year, month, day, hour, minute, second = '0'] = match;
  const startAsSaoPauloLocal = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) + 3,
    Number(minute),
    Number(second)
  );
  const elapsed = Math.floor((now.getTime() - startAsSaoPauloLocal) / 60_000);

  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
}

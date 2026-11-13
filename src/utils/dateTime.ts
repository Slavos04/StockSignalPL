/**
 * Wspólne narzędzia czasu strefy warszawskiej (Europe/Warsaw)
 * Gwarantuje jednolity format DD.MM.YYYY, HH:MM:SS na serwerze (Node.js) i w przeglądarce.
 */

export const WARSAW_TIMEZONE = 'Europe/Warsaw';

function getWarsawParts(date: Date = new Date()): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
} {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: WARSAW_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = p.value;
    }
  }
  const hour = map.hour === '24' ? '00' : (map.hour || '00');
  return {
    year: map.year || '2026',
    month: map.month || '01',
    day: map.day || '01',
    hour,
    minute: map.minute || '00',
    second: map.second || '00'
  };
}

/**
 * Zwraca dokładną datę i godzinę w Warszawie: "DD.MM.YYYY, HH:MM:SS"
 */
export function formatWarsawDateTime(date: Date = new Date()): string {
  const p = getWarsawParts(date);
  return `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute}:${p.second}`;
}

/**
 * Zwraca datę w Warszawie: "DD.MM.YYYY"
 */
export function formatWarsawDate(date: Date = new Date()): string {
  const p = getWarsawParts(date);
  return `${p.day}.${p.month}.${p.year}`;
}

/**
 * Zwraca datę ISO w Warszawie: "YYYY-MM-DD"
 */
export function formatWarsawIsoDate(date: Date = new Date()): string {
  const p = getWarsawParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Zwraca dokładny czas w Warszawie: "HH:MM:SS"
 */
export function formatWarsawTime(date: Date = new Date()): string {
  const p = getWarsawParts(date);
  return `${p.hour}:${p.minute}:${p.second}`;
}

/**
 * Parsuje polski format daty ("DD.MM.YYYY, HH:MM(:SS)") lub ISO na timestamp (ms) do poprawnego sortowania chronologicznego.
 */
export function parsePolishDateTimeToMs(dateStr?: string): number {
  if (!dateStr) return 0;
  const s = dateStr.trim();

  // Match "DD.MM.YYYY, HH:MM(:SS)" or "D.MM.YYYY HH:MM"
  const plMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (plMatch) {
    const day = parseInt(plMatch[1], 10);
    const month = parseInt(plMatch[2], 10) - 1;
    const year = parseInt(plMatch[3], 10);
    const hour = plMatch[4] ? parseInt(plMatch[4], 10) : 0;
    const minute = plMatch[5] ? parseInt(plMatch[5], 10) : 0;
    const second = plMatch[6] ? parseInt(plMatch[6], 10) : 0;
    return Date.UTC(year, month, day, hour, minute, second);
  }

  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? 0 : parsed;
}

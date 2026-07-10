import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { vi, th, ru } from 'date-fns/locale';
import i18n from 'i18next';

const dateFnsLocales = { vi, th, ru } as const;

export function dateFnsLocale() {
  return dateFnsLocales[i18n.language as keyof typeof dateFnsLocales];
}

/** Epoch ms of the Monday 00:00:00 local time that contains the given timestamp. */
export function weekStartOf(epochMs: number): number {
  const d = new Date(epochMs);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun, 1 = Mon … 6 = Sat
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d.getTime();
}

export function formatTimestamp(epochMs: number): string {
  const date = new Date(epochMs);
  if (isToday(date)) {
    return i18n.t('dates.today', { time: format(date, 'h:mm a', { locale: dateFnsLocale() }) });
  }
  if (isYesterday(date)) {
    return i18n.t('dates.yesterday', { time: format(date, 'h:mm a', { locale: dateFnsLocale() }) });
  }
  return format(date, 'MMM d, yyyy', { locale: dateFnsLocale() });
}

export function formatRelative(epochMs: number): string {
  return formatDistanceToNow(new Date(epochMs), { addSuffix: true, locale: dateFnsLocale() });
}

export function nowMs(): number {
  return Date.now();
}

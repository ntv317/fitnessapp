import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

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
  if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
  if (isYesterday(date)) return `Yesterday, ${format(date, 'h:mm a')}`;
  return format(date, 'MMM d, yyyy');
}

export function formatRelative(epochMs: number): string {
  return formatDistanceToNow(new Date(epochMs), { addSuffix: true });
}

export function nowMs(): number {
  return Date.now();
}

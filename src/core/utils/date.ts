import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

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

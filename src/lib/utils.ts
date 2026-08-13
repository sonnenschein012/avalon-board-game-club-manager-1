import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(ts: { toDate?: () => Date } | number | string | Date | null | undefined) {
  if (!ts) return '';
  if (typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function') {
    return ts.toDate().toLocaleDateString();
  }
  return new Date(ts as string | number | Date).toLocaleDateString();
}

export function formatDateTime(ts: { toDate?: () => Date } | number | string | Date | null | undefined) {
  if (!ts) return '';
  const date = typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function'
    ? ts.toDate()
    : new Date(ts as string | number | Date);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

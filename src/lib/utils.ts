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

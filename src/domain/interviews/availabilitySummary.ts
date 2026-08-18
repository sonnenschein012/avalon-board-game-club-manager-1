import { parseSlotId } from './scheduling';

export interface AvailabilitySummaryRow {
  dateKey: string;
  dateLabel: string;
  ranges: string[];
}

function timeToMinutes(time: string): number {
  const [hour = '0', minute = '0'] = time.split(':');
  return Number(hour) * 60 + Number(minute);
}

function minutesToTime(totalMinutes: number): string {
  const normalized = totalMinutes % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

export function summarizeAvailabilitySlots(
  slots: Iterable<string>,
  slotMinutes: number,
): AvailabilitySummaryRow[] {
  const byDate = new Map<string, number[]>();
  [...slots].sort().forEach(slotId => {
    const parsed = parseSlotId(slotId);
    if (!parsed) return;
    const times = byDate.get(parsed.date) ?? [];
    times.push(timeToMinutes(parsed.time));
    byDate.set(parsed.date, times);
  });

  return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([dateKey, times]) => {
    const merged = [...new Set(times)].sort((left, right) => left - right).reduce<Array<{ start: number; end: number }>>((ranges, start) => {
      const previous = ranges.at(-1);
      if (previous?.end === start) previous.end = start + slotMinutes;
      else ranges.push({ start, end: start + slotMinutes });
      return ranges;
    }, []);
    return {
      dateKey,
      dateLabel: new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(`${dateKey}T00:00:00`)),
      ranges: merged.map(range => `${minutesToTime(range.start)}~${minutesToTime(range.end)}`),
    };
  });
}

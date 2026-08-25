import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { parseSlotId } from '../domain/interviews/scheduling';

interface SlotRange {
  startSlotId: string;
  endSlotId: string;
  slotIds: string[];
}

interface DateSlots {
  date: string;
  slotIds: string[];
}

interface Props {
  slots: string[];
  selected: ReadonlySet<string>;
  slotMinutes: number;
  disabled?: boolean;
  onChange: (slotIds: string[]) => void;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T00:00:00`));
}

function formatTime(slotId: string, slotMinutes = 0) {
  const parsed = parseSlotId(slotId);
  if (!parsed) return slotId;
  if (!slotMinutes) return parsed.time;
  const [hourText, minuteText] = parsed.time.split(':');
  const end = ((Number(hourText) * 60) + Number(minuteText) + slotMinutes) % (24 * 60);
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

function toDateSlots(slots: string[]): DateSlots[] {
  const grouped = new Map<string, string[]>();
  [...new Set(slots)].sort().forEach(slotId => {
    const parsed = parseSlotId(slotId);
    if (!parsed) return;
    grouped.set(parsed.date, [...(grouped.get(parsed.date) ?? []), slotId]);
  });
  return [...grouped.entries()].map(([date, slotIds]) => ({ date, slotIds }));
}

function selectedRanges(slotIds: string[], selected: ReadonlySet<string>): SlotRange[] {
  const ranges: SlotRange[] = [];
  let current: string[] = [];
  slotIds.forEach(slotId => {
    if (selected.has(slotId)) {
      current.push(slotId);
      return;
    }
    if (current.length > 0) {
      ranges.push({ startSlotId: current[0]!, endSlotId: current.at(-1)!, slotIds: current });
      current = [];
    }
  });
  if (current.length > 0) ranges.push({ startSlotId: current[0]!, endSlotId: current.at(-1)!, slotIds: current });
  return ranges;
}

export default function ApplicantAvailabilityRanges({ slots, selected, slotMinutes, disabled = false, onChange }: Props) {
  const dates = useMemo(() => toDateSlots(slots), [slots]);
  const [openDate, setOpenDate] = useState<string | null>(null);

  useEffect(() => {
    setOpenDate(current => current && dates.some(date => date.date === current) ? current : dates[0]?.date ?? null);
  }, [dates]);

  const replaceRange = (dateSlots: DateSlots, previous: SlotRange, startSlotId: string, endSlotId: string) => {
    const startIndex = dateSlots.slotIds.indexOf(startSlotId);
    const endIndex = dateSlots.slotIds.indexOf(endSlotId);
    if (startIndex < 0 || endIndex < 0) return;
    const orderedEndIndex = Math.max(startIndex, endIndex);
    const next = new Set(selected);
    previous.slotIds.forEach(slotId => next.delete(slotId));
    dateSlots.slotIds.slice(startIndex, orderedEndIndex + 1).forEach(slotId => next.add(slotId));
    onChange([...next].sort());
  };

  const removeRange = (range: SlotRange) => {
    const next = new Set(selected);
    range.slotIds.forEach(slotId => next.delete(slotId));
    onChange([...next].sort());
  };

  const addRange = (dateSlots: DateSlots) => {
    const firstOpenSlot = dateSlots.slotIds.find((slotId, index) => {
      if (selected.has(slotId)) return false;
      const previous = dateSlots.slotIds[index - 1];
      const next = dateSlots.slotIds[index + 1];
      return (!previous || !selected.has(previous)) && (!next || !selected.has(next));
    }) ?? dateSlots.slotIds.find(slotId => !selected.has(slotId));
    if (!firstOpenSlot) return;
    onChange([...selected, firstOpenSlot].sort());
  };

  if (dates.length === 0) return <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">설정된 면접 시간이 없습니다.</p>;

  return <div className="space-y-2">{dates.map(dateSlots => {
    const ranges = selectedRanges(dateSlots.slotIds, selected);
    const isOpen = dateSlots.date === openDate;
    const allSelected = ranges.length === 1 && ranges[0]?.slotIds.length === dateSlots.slotIds.length;
    return <section key={dateSlots.date} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><button type="button" aria-expanded={isOpen} onClick={() => setOpenDate(current => current === dateSlots.date ? null : dateSlots.date)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"><span><strong className="block text-sm text-navy">{formatDate(dateSlots.date)}</strong><small className="mt-1 block text-xs text-slate-400">{ranges.length > 0 ? `${ranges.length}개 시간 구간 선택됨` : '가능한 시간을 아직 선택하지 않았습니다.'}</small></span><ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></button>{isOpen && <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 p-3">{ranges.map((range, index) => <div key={`${range.startSlotId}-${range.endSlotId}`} className="grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2 rounded-xl bg-white p-3 shadow-sm"><label className="min-w-0 text-[10px] font-bold text-slate-400">시작<select disabled={disabled} value={range.startSlotId} onChange={event => replaceRange(dateSlots, range, event.target.value, range.endSlotId)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-navy disabled:opacity-60">{dateSlots.slotIds.map(slotId => <option key={slotId} value={slotId}>{formatTime(slotId)}</option>)}</select></label><span className="pb-2 text-xs font-bold text-slate-300">~</span><label className="min-w-0 text-[10px] font-bold text-slate-400">종료<select disabled={disabled} value={range.endSlotId} onChange={event => replaceRange(dateSlots, range, range.startSlotId, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-navy disabled:opacity-60">{dateSlots.slotIds.map(slotId => <option key={slotId} value={slotId}>{formatTime(slotId, slotMinutes)}</option>)}</select></label><button type="button" disabled={disabled} aria-label={`${index + 1}번째 가능 시간 삭제`} onClick={() => removeRange(range)} className="mb-0.5 rounded-lg bg-red-50 p-2 text-red-500 disabled:opacity-40"><Trash2 size={14} /></button></div>)}{ranges.length === 0 && <p className="rounded-xl bg-white px-3 py-3 text-xs leading-5 text-slate-500">가능한 시간의 시작과 종료를 선택해 추가해주세요.</p>}{!disabled && <button type="button" disabled={allSelected} onClick={() => addRange(dateSlots)} className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2.5 text-xs font-black text-navy disabled:opacity-40"><Plus size={14} />다른 가능 시간 추가</button>}</div>}</section>;
  })}</div>;
}

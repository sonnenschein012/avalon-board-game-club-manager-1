import { useMemo, useRef } from 'react';
import { parseSlotId } from '../domain/interviews/scheduling';
import { cn } from '../lib/utils';
import { useEdgeAutoScroll } from '../hooks/useEdgeAutoScroll';

interface AvailabilityGridProps {
  slots: string[];
  selected?: ReadonlySet<string>;
  onToggle?: (slotId: string, force?: boolean) => void;
  counts?: ReadonlyMap<string, number>;
  onCountClick?: (slotId: string) => void;
  disabled?: boolean;
  slotMinutes?: number;
  compact?: boolean;
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(parsed);
}

function getEndTime(time: string, slotMinutes: number) {
  const [hourText, minuteText] = time.split(':');
  const totalMinutes = Number(hourText) * 60 + Number(minuteText) + slotMinutes;
  const normalizedMinutes = totalMinutes % (24 * 60);
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export default function AvailabilityGrid({
  slots,
  selected = new Set<string>(),
  onToggle,
  counts,
  onCountClick,
  disabled = false,
  slotMinutes,
  compact = false,
}: AvailabilityGridProps) {
  const paintMode = useRef<boolean | null>(null);
  const paintedSlots = useRef(new Set<string>());
  const activePointerId = useRef<number | null>(null);
  const { updateEdgeAutoScroll, stopEdgeAutoScroll } = useEdgeAutoScroll();

  const { dates, times, slotLookup } = useMemo(() => {
    const dateSet = new Set<string>();
    const timeSet = new Set<string>();
    const lookup = new Set<string>();
    slots.forEach((slotId) => {
      const parsed = parseSlotId(slotId);
      if (!parsed) return;
      dateSet.add(parsed.date);
      timeSet.add(parsed.time);
      lookup.add(slotId);
    });
    return {
      dates: Array.from(dateSet).sort(),
      times: Array.from(timeSet).sort(),
      slotLookup: lookup,
    };
  }, [slots]);

  const beginPaint = (slotId: string, currentlySelected: boolean, pointerId: number, element: HTMLButtonElement) => {
    if (disabled || !onToggle) return;
    paintMode.current = !currentlySelected;
    paintedSlots.current = new Set([slotId]);
    activePointerId.current = pointerId;
    element.setPointerCapture(pointerId);
    onToggle(slotId, paintMode.current);
  };

  const continuePaint = (slotId: string, buttons: number) => {
    if (disabled || !onToggle || paintMode.current === null || buttons === 0 || paintedSlots.current.has(slotId)) return;
    paintedSlots.current.add(slotId);
    onToggle(slotId, paintMode.current);
  };

  const endPaint = (pointerId?: number) => {
    if (pointerId !== undefined && activePointerId.current !== null && pointerId !== activePointerId.current) return;
    paintMode.current = null;
    activePointerId.current = null;
    paintedSlots.current.clear();
    stopEdgeAutoScroll();
  };

  if (dates.length === 0 || times.length === 0) {
    return <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">설정된 면접 시간이 없습니다.</p>;
  }

  return (
    <div
      className="relative z-0 isolate max-w-full overflow-auto rounded-2xl border border-slate-100 bg-white"
      onPointerMove={(event) => {
        if (paintMode.current === null) return;
        updateEdgeAutoScroll(event.clientY, event.currentTarget);
        const element = document.elementFromPoint(event.clientX, event.clientY);
        const button = element?.closest<HTMLButtonElement>('[data-slot-id]');
        const slotId = button?.dataset.slotId;
        if (slotId) continuePaint(slotId, event.buttons || 1);
      }}
      onPointerUp={(event) => endPaint(event.pointerId)}
      onPointerCancel={(event) => endPaint(event.pointerId)}
      onLostPointerCapture={(event) => endPaint(event.pointerId)}
    >
      <div
        className="grid min-w-max select-none"
        style={{ gridTemplateColumns: `${compact ? 58 : slotMinutes ? 92 : 76}px repeat(${dates.length}, minmax(${compact ? 46 : 68}px, 1fr))` }}
      >
        <div className="sticky left-0 top-0 z-30 border-b border-r border-slate-100 bg-slate-50 p-2 text-center text-[10px] font-bold text-slate-400">시간대</div>
        {dates.map((date) => (
          <div key={date} className="sticky top-0 z-20 border-b border-r border-slate-100 bg-slate-50 px-2 py-3 text-center text-xs font-black text-navy">
            {formatDate(date)}
          </div>
        ))}
        {times.map((time) => (
          <div key={time} className="contents">
            <div className={`sticky left-0 z-10 flex items-center justify-center whitespace-nowrap border-b border-r border-slate-100 bg-white font-bold text-slate-500 ${compact ? 'min-h-8 px-1 text-[9px]' : 'min-h-11 px-2 text-xs'}`}>
              {slotMinutes && !compact ? `${time}~${getEndTime(time, slotMinutes)}` : time}
            </div>
            {dates.map((date) => {
              const slotId = `${date}|${time}`;
              const exists = slotLookup.has(slotId);
              const isSelected = selected.has(slotId);
              const count = counts?.get(slotId);
              return exists ? (
                <button
                  key={slotId}
                  type="button"
                  aria-pressed={isSelected}
                  data-slot-id={slotId}
                  aria-label={`${date} ${time}${slotMinutes ? `부터 ${getEndTime(time, slotMinutes)}까지` : ''}${count !== undefined ? ` 가능 ${count}명` : isSelected ? ' 선택됨' : ' 선택 안 됨'}`}
                  disabled={disabled && count === undefined}
                  onClick={(event) => {
                    if (count !== undefined && onCountClick) {
                      onCountClick(slotId);
                    } else if (onToggle && event.detail === 0) {
                      onToggle(slotId);
                    }
                  }}
                  onPointerDown={onToggle ? (event) => {
                    event.preventDefault();
                    updateEdgeAutoScroll(event.clientY, event.currentTarget);
                    beginPaint(slotId, isSelected, event.pointerId, event.currentTarget);
                  } : undefined}
                  onPointerEnter={onToggle ? (event) => continuePaint(slotId, event.buttons) : undefined}
                  className={cn(
                    'flex touch-none items-center justify-center border-b border-r border-slate-100 font-black transition-colors',
                    compact ? 'min-h-8 min-w-[46px] text-[10px]' : 'min-h-11 min-w-[68px] text-xs',
                    count !== undefined
                      ? 'bg-white text-navy hover:bg-gold/15'
                      : isSelected
                        ? 'border-b-[#FFD166] border-r-[#FFD166] bg-[#FFD166] text-navy'
                        : 'bg-white text-slate-300 hover:bg-gold/10',
                    disabled && count === undefined && 'cursor-not-allowed opacity-70',
                  )}
                >
                  {count !== undefined ? count : ''}
                </button>
              ) : <div key={slotId} className={`${compact ? 'min-h-8' : 'min-h-11'} border-b border-r border-slate-100 bg-slate-50/60`} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

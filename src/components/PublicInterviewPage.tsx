import { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock3, Loader2, LockKeyhole, Pencil, Save } from 'lucide-react';
import { useParams } from 'react-router-dom';
import AvalonLogo from './AvalonLogo';
import AvailabilityGrid from './AvailabilityGrid';
import { usePublicInterviewLogic } from '../hooks/usePublicInterviewLogic';
import { summarizeAvailabilitySlots, type AvailabilitySummaryRow } from '../domain/interviews/availabilitySummary';
import { formatDateTime } from '../lib/utils';

const STATE_MESSAGES = {
  invalid: ['유효하지 않은 링크입니다', '링크가 잘못되었거나 더 이상 존재하지 않습니다. 운영진에게 새 링크를 요청해주세요.'],
  inactive: ['사용이 중지된 링크입니다', '보안을 위해 링크가 폐기되었습니다. 운영진에게 문의해주세요.'],
  unassigned: ['면접 일정을 준비하고 있습니다', '운영진이 면접 일정과 가능 시간 응답 기간을 안내하면 이 링크에서 선택할 수 있습니다.'],
  before: ['아직 조사가 시작되지 않았습니다', '조사 시작 시간이 되면 이 페이지에서 가능한 시간을 선택할 수 있습니다.'],
  closed: ['가능시간 조사가 마감되었습니다', '기존 응답은 아래에서 확인할 수 있지만 더 이상 수정할 수 없습니다.'],
  completed: ['면접이 완료되었습니다', '이 링크는 더 이상 일정 변경에 사용할 수 없습니다.'],
  error: ['면접 정보를 불러오지 못했습니다', '잠시 후 다시 시도하거나 운영진에게 문의해주세요.'],
} as const;

function getEndTime(time: string, slotMinutes: number) {
  const [hourText, minuteText] = time.split(':');
  const totalMinutes = Number(hourText) * 60 + Number(minuteText) + slotMinutes;
  const normalizedMinutes = totalMinutes % (24 * 60);
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function SlotSummary({
  label,
  rows,
  emptyText,
}: {
  label: string;
  rows: AvailabilitySummaryRow[];
  emptyText: string;
}) {
  return (
    <div className="space-y-2">
      <strong className="block text-navy">{label}</strong>
      {rows.length > 0 ? (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div key={row.dateKey} className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 rounded-xl bg-white/75 px-3 py-2">
              <span className="font-bold text-slate-700">{row.dateLabel}</span>
              <span className="font-medium text-slate-600">{row.ranges.join(', ')}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500">{emptyText}</p>
      )}
    </div>
  );
}

export default function PublicInterviewPage() {
  const { token } = useParams<{ token: string }>();
  const { access, round, visibleSlots, availability, state, error, saving, saved, replaceAvailability, submit, retryInitialization } = usePublicInterviewLogic(token);
  const [editing, setEditing] = useState<boolean | null>(null);
  const isEditing = editing ?? !access?.submittedAt;
  const hasUnsavedChanges = (() => {
    if (!access?.submittedAt || !isEditing) return false;
    const savedSlots = [...access.availability].sort();
    const draftSlots = [...availability].sort();
    return savedSlots.length !== draftSlots.length || savedSlots.some((slot, index) => slot !== draftSlots[index]);
  })();

  useEffect(() => {
    if (saved) setEditing(false);
  }, [saved]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [hasUnsavedChanges]);

  const confirmAndSubmit = () => {
    const selectedCount = availability.size;
    const hasPreviouslySavedTimes = Boolean(access?.submittedAt && access.availability.length > 0);
    const message = selectedCount === 0
      ? hasPreviouslySavedTimes
        ? '선택한 시간이 없습니다. 저장하면 이전에 선택한 시간도 모두 해제됩니다.\n\n이대로 저장할까요?'
        : '선택한 시간이 없습니다. “가능한 시간 없음”으로 저장할까요?'
      : `${selectedCount}개의 가능한 시간을 저장할까요?\n\n저장 후에도 응답 마감 전에는 다시 수정할 수 있습니다.`;
    if (window.confirm(message)) void submit();
  };

  if (state === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="flex items-center gap-3 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" /> 면접 정보를 확인하고 있습니다.</div>
      </main>
    );
  }

  const stateMessage = state !== 'collecting' && state !== 'completed' ? STATE_MESSAGES[state] : null;
  const canShowGrid = !!round && !!access && !['invalid', 'inactive', 'completed', 'error'].includes(state);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-6 text-navy sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <AvalonLogo width="42" height="42" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold">Avalon Interview</p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900 sm:text-3xl">{round && 'name' in round ? round.name : '신입부원 면접'}</h1>
            </div>
          </div>
          {access && <p className="mt-5 text-base font-bold text-slate-700">{access.displayName} 님</p>}
          {round && (
            <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2"><CalendarClock size={17} className="text-gold" /><span>응답 마감: <strong>{formatDateTime(round.surveyClosesAt)}</strong></span></div>
              <div className="flex items-center gap-2"><Clock3 size={17} className="text-gold" /><span>{round.availabilitySlotMinutes}분 단위로 선택</span></div>
            </div>
          )}
        </header>

        {access?.assignmentSummary && (
          <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5 shadow-sm sm:p-7">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Assigned interview</p>
            <h2 className="mt-2 text-lg font-black text-navy">{access.assignmentSummary.status === 'completed' ? '완료된 면접 일정' : '확정된 면접 일정'}</h2>
            <p className="mt-2 text-sm font-bold text-slate-700">{access.assignmentSummary.slotId.replace('|', ' ')}</p>
            {access.assignmentSummary.status === 'completed' ? <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"><CheckCircle2 size={17} />면접이 완료되었습니다. 이 링크는 더 이상 일정 변경에 사용할 수 없습니다.</p> : <p className="mt-4 rounded-xl bg-white/80 px-4 py-3 text-sm font-bold text-amber-700">일정 관련 문의는 운영진에게 직접 전달해주세요.</p>}
          </section>
        )}

        {stateMessage && (
          <section className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
            <LockKeyhole className="mx-auto text-gold" size={34} />
            <h2 className="mt-3 text-lg font-black text-slate-800">{stateMessage[0]}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{stateMessage[1]}</p>
            {state === 'error' && access && round && <button type="button" onClick={retryInitialization} className="mt-4 rounded-xl bg-navy px-4 py-2.5 text-xs font-black text-white">다시 시도</button>}
          </section>
        )}

        {canShowGrid && round && (
          <section className="relative isolate space-y-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-7">
            <div>
              <h2 className="text-lg font-black text-slate-800">면접 가능한 시간을 모두 선택해주세요</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {round.instructions || '선택하신 시간 중 운영진이 실제 면접 시간을 정하여 별도로 안내합니다.'}
              </p>
              <p className="mt-1 text-xs text-slate-400">{isEditing ? '가능한 칸을 누르거나 손가락으로 쓸어 여러 시간을 연속 선택하세요.' : '저장된 응답입니다. 변경하려면 아래 수정하기를 눌러주세요.'}</p>
            </div>
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              <SlotSummary
                label="이전에 저장한 시간"
                rows={access.submittedAt ? summarizeAvailabilitySlots(access.availability, round.availabilitySlotMinutes) : []}
                emptyText={access.submittedAt ? '가능한 시간 없음' : '아직 저장한 응답이 없습니다.'}
              />
              {isEditing && <SlotSummary
                label={access.submittedAt ? '수정 중인 시간' : '현재 선택한 시간'}
                rows={summarizeAvailabilitySlots(availability, round.availabilitySlotMinutes)}
                emptyText="선택한 시간이 없습니다."
              />}
              <p className="border-t border-slate-200 pt-2 text-xs text-slate-500">
                각 시간 셀은 시작부터 {round.availabilitySlotMinutes}분 동안을 뜻합니다. 예를 들어 10:00 셀은 10:00~{getEndTime('10:00', round.availabilitySlotMinutes)} 시간대입니다.
              </p>
            </div>
            <AvailabilityGrid
              slots={visibleSlots}
              selected={availability}
              onToggle={(slotId, force) => {
                const next = new Set(availability);
                const shouldSelect = force ?? !next.has(slotId);
                if (shouldSelect) next.add(slotId); else next.delete(slotId);
                replaceAvailability([...next].sort());
              }}
              disabled={state !== 'collecting' || !isEditing}
              slotMinutes={round.availabilitySlotMinutes}
              compact
            />
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}
            {saved && (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                <CheckCircle2 size={17} /> 응답을 저장했습니다. 마감 전에는 같은 링크에서 다시 수정할 수 있습니다.
              </p>
            )}
            {state === 'collecting' && (
              <div className="sticky bottom-3 z-50 flex justify-end">
                {access.submittedAt && !isEditing ? <button type="button" onClick={() => setEditing(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-navy/20 bg-white px-6 py-4 text-sm font-black text-navy shadow-xl sm:w-auto"><Pencil size={18} />수정하기</button> : <button
                    type="button"
                    onClick={confirmAndSubmit}
                    disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-navy px-6 py-4 text-sm font-black text-white shadow-xl transition-colors hover:bg-gold disabled:opacity-50 sm:w-auto"
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {saving ? '저장 중...' : access.submittedAt ? '변경사항 저장' : `${availability.size}개 시간 저장`}
                  </button>}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

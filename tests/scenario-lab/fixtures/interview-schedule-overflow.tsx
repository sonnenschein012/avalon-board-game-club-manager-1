import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import InterviewScheduleAssignmentModal from '../../../src/components/InterviewScheduleAssignmentModal';
import InterviewScheduleSelector from '../../../src/components/InterviewScheduleSelector';
import type { InterviewSchedule } from '../../../src/types';
import '../../../src/index.css';

const query = new URLSearchParams(location.search);
const schedules = Array.from({ length: Number(query.get('count') ?? 20) }, (_, index) => ({
  id: `schedule-${index + 1}`,
  name: `면접 일정 ${index + 1}`,
  status: 'collecting',
  interviewDates: ['2026-09-10'],
  order: index,
} as InterviewSchedule));

function Fixture() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState('');
  return <main style={{ padding: 16, minHeight: '200vh' }}>
    <button onClick={() => setOpen(true)}>지정 모달 열기</button>
    <output aria-label="결과">{result}</output>
    <div style={{ position: 'absolute', top: query.get('position') === 'bottom' ? 'calc(100dvh - 80px)' : 60, right: 16, width: 'min(320px, calc(100vw - 32px))' }}>
      <InterviewScheduleSelector schedules={schedules} activeScheduleId={selected} allowNone onSelect={id => { setSelected(id); setResult(id ?? 'none'); }} />
    </div>
    <InterviewScheduleAssignmentModal open={open} applicantsCount={3} alreadyScheduledCount={query.get('warning') === '0' ? 0 : 2} schedules={schedules}
      onClose={() => setOpen(false)} onCreateSchedule={() => { setResult('create'); setOpen(false); }}
      onAssign={async id => { setResult(id); return true; }} />
  </main>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);

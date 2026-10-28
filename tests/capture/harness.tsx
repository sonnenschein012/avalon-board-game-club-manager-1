import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import MeetingCanvasTab from '../../src/components/MeetingCanvasTab';
import { calculateGridPositions } from '../../src/domain/meeting/progressHelpers';
import { createMembersFixture } from '../../src/scenario-lab/fixtures';
import { captureBoard } from '../../src/services/captureService';
import type { Attendee, StoredSessionGroup } from '../../src/types';
import '../../src/index.css';

// No Firebase initialization: exercise the real canvas and renderer with synthetic data.
const members = createMembersFixture('default').slice(0, 9);
const groups: StoredSessionGroup[] = Array.from({ length: 3 }, (_, i) => ({
  id: `capture-group-${i + 1}`, name: `원탁 ${i + 1}조`,
  memberIds: members.slice(i * 3, i * 3 + 3).map(member => member.id), gameIds: [],
}));
const attendees: Attendee[] = members.map((member, i) => ({
  id: `capture-attendee-${i + 1}`, memberId: member.id, name: member.name,
  drink: ['아메리카노', '아이스티', '물'][i % 3] ?? '물', request: '',
  importDate: member.createdAt, importId: 'capture-fixture', status: '편성됨',
}));
const date = '2026-10-28';

function CaptureFixture() {
  const [activeTab, setActiveTab] = useState<'notice' | 'drink'>('notice');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [positions, setPositions] = useState(() => calculateGridPositions(groups));
  const [scale, setScale] = useState(1);
  const view = useRef<HTMLDivElement>(null);
  const capture = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const resize = () => setScale(Math.min(1, ((view.current?.clientWidth ?? 1600) - 32) / 1600));
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return <main className="p-4">
    <nav aria-label="테스트 캔버스 선택" className="flex gap-4 mb-4">
      <button onClick={() => setActiveTab('notice')}>공지 이미지 생성</button>
      <button onClick={() => setActiveTab('drink')}>음료 주문 리스트</button>
    </nav>
    <MeetingCanvasTab
      activeTab={activeTab} isFullscreen={isFullscreen} setIsFullscreen={setIsFullscreen}
      viewContainerRef={view} captureRef={capture} boardScale={scale} boardHeight={800}
      customTitle={customTitle} setCustomTitle={setCustomTitle} selectedDate={date}
      guides={guides} setGuides={setGuides} dailyPlanning={{ groups }} cardStyles={{}}
      colors={['#E11D48', '#2563EB', '#16A34A']} members={members}
      getAttendeeFromMember={member => attendees.find(attendee => attendee.memberId === member.id)}
      cardPositions={positions} setCardPositions={setPositions} setEditingCardId={() => {}}
      handleGridAlign={() => setPositions(calculateGridPositions(groups))} handleCopyDrinkOrder={() => {}}
      handleCapture={() => { if (capture.current) void captureBoard(capture.current, 800, date); }}
    />
  </main>;
}

createRoot(document.getElementById('root')!).render(<CaptureFixture />);

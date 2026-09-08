import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AttendanceScenario } from '../../../src/scenario-lab/ScenarioPages';
import '../../../src/index.css';

function Fixture() {
  const [tab, setTab] = useState('attendance');
  return <main className="p-4">
    <nav className="sticky top-0 z-50 flex gap-4 bg-white p-2">
      <button onClick={() => setTab('attendance')}>일일 조편성 탭</button>
      <button onClick={() => setTab('other')}>다른 탭</button>
    </nav>
    {tab === 'attendance' ? <AttendanceScenario state="crowded" draftScope="test:attendance" /> : <p>다른 페이지</p>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);

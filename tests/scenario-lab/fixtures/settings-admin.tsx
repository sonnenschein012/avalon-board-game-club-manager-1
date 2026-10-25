import { createRoot } from 'react-dom/client';
import { Timestamp } from 'firebase/firestore';
import SettingsAdminPanel from '../../../src/components/SettingsAdminPanel';
import '../../../src/index.css';

createRoot(document.getElementById('root')!).render(
  <main className="p-4">
    <SettingsAdminPanel
      isMasterAdmin={new URLSearchParams(location.search).get('role') !== 'admin'}
      admins={[
        { id: 'master.with.a.very.long.email.address@example.com', email: 'master.with.a.very.long.email.address@example.com', createdAt: Timestamp.fromMillis(0), role: 'master' },
        { id: 'administrator.with.a.very.long.email.address@example.com', email: 'administrator.with.a.very.long.email.address@example.com', createdAt: Timestamp.fromMillis(0), role: 'admin' },
      ]}
      loadingAdmins={false} newAdminEmail="" setNewAdminEmail={() => {}}
      addingAdmin={false} addAdmin={async () => {}}
      removeAdmin={email => { document.querySelector('output')!.textContent = email; }}
    />
    <output aria-label="삭제 대상" />
  </main>,
);

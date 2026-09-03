import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Admin, Game, Member, Session } from '../types';

export async function listAdmins(): Promise<Admin[]> {
  const snapshot = await getDocs(collection(db, 'admins'));
  return snapshot.docs.map(admin => ({ id: admin.id, ...admin.data() } as Admin));
}

export async function addAdminRecord(normalizedEmail: string): Promise<void> {
  await setDoc(doc(db, 'admins', normalizedEmail), {
    email: normalizedEmail,
    role: 'admin',
    createdAt: serverTimestamp(),
  });
}

export async function removeAdminRecord(email: string): Promise<void> {
  await deleteDoc(doc(db, 'admins', email));
}

export async function loadMemberExportData() {
  const membersSnapshot = await getDocs(collection(db, 'members'));
  const sessionsSnapshot = await getDocs(collection(db, 'sessions'));
  return {
    members: membersSnapshot.docs.map(member => ({ id: member.id, ...member.data() } as Member)),
    sessions: sessionsSnapshot.docs.map(session => session.data() as Session),
  };
}

export async function loadGameExportData(): Promise<Game[]> {
  const snapshot = await getDocs(collection(db, 'games'));
  return snapshot.docs.map(game => game.data() as Game);
}

export async function loadSessionExportData() {
  const sessionsSnapshot = await getDocs(collection(db, 'sessions'));
  const membersSnapshot = await getDocs(collection(db, 'members'));
  const gamesSnapshot = await getDocs(collection(db, 'games'));
  return {
    sessions: sessionsSnapshot.docs.map(session => ({ id: session.id, ...session.data() } as Session)),
    membersById: new Map(membersSnapshot.docs.map(member => [
      member.id,
      { id: member.id, ...member.data() } as Member,
    ])),
    gameTitlesById: new Map(gamesSnapshot.docs.map(game => [game.id, game.data().title as string])),
  };
}

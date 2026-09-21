import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, updateDoc, getDoc, getDocs, collection, writeBatch } from 'firebase/firestore';
const projectId = 'demo-member-security';
const rules = readFileSync('firestore.rules', 'utf8');
const env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8080, rules } });
const results = [];
const baseline = { name: 'Synthetic member', phone: '000-0000-0000' };
async function current() { return env.withSecurityRulesDisabled(async c => (await getDoc(doc(c.firestore(), 'members', 'synthetic-target'))).data()); }
async function probe(label, action, expected) {
 let outcome = 'allowed';
 try { await action(); } catch (e) { if (e.code !== 'permission-denied') throw e; outcome = 'denied'; }
 assert.equal(outcome, expected, label);
 results.push({ label, outcome, member: await current() });
}
try {
 await env.withSecurityRulesDisabled(async c => {
  await setDoc(doc(c.firestore(), 'members', 'synthetic-target'), baseline);
  await setDoc(doc(c.firestore(), 'admins', 'operator@example.test'), { role: 'admin' });
 });
 const guest = env.unauthenticatedContext().firestore();
 const stranger = env.authenticatedContext('stranger', { email: 'stranger@example.test', email_verified: true }).firestore();
 await probe('Unauthenticated member enumeration', () => getDocs(collection(guest, 'members')), 'denied');
 await probe('Unauthenticated direct member update', () => updateDoc(doc(guest, 'members', 'synthetic-target'), { phone: 'ATTACK-1' }), 'denied');
 await probe('Non-admin direct member update', () => updateDoc(doc(stranger, 'members', 'synthetic-target'), { phone: 'ATTACK-2' }), 'denied');
 await probe('Non-admin self-promotion', () => setDoc(doc(stranger, 'admins', 'stranger@example.test'), { role: 'master' }), 'denied');
 await probe('Atomic self-promotion plus member update', () => {
  const b = writeBatch(stranger); b.set(doc(stranger, 'admins', 'stranger@example.test'), { role: 'master' }); b.update(doc(stranger, 'members', 'synthetic-target'), { phone: 'ATTACK-3' }); return b.commit();
 }, 'denied');
 assert.deepEqual(await current(), baseline);
 // Real Auth emulator sign-up: no preassigned claims or admin token in this client.
 const app = initializeApp({ projectId, apiKey: 'local-only' }, 'member-security-probe');
 try {
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const cred = await createUserWithEmailAndPassword(auth, 'operator@example.test', 'Synthetic-only-2026!');
  assert.equal(cred.user.emailVerified, false);
  const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore');
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
  await probe('Auth emulator signup with unverified registered operator email', () => updateDoc(doc(db, 'members', 'synthetic-target'), { phone: 'LOCAL-ATTACK-SUCCEEDED' }), 'allowed');
  assert.equal((await current()).phone, 'LOCAL-ATTACK-SUCCEEDED');
 } finally { await deleteApp(app); }
 const bootstrap = rules.match(/request.auth.token.email == '([^']+)'/)[1];
 const unverifiedBootstrap = env.authenticatedContext('synthetic-bootstrap', { email: bootstrap, email_verified: false }).firestore();
 await probe('Rules-only unverified bootstrap identity (assumed claim)', () => updateDoc(doc(unverifiedBootstrap, 'members', 'synthetic-target'), { name: 'LOCAL-BOOTSTRAP-CHANGED' }), 'allowed');
 mkdirSync('artifacts/security', { recursive: true });
 writeFileSync('artifacts/security/member-attack-results.json', JSON.stringify({ at: new Date().toISOString(), scope: 'Local emulators only; current working-tree rules; production auth providers and deployed rules not checked', results }, null, 2));
 console.log(JSON.stringify(results, null, 2));
} finally { await env.cleanup(); }

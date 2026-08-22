import { db, checkAdminStatus } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

async function checkAndMigrateMasterAdmin() {
  const masterEmail = 'eunchangyang1@gmail.com';
  console.log(`Checking Firestore admins/${masterEmail}...`);

  try {
    const docRef = doc(db, 'admins', masterEmail);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      console.log(`[FOUND] Document admins/${masterEmail}:`, JSON.stringify(data));
      if (data.role === 'master') {
        console.log(`[CONFIRMED] Account ${masterEmail} is already verified as role: 'master'.`);
      } else {
        console.log(`[UPDATING] Updating role to 'master'...`);
        await setDoc(docRef, { ...data, role: 'master', updatedAt: new Date() }, { merge: true });
        console.log(`[UPDATED] Successfully updated to role: 'master'.`);
      }
    } else {
      console.log(`[CREATING] Document does not exist. Creating admins/${masterEmail} with role: 'master'...`);
      await setDoc(docRef, {
        email: masterEmail,
        role: 'master',
        name: '양은창',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`[CREATED] Document created successfully with role: 'master'.`);
    }

    // Verify with checkAdminStatus
    const status = await checkAdminStatus(masterEmail);
    console.log(`checkAdminStatus result:`, status);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Firestore operation note:', errorMsg);
  }
}

checkAndMigrateMasterAdmin();

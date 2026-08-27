/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, doc, getDocFromServer } from 'firebase/firestore';

import firebaseConfig from '@firebase-config';

export const isDemoMode = import.meta.env.MODE === 'demo';
export const DEMO_ADMIN_EMAIL = 'demo.admin@avalon.local';
const DEMO_ADMIN_PASSWORD = 'local-demo-only';

if (isDemoMode && firebaseConfig.projectId !== 'demo-avalon-manager') {
  throw new Error('Demo mode must use the isolated demo-avalon-manager project.');
}

const app = initializeApp(firebaseConfig);
export const db = firebaseConfig.firestoreDatabaseId === '(default)'
  ? getFirestore(app)
  : getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

if (isDemoMode) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

let demoSessionPromise: Promise<void> | null = null;

/** Creates a fixed local-only operator inside the Auth emulator. */
export function initializeDemoSession(): Promise<void> {
  if (!isDemoMode || auth.currentUser?.email === DEMO_ADMIN_EMAIL) return Promise.resolve();
  if (demoSessionPromise) return demoSessionPromise;

  demoSessionPromise = signInWithEmailAndPassword(auth, DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD)
    .catch(async error => {
      const code = (error as { code?: string }).code;
      if (code !== 'auth/user-not-found' && code !== 'auth/invalid-credential') throw error;
      try {
        return await createUserWithEmailAndPassword(auth, DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD);
      } catch (createError) {
        if ((createError as { code?: string }).code !== 'auth/email-already-in-use') throw createError;
        return signInWithEmailAndPassword(auth, DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD);
      }
    })
    .then(async credential => {
      if (credential.user.displayName !== '로컬 데모 관리자') {
        await updateProfile(credential.user, { displayName: '로컬 데모 관리자' });
      }
    })
    .finally(() => {
      demoSessionPromise = null;
    });

  return demoSessionPromise;
}

let isSigningIn = false;

export const signInWithGoogle = async () => {
  if (isDemoMode) {
    await initializeDemoSession();
    return;
  }
  if (isSigningIn) {
    console.warn('Sign-in already in progress');
    return;
  }
  
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
      console.warn('Sign-in popup was closed or cancelled');
    } else if (error.message?.includes('Pending promise was never set')) {
      console.error('Firebase Auth internal assertion error. You may need to click again or refresh.');
    } else {
      console.error('Sign-in error:', error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};
export const logout = () => signOut(auth);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      ...(auth.currentUser?.uid !== undefined && { userId: auth.currentUser?.uid }),
      ...(auth.currentUser?.email !== undefined && { email: auth.currentUser?.email }),
      ...(auth.currentUser?.emailVerified !== undefined && { emailVerified: auth.currentUser?.emailVerified }),
      ...(auth.currentUser?.isAnonymous !== undefined && { isAnonymous: auth.currentUser?.isAnonymous }),
      ...(auth.currentUser?.tenantId !== undefined && { tenantId: auth.currentUser?.tenantId }),
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        ...(provider.providerId !== undefined && { providerId: provider.providerId }),
        ...(provider.email !== undefined && { email: provider.email }),
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo, null, 2));
}

// Connection test
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection successful");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or network status.");
    }
  }
}

export async function checkAdminStatus(email: string): Promise<{ isAdmin: boolean; isMaster: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();
  const isBootstrapMaster = normalizedEmail === 'eunchangyang1@gmail.com';
  try {
    const docRef = doc(db, 'admins', normalizedEmail);
    const docSnap = await getDocFromServer(docRef);
    if (!docSnap.exists()) {
      return { isAdmin: isBootstrapMaster, isMaster: isBootstrapMaster };
    }
    const data = docSnap.data();
    return {
      isAdmin: true,
      isMaster: isBootstrapMaster || data?.role === 'master',
    };
  } catch {
    return { isAdmin: false, isMaster: false };
  }
}

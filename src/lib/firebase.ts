/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

import firebaseConfig from '@firebase-config';

const app = initializeApp(firebaseConfig);
export const db = firebaseConfig.firestoreDatabaseId === '(default)'
  ? getFirestore(app)
  : getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

let isSigningIn = false;

export const signInWithGoogle = async () => {
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

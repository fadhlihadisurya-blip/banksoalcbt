import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
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
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.error('Google Sign-In Error:', err);
    throw err;
  }
}

export async function loginWithEmailPassword(email: string, pass: string) {
  const cleanEmail = email.trim();
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    return cred.user;
  } catch (err: any) {
    // If user not found and it's a recognized school admin email, attempt initial bootstrap registration
    if (
      err.code === 'auth/user-not-found' ||
      err.code === 'auth/invalid-credential'
    ) {
      const lower = cleanEmail.toLowerCase();
      if (
        lower === 'fadhlihadisurya@gmail.com' ||
        lower === 'admin@sman1prestasi.sch.id' ||
        lower.startsWith('admin@')
      ) {
        try {
          const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
          return newCred.user;
        } catch (createErr) {
          // If creation fails, throw original authentication error
          console.warn('Bootstrap creation skipped:', createErr);
        }
      }
    }
    console.error('Firebase Email/Password Login Error:', err);
    throw err;
  }
}

export async function registerWithEmailPassword(email: string, pass: string) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    return cred.user;
  } catch (err) {
    console.error('Firebase Email/Password Register Error:', err);
    throw err;
  }
}

export async function resetPasswordEmail(email: string) {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err) {
    console.error('Firebase Reset Password Error:', err);
    throw err;
  }
}

export async function logoutFirebase() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Sign-out error:', err);
  }
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

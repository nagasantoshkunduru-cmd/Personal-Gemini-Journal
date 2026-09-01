import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import type { JournalEntry, UserAuthProfile } from '../types';
import { SAMPLE_INITIAL_ENTRIES } from './sampleData';
import firebaseConfig from '../../firebase-applet-config.json';

// Standardized Firestore Error Tracking per Firebase Integration Guidelines
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
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
      tenantId: currentUser?.tenantId || null,
      providerInfo: currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('[Firestore Error Diagnostic]:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Build effective Firebase config with fallback to environment variables
const rawConfig = (firebaseConfig as any) || {};
const metaEnv = ((import.meta as any)?.env) || {};
const effectiveFirebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || rawConfig.apiKey || '',
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || rawConfig.authDomain || '',
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || rawConfig.projectId || '',
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || rawConfig.storageBucket || '',
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || rawConfig.messagingSenderId || '',
  appId: metaEnv.VITE_FIREBASE_APP_ID || rawConfig.appId || '',
  firestoreDatabaseId: metaEnv.VITE_FIRESTORE_DATABASE_ID || rawConfig.firestoreDatabaseId || '(default)',
};

// Initialize Firebase App singleton safely
let app: any;
try {
  app = getApps().length === 0 ? initializeApp(effectiveFirebaseConfig) : getApp();
} catch (e) {
  console.warn('[Firebase] Initializing default fallback app:', e);
  app = getApps().length === 0 ? initializeApp({ projectId: 'demo-personal-journal' }) : getApp();
}

// Initialize Auth safely
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore safely with fallback
function initFirestore() {
  try {
    if (
      effectiveFirebaseConfig.firestoreDatabaseId &&
      effectiveFirebaseConfig.firestoreDatabaseId !== '(default)'
    ) {
      return getFirestore(app, effectiveFirebaseConfig.firestoreDatabaseId);
    }
  } catch (e) {
    console.warn('[Firestore] Named database initialization failed, falling back to default:', e);
  }
  return getFirestore(app);
}

export const db = initFirestore();

/**
 * Format Firebase User into app profile format
 */
export function formatUserProfile(user: User | null): UserAuthProfile | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || (user.isAnonymous ? 'Public Contributor' : 'Journaler'),
    photoURL: user.photoURL,
    isAnonymous: user.isAnonymous,
  };
}

/**
 * Listen to Auth State Changes
 */
export function onAuthUserChanged(callback: (profile: UserAuthProfile | null) => void) {
  return onAuthStateChanged(auth, (user) => {
    callback(formatUserProfile(user));
  });
}

/**
 * Optional Google Sign-In
 */
export async function signInWithGoogle(): Promise<UserAuthProfile> {
  const result = await signInWithPopup(auth, googleProvider);
  const profile = formatUserProfile(result.user);
  if (!profile) throw new Error('Failed to retrieve user profile');
  return profile;
}

/**
 * Optional Email/Password Sign-In
 */
export async function signInWithEmail(email: string, pass: string): Promise<UserAuthProfile> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  const profile = formatUserProfile(result.user);
  if (!profile) throw new Error('Failed to sign in with email');
  return profile;
}

/**
 * Optional Email/Password Sign-Up
 */
export async function signUpWithEmail(email: string, pass: string): Promise<UserAuthProfile> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  const profile = formatUserProfile(result.user);
  if (!profile) throw new Error('Failed to create user account');
  return profile;
}

/**
 * Guest / Anonymous Sign-In (Zero friction)
 */
export async function signInAsGuest(): Promise<UserAuthProfile> {
  const result = await signInAnonymously(auth);
  const profile = formatUserProfile(result.user);
  if (!profile) throw new Error('Failed to create guest session');
  return profile;
}

/**
 * Sign Out
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Save / Update Journal Entry to Cloud Firestore with strict User ID enforcement.
 * Ensures the document explicitly includes the current user's UID and writes to isolated user path.
 */
export async function saveJournalEntry(
  userIdOrEntry: string | (Omit<JournalEntry, 'id'> & { id?: string }),
  maybeEntry?: Omit<JournalEntry, 'id' | 'userId'> & { id?: string }
): Promise<string> {
  const currentAuthUid = auth.currentUser?.uid;
  let targetUserId = currentAuthUid;
  let entryData: any;

  if (typeof userIdOrEntry === 'string') {
    targetUserId = userIdOrEntry || currentAuthUid;
    entryData = maybeEntry || {};
  } else {
    entryData = userIdOrEntry;
    targetUserId = entryData.userId || currentAuthUid;
  }

  // Strictly enforce user UID presence
  if (!targetUserId) {
    throw new Error('Authentication required: Current user UID is missing.');
  }

  const entryId = entryData.id || `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Explicitly embed targetUserId as the immutable owner UID
  const rawEntry: JournalEntry = {
    ...entryData,
    id: entryId,
    userId: targetUserId,
    updatedAt: Date.now(),
    createdAt: entryData.createdAt || Date.now(),
  };

  // Strip undefined values for clean zero-crash Firestore payloads
  const cleanPayload = JSON.parse(JSON.stringify(rawEntry));

  const writePath = `users/${targetUserId}/entries/${entryId}`;
  try {
    // 1. Write to isolated user collection: /users/{userId}/entries/{entryId}
    const userEntryDoc = doc(db, 'users', targetUserId, 'entries', entryId);
    await setDoc(userEntryDoc, cleanPayload, { merge: true });

    // 2. Write to global entries collection with explicit userId for strict where('userId', '==', currentUser.uid) queries
    const rootEntryDoc = doc(db, 'entries', entryId);
    await setDoc(rootEntryDoc, cleanPayload, { merge: true });

    return entryId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, writePath);
    return entryId;
  }
}

/**
 * Delete Journal Entry from Isolated User Collection
 */
export async function deleteJournalEntry(
  entryId: string,
  optionalUserId?: string
): Promise<void> {
  const currentAuthUid = auth.currentUser?.uid;
  const userId = optionalUserId || currentAuthUid;

  if (!userId) {
    throw new Error('Authentication required: Current user UID is missing for deletion.');
  }

  const deletePath = `users/${userId}/entries/${entryId}`;
  try {
    const userDocRef = doc(db, 'users', userId, 'entries', entryId);
    await deleteDoc(userDocRef);

    const rootDocRef = doc(db, 'entries', entryId);
    await deleteDoc(rootDocRef).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, deletePath);
  }
}

/**
 * Real-time subscription to user journal entries with strict where('userId', '==', currentUser.uid) query filtering
 */
export function subscribeUserEntries(
  userId: string | null | undefined,
  onData: (entries: JournalEntry[]) => void,
  onError?: (err: Error) => void
) {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const path = `users/${userId}/entries`;
  const entriesRef = collection(db, 'users', userId, 'entries');

  // Strictly filter by where('userId', '==', currentUser.uid)
  const q = query(
    entriesRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        // Return empty list for brand new accounts with no entries
        onData([]);
        return;
      }

      const items: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as JournalEntry;
        // Verify explicit UID matching
        if (item.userId === userId) {
          items.push(item);
        }
      });

      onData(items);
    },
    (error) => {
      console.warn('[Firestore User Subscription Notice]', error.message);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        if (onError) onError(err as Error);
      }
    }
  );
}

/**
 * Fetch all entries for authenticated user with strict where('userId', '==', currentUser.uid) filtering
 */
export async function fetchUserEntries(userId: string): Promise<JournalEntry[]> {
  if (!userId) return [];
  const path = `users/${userId}/entries`;
  try {
    const entriesRef = collection(db, 'users', userId, 'entries');
    const q = query(
      entriesRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return [];
    }
    const items: JournalEntry[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as JournalEntry;
      if (data.userId === userId) {
        items.push(data);
      }
    });
    return items;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}



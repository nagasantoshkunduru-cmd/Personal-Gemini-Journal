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
  orderBy,
  getDocs,
} from 'firebase/firestore';
import type { JournalEntry, UserAuthProfile } from '../types';
import { SAMPLE_INITIAL_ENTRIES } from './sampleData';
import firebaseConfig from '../../firebase-applet-config.json';

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
 * Save / Update Journal Entry to Cloud Firestore (Strict User Isolation)
 */
export async function saveJournalEntry(
  userIdOrEntry: string | (Omit<JournalEntry, 'id'> & { id?: string }),
  maybeEntry?: Omit<JournalEntry, 'id' | 'userId'> & { id?: string }
): Promise<string> {
  const currentAuthUid = auth.currentUser?.uid;
  let targetUserId = currentAuthUid || 'anonymous';
  let entryData: any;

  if (typeof userIdOrEntry === 'string') {
    targetUserId = userIdOrEntry || currentAuthUid || 'anonymous';
    entryData = maybeEntry || {};
  } else {
    entryData = userIdOrEntry;
    targetUserId = entryData.userId || currentAuthUid || 'anonymous';
  }

  const entryId = entryData.id || `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const fullEntry: JournalEntry = {
    ...entryData,
    id: entryId,
    userId: targetUserId,
    updatedAt: Date.now(),
    createdAt: entryData.createdAt || Date.now(),
  };

  // Write directly to user isolated subcollection /users/{userId}/entries/{entryId}
  const userEntryDoc = doc(db, 'users', targetUserId, 'entries', entryId);
  await setDoc(userEntryDoc, fullEntry, { merge: true });

  return entryId;
}

/**
 * Delete Journal Entry from Isolated User Collection
 */
export async function deleteJournalEntry(
  param1: string,
  param2?: string
): Promise<void> {
  const currentAuthUid = auth.currentUser?.uid;
  const entryId = param2 ? param2 : param1;
  const userId = (param2 ? param1 : currentAuthUid) || 'anonymous';

  const userDocRef = doc(db, 'users', userId, 'entries', entryId);
  await deleteDoc(userDocRef);
}

/**
 * Real-time subscription to isolated user journal entries
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

  const entriesRef = collection(db, 'users', userId, 'entries');
  const q = query(entriesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        // Return default sample entries for new user exploration
        onData(SAMPLE_INITIAL_ENTRIES);
        return;
      }

      const items: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as JournalEntry);
      });
      onData(items);
    },
    (error) => {
      console.warn('[Firestore User Subscription Notice]', error.message);
      onData(SAMPLE_INITIAL_ENTRIES);
      if (onError) onError(error);
    }
  );
}

/**
 * Fetch all entries for authenticated user
 */
export async function fetchUserEntries(userId: string): Promise<JournalEntry[]> {
  try {
    if (!userId) return [];
    const entriesRef = collection(db, 'users', userId, 'entries');
    const q = query(entriesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return SAMPLE_INITIAL_ENTRIES;
    }
    const items: JournalEntry[] = [];
    snapshot.forEach((docSnap) => {
      items.push(docSnap.data() as JournalEntry);
    });
    return items;
  } catch (err) {
    console.error('Error fetching user entries:', err);
    return SAMPLE_INITIAL_ENTRIES;
  }
}



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

// Initialize Firebase App singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore with the dedicated database ID if configured
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

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
 * Save / Update Journal Entry to Cloud Firestore (Public Access)
 */
export async function saveJournalEntry(
  userIdOrEntry: string | (Omit<JournalEntry, 'id'> & { id?: string }),
  maybeEntry?: Omit<JournalEntry, 'id' | 'userId'> & { id?: string }
): Promise<string> {
  let userId = 'public';
  let entryData: any;

  if (typeof userIdOrEntry === 'string') {
    userId = userIdOrEntry || 'public';
    entryData = maybeEntry || {};
  } else {
    entryData = userIdOrEntry;
    userId = entryData.userId || 'public';
  }

  const entryId = entryData.id || `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const fullEntry: JournalEntry = {
    ...entryData,
    id: entryId,
    userId: userId,
    updatedAt: Date.now(),
    createdAt: entryData.createdAt || Date.now(),
  };

  // Write to public entries collection
  const publicEntryDoc = doc(db, 'entries', entryId);
  await setDoc(publicEntryDoc, fullEntry, { merge: true });

  // If a specific userId exists, also mirror to user collection for compatibility
  if (userId && userId !== 'public') {
    try {
      const userEntryDoc = doc(db, 'users', userId, 'entries', entryId);
      await setDoc(userEntryDoc, fullEntry, { merge: true });
    } catch (e) {
      console.warn('Could not mirror to user collection:', e);
    }
  }

  return entryId;
}

/**
 * Delete Journal Entry
 */
export async function deleteJournalEntry(
  param1: string,
  param2?: string
): Promise<void> {
  const entryId = param2 ? param2 : param1;
  const userId = param2 ? param1 : 'public';

  // Delete from public entries
  try {
    const publicDocRef = doc(db, 'entries', entryId);
    await deleteDoc(publicDocRef);
  } catch (e) {
    console.error('Error deleting from public entries:', e);
  }

  // Delete from user collection if userId provided
  if (userId && userId !== 'public') {
    try {
      const userDocRef = doc(db, 'users', userId, 'entries', entryId);
      await deleteDoc(userDocRef);
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Real-time subscription to public journal entries (Accessible to anyone without login)
 */
export function subscribePublicEntries(
  onData: (entries: JournalEntry[]) => void,
  onError?: (err: Error) => void
) {
  const entriesRef = collection(db, 'entries');
  const q = query(entriesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        // Return default sample entries if Firestore collection is fresh
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
      console.warn('[Firestore Public Subscription Notice]', error.message);
      // Fallback to sample entries gracefully if offline or connecting
      onData(SAMPLE_INITIAL_ENTRIES);
      if (onError) onError(error);
    }
  );
}

/**
 * Compatibility wrapper for subscribeUserEntries
 */
export function subscribeUserEntries(
  _userId: string | null | undefined,
  onData: (entries: JournalEntry[]) => void,
  onError?: (err: Error) => void
) {
  return subscribePublicEntries(onData, onError);
}

/**
 * Fetch all public entries once
 */
export async function fetchPublicEntries(): Promise<JournalEntry[]> {
  try {
    const entriesRef = collection(db, 'entries');
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
    console.error('Error fetching public entries:', err);
    return SAMPLE_INITIAL_ENTRIES;
  }
}


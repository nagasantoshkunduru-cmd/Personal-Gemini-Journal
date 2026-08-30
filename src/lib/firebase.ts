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
    displayName: user.displayName || (user.isAnonymous ? 'Guest Reflective User' : 'Journaler'),
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
 * Google Sign-In
 */
export async function signInWithGoogle(): Promise<UserAuthProfile> {
  const result = await signInWithPopup(auth, googleProvider);
  const profile = formatUserProfile(result.user);
  if (!profile) throw new Error('Failed to retrieve user profile');
  return profile;
}

/**
 * Email/Password Sign-In
 */
export async function signInWithEmail(email: string, pass: string): Promise<UserAuthProfile> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  const profile = formatUserProfile(result.user);
  if (!profile) throw new Error('Failed to sign in with email');
  return profile;
}

/**
 * Email/Password Sign-Up
 */
export async function signUpWithEmail(email: string, pass: string): Promise<UserAuthProfile> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  const profile = formatUserProfile(result.user);
  if (!profile) throw new Error('Failed to create user account');
  return profile;
}

/**
 * Guest / Anonymous Sign-In (Zero friction, isolated securely under auth.uid)
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
 * Security: Firestore collection reference strictly nested under authenticated user path:
 * /users/{userId}/entries
 */
function getEntriesCollection(userId: string) {
  if (!userId) throw new Error('Security Error: User ID is required for data isolation.');
  return collection(db, 'users', userId, 'entries');
}

/**
 * Save / Update Journal Entry under users/{userId}/entries/{entryId}
 */
export async function saveJournalEntry(
  userId: string,
  entry: Omit<JournalEntry, 'id' | 'userId'> & { id?: string }
): Promise<string> {
  if (!userId) throw new Error('Unauthorized: Missing User ID');

  const entriesRef = getEntriesCollection(userId);
  const entryId = entry.id || `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const entryDoc = doc(entriesRef, entryId);

  const fullEntry: JournalEntry = {
    ...entry,
    id: entryId,
    userId,
    updatedAt: Date.now(),
    createdAt: entry.createdAt || Date.now(),
  };

  await setDoc(entryDoc, fullEntry, { merge: true });
  return entryId;
}

/**
 * Delete Journal Entry
 */
export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) throw new Error('Invalid arguments for deletion');
  const entryDoc = doc(db, 'users', userId, 'entries', entryId);
  await deleteDoc(entryDoc);
}

/**
 * Real-time subscription to user's journal entries
 */
export function subscribeUserEntries(
  userId: string,
  onData: (entries: JournalEntry[]) => void,
  onError?: (err: Error) => void
) {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const entriesRef = getEntriesCollection(userId);
  const q = query(entriesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as JournalEntry);
      });
      onData(items);
    },
    (error) => {
      console.error('[Firestore Error] Failed to fetch entries:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Fetch all entries once
 */
export async function fetchUserEntries(userId: string): Promise<JournalEntry[]> {
  if (!userId) return [];
  const entriesRef = getEntriesCollection(userId);
  const q = query(entriesRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  const items: JournalEntry[] = [];
  snapshot.forEach((docSnap) => {
    items.push(docSnap.data() as JournalEntry);
  });
  return items;
}

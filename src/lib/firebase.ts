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
  updateProfile,
  sendPasswordResetEmail,
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

// Local Guest Storage Keys
const GUEST_PROFILE_STORAGE_KEY = 'vault_guest_profile';
const GUEST_ENTRIES_STORAGE_KEY_PREFIX = 'vault_guest_entries_';

/**
 * Retrieve local guest profile if active
 */
export function getLocalGuestProfile(): UserAuthProfile | null {
  try {
    const raw = localStorage.getItem(GUEST_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserAuthProfile;
  } catch {
    return null;
  }
}

/**
 * Save or clear local guest profile
 */
export function setLocalGuestProfile(profile: UserAuthProfile | null): void {
  try {
    if (profile) {
      localStorage.setItem(GUEST_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(GUEST_PROFILE_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('Unable to persist guest profile to localStorage:', e);
  }
}

/**
 * Clear local guest profile
 */
export function clearLocalGuestProfile(): void {
  try {
    localStorage.removeItem(GUEST_PROFILE_STORAGE_KEY);
  } catch (e) {
    console.warn('Unable to clear guest profile from localStorage:', e);
  }
}

/**
 * Check if the active session is a local guest/sandbox session
 */
export function isGuestSession(userId?: string | null): boolean {
  if (!userId) return false;
  if (userId.startsWith('guest_')) return true;
  if (!auth.currentUser && getLocalGuestProfile()?.uid === userId) return true;
  return false;
}

/**
 * Read local entries for guest users
 */
function getLocalEntries(userId: string): JournalEntry[] {
  try {
    const raw = localStorage.getItem(`${GUEST_ENTRIES_STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) return [];
    return JSON.parse(raw) as JournalEntry[];
  } catch {
    return [];
  }
}

/**
 * Save local entries for guest users and trigger cross-component event
 */
function saveLocalEntries(userId: string, entries: JournalEntry[]): void {
  try {
    localStorage.setItem(`${GUEST_ENTRIES_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(entries));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vault_entries_changed', { detail: { userId } }));
    }
  } catch (e) {
    console.warn('Unable to save local entries:', e);
  }
}

/**
 * Extract name portion of an email address as a reliable fallback.
 */
export function getEmailNameFallback(email?: string | null): string {
  if (email && email.includes('@')) {
    const namePart = email.split('@')[0];
    if (namePart && namePart.trim()) return namePart.trim();
  }
  return 'User';
}

/**
 * Format Firebase User into app profile format
 */
export function formatUserProfile(user: User | null): UserAuthProfile | null {
  if (!user) return null;
  const emailFallback = getEmailNameFallback(user.email);
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || (user.isAnonymous ? 'Guest Explorer' : emailFallback),
    photoURL: user.photoURL,
    isAnonymous: user.isAnonymous,
  };
}

// Active listeners for auth changes
const authListeners: Array<(profile: UserAuthProfile | null) => void> = [];

export function notifyAuthListeners(profile: UserAuthProfile | null) {
  authListeners.forEach((listener) => {
    try {
      listener(profile);
    } catch (e) {
      console.warn('Error notifying auth listener:', e);
    }
  });
}

/**
 * Update authenticated user's display name across Firebase Auth and Firestore user profile.
 */
export async function updateUserDisplayName(newDisplayName: string): Promise<UserAuthProfile> {
  const currentUser = auth.currentUser;
  const localGuest = getLocalGuestProfile();

  if (!currentUser && localGuest) {
    const trimmed = newDisplayName.trim() || 'Guest Explorer';
    const updated: UserAuthProfile = {
      ...localGuest,
      displayName: trimmed,
    };
    setLocalGuestProfile(updated);
    notifyAuthListeners(updated);
    return updated;
  }

  if (!currentUser) throw new Error('Authentication required: No active user.');

  const fallback = getEmailNameFallback(currentUser.email);
  const trimmed = newDisplayName.trim() || fallback;

  // 1. Update Firebase Auth user profile
  await updateProfile(currentUser, {
    displayName: trimmed,
  });

  // 2. Synchronize to Firestore user profile document (/users/{userId})
  try {
    const userDocRef = doc(db, 'users', currentUser.uid);
    await setDoc(userDocRef, {
      uid: currentUser.uid,
      displayName: trimmed,
      email: currentUser.email || null,
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.warn('Non-blocking user profile document sync:', err);
  }

  const profile = formatUserProfile(currentUser);
  if (!profile) throw new Error('Failed to retrieve updated profile');
  return {
    ...profile,
    displayName: trimmed,
  };
}

/**
 * Listen to Auth State Changes with support for seamless guest sessions
 */
export function onAuthUserChanged(callback: (profile: UserAuthProfile | null) => void) {
  authListeners.push(callback);

  const unsubscribeFirebase = onAuthStateChanged(auth, (user) => {
    if (user) {
      clearLocalGuestProfile();
      callback(formatUserProfile(user));
    } else {
      const localGuest = getLocalGuestProfile();
      if (localGuest) {
        callback(localGuest);
      } else {
        callback(null);
      }
    }
  });

  // If local guest is already stored and Firebase is unauthenticated, trigger callback
  const existingGuest = getLocalGuestProfile();
  if (existingGuest && !auth.currentUser) {
    callback(existingGuest);
  }

  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx !== -1) authListeners.splice(idx, 1);
    unsubscribeFirebase();
  };
}

/**
 * Optional Google Sign-In
 */
export async function signInWithGoogle(): Promise<UserAuthProfile> {
  const result = await signInWithPopup(auth, googleProvider);
  clearLocalGuestProfile();
  const profile = formatUserProfile(result.user);
  if (!profile) throw new Error('Failed to retrieve user profile');
  return profile;
}

/**
 * Optional Email/Password Sign-In
 */
export async function signInWithEmail(email: string, pass: string): Promise<UserAuthProfile> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  clearLocalGuestProfile();
  const profile = formatUserProfile(result.user);
  if (!profile) throw new Error('Failed to sign in with email');
  return profile;
}

/**
 * Optional Email/Password Sign-Up
 */
export async function signUpWithEmail(email: string, pass: string): Promise<UserAuthProfile> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  clearLocalGuestProfile();
  const profile = formatUserProfile(result.user);
  if (!profile) throw new Error('Failed to create user account');
  return profile;
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Guest / Anonymous Sign-In (Zero friction)
 * Attempts Firebase anonymous sign-in, and gracefully falls back to local sandbox
 * if Anonymous Authentication is restricted/disabled by Firebase admin policy (auth/admin-restricted-operation).
 */
export async function signInAsGuest(): Promise<UserAuthProfile> {
  try {
    const result = await signInAnonymously(auth);
    const profile = formatUserProfile(result.user);
    if (profile) {
      clearLocalGuestProfile();
      return profile;
    }
  } catch (err: any) {
    console.info(
      '[Firebase Auth Notice] Firebase Anonymous sign-in provider is restricted in Firebase Console (auth/admin-restricted-operation). Activating local guest sandbox mode seamlessly.',
      err.code || err.message
    );
  }

  // Graceful local guest profile
  const existing = getLocalGuestProfile();
  const profile: UserAuthProfile = existing || {
    uid: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    displayName: 'Guest Explorer',
    email: null,
    photoURL: null,
    isAnonymous: true,
  };
  setLocalGuestProfile(profile);
  notifyAuthListeners(profile);
  return profile;
}

/**
 * Sign Out
 */
export async function signOut(): Promise<void> {
  clearLocalGuestProfile();
  notifyAuthListeners(null);
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    console.warn('Firebase signOut notice:', err);
  }
}

/**
 * Save / Update Journal Entry to Cloud Firestore with strict User ID enforcement.
 * Ensures the document explicitly includes the current user's UID and writes to isolated user path.
 * Seamlessly stores to local guest storage if operating in guest sandbox mode.
 */
export async function saveJournalEntry(
  userIdOrEntry: string | (Omit<JournalEntry, 'id'> & { id?: string }),
  maybeEntry?: Omit<JournalEntry, 'id' | 'userId'> & { id?: string }
): Promise<string> {
  const currentAuthUid = auth.currentUser?.uid || getLocalGuestProfile()?.uid;
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

  // If local guest session or no auth user, persist to local entries storage
  if (isGuestSession(targetUserId) || !auth.currentUser) {
    const currentList = getLocalEntries(targetUserId);
    const existingIndex = currentList.findIndex((e) => e.id === entryId);
    let updatedList: JournalEntry[];
    if (existingIndex >= 0) {
      updatedList = [...currentList];
      updatedList[existingIndex] = cleanPayload;
    } else {
      updatedList = [cleanPayload, ...currentList];
    }
    saveLocalEntries(targetUserId, updatedList);
    return entryId;
  }

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
    console.warn('[Firestore Write Notice] Fallback to local persistence:', error);
    const currentList = getLocalEntries(targetUserId);
    const existingIndex = currentList.findIndex((e) => e.id === entryId);
    let updatedList: JournalEntry[];
    if (existingIndex >= 0) {
      updatedList = [...currentList];
      updatedList[existingIndex] = cleanPayload;
    } else {
      updatedList = [cleanPayload, ...currentList];
    }
    saveLocalEntries(targetUserId, updatedList);

    try {
      handleFirestoreError(error, OperationType.WRITE, writePath);
    } catch {
      // Diagnostic logged
    }
    return entryId;
  }
}

/**
 * Update Journal Entry Title in Cloud Firestore with strict User ID enforcement.
 */
export async function updateJournalEntryTitle(
  entryId: string,
  newTitle: string,
  optionalUserId?: string
): Promise<void> {
  const currentAuthUid = auth.currentUser?.uid || getLocalGuestProfile()?.uid;
  const userId = optionalUserId || currentAuthUid;

  if (!userId) {
    throw new Error('Authentication required: Current user UID is missing for update.');
  }

  const trimmedTitle = newTitle.trim() || 'Untitled Reflection';

  if (isGuestSession(userId) || !auth.currentUser) {
    const list = getLocalEntries(userId);
    const updated = list.map((e) => (e.id === entryId ? { ...e, title: trimmedTitle, updatedAt: Date.now() } : e));
    saveLocalEntries(userId, updated);
    return;
  }

  const writePath = `users/${userId}/entries/${entryId}`;
  try {
    const userDocRef = doc(db, 'users', userId, 'entries', entryId);
    await setDoc(userDocRef, { title: trimmedTitle, updatedAt: Date.now() }, { merge: true });

    const rootDocRef = doc(db, 'entries', entryId);
    await setDoc(rootDocRef, { title: trimmedTitle, updatedAt: Date.now() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, writePath);
  }
}

/**
 * Delete Journal Entry from Isolated User Collection
 */
export async function deleteJournalEntry(
  entryId: string,
  optionalUserId?: string
): Promise<void> {
  const currentAuthUid = auth.currentUser?.uid || getLocalGuestProfile()?.uid;
  const userId = optionalUserId || currentAuthUid;

  if (!userId) {
    throw new Error('Authentication required: Current user UID is missing for deletion.');
  }

  if (isGuestSession(userId) || !auth.currentUser) {
    const list = getLocalEntries(userId);
    const updated = list.filter((e) => e.id !== entryId);
    saveLocalEntries(userId, updated);
    return;
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

  // Handle local guest subscription with live storage and event synchronization
  if (isGuestSession(userId) || !auth.currentUser) {
    const emitLocal = () => {
      const entries = getLocalEntries(userId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onData(entries);
    };

    emitLocal();

    const handleCustomEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.userId === userId) {
        emitLocal();
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === `${GUEST_ENTRIES_STORAGE_KEY_PREFIX}${userId}`) {
        emitLocal();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('vault_entries_changed', handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('vault_entries_changed', handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
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
      const localEntries = getLocalEntries(userId);
      if (localEntries.length > 0) {
        onData(localEntries);
      }
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
  if (isGuestSession(userId) || !auth.currentUser) {
    return getLocalEntries(userId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
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
      return getLocalEntries(userId);
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
    const local = getLocalEntries(userId);
    if (local.length > 0) return local;
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}



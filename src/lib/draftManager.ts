import type { ChatMessage, JournalPersonaRole, ModelTier } from '../types';

export interface JournalDraft {
  id: string;
  userId: string;
  title: string;
  inputText: string;
  messages: ChatMessage[];
  selectedPersona: JournalPersonaRole;
  selectedModelTier: ModelTier;
  useSearchGrounding: boolean;
  lastUpdated: number;
}

const DRAFT_STORAGE_PREFIX = 'gemini_journal_draft_v1_';

/**
 * Get storage key scoped to current user UID to prevent cross-account draft leakage.
 */
function getDraftKey(userId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${userId || 'anonymous'}`;
}

/**
 * Save user journal draft to local storage with sanitization and error resilience.
 */
export function saveDraft(draft: JournalDraft): void {
  try {
    if (!draft.userId) return;
    const key = getDraftKey(draft.userId);
    // Only save if there's meaningful content
    const hasContent =
      (draft.messages && draft.messages.some((m) => m.role === 'user')) ||
      (draft.inputText && draft.inputText.trim().length > 0) ||
      (draft.title && draft.title.trim().length > 0);

    if (!hasContent) {
      clearDraft(draft.userId);
      return;
    }

    const payload = JSON.stringify({
      ...draft,
      lastUpdated: Date.now(),
    });
    localStorage.setItem(key, payload);
  } catch (err) {
    console.warn('[DraftManager] Failed to persist draft to storage:', err);
  }
}

/**
 * Retrieve active draft for specific user UID.
 */
export function getDraft(userId: string | null | undefined): JournalDraft | null {
  try {
    if (!userId) return null;
    const key = getDraftKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed: JournalDraft = JSON.parse(raw);
    if (parsed.userId !== userId) {
      return null;
    }

    // Verify draft has actual content
    const hasContent =
      (parsed.messages && parsed.messages.some((m) => m.role === 'user')) ||
      (parsed.inputText && parsed.inputText.trim().length > 0) ||
      (parsed.title && parsed.title.trim().length > 0);

    return hasContent ? parsed : null;
  } catch (err) {
    console.warn('[DraftManager] Error reading draft:', err);
    return null;
  }
}

/**
 * Remove draft for specific user UID after successful completion or explicit discard.
 */
export function clearDraft(userId: string | null | undefined): void {
  try {
    if (!userId) return;
    const key = getDraftKey(userId);
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('[DraftManager] Failed to clear draft:', err);
  }
}

/**
 * Helper to check if a user has an active draft.
 */
export function hasActiveDraft(userId: string | null | undefined): boolean {
  return Boolean(getDraft(userId));
}

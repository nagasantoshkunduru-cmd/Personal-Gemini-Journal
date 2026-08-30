import DOMPurify from 'dompurify';

/**
 * Sanitize text input to prevent XSS and strip harmful tags.
 */
export function sanitizeText(input: string): string {
  if (!input) return '';
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // Strip all HTML tags from journal inputs
    ALLOWED_ATTR: [],
  }).trim();
}

/**
 * Sanitize text for display while preserving safe formatting (paragraphs/line breaks)
 */
export function sanitizeForDisplay(input: string): string {
  if (!input) return '';
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote'],
    ALLOWED_ATTR: ['class'],
  });
}

/**
 * Format relative time or clean date
 */
export function formatDate(timestamp: number | string): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(timestamp: number | string): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Helper to get sentiment badge color styles
 */
export function getSentimentColor(sentiment: string) {
  switch (sentiment?.toLowerCase()) {
    case 'positive':
      return {
        badge: 'bg-[#4ADE8015] text-[#4ADE80] border-[#4ADE8030]',
        dot: 'bg-[#4ADE80]',
        text: 'text-[#4ADE80]',
        bg: 'bg-[#4ADE8010]',
      };
    case 'negative':
      return {
        badge: 'bg-[#F8717115] text-[#F87171] border-[#F8717130]',
        dot: 'bg-[#F87171]',
        text: 'text-[#F87171]',
        bg: 'bg-[#F8717110]',
      };
    case 'mixed':
      return {
        badge: 'bg-[#FBBF2415] text-[#FBBF24] border-[#FBBF2430]',
        dot: 'bg-[#FBBF24]',
        text: 'text-[#FBBF24]',
        bg: 'bg-[#FBBF2410]',
      };
    case 'neutral':
    default:
      return {
        badge: 'bg-[#161618] text-[#A0A0A0] border-[#2A2A2D]',
        dot: 'bg-[#808080]',
        text: 'text-[#A0A0A0]',
        bg: 'bg-[#161618]',
      };
  }
}

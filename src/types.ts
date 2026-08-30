export type SentimentType = 'Positive' | 'Neutral' | 'Negative' | 'Mixed';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: string;
  groundingSources?: GroundingSource[];
  modelUsed?: string;
  isVoiceTurn?: boolean;
}

export type JournalPersonaRole = 'socratic' | 'cbt_stoic' | 'creative_muse' | 'compassionate_listener';

export interface PersonaConfig {
  id: JournalPersonaRole;
  name: string;
  badge: string;
  tagline: string;
  description: string;
  systemInstruction: string;
}

export type ModelTier = 'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite';

export interface ModelOption {
  id: ModelTier;
  label: string;
  badge: string;
  description: string;
  speed: 'Ultra Fast' | 'Balanced' | 'Deep Reasoning';
}

export interface AISummaryData {
  summary: string;
  keyTakeaways: string[];
  gratitudeOrWins: string[];
  actionableSteps: string[];
  suggestedTitle?: string;
}

export interface AISentimentAndTags {
  sentiment: SentimentType;
  sentimentScore: number; // -1.0 to 1.0
  confidence: number; // 0 to 100
  tags: string[];
  emotionalEnergy: 'Low / Drained' | 'Calm / Grounded' | 'Moderate / Steady' | 'High / Energized' | string;
  primaryEmotion: string;
  reflectionPromptForTomorrow: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  dateString: string;
  rawTranscript: string;
  messages: ChatMessage[];
  summary: string;
  keyTakeaways: string[];
  gratitudeOrWins: string[];
  actionableSteps: string[];
  sentiment: SentimentType;
  sentimentScore: number;
  confidence: number;
  tags: string[];
  emotionalEnergy: string;
  primaryEmotion: string;
  reflectionPromptForTomorrow: string;
  wordCount: number;
  turnCount: number;
}

export interface JournalPrompt {
  id: string;
  title: string;
  description: string;
  starterText: string;
  category: 'Reflection' | 'Gratitude' | 'Resilience' | 'Clarity' | 'Future';
  iconName?: string;
}

export interface UserAuthProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

export interface FilterState {
  searchQuery: string;
  selectedTag: string | null;
  selectedSentiment: SentimentType | 'ALL';
  sortBy: 'newest' | 'oldest' | 'sentiment_high' | 'sentiment_low';
  dateRange: 'all' | '7days' | '30days' | 'this_year';
}

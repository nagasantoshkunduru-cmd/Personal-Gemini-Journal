import { Router, Request, Response } from 'express';
import {
  generateChatResponse,
  summarizeAndPrepareEntry,
  generateJournalPrompts,
  searchGroundedKnowledge,
  transcribeAudio,
  synthesizeSpeech,
  sanitizeInput,
} from './gemini';

export const apiRouter = Router();

// 1. Health Status: verifies local environment variable configuration and capabilities
apiRouter.get('/health', (req: Request, res: Response) => {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    envSource: 'Local .env (process.env.GEMINI_API_KEY)',
    capabilities: {
      liveVoiceAPI: 'gemini-3.1-flash-live-preview',
      searchGrounding: 'gemini-3.5-flash with googleSearch',
      tieredChatModels: [
        'gemini-3.1-pro-preview (Deep reasoning)',
        'gemini-3.5-flash (Balanced & Search)',
        'gemini-3.1-flash-lite (Ultra fast)',
      ],
      personas: ['socratic', 'cbt_stoic', 'creative_muse', 'compassionate_listener'],
      firestoreIsolatedScope: 'users/{userId}/entries/*',
      clientProxyEnforced: true,
      secretsClientExposed: false,
      geminiConfigured: hasGeminiKey,
    },
  });
});

/**
 * 2. POST /api/chat
 * Multi-turn chat interface supporting:
 * - Conversation history
 * - Role personas (system instructions)
 * - Model tiers (gemini-3.1-pro-preview, gemini-3.5-flash, gemini-3.1-flash-lite)
 * - Google Search Grounding with web citations
 */
apiRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, modelTier, personaRole, useSearchGrounding } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'A non-empty messages array is required.' });
    }

    const result = await generateChatResponse({
      messages,
      modelTier,
      personaRole,
      useSearchGrounding: Boolean(useSearchGrounding),
    });

    return res.json(result);
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    return res.status(500).json({
      error: error.message || 'Failed to process chat conversation.',
    });
  }
});

// Alias for backwards compatibility
apiRouter.post('/journal/chat', async (req: Request, res: Response) => {
  try {
    const { messages, modelTier, personaRole, useSearchGrounding } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'A non-empty messages array is required.' });
    }
    const result = await generateChatResponse({
      messages,
      modelTier,
      personaRole,
      useSearchGrounding: Boolean(useSearchGrounding),
    });
    return res.json(result);
  } catch (error: any) {
    console.error('Error in /api/journal/chat:', error);
    return res.status(500).json({
      error: error.message || 'Failed to process journal conversation.',
    });
  }
});

/**
 * 3. POST /api/search-grounding
 * Look up verified psychological research, mindfulness guides, or factual context via Google Search Grounding.
 */
apiRouter.post('/search-grounding', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'A valid search query is required.' });
    }

    const result = await searchGroundedKnowledge(query);
    return res.json(result);
  } catch (error: any) {
    console.error('Error in /api/search-grounding:', error);
    return res.status(500).json({
      error: error.message || 'Failed to perform grounded search.',
    });
  }
});

/**
 * 4. POST /api/voice/transcribe
 * Transcribe spoken voice input from the user.
 */
apiRouter.post('/voice/transcribe', async (req: Request, res: Response) => {
  try {
    const { audio, mimeType } = req.body;
    if (!audio || typeof audio !== 'string') {
      return res.status(400).json({ error: 'Base64 audio payload is required.' });
    }

    const transcription = await transcribeAudio(audio, mimeType || 'audio/webm');
    return res.json({ transcription });
  } catch (error: any) {
    console.error('Error in /api/voice/transcribe:', error);
    return res.status(500).json({
      error: error.message || 'Audio transcription failed.',
    });
  }
});

/**
 * 5. POST /api/voice/speak
 * Synthesize soothing spoken reflection audio for the user.
 */
apiRouter.post('/voice/speak', async (req: Request, res: Response) => {
  try {
    const { text, voiceName } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for speech synthesis.' });
    }

    const audioBase64 = await synthesizeSpeech(text, voiceName || 'Zephyr');
    return res.json({ audio: audioBase64 });
  } catch (error: any) {
    console.error('Error in /api/voice/speak:', error);
    return res.status(500).json({
      error: error.message || 'Speech synthesis failed.',
    });
  }
});

/**
 * 6. POST /api/summarize-and-save
 * Automatically summarizes session history using Gemini and prepares it for Firestore storage.
 */
apiRouter.post('/summarize-and-save', async (req: Request, res: Response) => {
  try {
    const { transcript, title, messages } = req.body;

    let sessionTranscript = typeof transcript === 'string' ? transcript : '';

    if (!sessionTranscript && Array.isArray(messages)) {
      sessionTranscript = messages
        .filter((m: { id?: string; role?: string; content?: string }) => m.id !== 'welcome-msg' && m.content)
        .map((m: { role?: string; content?: string }) => `${m.role === 'user' ? 'Reflector' : 'Gemini Guide'}: ${m.content}`)
        .join('\n\n');
    }

    const cleanTranscript = sanitizeInput(sessionTranscript);
    if (!cleanTranscript) {
      return res.status(400).json({ error: 'Session transcript or messages are required.' });
    }

    const analysis = await summarizeAndPrepareEntry(cleanTranscript, title);
    const wordCount = cleanTranscript.split(/\s+/).filter(Boolean).length;
    const rawMessages = Array.isArray(messages) ? messages.filter((m: any) => m.id !== 'welcome-msg') : [];
    const turnCount = rawMessages.filter((m: any) => m.role === 'user').length || 1;

    const finalTitle = (title && typeof title === 'string' && title.trim()) || analysis.suggestedTitle || 'Reflective Journal Entry';

    const preparedDocument = {
      title: finalTitle,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      dateString: new Date().toISOString(),
      rawTranscript: cleanTranscript,
      messages: rawMessages,
      summary: analysis.summary,
      keyTakeaways: analysis.keyTakeaways,
      gratitudeOrWins: analysis.gratitudeOrWins,
      actionableSteps: analysis.actionableSteps,
      sentiment: analysis.sentiment,
      sentimentScore: analysis.sentimentScore,
      confidence: analysis.confidence,
      tags: analysis.tags,
      emotionalEnergy: analysis.emotionalEnergy,
      primaryEmotion: analysis.primaryEmotion,
      reflectionPromptForTomorrow: analysis.reflectionPromptForTomorrow,
      wordCount,
      turnCount,
    };

    return res.json({
      success: true,
      analysis,
      preparedDocument,
    });
  } catch (error: any) {
    console.error('Error in /api/summarize-and-save:', error);
    return res.status(500).json({
      error: error.message || 'Failed to synthesize and prepare journal entry.',
    });
  }
});

// Prompts Endpoint
apiRouter.post('/journal/prompts', async (req: Request, res: Response) => {
  try {
    const { category } = req.body;
    const prompts = await generateJournalPrompts(category || 'General Reflection');
    return res.json({ prompts });
  } catch (error: any) {
    console.error('Error in /api/journal/prompts:', error);
    return res.json({
      prompts: [
        {
          id: 'daily-clarity',
          title: 'Daily Unwinding & Clarity',
          description: 'Reflect on the high point, the tension point, and what you need right now.',
          starterText: 'Looking back on today, what surprised me most was...',
        },
        {
          id: 'gratitude-anchor',
          title: 'Gratitude & Inner Anchor',
          description: 'Acknowledge 3 small things that went well and why they matter.',
          starterText: 'Today I feel deeply grateful for...',
        },
      ],
    });
  }
});

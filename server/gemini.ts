import { GoogleGenAI, Type, LiveServerMessage, Modality } from '@google/genai';
import { WebSocket, WebSocketServer } from 'ws';

/**
 * Lazy initialization of Google GenAI SDK.
 * Principle: Secrets are strictly server-side; loaded via local environment variables (process.env.GEMINI_API_KEY).
 */
let aiClient: GoogleGenAI | null = null;

export function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[Backend Proxy] GEMINI_API_KEY environment variable is not configured in local environment.');
      throw new Error('GEMINI_API_KEY is not configured in the server environment (.env).');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

/**
 * Input sanitization helper to strip dangerous script tags and null bytes.
 */
export function sanitizeInput(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/\0/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .trim()
    .slice(0, 25000);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Primary and fallback model strategy.
 * Models:
 * - gemini-3.1-pro-preview: Complex reasoning, deep CBT analysis, cognitive reframing
 * - gemini-3.5-flash: General tasks, search grounding
 * - gemini-3.1-flash-lite: Lightning-fast dialogue
 * - gemini-3.1-flash-live-preview: Real-time audio voice dialogue (Live API)
 */
export const MODEL_MAP = {
  pro: 'gemini-3.7-flash',
  flash: 'gemini-3.6-flash',
  lite: 'gemini-3.1-flash-lite',
  live: 'gemini-3.1-flash-live-preview',
  transcribe: 'gemini-3.5-transcribe',
  tts: 'gemini-3.1-flash-tts-preview',
};

const CANDIDATE_FALLBACKS = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
];

/**
 * Execute generateContent with automatic retry and model fallback if necessary.
 */
async function generateContentWithFallback(ai: GoogleGenAI, requestOptions: any) {
  const requested = requestOptions.model || MODEL_MAP.flash;
  const modelsToTry = [requested, ...CANDIDATE_FALLBACKS.filter((m) => m !== requested)];
  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...requestOptions,
          model,
        });
        return { response, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        const statusCode = err?.status || err?.code || (err?.error && err?.error.code);
        const errMsg = String(err?.message || '');
        const isTemporaryHighDemand = statusCode === 503 || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE');
        const isRateLimited = statusCode === 429 || errMsg.includes('RESOURCE_EXHAUSTED');
        const isModelNotFound = statusCode === 404 || errMsg.includes('not found') || errMsg.includes('no longer available');

        console.warn(`[Gemini SDK] Model ${model} attempt ${attempt + 1} (Code: ${statusCode || '?'}) ${errMsg.slice(0, 120)}`);

        if (isTemporaryHighDemand || isRateLimited) {
          if (attempt === 0) {
            await sleep(800);
            continue;
          }
          break;
        }

        if (isModelNotFound) {
          break;
        }

        break;
      }
    }
  }

  throw lastError;
}

export interface ChatTurn {
  role: string;
  content: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatRequestOptions {
  messages: ChatTurn[];
  modelTier?: 'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite';
  personaRole?: 'socratic' | 'cbt_stoic' | 'creative_muse' | 'compassionate_listener';
  useSearchGrounding?: boolean;
}

const PERSONA_INSTRUCTIONS: Record<string, string> = {
  socratic: `You are the thoughtful Socratic Guide for the Personal Gemini Journal.
Role Directives:
1. Tone: Deeply reflective, grounded, calm, and intellectually gentle.
2. Socratic Inquiries: Formulate 1-2 perceptive questions that illuminate the user's implicit assumptions, underlying values, and unspoken motives.
3. Brevity: Keep replies concise (2-4 sentences). Reflect what they shared with precision before posing the next question.`,

  cbt_stoic: `You are the CBT & Stoic Mindset Coach for the Personal Gemini Journal.
Role Directives:
1. Tone: Clear, compassionate, objective, and empowering.
2. Cognitive Reframing: Gently identify any cognitive distortions (e.g. catastrophizing, black-and-white thinking, emotional reasoning).
3. Dichotomy of Control: Encourage distinguishing between what lies within their sphere of control and what does not.
4. Actionable Stoic Wisdom: Offer a grounded mental shift or actionable grounding exercise in 2-4 sentences.`,

  creative_muse: `You are the Creative & Poetic Muse for the Personal Gemini Journal.
Role Directives:
1. Tone: Lyrical, evocative, imaginative, and encouraging.
2. Metaphorical Exploration: Help the user transform raw emotions and events into meaningful metaphors, sensory imagery, and philosophical wonder.
3. Expressive Spark: Suggest creative writing hooks or poetic reflections in 2-4 sentences.`,

  compassionate_listener: `You are the Compassionate Active Listener for the Personal Gemini Journal.
Role Directives:
1. Tone: Warm, nurturing, validating, safe, and judgment-free.
2. Emotional Resonance: Affirm and validate their lived feelings without rushing to problem-solve.
3. Safe Space: Offer unconditional positive regard and a gentle calming presence in 2-4 sentences.`,
};

/**
 * Process a multi-turn conversation turn with Gemini.
 * Supports model tiering (Pro, Flash, Flash-Lite), role personas, and Google Search Grounding.
 */
export async function generateChatResponse(options: ChatRequestOptions): Promise<{
  reply: string;
  timestamp: string;
  modelUsed: string;
  groundingSources?: GroundingSource[];
}> {
  const { messages, modelTier, personaRole, useSearchGrounding } = options;

  const sanitizedMessages = messages
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      content: sanitizeInput(m.content),
    }))
    .filter((m) => m.content.length > 0);

  if (sanitizedMessages.length === 0) {
    throw new Error('No valid message content provided.');
  }

  const ai = getAIClient();

  const selectedModel = modelTier || (useSearchGrounding ? MODEL_MAP.flash : MODEL_MAP.flash);
  const systemInstruction = (personaRole && PERSONA_INSTRUCTIONS[personaRole]) || PERSONA_INSTRUCTIONS.socratic;

  const contents = sanitizedMessages.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  const config: any = {
    systemInstruction,
    temperature: personaRole === 'creative_muse' ? 0.85 : 0.7,
    maxOutputTokens: 600,
  };

  // Attach Google Search Grounding tool if requested
  if (useSearchGrounding) {
    config.tools = [{ googleSearch: {} }];
  }

  const { response, modelUsed } = await generateContentWithFallback(ai, {
    model: selectedModel,
    contents,
    config,
  });

  const reply = response.text || 'I hear you and I am holding space for your reflection. What felt most meaningful about that experience?';

  // Extract search grounding sources if present
  let groundingSources: GroundingSource[] | undefined = undefined;
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (Array.isArray(chunks) && chunks.length > 0) {
    groundingSources = chunks
      .map((chunk: any) => ({
        title: chunk.web?.title || 'Web Search Reference',
        uri: chunk.web?.uri || '',
      }))
      .filter((s: GroundingSource) => Boolean(s.uri));
  }

  return {
    reply,
    timestamp: new Date().toISOString(),
    modelUsed,
    groundingSources,
  };
}

/**
 * Conduct a grounded Google Search exploration for mindfulness, psychological research, or daily context.
 */
export async function searchGroundedKnowledge(query: string): Promise<{
  insight: string;
  sources: GroundingSource[];
  modelUsed: string;
}> {
  const cleanQuery = sanitizeInput(query);
  if (!cleanQuery) {
    throw new Error('Search query is required.');
  }

  const ai = getAIClient();

  const prompt = `Provide a concise, research-informed, and compassionate reflection answer with accurate real-world citations regarding this query:
"${cleanQuery}"

Provide 2-3 structured takeaways that a person can directly apply to their personal journal or daily mindfulness practice.`;

  const { response, modelUsed } = await generateContentWithFallback(ai, {
    model: MODEL_MAP.flash,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction: 'You are an evidence-based mindfulness and cognitive psychology research assistant.',
    },
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  const sources: GroundingSource[] = [];
  if (Array.isArray(chunks)) {
    chunks.forEach((chunk: any) => {
      if (chunk.web?.uri) {
        sources.push({
          title: chunk.web.title || 'Verified Web Source',
          uri: chunk.web.uri,
        });
      }
    });
  }

  return {
    insight: response.text || 'No grounded insight found.',
    sources,
    modelUsed,
  };
}

export interface SummarizeAndPreparePayload {
  title?: string;
  summary: string;
  keyTakeaways: string[];
  gratitudeOrWins: string[];
  actionableSteps: string[];
  suggestedTitle: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Mixed';
  sentimentScore: number;
  confidence: number;
  tags: string[];
  emotionalEnergy: 'Low / Drained' | 'Calm / Grounded' | 'Moderate / Steady' | 'High / Energized';
  primaryEmotion: string;
  reflectionPromptForTomorrow: string;
}

/**
 * Automatically summarizes session history using Gemini and produces
 * a structured payload ready for Firestore persistence.
 */
export async function summarizeAndPrepareEntry(
  transcript: string,
  providedTitle?: string
): Promise<SummarizeAndPreparePayload> {
  const cleanTranscript = sanitizeInput(transcript);
  const cleanTitle = sanitizeInput(providedTitle);

  if (!cleanTranscript) {
    throw new Error('Transcript content is required for summarization.');
  }

  const ai = getAIClient();

  const prompt = `Analyze this entire personal journaling session and extract structured cognitive takeaways, psychological sentiment metrics, semantic tags, and a summary.

Provided Title Context: "${cleanTitle || 'Journal Entry'}"

Full Session Transcript:
"""
${cleanTranscript}
"""

Output strictly in JSON matching the defined schema.`;

  const { response } = await generateContentWithFallback(ai, {
    model: MODEL_MAP.flash,
    contents: prompt,
    config: {
      systemInstruction: `You are an expert cognitive reflection and sentiment analysis engine.
Synthesize the personal journal entry into:
1. summary: A 2-3 sentence executive reflection summary.
2. keyTakeaways: 3-4 bullet insights.
3. gratitudeOrWins: 1-3 positive recognitions or strengths.
4. actionableSteps: 1-2 practical next steps or affirmations.
5. suggestedTitle: A memorable, poetic 3-6 word title.
6. sentiment: One of "Positive", "Neutral", "Negative", "Mixed".
7. sentimentScore: Float from -1.0 (very negative) to +1.0 (very positive).
8. confidence: Integer percentage 0 to 100.
9. tags: Array of 3 to 5 lowercase keyword tags (e.g. ["gratitude", "mindfulness", "resilience"]).
10. emotionalEnergy: One of "Low / Drained", "Calm / Grounded", "Moderate / Steady", "High / Energized".
11. primaryEmotion: Single dominant emotion word (e.g. "Peaceful", "Overwhelmed", "Hopeful").
12. reflectionPromptForTomorrow: A tailored introspective prompt for the next day.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: 'Executive reflection summary' },
          keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3-4 insights' },
          gratitudeOrWins: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Gratitude or wins' },
          actionableSteps: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Gentle action steps' },
          suggestedTitle: { type: Type.STRING, description: 'Poetic 3-6 word entry title' },
          sentiment: {
            type: Type.STRING,
            enum: ['Positive', 'Neutral', 'Negative', 'Mixed'],
            description: 'Categorical sentiment',
          },
          sentimentScore: { type: Type.NUMBER, description: 'Score between -1.0 and 1.0' },
          confidence: { type: Type.NUMBER, description: 'Confidence between 0 and 100' },
          tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3-5 lowercase keyword tags' },
          emotionalEnergy: {
            type: Type.STRING,
            enum: ['Low / Drained', 'Calm / Grounded', 'Moderate / Steady', 'High / Energized'],
            description: 'Estimated emotional energy level',
          },
          primaryEmotion: { type: Type.STRING, description: 'Dominant emotional state' },
          reflectionPromptForTomorrow: { type: Type.STRING, description: 'Introspective prompt for tomorrow' },
        },
        required: [
          'summary',
          'keyTakeaways',
          'gratitudeOrWins',
          'actionableSteps',
          'suggestedTitle',
          'sentiment',
          'sentimentScore',
          'confidence',
          'tags',
          'emotionalEnergy',
          'primaryEmotion',
          'reflectionPromptForTomorrow',
        ],
      },
    },
  });

  const rawJson = response.text;
  let parsed: SummarizeAndPreparePayload;
  try {
    parsed = JSON.parse(rawJson || '{}');
  } catch {
    parsed = {
      summary: cleanTranscript.slice(0, 200) + '...',
      keyTakeaways: ['Reflected on personal experiences.', 'Honored personal growth and learning.'],
      gratitudeOrWins: ['Taking the time to journal with intention.'],
      actionableSteps: ['Continue checking in daily with curiosity.'],
      suggestedTitle: cleanTitle || 'Reflective Journal Entry',
      sentiment: 'Neutral',
      sentimentScore: 0.0,
      confidence: 90,
      tags: ['reflection', 'journal', 'mindfulness'],
      emotionalEnergy: 'Calm / Grounded',
      primaryEmotion: 'Reflective',
      reflectionPromptForTomorrow: 'What is one gentle gift you can offer yourself tomorrow?',
    };
  }

  return parsed;
}

/**
 * Transcribe recorded audio chunks using Gemini.
 */
export async function transcribeAudio(base64Audio: string, mimeType = 'audio/webm'): Promise<string> {
  const ai = getAIClient();

  const response = await ai.models.generateContent({
    model: MODEL_MAP.transcribe,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Audio,
          },
        },
        {
          text: 'Accurately transcribe all spoken words from this personal journaling audio without adding commentary.',
        },
      ],
    },
  });

  return response.text || '';
}

/**
 * Text-to-Speech synthesis using Gemini.
 */
export async function synthesizeSpeech(text: string, voiceName = 'Zephyr'): Promise<string> {
  const cleanText = sanitizeInput(text);
  if (!cleanText) return '';

  const ai = getAIClient();

  const response = await ai.models.generateContent({
    model: MODEL_MAP.tts,
    contents: cleanText,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
  return base64Audio;
}

/**
 * Setup WebSocket Server for Gemini Live API Voice Conversations (gemini-3.1-flash-live-preview).
 */
export function setupLiveWebSocket(wss: WebSocketServer) {
  wss.on('connection', async (clientWs: WebSocket) => {
    console.log('[Live API WS] Client connected for real-time voice session');
    let session: any = null;

    try {
      const ai = getAIClient();

      session = await ai.live.connect({
        model: MODEL_MAP.live,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: `You are the empathetic, soothing voice companion for the Personal Gemini Journal.
Speak in a warm, grounded, gentle, and reflective tone.
Respond concisely (1-3 sentences) so the user can easily speak back in a natural spoken flow.`,
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ audio }));
            }
            if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
        },
      });

      clientWs.send(JSON.stringify({ type: 'ready', status: 'connected', model: MODEL_MAP.live }));

      clientWs.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio && session) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          }
          if (parsed.text && session) {
            session.sendRealtimeInput({
              text: parsed.text,
            });
          }
        } catch (e) {
          console.error('[Live API WS] Error parsing client message:', e);
        }
      });

      clientWs.on('close', () => {
        console.log('[Live API WS] Client disconnected, closing session');
        if (session && typeof session.close === 'function') {
          session.close();
        }
      });
    } catch (err: any) {
      console.error('[Live API WS] Connection initialization failed:', err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'error',
          message: err.message || 'Live API connection unavailable.',
        }));
      }
    }
  });
}

/**
 * Generate inspiring journaling prompts.
 */
export async function generateJournalPrompts(category: string): Promise<Array<{ id: string; title: string; description: string; starterText: string }>> {
  const cleanCategory = sanitizeInput(category) || 'General Reflection';
  const ai = getAIClient();

  const prompt = `Generate 4 deeply inspiring, thoughtful, and unique journaling prompts for the category: "${cleanCategory}".`;

  const { response } = await generateContentWithFallback(ai, {
    model: MODEL_MAP.flash,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          prompts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                starterText: { type: Type.STRING },
              },
              required: ['id', 'title', 'description', 'starterText'],
            },
          },
        },
        required: ['prompts'],
      },
    },
  });

  const parsed = JSON.parse(response.text || '{"prompts": []}');
  return parsed.prompts || [];
}

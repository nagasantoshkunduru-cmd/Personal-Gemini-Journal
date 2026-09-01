import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  CheckCircle2,
  Brain,
  Shield,
  Loader2,
  RefreshCw,
  Compass,
  Smile,
  Tag,
  ArrowRight,
  MessageSquare,
  FileText,
  Save,
  HelpCircle,
  Lightbulb,
  X,
  Radio,
  Globe,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ExternalLink,
  ChevronDown,
  BookOpen,
  Feather,
  HeartHandshake
} from 'lucide-react';
import type {
  ChatMessage,
  JournalEntry,
  UserAuthProfile,
  AISummaryData,
  AISentimentAndTags,
  JournalPersonaRole,
  ModelTier,
  GroundingSource
} from '../types';
import { sanitizeText, getSentimentColor } from '../lib/sanitize';
import { saveJournalEntry } from '../lib/firebase';
import { VoiceStudioModal } from './VoiceStudioModal';
import { SearchGroundingModal } from './SearchGroundingModal';

interface JournalChatProps {
  currentUser: UserAuthProfile | null;
  onSessionSaved: (newEntryId: string) => void;
  onCancel: () => void;
  onRequireAuth?: () => void;
}

const PERSONAS: Array<{
  id: JournalPersonaRole;
  label: string;
  badge: string;
  tagline: string;
  icon: typeof Compass;
}> = [
  {
    id: 'socratic',
    label: 'Socratic Guide',
    badge: 'Inquiry',
    tagline: 'Illuminates core assumptions and introspective clarity',
    icon: Compass,
  },
  {
    id: 'cbt_stoic',
    label: 'CBT & Stoic Coach',
    badge: 'Resilience',
    tagline: 'Reframes cognitive distortions and dichotomy of control',
    icon: Brain,
  },
  {
    id: 'creative_muse',
    label: 'Creative Muse',
    badge: 'Expression',
    tagline: 'Evocative metaphors and poetic sensory imagery',
    icon: Feather,
  },
  {
    id: 'compassionate_listener',
    label: 'Compassionate Listener',
    badge: 'Validation',
    tagline: 'Warm holding space and unconditional empathy',
    icon: HeartHandshake,
  },
];

const MODEL_OPTIONS: Array<{
  id: ModelTier;
  name: string;
  badge: string;
  desc: string;
}> = [
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    badge: 'Primary & Grounding',
    desc: 'Empathetic reasoning, fast brainstorming, and Google Search Grounding support',
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'Deep Reasoning',
    desc: 'Complex introspective analysis and nuanced psychological reframing',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    badge: 'Ultra Fast',
    desc: 'Low-latency rapid turnaround for quick journaling notes',
  },
];

const DEFAULT_PROMPTS = [
  {
    title: 'Daily Unwinding & Wins',
    prompt: 'I want to unpack today: what went well, what tested my patience, and how I feel right now.',
    category: 'Reflection',
  },
  {
    title: 'Navigating a Tough Decision',
    prompt: 'I am wrestling with a challenging choice and need help thinking through my true values and options.',
    category: 'Clarity',
  },
  {
    title: 'Gratitude & Inner Anchor',
    prompt: 'Help me reflect on 3 moments of simple joy and gratitude that occurred today.',
    category: 'Gratitude',
  },
  {
    title: 'Processing Overwhelm',
    prompt: 'I feel a bit overwhelmed with competing demands. Help me break down my thoughts calmly.',
    category: 'Resilience',
  },
];

export function JournalChat({
  currentUser,
  onSessionSaved,
  onCancel,
  onRequireAuth,
}: JournalChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [selectedPersona, setSelectedPersona] = useState<JournalPersonaRole>('socratic');
  const [selectedModelTier, setSelectedModelTier] = useState<ModelTier>('gemini-3.6-flash');
  const [useSearchGrounding, setUseSearchGrounding] = useState<boolean>(false);
  const [isAiReplying, setIsAiReplying] = useState(false);
  const [isFinishingSession, setIsFinishingSession] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');

  // Modals
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState(false);
  const [isSearchGroundingOpen, setIsSearchGroundingOpen] = useState(false);

  // Audio Playback
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Direct Recording State
  const [isDirectRecording, setIsDirectRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiReplying]);

  // Initial welcome greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome-msg',
          role: 'model',
          content: `Welcome to your private journaling sanctuary. I'm your reflective companion, ready to hold safe, confidential space for your thoughts.

Select a persona or model tier above, choose a starter prompt, enable Google Search Grounding for evidence-based insight, or launch Live Voice Mode to speak naturally.`,
          timestamp: new Date().toISOString(),
          modelUsed: 'gemini-3.5-flash',
        },
      ]);
    }
  }, []);

  const handleSendMessage = async (customPrompt?: string) => {
    const rawContent = customPrompt || inputText;
    const cleanContent = sanitizeText(rawContent);

    if (!cleanContent || isAiReplying || isFinishingSession) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: cleanContent,
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputText('');
    setIsAiReplying(true);

    try {
      // Send request to server proxy with model selection, persona role, and search grounding flag
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.filter((m) => m.id !== 'welcome-msg'),
          modelTier: selectedModelTier,
          personaRole: selectedPersona,
          useSearchGrounding,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();

      const aiReplyMessage: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        content: data.reply || 'Thank you for sharing. What else is on your mind regarding this?',
        timestamp: data.timestamp || new Date().toISOString(),
        groundingSources: data.groundingSources,
        modelUsed: data.modelUsed || selectedModelTier,
      };

      setMessages((prev) => [...prev, aiReplyMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'model',
          content: "I'm experiencing a brief pause. Please take a deep breath and share your thought again in a moment.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsAiReplying(false);
    }
  };

  // Play spoken TTS audio of model response
  const handlePlayVoice = async (messageId: string, text: string) => {
    try {
      if (playingMessageId === messageId && audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        setPlayingMessageId(null);
        return;
      }

      setPlayingMessageId(messageId);
      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceName: 'Zephyr' }),
      });

      if (!res.ok) throw new Error('Voice playback failed.');

      const { audio } = await res.json();
      if (!audio) throw new Error('No audio returned');

      const audioUrl = `data:audio/wav;base64,${audio}`;
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioUrl;
        audioPlayerRef.current.play();
        audioPlayerRef.current.onended = () => setPlayingMessageId(null);
      } else {
        const player = new Audio(audioUrl);
        audioPlayerRef.current = player;
        player.play();
        player.onended = () => setPlayingMessageId(null);
      }
    } catch (err) {
      console.error('TTS playback error:', err);
      setPlayingMessageId(null);
    }
  };

  // Quick microphone transcription
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(',')[1];
          try {
            const res = await fetch('/api/voice/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: base64Data, mimeType: 'audio/webm' }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.transcription) {
                setInputText((prev) => (prev ? `${prev} ${data.transcription}` : data.transcription));
              }
            }
          } catch (e) {
            console.error('Transcription error:', e);
          }
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsDirectRecording(true);
    } catch (e) {
      console.error('Microphone error:', e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isDirectRecording) {
      mediaRecorderRef.current.stop();
      setIsDirectRecording(false);
    }
  };

  const handleCompleteSession = async () => {
    if (!currentUser) {
      if (onRequireAuth) {
        onRequireAuth();
      } else {
        alert('Please sign in to save your reflections and write to the journal.');
      }
      return;
    }

    const userEntries = messages.filter((m) => m.role === 'user');
    if (userEntries.length === 0) {
      alert('Please share at least one reflection before completing the session.');
      return;
    }

    setIsFinishingSession(true);

    try {
      const transcript = messages
        .filter((m) => m.id !== 'welcome-msg')
        .map((m) => `${m.role === 'user' ? 'Reflector' : 'Gemini Guide'}: ${m.content}`)
        .join('\n\n');

      setProcessingStep('Synthesizing takeaways and psychological sentiment with Gemini...');
      const response = await fetch('/api/summarize-and-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          title: customTitle || 'Reflective Journal Session',
          messages: messages.filter((m) => m.id !== 'welcome-msg'),
        }),
      });

      if (!response.ok) {
        throw new Error(`Summarize proxy failed with status ${response.status}`);
      }

      const { preparedDocument } = await response.json();

      setProcessingStep('Persisting reflection to Cloud Firestore...');
      const targetUserId = currentUser.uid;
      const entryId = await saveJournalEntry(targetUserId, preparedDocument);

      setProcessingStep('Saved successfully!');
      setTimeout(() => {
        onSessionSaved(entryId);
      }, 600);
    } catch (err: any) {
      console.error('Failed to finalize session:', err);
      alert('Error finalizing session: ' + (err.message || 'Please check your connection.'));
      setIsFinishingSession(false);
    }
  };

  const userMessagesCount = messages.filter((m) => m.role === 'user').length;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
      {/* Session Container */}
      <div className="bg-[#0E0E10] border border-[#1E1E20] rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-130px)] min-h-[620px]">
        {/* Header Bar */}
        <div className="px-6 py-3.5 border-b border-[#1E1E20] bg-[#0A0A0B] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#9B72F3] flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <input
                id="session-title-input"
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Session Title (or let Gemini name it)"
                className="font-bold text-sm sm:text-base text-white bg-transparent border-b border-transparent hover:border-[#2A2A2D] focus:border-[#4285F4] focus:outline-hidden px-1 py-0.5 rounded transition w-52 sm:w-72"
              />
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#606060] font-bold mt-0.5">
                <span className="flex items-center gap-1 text-[#4ADE80]">
                  <Shield className="w-3 h-3" /> End-to-End Isolated
                </span>
                <span>•</span>
                <span>{userMessagesCount} reflections logged</span>
              </div>
            </div>
          </div>

          {/* Quick Action Tools: Live Voice Studio & Grounded Search Explorer */}
          <div className="flex items-center gap-2">
            <button
              id="open-live-voice-btn"
              onClick={() => setIsVoiceStudioOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161618] hover:bg-[#1E1E20] border border-[#2A2A2D] hover:border-[#4285F4] text-xs font-semibold text-[#E0E0E0] shadow-xs transition"
              title="Open Gemini Live Voice Conversation Studio"
            >
              <Radio className="w-3.5 h-3.5 text-[#4ADE80] animate-pulse" />
              <span className="hidden sm:inline">Live Voice</span>
            </button>

            <button
              id="open-search-grounding-btn"
              onClick={() => setIsSearchGroundingOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161618] hover:bg-[#1E1E20] border border-[#2A2A2D] hover:border-[#4285F4] text-xs font-semibold text-[#E0E0E0] shadow-xs transition"
              title="Explore Google Search Grounded Research"
            >
              <Globe className="w-3.5 h-3.5 text-[#4285F4]" />
              <span className="hidden sm:inline">Search Insight</span>
            </button>

            <button
              id="cancel-session-btn"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-[#808080] hover:text-[#E0E0E0] hover:bg-[#161618] rounded-xl transition"
            >
              Discard
            </button>

            <button
              id="complete-session-btn"
              onClick={handleCompleteSession}
              disabled={isFinishingSession || userMessagesCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#4285F4] hover:bg-[#3367D6] text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              {isFinishingSession ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Save & Summarize
                </>
              )}
            </button>
          </div>
        </div>

        {/* Persona Role Selection & Model Tier Toolbar */}
        <div className="px-6 py-2.5 bg-[#121214] border-b border-[#1E1E20] flex items-center justify-between flex-wrap gap-2 text-xs">
          {/* Persona Selection */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[10px] uppercase tracking-wider text-[#707070] font-bold mr-1 shrink-0">
              Persona:
            </span>
            {PERSONAS.map((p) => {
              const IconComp = p.icon;
              const isSelected = selectedPersona === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPersona(p.id)}
                  title={p.tagline}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition shrink-0 ${
                    isSelected
                      ? 'bg-[#2A2A2D] text-white font-bold border border-[#3A3A3D]'
                      : 'text-[#808080] hover:text-[#C0C0C0] hover:bg-[#161618]'
                  }`}
                >
                  <IconComp className={`w-3 h-3 ${isSelected ? 'text-[#4285F4]' : 'text-[#808080]'}`} />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Model Tier Selector & Search Grounding Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search Grounding Toggle */}
            <button
              onClick={() => setUseSearchGrounding(!useSearchGrounding)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
                useSearchGrounding
                  ? 'bg-[#1A2838] text-[#4285F4] border-[#224060]'
                  : 'bg-[#161618] text-[#808080] border-[#2A2A2D] hover:text-white'
              }`}
              title="Ground chat turns with real-time Google Search information"
            >
              <Globe className="w-3 h-3" />
              <span>Search Grounding</span>
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  useSearchGrounding ? 'bg-[#4285F4]' : 'bg-[#404040]'
                }`}
              />
            </button>

            {/* Model Tier Dropdown */}
            <div className="relative">
              <select
                value={selectedModelTier}
                onChange={(e) => setSelectedModelTier(e.target.value as ModelTier)}
                className="bg-[#161618] text-[#C0C0C0] border border-[#2A2A2D] rounded-lg px-2.5 py-1 text-[11px] font-mono focus:outline-hidden focus:border-[#4285F4] cursor-pointer"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.badge})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Processing State Banner */}
        {isFinishingSession && (
          <div className="bg-[#1A2530] border-b border-[#223B50] px-6 py-2.5 flex items-center gap-3 animate-in fade-in">
            <Loader2 className="w-4 h-4 text-[#4285F4] animate-spin shrink-0" />
            <span className="text-xs font-medium text-[#4285F4]">
              {processingStep || 'Processing conversation with Gemini AI...'}
            </span>
          </div>
        )}

        {/* Unauthenticated Mode Warning */}
        {!currentUser && (
          <div className="bg-[#1C160E] border-b border-[#3E2D18] px-6 py-2 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 text-[#FBBF24]">
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              <span>You are writing in guest reflection mode. Sign in to save this session to your journal.</span>
            </div>
            {onRequireAuth && (
              <button
                onClick={onRequireAuth}
                className="px-2.5 py-1 bg-[#FBBF24] hover:bg-[#F59E0B] text-black font-bold rounded-lg text-[11px] transition cursor-pointer"
              >
                Sign In to Save
              </button>
            )}
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0E0E10]">
          {messages.map((message) => {
            const isUser = message.role === 'user';
            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4285F4] to-[#9B72F3] text-white flex items-center justify-center shrink-0 mt-1 text-[10px] font-bold shadow-sm">
                    G
                  </div>
                )}

                <div
                  className={`max-w-xl text-sm leading-relaxed p-4 ${
                    isUser
                      ? 'bg-[#1E1E20] text-[#E0E0E0] rounded-2xl rounded-tr-none border border-[#2A2A2D]'
                      : 'bg-[#0A0A0B] text-[#C0C0C0] rounded-2xl rounded-tl-none border border-[#1E1E20] shadow-xl'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>

                  {/* Grounding Citations */}
                  {message.groundingSources && message.groundingSources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#1E1E20] space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-[#808080] font-bold flex items-center gap-1">
                        <Globe className="w-3 h-3 text-[#4285F4]" /> Grounded Sources
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {message.groundingSources.map((src, i) => (
                          <a
                            key={i}
                            href={src.uri}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#161618] border border-[#2A2A2D] hover:border-[#4285F4] text-[10px] text-[#A0A0A0] hover:text-white transition"
                          >
                            <ExternalLink className="w-2.5 h-2.5 text-[#4285F4]" />
                            <span className="max-w-[160px] truncate">{src.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Model & Audio Controls on Assistant Message */}
                  {!isUser && message.id !== 'welcome-msg' && (
                    <div className="mt-2.5 pt-2 border-t border-[#1E1E20]/50 flex items-center justify-between text-[10px] text-[#606060]">
                      <span className="font-mono">
                        {message.modelUsed || selectedModelTier}
                      </span>
                      <button
                        onClick={() => handlePlayVoice(message.id, message.content)}
                        className="flex items-center gap-1 hover:text-[#4285F4] transition"
                        title="Listen to reflection spoken with Gemini TTS"
                      >
                        {playingMessageId === message.id ? (
                          <>
                            <VolumeX className="w-3 h-3 text-[#F87171]" />
                            <span>Stop Audio</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3" />
                            <span>Listen</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded bg-[#2A2A2D] text-[#4285F4] flex items-center justify-center shrink-0 mt-1 font-bold text-xs">
                    You
                  </div>
                )}
              </div>
            );
          })}

          {/* AI Thinking Animation */}
          {isAiReplying && (
            <div className="flex gap-3 justify-start animate-in fade-in">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4285F4] to-[#9B72F3] text-white flex items-center justify-center shrink-0 mt-1 text-[10px] font-bold shadow-sm">
                G
              </div>
              <div className="bg-[#0A0A0B] border border-[#1E1E20] rounded-2xl p-4 text-xs text-[#808080] flex items-center gap-2 shadow-lg">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4285F4]" />
                <span>
                  {useSearchGrounding
                    ? 'Gemini is querying Google Search and reflecting...'
                    : `Gemini (${selectedPersona}) is reflecting on your words...`}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Starter Prompts */}
        {userMessagesCount < 2 && (
          <div className="px-6 py-2.5 bg-[#0A0A0B] border-t border-[#1E1E20]">
            <p className="text-[10px] uppercase tracking-widest text-[#606060] font-bold mb-1.5 flex items-center gap-1">
              <Lightbulb className="w-3 h-3 text-[#4285F4]" /> Starter Prompts
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1.5">
              {DEFAULT_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(p.prompt)}
                  className="whitespace-nowrap px-3 py-1.5 bg-[#161618] hover:bg-[#1E1E20] text-[#A0A0A0] hover:text-[#E0E0E0] text-xs rounded-xl border border-[#2A2A2D] hover:border-[#3A3A3D] transition shrink-0 shadow-xs"
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 sm:p-6 bg-[#0A0A0B] border-t border-[#1E1E20]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            {/* Quick Mic Dictate Button */}
            <button
              type="button"
              onClick={isDirectRecording ? stopRecording : startRecording}
              className={`p-3.5 rounded-xl border transition flex items-center justify-center shrink-0 ${
                isDirectRecording
                  ? 'bg-[#F8717120] text-[#F87171] border-[#F8717140] animate-pulse'
                  : 'bg-[#161618] text-[#808080] hover:text-white border-[#2A2A2D] hover:border-[#3A3A3D]'
              }`}
              title={isDirectRecording ? 'Stop dictation' : 'Click to dictate reflection with voice'}
            >
              {isDirectRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <div className="flex-1 bg-[#161618] border border-[#2A2A2D] rounded-xl p-3 focus-within:border-[#4285F4] transition">
              <textarea
                id="journal-chat-input"
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  isDirectRecording
                    ? 'Listening to your voice dictation...'
                    : 'Share your thoughts, feelings, or events from today... (Shift+Enter for newline)'
                }
                className="w-full bg-transparent resize-none text-sm text-[#E0E0E0] placeholder-[#606060] focus:outline-hidden"
              />
              <div className="flex items-center justify-between pt-1 text-[10px] uppercase tracking-wider text-[#606060]">
                <span>
                  {useSearchGrounding ? 'Google Search Grounding Enabled' : 'Sanitized & Isolated Vault'}
                </span>
                <span className="font-mono">CMD+ENTER</span>
              </div>
            </div>

            <button
              id="journal-send-btn"
              type="submit"
              disabled={!inputText.trim() || isAiReplying || isFinishingSession}
              className="p-3.5 sm:p-4 bg-[#4285F4] hover:bg-[#3367D6] text-white rounded-xl shadow-sm transition disabled:opacity-40 shrink-0 flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Voice Studio Modal (Gemini Live API Voice Conversations) */}
      <VoiceStudioModal
        isOpen={isVoiceStudioOpen}
        onClose={() => setIsVoiceStudioOpen(false)}
        onApplyVoiceTurns={(newTurns) => {
          if (newTurns.length > 0) {
            setMessages((prev) => [...prev, ...newTurns]);
          }
        }}
      />

      {/* Search Grounding Modal (Explore Mindful Research) */}
      <SearchGroundingModal
        isOpen={isSearchGroundingOpen}
        onClose={() => setIsSearchGroundingOpen(false)}
        onInsertGroundedContext={(text, sources) => {
          handleSendMessage(text);
        }}
      />
    </div>
  );
}

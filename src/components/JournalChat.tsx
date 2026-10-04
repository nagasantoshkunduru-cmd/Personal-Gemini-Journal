import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Check,
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
  AlertCircle,
  FileText,
  Save,
  Trash2,
  HelpCircle,
  Lightbulb,
  X,
  Radio,
  Globe,
  Mic,
  MicOff,
  Pause,
  Play,
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
import { saveJournalEntry, getEmailNameFallback } from '../lib/firebase';
import { playPcm24kAudio, stopGlobalAudio, getSharedTtsAnalyser } from '../lib/audioUtils';
import { saveDraft, getDraft, clearDraft } from '../lib/draftManager';
import { VoiceStudioModal } from './VoiceStudioModal';
import { SearchGroundingModal } from './SearchGroundingModal';
import { AudioVisualizer } from './AudioVisualizer';

interface JournalChatProps {
  currentUser: UserAuthProfile | null;
  sessionTitle?: string;
  onSessionTitleChange?: (title: string) => void;
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
  sessionTitle = '',
  onSessionTitleChange,
  onSessionSaved,
  onCancel,
  onRequireAuth,
}: JournalChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [customTitle, setCustomTitle] = useState(sessionTitle || '');
  const [selectedPersona, setSelectedPersona] = useState<JournalPersonaRole>('socratic');
  const [selectedModelTier, setSelectedModelTier] = useState<ModelTier>('gemini-3.6-flash');
  const [useSearchGrounding, setUseSearchGrounding] = useState<boolean>(false);
  const [isAiReplying, setIsAiReplying] = useState(false);
  const [isFinishingSession, setIsFinishingSession] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Modals
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState(false);
  const [isSearchGroundingOpen, setIsSearchGroundingOpen] = useState(false);

  // Audio Playback
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [loadingAudioMessageId, setLoadingAudioMessageId] = useState<string | null>(null);
  const audioAbortControllerRef = useRef<AbortController | null>(null);

  // Direct Recording State & Controls
  const [isDirectRecording, setIsDirectRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micAnalyser, setMicAnalyser] = useState<AnalyserNode | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const isCancelledRef = useRef<boolean>(false);
  const preRecordingTextRef = useRef<string>('');
  const isDirectRecordingRef = useRef<boolean>(false);

  // Persistent Cumulative Transcription & Silence Detection Refs
  const cumulativeFinalTextRef = useRef<string>('');
  const currentInstanceFinalRef = useRef<string>('');
  const hasSpokenRef = useRef<boolean>(false);
  const lastSpeechTimeRef = useRef<number>(0);
  const silenceIntervalRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Stop audio playback, recording, and cancel active fetches on unmount
  useEffect(() => {
    return () => {
      if (audioAbortControllerRef.current) {
        audioAbortControllerRef.current.abort();
        audioAbortControllerRef.current = null;
      }
      stopGlobalAudio();

      if (silenceIntervalRef.current) {
        window.clearInterval(silenceIntervalRef.current);
        silenceIntervalRef.current = null;
      }

      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch {}
        speechRecognitionRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
        mediaRecorderRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch {}
        audioContextRef.current = null;
      }
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiReplying]);

  // Keep customTitle synchronized with sessionTitle from Navbar
  useEffect(() => {
    if (sessionTitle !== undefined && sessionTitle !== customTitle) {
      setCustomTitle(sessionTitle);
    }
  }, [sessionTitle]);

  // Initial welcome greeting OR draft restoration
  useEffect(() => {
    if (!currentUser?.uid) return;

    const existingDraft = getDraft(currentUser.uid);
    if (existingDraft && (existingDraft.messages?.length > 0 || existingDraft.inputText || existingDraft.title)) {
      setMessages(existingDraft.messages || []);
      setInputText(existingDraft.inputText || '');
      setCustomTitle(existingDraft.title || '');
      if (existingDraft.title && onSessionTitleChange) {
        onSessionTitleChange(existingDraft.title);
      }
      if (existingDraft.selectedPersona) setSelectedPersona(existingDraft.selectedPersona);
      if (existingDraft.selectedModelTier) setSelectedModelTier(existingDraft.selectedModelTier);
      if (typeof existingDraft.useSearchGrounding === 'boolean') {
        setUseSearchGrounding(existingDraft.useSearchGrounding);
      }
      setDraftStatus('Draft restored');
      return;
    }

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
  }, [currentUser?.uid]);

  // Real-time draft auto-saving whenever content changes
  useEffect(() => {
    if (!currentUser?.uid || isFinishingSession) return;

    const hasUserContributions =
      messages.some((m) => m.role === 'user') ||
      inputText.trim().length > 0 ||
      customTitle.trim().length > 0;

    if (hasUserContributions) {
      saveDraft({
        id: `draft_${currentUser.uid}`,
        userId: currentUser.uid,
        title: customTitle,
        inputText,
        messages,
        selectedPersona,
        selectedModelTier,
        useSearchGrounding,
        lastUpdated: Date.now(),
      });
      setDraftStatus('Draft autosaved');
    }
  }, [
    messages,
    inputText,
    customTitle,
    selectedPersona,
    selectedModelTier,
    useSearchGrounding,
    currentUser?.uid,
    isFinishingSession,
  ]);

  const handleSendMessage = async (customPrompt?: string) => {
    if (!currentUser || currentUser.isAnonymous) {
      onRequireAuth?.();
      return;
    }

    // If submitting while recording was active, cleanly finalize recording
    if (silenceIntervalRef.current) {
      window.clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
    setSilenceCountdown(null);
    hasSpokenRef.current = false;

    if (isDirectRecordingRef.current) {
      stopRecording();
    }

    const rawContent = customPrompt || inputText || liveTranscript;
    const cleanContent = sanitizeText(rawContent);

    cumulativeFinalTextRef.current = '';
    currentInstanceFinalRef.current = '';

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
    setLiveTranscript('');
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

  // Play spoken TTS audio of model response using reliable Web Audio API
  const handlePlayVoice = async (messageId: string, text: string) => {
    // 1. If this message is currently playing OR currently buffering/loading, cancel & stop immediately
    if (playingMessageId === messageId || loadingAudioMessageId === messageId) {
      if (audioAbortControllerRef.current) {
        audioAbortControllerRef.current.abort();
        audioAbortControllerRef.current = null;
      }
      stopGlobalAudio();
      setLoadingAudioMessageId(null);
      setPlayingMessageId(null);
      return;
    }

    // 2. If another message was playing or buffering, cancel that one first
    if (audioAbortControllerRef.current) {
      audioAbortControllerRef.current.abort();
      audioAbortControllerRef.current = null;
    }
    stopGlobalAudio();
    setPlayingMessageId(null);

    // 3. Create fresh AbortController for this fetch request
    const abortController = new AbortController();
    audioAbortControllerRef.current = abortController;
    setLoadingAudioMessageId(messageId);

    try {
      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceName: 'Zephyr' }),
        signal: abortController.signal,
      });

      // If aborted during network transit, stop immediately
      if (abortController.signal.aborted) {
        return;
      }

      if (!res.ok) throw new Error('Voice playback failed.');

      const { audio } = await res.json();

      // If aborted during payload parsing, stop immediately
      if (abortController.signal.aborted) {
        return;
      }

      if (!audio) throw new Error('No audio returned');

      // Audio data is ready: transition smoothly from buffering to playing
      setLoadingAudioMessageId(null);
      setPlayingMessageId(messageId);

      playPcm24kAudio(audio, () => {
        setPlayingMessageId((current) => (current === messageId ? null : current));
      });
    } catch (err: any) {
      // Ignore deliberate user cancellations
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        console.log(`[Audio TTS] Voice stream for ${messageId} halted by user.`);
      } else {
        console.error('TTS playback error:', err);
      }
      setLoadingAudioMessageId((current) => (current === messageId ? null : current));
      setPlayingMessageId((current) => (current === messageId ? null : current));
    } finally {
      if (audioAbortControllerRef.current === abortController) {
        audioAbortControllerRef.current = null;
      }
    }
  };

  // Quick microphone recording with real-time AnalyserNode, persistent cumulative transcription, and silence auto-submit
  const startRecording = async () => {
    try {
      setMicError(null);
      isCancelledRef.current = false;
      preRecordingTextRef.current = inputText;

      // Initialize persistent cumulative accumulation
      // Any text already in the input is preserved at the beginning of the cumulative buffer
      cumulativeFinalTextRef.current = inputText ? `${inputText.trim()} ` : '';
      currentInstanceFinalRef.current = '';
      hasSpokenRef.current = false;
      lastSpeechTimeRef.current = Date.now();
      setSilenceCountdown(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      // 1. Initialize Web Audio API AnalyserNode for exact real-time frequency visualizer & silence monitoring
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // 32 frequency bins
      analyser.smoothingTimeConstant = 0.75;
      analyser.minDecibels = -85;
      analyser.maxDecibels = -10;

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;
      sourceNode.connect(analyser);
      // NOTE: sourceNode is NOT connected to audioCtx.destination to prevent microphone feedback loop

      setMicAnalyser(analyser);
      micAnalyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (isCancelledRef.current) {
          return; // Discarded by user
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 0) {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            if (isCancelledRef.current) return;
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
                  const serverText = data.transcription.trim();
                  setInputText((prev) => {
                    if (!prev.trim()) return serverText;
                    return prev;
                  });
                }
              }
            } catch (e) {
              console.error('Transcription fallback error:', e);
            }
          };
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      // 2. Persistent Live Transcription Engine (Cumulative Accumulation)
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let sessionFinal = '';
            let sessionInterim = '';

            for (let i = 0; i < event.results.length; ++i) {
              const res = event.results[i];
              const transcript = res[0]?.transcript || '';
              if (res.isFinal) {
                sessionFinal += transcript + ' ';
              } else {
                sessionInterim += transcript;
              }
            }

            currentInstanceFinalRef.current = sessionFinal;

            // Persistent Cumulative Assembly: Prior confirmed sentences + current session final + current interim
            const fullCombinedText = `${cumulativeFinalTextRef.current}${sessionFinal}${sessionInterim}`.trim();
            if (fullCombinedText) {
              setLiveTranscript(fullCombinedText);
              setInputText(fullCombinedText);
              hasSpokenRef.current = true;
              lastSpeechTimeRef.current = Date.now();
              setSilenceCountdown(null);
            }
          };

          recognition.onerror = (err: any) => {
            console.warn('[SpeechRecognition] warning:', err.error);
          };

          recognition.onend = () => {
            if (isDirectRecordingRef.current && !isCancelledRef.current) {
              // Permanently commit completed instance finals into the cumulative buffer before restarting
              if (currentInstanceFinalRef.current) {
                cumulativeFinalTextRef.current = `${cumulativeFinalTextRef.current}${currentInstanceFinalRef.current}`.trim() + ' ';
                currentInstanceFinalRef.current = '';
              }
              try {
                recognition.start();
              } catch {}
            }
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (err) {
          console.warn('[SpeechRecognition] could not start:', err);
        }
      }

      // 3. Silence Detection Loop (Auto-submit after 3 consecutive seconds of silence following speech)
      if (silenceIntervalRef.current) {
        window.clearInterval(silenceIntervalRef.current);
      }

      silenceIntervalRef.current = window.setInterval(() => {
        if (!isDirectRecordingRef.current || isCancelledRef.current) return;

        const activeAnalyser = micAnalyserRef.current;
        if (!activeAnalyser) return;

        const binCount = activeAnalyser.frequencyBinCount;
        const freqData = new Uint8Array(binCount);
        activeAnalyser.getByteFrequencyData(freqData);

        let energySum = 0;
        for (let i = 0; i < binCount; i++) {
          energySum += freqData[i];
        }
        const avgEnergy = energySum / binCount;
        const now = Date.now();

        // Speech volume threshold (voice speech produces higher energy than room noise)
        const SPEECH_ENERGY_THRESHOLD = 14;

        if (avgEnergy >= SPEECH_ENERGY_THRESHOLD) {
          // User is actively speaking
          lastSpeechTimeRef.current = now;
          hasSpokenRef.current = true;
          setSilenceCountdown(null);
        } else if (hasSpokenRef.current) {
          // User has spoken and is now silent
          const currentText = `${cumulativeFinalTextRef.current}${currentInstanceFinalRef.current}`.trim();
          if (currentText.length > 0) {
            const silenceMs = now - lastSpeechTimeRef.current;
            if (silenceMs >= 3000) {
              // 3 seconds of silence reached -> Trigger auto-submit!
              if (silenceIntervalRef.current) {
                window.clearInterval(silenceIntervalRef.current);
                silenceIntervalRef.current = null;
              }
              setSilenceCountdown(null);
              handleSendMessage();
            } else if (silenceMs >= 1000) {
              // Display countdown for remaining seconds
              const remainingSecs = Math.max(1, Math.ceil((3000 - silenceMs) / 1000));
              setSilenceCountdown(remainingSecs);
            } else {
              setSilenceCountdown(null);
            }
          }
        }
      }, 100);

      mediaRecorder.start();
      setIsDirectRecording(true);
      isDirectRecordingRef.current = true;
      setLiveTranscript('');
    } catch (e: any) {
      console.error('Microphone error:', e);
      let errorMsg = 'Could not access the microphone.';
      if (
        e.name === 'NotAllowedError' ||
        e.name === 'PermissionDeniedError' ||
        e.message?.includes('denied')
      ) {
        errorMsg =
          'Microphone permission denied. Please allow microphone access in your browser settings, or open this app in a separate tab if inside an iframe.';
      } else {
        errorMsg = `Microphone error: ${e.message || e.name || 'Setup failed'}`;
      }
      setMicError(errorMsg);
    }
  };

  const cancelRecording = () => {
    isCancelledRef.current = true;
    if (silenceIntervalRef.current) {
      window.clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
    setSilenceCountdown(null);
    hasSpokenRef.current = false;
    cumulativeFinalTextRef.current = '';
    currentInstanceFinalRef.current = '';

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch {}
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setMicAnalyser(null);
    micAnalyserRef.current = null;
    audioChunksRef.current = [];
    setIsDirectRecording(false);
    isDirectRecordingRef.current = false;
    setLiveTranscript('');
    // Restore text that was present prior to recording
    setInputText(preRecordingTextRef.current);
  };

  const stopRecording = () => {
    if (silenceIntervalRef.current) {
      window.clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
    setSilenceCountdown(null);
    hasSpokenRef.current = false;

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setMicAnalyser(null);
    micAnalyserRef.current = null;
    setIsDirectRecording(false);
    isDirectRecordingRef.current = false;
  };

  const handleCompleteSession = async () => {
    if (!currentUser || currentUser.isAnonymous) {
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

      // Successfully saved to Cloud Firestore: clear active draft
      clearDraft(targetUserId);

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

  const handleExplicitDiscard = () => {
    if (currentUser?.uid) {
      clearDraft(currentUser.uid);
    }
    setShowDiscardConfirm(false);
    onCancel();
  };

  const userMessagesCount = messages.filter((m) => m.role === 'user').length;

  return (
    <div className="max-w-4xl mx-auto pt-1.5 sm:pt-2.5 pb-2 sm:pb-3 px-2 sm:px-4 md:px-6 relative flex-1 flex flex-col min-h-0 h-full w-full overflow-hidden">
      {/* Discard Draft Confirmation Modal */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-black border border-[#2A2A2D] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-[#F87171]">
              <div className="p-2.5 rounded-full bg-[#F8717120] border border-[#F8717140]">
                <X className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Discard Unsaved Draft?</h3>
                <p className="text-xs text-[#808080]">This will permanently erase your current reflection messages.</p>
              </div>
            </div>

            <div className="p-3 bg-black rounded-xl border border-[#222225] text-xs text-[#A0A0A0] leading-relaxed">
              If you wish to return later, click <strong>"Keep as Draft"</strong> and your writing will be waiting for you.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3.5 py-2 text-xs font-semibold text-[#A0A0A0] hover:text-white hover:bg-[#1E1E20] rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-3.5 py-2 text-xs font-semibold text-[#4285F4] bg-[#4285F415] hover:bg-[#4285F425] border border-[#4285F440] rounded-xl transition cursor-pointer"
              >
                Keep as Draft & Exit
              </button>
              <button
                type="button"
                onClick={handleExplicitDiscard}
                className="px-3.5 py-2 text-xs font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-xl transition cursor-pointer"
              >
                Discard Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Container */}
      <div className="bg-black border border-[#1E1E20] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col flex-1 min-h-0 h-full">
        {/* Header Bar with Streamlined Controls */}
        <div className="px-3 sm:px-4 py-2 border-b border-[#1E1E20] bg-black flex items-center justify-between gap-2 sm:gap-3 shrink-0 min-h-[46px]">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#9B72F3] flex items-center justify-center text-white shadow-xs shrink-0">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
              <span className="font-bold text-xs sm:text-sm text-white whitespace-nowrap">
                {userMessagesCount} {userMessagesCount === 1 ? 'reflection' : 'reflections'}
              </span>
              <span className="text-[#3A3A40] hidden sm:inline">•</span>
              <span
                id="journal-autosave-indicator"
                className="hidden sm:flex text-[#9E9EA5] items-center gap-1 text-[11px] font-medium bg-black border border-[#2A2A2D] px-2 py-0.5 rounded-md shrink-0 shadow-xs"
                title="Autosaved locally in real-time"
              >
                <Check className="w-3 h-3 text-[#4ADE80] shrink-0" />
                <span className="text-[#E0E0E0] font-medium">Auto-saved</span>
              </span>
            </div>
          </div>

          {/* Action Tools - Compact Icon Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Live Voice */}
            <button
              id="open-live-voice-btn"
              onClick={() => {
                if (!currentUser || currentUser.isAnonymous) {
                  onRequireAuth?.();
                } else {
                  setIsVoiceStudioOpen(true);
                }
              }}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-black hover:bg-white/[0.06] border border-[#2A2A2D] hover:border-[#4285F4] text-xs font-semibold text-[#E0E0E0] shadow-xs transition shrink-0 cursor-pointer flex items-center gap-1.5"
              title="Open Gemini Live Voice Conversation Studio"
              aria-label="Open Live Voice Studio"
            >
              <Radio className="w-3.5 h-3.5 text-[#4ADE80] animate-pulse shrink-0" />
              <span className="hidden md:inline">Voice</span>
            </button>

            {/* Search Grounding Insights */}
            <button
              id="open-search-grounding-btn"
              onClick={() => {
                if (!currentUser || currentUser.isAnonymous) {
                  onRequireAuth?.();
                } else {
                  setIsSearchGroundingOpen(true);
                }
              }}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-black hover:bg-white/[0.06] border border-[#2A2A2D] hover:border-[#4285F4] text-xs font-semibold text-[#E0E0E0] shadow-xs transition shrink-0 cursor-pointer flex items-center gap-1.5"
              title="Explore Google Search Grounded Research"
              aria-label="Explore Search Grounding"
            >
              <Globe className="w-3.5 h-3.5 text-[#4285F4] shrink-0" />
              <span className="hidden md:inline">Search</span>
            </button>

            {/* Keep Draft & Return */}
            <button
              id="keep-draft-exit-btn"
              onClick={onCancel}
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs text-[#A0A0A0] hover:text-white bg-black hover:bg-white/[0.06] border border-[#2A2A2D] rounded-xl transition shrink-0 cursor-pointer flex items-center gap-1.5 font-medium"
              title="Keep draft saved and return to timeline"
              aria-label="Keep draft and exit"
            >
              <Save className="w-3.5 h-3.5 text-[#A0A0A0] shrink-0" />
              <span className="hidden lg:inline">Keep Draft</span>
            </button>

            {/* Discard Draft */}
            <button
              id="cancel-session-btn"
              onClick={() => {
                if (userMessagesCount > 0 || inputText.trim() || customTitle.trim()) {
                  setShowDiscardConfirm(true);
                } else {
                  handleExplicitDiscard();
                }
              }}
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs text-[#808080] hover:text-[#F87171] bg-black hover:bg-[#F8717115] border border-[#2A2A2D] hover:border-[#F8717140] rounded-xl transition shrink-0 cursor-pointer flex items-center gap-1.5"
              title="Discard draft permanently"
              aria-label="Discard draft"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">Discard</span>
            </button>

            {/* Save & Summarize */}
            <button
              id="complete-session-btn"
              onClick={handleCompleteSession}
              disabled={isFinishingSession || userMessagesCount === 0}
              className="btn-primary-cta p-1.5 sm:px-3 sm:py-1.5 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 shrink-0 cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="Save & Summarize Reflection"
              aria-label="Save and summarize reflection"
            >
              {isFinishingSession ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-neutral-900" />
                  <span className="hidden sm:inline text-neutral-900">Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-neutral-900" />
                  <span className="hidden sm:inline text-neutral-900">Save</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Persona Role Selection & Model Tier Toolbar */}
        <div className="px-3 sm:px-4 py-1.5 bg-black border-b border-[#1E1E20] flex items-center justify-between gap-2 sm:gap-3 text-xs overflow-x-auto no-scrollbar shrink-0 min-h-[38px]">
          {/* Persona Selection */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-[#606060] font-bold mr-0.5 shrink-0 hidden sm:inline">
              Persona:
            </span>
            {PERSONAS.map((p) => {
              const IconComp = p.icon;
              const isSelected = selectedPersona === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (!currentUser || currentUser.isAnonymous) {
                      onRequireAuth?.();
                    } else {
                      setSelectedPersona(p.id);
                    }
                  }}
                  title={p.tagline}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-[#2A2A2D] text-white font-bold border border-[#3A3A3D]'
                      : 'text-[#808080] hover:text-[#C0C0C0] hover:bg-[#161618] border border-transparent'
                  }`}
                >
                  <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-[#4285F4]' : 'text-[#808080]'}`} />
                  <span className="whitespace-nowrap">{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Model Selector & Real-Time Search Grounding */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => {
                if (!currentUser || currentUser.isAnonymous) {
                  onRequireAuth?.();
                } else {
                  setUseSearchGrounding(!useSearchGrounding);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition shrink-0 cursor-pointer ${
                useSearchGrounding
                  ? 'bg-[#1A2838] text-[#4285F4] border-[#224060]'
                  : 'bg-[#161618] text-[#808080] border-[#2A2A2D] hover:text-white'
              }`}
              title="Ground chat turns with Google Search"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search Grounding</span>
              <span className="sm:hidden">Search</span>
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  useSearchGrounding ? 'bg-[#4285F4]' : 'bg-[#404040]'
                }`}
              />
            </button>

            <select
              value={selectedModelTier}
              onChange={(e) => {
                if (!currentUser || currentUser.isAnonymous) {
                  onRequireAuth?.();
                } else {
                  setSelectedModelTier(e.target.value as ModelTier);
                }
              }}
              className="bg-[#161618] text-[#C0C0C0] border border-[#2A2A2D] rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-hidden focus:border-[#4285F4] cursor-pointer shrink-0"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.badge}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Processing State Banner */}
        {isFinishingSession && (
          <div className="bg-[#1A2530] border-b border-[#223B50] px-4 sm:px-6 py-2 flex items-center gap-2 animate-in fade-in">
            <Loader2 className="w-3.5 h-3.5 text-[#4285F4] animate-spin shrink-0" />
            <span className="text-[11px] sm:text-xs font-medium text-[#4285F4] truncate">
              {processingStep || 'Processing conversation with Gemini AI...'}
            </span>
          </div>
        )}

        {/* Unauthenticated Mode Warning */}
        {!currentUser && (
          <div className="bg-[#1C160E] border-b border-[#3E2D18] px-3 sm:px-6 py-1.5 flex items-center justify-between gap-2 text-[11px] sm:text-xs">
            <div className="flex items-center gap-1.5 text-[#FBBF24] truncate">
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Guest mode: sign in to save your entries permanently.</span>
            </div>
            {onRequireAuth && (
              <button
                onClick={onRequireAuth}
                className="px-2 py-0.5 bg-[#FBBF24] hover:bg-[#F59E0B] text-black font-bold rounded text-[10px] transition shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3.5 sm:space-y-4 bg-black">
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
                      : 'bg-black text-[#C0C0C0] rounded-2xl rounded-tl-none border border-[#1E1E20] shadow-xl'
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
                        id={`tts-btn-${message.id}`}
                        onClick={() => handlePlayVoice(message.id, message.content)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] transition cursor-pointer ${
                          loadingAudioMessageId === message.id
                            ? 'bg-[#4285F420] text-[#4285F4] border border-[#4285F440] hover:bg-[#F8717120] hover:text-[#F87171] hover:border-[#F8717140]'
                            : playingMessageId === message.id
                            ? 'bg-[#F8717120] text-[#F87171] border border-[#F8717140] hover:bg-[#F8717130]'
                            : 'hover:text-[#4285F4] hover:bg-[#161618] text-[#808080]'
                        }`}
                        title={
                          loadingAudioMessageId === message.id
                            ? 'Buffering audio — Click to Stop'
                            : playingMessageId === message.id
                            ? 'Stop Audio Playback'
                            : 'Listen to reflection spoken with Gemini TTS'
                        }
                      >
                        {loadingAudioMessageId === message.id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-[#4285F4] shrink-0" />
                            <span className="font-medium">Buffering...</span>
                            <span className="text-[9px] text-[#A0A0A0] hover:text-[#F87171]">(Stop)</span>
                          </>
                        ) : playingMessageId === message.id ? (
                          <>
                            <div className="scale-75 origin-left shrink-0">
                              <AudioVisualizer mode="tts" isActive={true} analyser={getSharedTtsAnalyser()} />
                            </div>
                            <VolumeX className="w-3.5 h-3.5 text-[#F87171] shrink-0 ml-1" />
                            <span className="font-semibold">Stop Audio</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3 shrink-0" />
                            <span>Listen</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div
                    className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#9B72F3] text-white flex items-center justify-center shrink-0 mt-1 font-bold text-xs shadow-xs border border-[#4285F4]/40"
                    title={currentUser?.displayName || getEmailNameFallback(currentUser?.email) || 'You'}
                  >
                    {currentUser?.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt="You"
                        referrerPolicy="no-referrer"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      (currentUser?.displayName || getEmailNameFallback(currentUser?.email) || 'U').charAt(0).toUpperCase()
                    )}
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
              <div className="bg-black border border-[#1E1E20] rounded-2xl p-4 text-xs text-[#808080] flex items-center gap-2 shadow-lg">
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

        {/* Suggested Starter Prompts - Compact on mobile */}
        {userMessagesCount < 2 && (
          <div className="px-3 sm:px-6 py-1.5 sm:py-2 bg-black border-t border-[#1E1E20]">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] uppercase tracking-widest text-[#606060] font-bold shrink-0 flex items-center gap-1">
                <Lightbulb className="w-3 h-3 text-[#4285F4]" />
                <span className="hidden sm:inline">Starters:</span>
              </span>
              {DEFAULT_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(p.prompt)}
                  className="whitespace-nowrap px-2.5 py-1 bg-black hover:bg-white/[0.06] text-[#A0A0A0] hover:text-[#E0E0E0] text-[11px] rounded-lg border border-[#2A2A2D] hover:border-[#3A3A3D] transition shrink-0 shadow-xs cursor-pointer"
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Compact Streamlined Input Toolbar (Stationary & Pinned) */}
        <div className="p-2 sm:p-3 bg-black border-t border-[#1E1E20] shrink-0">
          {playingMessageId && (
            <div className="mb-2.5 p-2.5 bg-[#0C1220] border border-[#1A2E50]/60 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#4285F4] animate-ping shrink-0" />
                <span className="text-xs font-semibold text-white">Gemini speaking aloud...</span>
              </div>
              <div className="flex-1 flex justify-center scale-90">
                <AudioVisualizer mode="tts" isActive={true} analyser={getSharedTtsAnalyser()} />
              </div>
              <button
                type="button"
                onClick={() => {
                  stopGlobalAudio();
                  setPlayingMessageId(null);
                }}
                className="px-2.5 py-1 text-[10px] text-[#A0A0A0] hover:text-white bg-white/[0.05] hover:bg-white/[0.1] rounded-lg transition font-medium cursor-pointer"
              >
                Stop
              </button>
            </div>
          )}

          {micError && (
            <div className="mb-2.5 p-3 bg-[#1A1010] border border-[#3A2020] text-[#F87171] text-xs rounded-xl flex items-start justify-between gap-2.5 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#F87171] shrink-0 mt-0.5" />
                <span className="leading-relaxed">{micError}</span>
              </div>
              <button
                type="button"
                onClick={() => setMicError(null)}
                className="p-1 hover:bg-white/[0.05] rounded-lg text-[#808080] hover:text-white transition shrink-0 cursor-pointer"
                title="Dismiss error message"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-1.5 sm:gap-2 bg-black border border-[#2A2A2D] rounded-2xl p-1.5 sm:p-2 focus-within:border-[#4285F4] transition shadow-inner"
          >
            {/* Quick Mic Dictate Button */}
            <button
              type="button"
              onClick={isDirectRecording ? stopRecording : startRecording}
              className={`p-2 sm:p-2.5 rounded-xl border transition flex items-center justify-center shrink-0 cursor-pointer ${
                isDirectRecording
                  ? 'bg-[#F8717120] text-[#F87171] border-[#F8717140] animate-pulse'
                  : 'bg-black text-[#808080] hover:text-white border-[#2A2A2D] hover:border-[#3A3A3D]'
              }`}
              title={
                isDirectRecording
                  ? 'Stop voice recording'
                  : 'Speak thoughts with microphone'
              }
            >
              {isDirectRecording ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {/* Input Box & Recording Stage */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              {isDirectRecording ? (
                <div className="flex flex-col gap-2 py-0.5 px-1 min-w-0">
                  {/* Status, Exact Frequency Visualizer, and Direct Send/Arrow & Cancel Controls */}
                  <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
                    {/* Status Indicator Badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#F8717115] border border-[#F8717130] text-[#F87171] text-[11px] font-medium animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#F87171] animate-ping" />
                        Live Voice
                      </span>
                      {silenceCountdown !== null && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#4285F415] border border-[#4285F430] text-[#4285F4] text-[11px] font-medium animate-pulse">
                          Auto-sending in {silenceCountdown}s...
                        </span>
                      )}
                    </div>

                    {/* Exact Frequency Visualizer (AnalyserNode) */}
                    <div className="flex-1 flex justify-center scale-90 sm:scale-95 origin-center">
                      <AudioVisualizer
                        mode="mic"
                        isActive={isDirectRecording}
                        analyser={micAnalyser}
                        barCount={24}
                      />
                    </div>

                    {/* Controls: Direct Send/Arrow Button & Cancel */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Direct Send/Arrow Button (Replaced Pause/Resume) */}
                      <button
                        type="button"
                        onClick={() => handleSendMessage()}
                        disabled={
                          (!inputText.trim() && !liveTranscript.trim()) ||
                          isAiReplying ||
                          isFinishingSession
                        }
                        className="btn-primary-cta px-2.5 sm:px-3 py-1 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded-xl shadow-sm transition disabled:opacity-40 flex items-center gap-1.5 text-xs font-semibold cursor-pointer active:scale-95 shrink-0"
                        title="Submit Spoken Reflection (Enter)"
                      >
                        <span>Send</span>
                        <Send className="w-3.5 h-3.5 text-neutral-900" />
                      </button>

                      {/* Cancel Button */}
                      <button
                        type="button"
                        onClick={cancelRecording}
                        className="p-1 sm:px-2 py-1 rounded-xl border border-[#F8717140] bg-[#F8717115] text-[#F87171] hover:bg-[#F8717130] transition flex items-center gap-1 text-xs cursor-pointer font-medium shrink-0"
                        title="Cancel and discard recording"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Cancel</span>
                      </button>
                    </div>
                  </div>

                  {/* Real-time Live Transcription Display (Cumulative Persistent View) */}
                  <div className="bg-[#121214] border border-[#262629] rounded-xl p-2.5 max-h-32 overflow-y-auto">
                    <div className="text-xs sm:text-sm leading-relaxed text-[#E0E0E0] flex items-start gap-1">
                      {inputText || liveTranscript ? (
                        <span className="text-white font-normal break-words">
                          {inputText || liveTranscript}
                          <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#F87171] animate-pulse align-middle rounded-xs" />
                        </span>
                      ) : (
                        <span className="text-[#707070] italic flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F87171] animate-ping" />
                          Speak your thoughts... Live continuous transcription accumulating
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <textarea
                  id="journal-chat-input"
                  rows={1}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Enter your thoughts"
                  className="w-full bg-transparent resize-none text-xs sm:text-sm text-[#E0E0E0] placeholder-[#606060] focus:outline-hidden max-h-24 sm:max-h-32 py-1 px-1 leading-relaxed"
                />
              )}
            </div>

            {/* Actionable Send / Submit Button */}
            <button
              id="journal-send-btn"
              type="submit"
              disabled={
                (!inputText.trim() && !liveTranscript.trim()) ||
                isAiReplying ||
                isFinishingSession
              }
              className="btn-primary-cta p-2 sm:p-2.5 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded-xl shadow-sm transition disabled:opacity-40 shrink-0 flex items-center justify-center cursor-pointer active:scale-95"
              title="Send Reflection (Enter)"
            >
              <Send className="w-4 h-4 text-neutral-900" />
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

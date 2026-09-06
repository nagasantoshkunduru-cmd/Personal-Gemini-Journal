import { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  X,
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { float32ToPcmBase64, pcm24kBase64ToAudioBuffer } from '../lib/audioUtils';
import type { ChatMessage } from '../types';

interface VoiceStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyVoiceTurns: (newMessages: ChatMessage[]) => void;
}

export function VoiceStudioModal({
  isOpen,
  onClose,
  onApplyVoiceTurns,
}: VoiceStudioModalProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<'idle' | 'user' | 'model'>('idle');
  const [voiceMessages, setVoiceMessages] = useState<ChatMessage[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);

  // Audio Contexts & WebSockets
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Auto-connect when modal opens
  useEffect(() => {
    if (isOpen) {
      startVoiceSession();
    } else {
      stopVoiceSession();
    }

    return () => {
      stopVoiceSession();
    };
  }, [isOpen]);

  const startVoiceSession = async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);

      // 1. Initialize Audio Contexts (16kHz for input, 24kHz for output)
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });

      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextPlayTimeRef.current = outputCtx.currentTime;

      // 2. Request mic stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      mediaStreamRef.current = stream;

      // 3. Establish WebSocket connection to backend Live API
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecting(false);
        setIsConnected(true);
        console.log('[Live Voice] Connected to Gemini Live API');

        // Setup microphone processor
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (isMicMuted) return;
          const inputData = e.inputBuffer.getChannelData(0);

          // Calculate energy level for visualizer
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          setVolumeLevel(Math.min(1, rms * 5));

          if (rms > 0.02) {
            setActiveSpeaker('user');
          }

          const base64Pcm = float32ToPcmBase64(inputData);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ audio: base64Pcm }));
          }
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.audio && !isSpeakerMuted && outputAudioCtxRef.current) {
            setActiveSpeaker('model');
            const audioBuffer = pcm24kBase64ToAudioBuffer(outputAudioCtxRef.current, msg.audio);
            const sourceNode = outputAudioCtxRef.current.createBufferSource();
            sourceNode.buffer = audioBuffer;
            sourceNode.connect(outputAudioCtxRef.current.destination);

            const currentTime = outputAudioCtxRef.current.currentTime;
            const startTime = Math.max(currentTime, nextPlayTimeRef.current);
            sourceNode.start(startTime);
            nextPlayTimeRef.current = startTime + audioBuffer.duration;

            sourceNode.onended = () => {
              if (outputAudioCtxRef.current && outputAudioCtxRef.current.currentTime >= nextPlayTimeRef.current - 0.05) {
                setActiveSpeaker('idle');
              }
            };
          }

          if (msg.interrupted) {
            console.log('[Live Voice] Model interrupted by user speech');
            if (outputAudioCtxRef.current) {
              nextPlayTimeRef.current = outputAudioCtxRef.current.currentTime;
            }
            setActiveSpeaker('user');
          }

          if (msg.type === 'error') {
            setConnectionError(msg.message || 'Live API temporary limitation.');
          }
        } catch (err) {
          console.error('[Live Voice] Error decoding audio message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[Live Voice WS Error]:', err);
        setConnectionError('Unable to connect to real-time audio socket.');
        setIsConnecting(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        setActiveSpeaker('idle');
      };

      startVisualizer();
    } catch (err: any) {
      console.error('[Live Voice] Setup failed:', err);
      setConnectionError(err.message || 'Microphone permission or Live API error.');
      setIsConnecting(false);
      setIsConnected(false);
    }
  };

  const stopVoiceSession = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setActiveSpeaker('idle');
  };

  // Ambient audio visualizer canvas
  const startVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      phase += 0.05;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = 50 + volumeLevel * 30;

      // Draw subtle orbital ripple rings
      for (let i = 3; i >= 1; i--) {
        ctx.beginPath();
        const r = baseRadius + i * 18 + Math.sin(phase + i) * 4;
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.strokeStyle =
          activeSpeaker === 'user'
            ? `rgba(74, 222, 128, ${0.12 * i})`
            : activeSpeaker === 'model'
            ? `rgba(155, 114, 243, ${0.15 * i})`
            : `rgba(66, 133, 244, ${0.08 * i})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw glowing central orb
      const grad = ctx.createRadialGradient(
        centerX,
        centerY,
        10,
        centerX,
        centerY,
        baseRadius
      );
      if (activeSpeaker === 'user') {
        grad.addColorStop(0, 'rgba(74, 222, 128, 0.9)');
        grad.addColorStop(1, 'rgba(34, 197, 94, 0.2)');
      } else if (activeSpeaker === 'model') {
        grad.addColorStop(0, 'rgba(155, 114, 243, 0.95)');
        grad.addColorStop(1, 'rgba(66, 133, 244, 0.25)');
      } else {
        grad.addColorStop(0, 'rgba(66, 133, 244, 0.7)');
        grad.addColorStop(1, 'rgba(66, 133, 244, 0.1)');
      }

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
  };

  if (!isOpen) return null;

  return (
    <div id="voice-studio-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-black border border-[#1E1E20] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-[#1E1E20] flex items-center justify-between bg-black">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#9B72F3] flex items-center justify-center text-white shadow-md">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Live Voice Conversation
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A3020] text-[#4ADE80] border border-[#225030] font-mono font-bold">
                  gemini-3.1-flash-live-preview
                </span>
              </h2>
              <p className="text-xs text-[#808080]">
                Real-time, bidirectional voice dialogue with low-latency PCM audio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#808080] hover:text-white rounded-lg hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visualizer Area */}
        <div className="relative h-64 bg-black flex flex-col items-center justify-center overflow-hidden">
          <canvas
            ref={canvasRef}
            width={400}
            height={240}
            className="w-full h-full max-w-[360px]"
          />

          {/* Status Overlay */}
          <div className="absolute bottom-4 flex flex-col items-center space-y-1">
            {isConnecting ? (
              <div className="flex items-center gap-2 text-xs text-[#4285F4] bg-[#161618]/90 px-3 py-1.5 rounded-full border border-[#2A2A2D]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Establishing Live API WebSocket Stream...</span>
              </div>
            ) : isConnected ? (
              <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-[#161618]/90 border border-[#2A2A2D]">
                <div
                  className={`w-2 h-2 rounded-full ${
                    activeSpeaker === 'user'
                      ? 'bg-[#4ADE80] animate-pulse'
                      : activeSpeaker === 'model'
                      ? 'bg-[#9B72F3] animate-pulse'
                      : 'bg-[#4285F4]'
                  }`}
                />
                <span className="text-white font-medium">
                  {activeSpeaker === 'user'
                    ? 'Listening to you...'
                    : activeSpeaker === 'model'
                    ? 'Gemini is speaking...'
                    : 'Speak freely, Gemini is listening'}
                </span>
              </div>
            ) : connectionError ? (
              <div className="flex items-center gap-1.5 text-xs text-[#F87171] bg-[#1A1010] px-3 py-1.5 rounded-full border border-[#3A2020]">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{connectionError}</span>
              </div>
            ) : (
              <div className="text-xs text-[#808080]">Voice stream disconnected</div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 bg-black border-t border-[#1E1E20] space-y-4">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setIsMicMuted(!isMicMuted)}
              disabled={!isConnected}
              className={`p-3.5 rounded-2xl border transition flex items-center gap-2 text-xs font-semibold ${
                isMicMuted
                  ? 'bg-[#F8717120] text-[#F87171] border-[#F8717140]'
                  : 'bg-[#161618] text-white border-[#2A2A2D] hover:bg-[#1E1E20]'
              }`}
            >
              {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-[#4ADE80]" />}
              <span>{isMicMuted ? 'Mic Muted' : 'Mic Active'}</span>
            </button>

            <button
              onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
              disabled={!isConnected}
              className={`p-3.5 rounded-2xl border transition flex items-center gap-2 text-xs font-semibold ${
                isSpeakerMuted
                  ? 'bg-[#F8717120] text-[#F87171] border-[#F8717140]'
                  : 'bg-[#161618] text-white border-[#2A2A2D] hover:bg-[#1E1E20]'
              }`}
            >
              {isSpeakerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#4285F4]" />}
              <span>{isSpeakerMuted ? 'Muted' : 'Audio On'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#1E1E20]/60">
            <button
              onClick={() => {
                stopVoiceSession();
                onClose();
              }}
              className="px-4 py-2 text-xs text-[#808080] hover:text-[#E0E0E0] rounded-xl hover:bg-[#161618] transition"
            >
              Exit Voice Session
            </button>

            <button
              id="voice-studio-done-btn"
              onClick={() => {
                stopVoiceSession();
                onClose();
              }}
              className="btn-primary-cta px-4 py-2 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900" />
              <span className="text-neutral-900">Done Speaking</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

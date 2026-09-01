/**
 * Audio processing utilities for Gemini Live API and Voice Interaction.
 * Live API requires 16-bit little-endian PCM at 16kHz for mic input,
 * and outputs 24kHz PCM audio.
 */

// Convert Float32 audio buffer from Web Audio API into 16-bit PCM Base64
export function float32ToPcmBase64(float32Array: Float32Array): string {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16Array.buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 24kHz PCM from Gemini into an AudioBuffer
export function pcm24kBase64ToAudioBuffer(
  audioCtx: AudioContext,
  base64String: string
): AudioBuffer {
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
  }

  const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000);
  audioBuffer.copyToChannel(float32Array, 0);
  return audioBuffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Encodes 16-bit PCM Base64 audio into a valid RIFF WAV Blob with proper 44-byte header.
 */
export function pcmToWavBlob(base64Pcm: string, sampleRate = 24000, numChannels = 1): Blob {
  const binaryString = atob(base64Pcm);
  const len = binaryString.length;
  const pcmBytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    pcmBytes[i] = binaryString.charCodeAt(i);
  }

  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  // "RIFF" chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, pcmBytes.length, true);

  return new Blob([view, pcmBytes], { type: 'audio/wav' });
}

// Global AudioContext and node for reliable Web Audio playback without HTML5 MediaElement errors
let sharedAudioCtx: AudioContext | null = null;
let activeSourceNode: AudioBufferSourceNode | null = null;

export function playPcm24kAudio(
  base64Pcm: string,
  onEnded?: () => void
): { stop: () => void } {
  // Stop existing playback if any
  stopGlobalAudio();

  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
    }

    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }

    const audioBuffer = pcm24kBase64ToAudioBuffer(sharedAudioCtx, base64Pcm);
    const sourceNode = sharedAudioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(sharedAudioCtx.destination);
    activeSourceNode = sourceNode;

    sourceNode.onended = () => {
      if (activeSourceNode === sourceNode) {
        activeSourceNode = null;
      }
      if (onEnded) onEnded();
    };

    sourceNode.start(0);

    return {
      stop: () => {
        try {
          sourceNode.stop();
        } catch {}
        if (activeSourceNode === sourceNode) {
          activeSourceNode = null;
        }
      },
    };
  } catch (err) {
    console.error('[WebAudio] Playback failed:', err);
    if (onEnded) onEnded();
    return { stop: () => {} };
  }
}

export function stopGlobalAudio() {
  if (activeSourceNode) {
    try {
      activeSourceNode.stop();
    } catch {}
    activeSourceNode = null;
  }
}

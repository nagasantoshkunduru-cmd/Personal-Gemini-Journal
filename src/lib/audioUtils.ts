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

import { useEffect, useState, useRef } from 'react';

interface AudioVisualizerProps {
  mode: 'mic' | 'tts';
  isActive: boolean;
  analyser?: AnalyserNode | null;
  isPaused?: boolean;
  color?: string;
  barCount?: number;
}

export function AudioVisualizer({
  mode,
  isActive,
  analyser,
  isPaused = false,
  color,
  barCount,
}: AudioVisualizerProps) {
  const defaultCount = barCount || (mode === 'mic' ? 24 : 18);
  const [bars, setBars] = useState<number[]>(() =>
    Array.from({ length: defaultCount }, () => 4)
  );

  const animationFrameRef = useRef<number | null>(null);

  // Initialize and update real-time frequency visualizer loop
  useEffect(() => {
    if (!isActive) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const count = defaultCount;
    const minHeight = 4;
    const maxHeight = mode === 'mic' ? 36 : 28;

    const renderLoop = () => {
      if (isPaused) {
        // Paused state: gracefully lower bars to baseline
        setBars((prevBars) =>
          prevBars.map((h) => Math.max(minHeight, Math.round(h * 0.85)))
        );
        animationFrameRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      if (analyser) {
        try {
          // Exact Frequency extraction using Web Audio API
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(dataArray);

          // Map frequency bins across our visualizer bars
          // Human voice pitch fundamental is in lower bins, with overtones across mid-high bins
          const step = Math.max(1, Math.floor(bufferLength / count));
          const nextBars = Array.from({ length: count }, (_, i) => {
            const binIndex = Math.min(bufferLength - 1, i * step);
            const value = dataArray[binIndex] || 0; // 0 to 255
            const percent = value / 255;
            return Math.max(minHeight, Math.round(minHeight + percent * (maxHeight - minHeight)));
          });

          setBars(nextBars);
        } catch (err) {
          console.warn('[AudioVisualizer] Failed to read frequency data:', err);
        }
      } else {
        // Subtle fallback wave during initialization
        setBars((prevBars) =>
          prevBars.map((height, i) => {
            const wave = Math.sin((Date.now() / 200) + (i * 0.4)) * 3;
            return Math.max(minHeight, Math.min(maxHeight, 6 + wave));
          })
        );
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isActive, analyser, isPaused, defaultCount, mode]);

  if (!isActive) return null;

  // Visual Theme configurations based on active vs paused state
  let selectedColorClass = color;
  if (!selectedColorClass) {
    if (mode === 'mic') {
      if (isPaused) {
        selectedColorClass = 'bg-[#FBBF24] shadow-[#FBBF24]/40 border-[#FBBF24]/20';
      } else {
        selectedColorClass = 'bg-[#F87171] shadow-[#F87171]/40 border-[#F87171]/20';
      }
    } else {
      selectedColorClass = 'bg-gradient-to-t from-[#4285F4] to-[#A78BFA] shadow-[#4285F4]/40 border-[#4285F4]/20';
    }
  }

  return (
    <div className="flex items-center justify-center gap-[3px] h-9 px-2.5 bg-black/50 backdrop-blur-xs border border-[#1E1E20]/60 rounded-xl max-w-fit shadow-inner">
      {bars.map((height, index) => (
        <div
          key={index}
          className={`w-[3px] rounded-full transition-[height] duration-75 ease-out ${selectedColorClass}`}
          style={{
            height: `${height}px`,
            boxShadow: '0 0 8px var(--tw-shadow-color)',
          }}
        />
      ))}
    </div>
  );
}

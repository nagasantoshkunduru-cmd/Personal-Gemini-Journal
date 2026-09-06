import { useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Smile,
  Zap,
  Tag,
  BookOpen,
  Calendar,
  Sparkles,
  Award,
  Compass
} from 'lucide-react';
import type { JournalEntry } from '../types';
import { getSentimentColor } from '../lib/sanitize';

interface SentimentAnalyticsProps {
  entries: JournalEntry[];
  onSelectTag: (tag: string) => void;
  onNewSession: () => void;
}

export function SentimentAnalytics({
  entries,
  onSelectTag,
  onNewSession,
}: SentimentAnalyticsProps) {
  // Aggregate Metrics
  const stats = useMemo(() => {
    if (entries.length === 0) {
      return {
        total: 0,
        avgSentiment: 0,
        positiveCount: 0,
        neutralCount: 0,
        negativeCount: 0,
        mixedCount: 0,
        totalWords: 0,
        tagCounts: {} as Record<string, number>,
        energyCounts: {} as Record<string, number>,
      };
    }

    let pos = 0;
    let neu = 0;
    let neg = 0;
    let mix = 0;
    let totalScore = 0;
    let words = 0;
    const tagsMap: Record<string, number> = {};
    const energyMap: Record<string, number> = {};

    entries.forEach((e) => {
      if (e.sentiment === 'Positive') pos++;
      else if (e.sentiment === 'Negative') neg++;
      else if (e.sentiment === 'Mixed') mix++;
      else neu++;

      totalScore += e.sentimentScore || 0;
      words += e.wordCount || 0;

      if (e.emotionalEnergy) {
        energyMap[e.emotionalEnergy] = (energyMap[e.emotionalEnergy] || 0) + 1;
      }

      e.tags?.forEach((t) => {
        const key = t.toLowerCase();
        tagsMap[key] = (tagsMap[key] || 0) + 1;
      });
    });

    return {
      total: entries.length,
      avgSentiment: totalScore / entries.length,
      positiveCount: pos,
      neutralCount: neu,
      negativeCount: neg,
      mixedCount: mix,
      totalWords: words,
      tagCounts: tagsMap,
      energyCounts: energyMap,
    };
  }, [entries]);

  const sortedTags = useMemo(() => {
    return (Object.entries(stats.tagCounts) as [string, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
  }, [stats.tagCounts]);

  if (entries.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#9B72F3] text-white flex items-center justify-center mx-auto shadow-md">
          <BarChart3 className="w-6 h-6" />
        </div>
        <h2 className="font-bold text-xl text-white">
          Analytics & Mood Trends
        </h2>
        <p className="text-xs text-[#808080] max-w-sm mx-auto">
          Complete a few conversational journaling sessions to unlock psychological sentiment breakdowns, keyword tag patterns, and emotional energy metrics.
        </p>
        <button
          id="start-journaling-analytics-btn"
          onClick={onNewSession}
          className="btn-primary-cta px-4 py-2 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 text-xs font-bold rounded-xl transition shadow-sm active:scale-95 cursor-pointer"
        >
          Start Journaling
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="font-bold text-2xl text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#4285F4]" />
            Intelligent Sentiment & Reflection Analytics
          </h1>
          <p className="text-xs text-[#808080]">
            Automated cognitive insights synthesized across {stats.total} journaling sessions
          </p>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-black border border-[#1E1E20] rounded-2xl space-y-1 shadow-sm">
          <span className="text-[10px] uppercase tracking-widest text-[#606060] font-bold">Total Entries</span>
          <div className="text-2xl font-bold text-white">
            {stats.total}
          </div>
          <span className="text-[11px] text-[#4ADE80] font-medium flex items-center gap-1">
            <Award className="w-3 h-3" /> Consistent practice
          </span>
        </div>

        <div className="p-5 bg-black border border-[#1E1E20] rounded-2xl space-y-1 shadow-sm">
          <span className="text-[10px] uppercase tracking-widest text-[#606060] font-bold">Avg Sentiment Score</span>
          <div className="text-2xl font-bold text-[#4285F4]">
            {stats.avgSentiment >= 0 ? `+${stats.avgSentiment.toFixed(2)}` : stats.avgSentiment.toFixed(2)}
          </div>
          <span className="text-[11px] text-[#808080] font-medium">
            Range: -1.0 (Low) to +1.0 (High)
          </span>
        </div>

        <div className="p-5 bg-black border border-[#1E1E20] rounded-2xl space-y-1 shadow-sm">
          <span className="text-[10px] uppercase tracking-widest text-[#606060] font-bold">Words Reflected</span>
          <div className="text-2xl font-bold text-white">
            {stats.totalWords.toLocaleString()}
          </div>
          <span className="text-[11px] text-[#808080]">Unpacked & sanitized</span>
        </div>

        <div className="p-5 bg-black border border-[#1E1E20] rounded-2xl space-y-1 shadow-sm">
          <span className="text-[10px] uppercase tracking-widest text-[#606060] font-bold">Unique Themes</span>
          <div className="text-2xl font-bold text-[#9B72F3]">
            {Object.keys(stats.tagCounts).length}
          </div>
          <span className="text-[11px] text-[#808080]">Indexed keywords</span>
        </div>
      </div>

      {/* Main Analysis Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sentiment Breakdown */}
        <div className="p-6 bg-black border border-[#1E1E20] rounded-2xl space-y-4 shadow-sm">
          <h2 className="text-xs uppercase tracking-widest text-[#606060] font-bold flex items-center gap-2">
            <Smile className="w-4 h-4 text-[#4285F4]" />
            Sentiment Distribution Breakdown
          </h2>

          <div className="space-y-3">
            {[
              { label: 'Positive', count: stats.positiveCount, color: 'bg-[#4ADE80]', text: 'text-[#4ADE80]' },
              { label: 'Neutral', count: stats.neutralCount, color: 'bg-[#808080]', text: 'text-[#C0C0C0]' },
              { label: 'Mixed', count: stats.mixedCount, color: 'bg-[#FBBF24]', text: 'text-[#FBBF24]' },
              { label: 'Negative / Heavy', count: stats.negativeCount, color: 'bg-[#F87171]', text: 'text-[#F87171]' },
            ].map((item) => {
              const pct = stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className={item.text}>{item.label}</span>
                    <span className="text-[#808080] font-mono">{item.count} entries ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-[#1E1E20] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Keywords & Tag Cloud */}
        <div className="p-6 bg-black border border-[#1E1E20] rounded-2xl space-y-4 shadow-sm">
          <h2 className="text-xs uppercase tracking-widest text-[#606060] font-bold flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#4285F4]" />
            Extracted Semantic Tags
          </h2>

          <p className="text-xs text-[#808080]">
            Click any tag to filter your journal timeline by topic.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {sortedTags.map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => onSelectTag(tag)}
                className="px-3 py-1.5 bg-black hover:bg-white/[0.06] text-[#E0E0E0] rounded-xl text-xs font-medium border border-[#2A2A2D] hover:border-[#3A3A3D] transition flex items-center gap-1.5 shadow-xs"
              >
                <span className="text-[#4285F4]">#{tag}</span>
                <span className="text-[10px] bg-[#2A2A2D] text-[#A0A0A0] px-1.5 py-0.5 rounded-full font-mono font-bold">
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

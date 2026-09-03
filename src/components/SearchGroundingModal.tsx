import { useState } from 'react';
import {
  Search,
  Globe,
  ExternalLink,
  Sparkles,
  Loader2,
  X,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Plus
} from 'lucide-react';
import type { GroundingSource } from '../types';

interface SearchGroundingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertGroundedContext: (text: string, sources: GroundingSource[]) => void;
}

const SAMPLE_QUERIES = [
  'Evidence-based CBT techniques for reframing workplace anxiety',
  'Stoic philosophy quotes on managing things outside your control',
  'Neurobiology of gratitude journaling before sleep',
  'Box breathing vs physiological sigh for vagus nerve calming',
];

export function SearchGroundingModal({
  isOpen,
  onClose,
  onInsertGroundedContext,
}: SearchGroundingModalProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    insight: string;
    sources: GroundingSource[];
    modelUsed: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (targetQuery?: string) => {
    const q = (targetQuery || query).trim();
    if (!q || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const response = await fetch('/api/search-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });

      if (!response.ok) {
        throw new Error(`Search grounding failed with status ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error('Search Grounding error:', err);
      setErrorMessage(err.message || 'Unable to retrieve grounded web search insights.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyToJournal = () => {
    if (!result) return;
    const formatted = `[Grounded Research on "${query}"]:\n${result.insight}`;
    onInsertGroundedContext(formatted, result.sources);
    onClose();
  };

  return (
    <div id="search-grounding-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#0E0E10] border border-[#1E1E20] rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-[#1E1E20] flex items-center justify-between bg-[#0A0A0B]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#34A853] flex items-center justify-center text-white shadow-md">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Google Search Grounding
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A2838] text-[#4285F4] border border-[#224060] font-mono font-bold">
                  gemini-3.5-flash + googleSearch
                </span>
              </h2>
              <p className="text-xs text-[#808080]">
                Access real-world psychological research, stoic wisdom, and verified citations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#808080] hover:text-white rounded-lg hover:bg-[#161618] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-[#0E0E10]">
          {/* Search Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex items-center gap-2"
          >
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#808080]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search psychology, mindfulness practices, stoic concepts..."
                className="w-full bg-[#161618] border border-[#2A2A2D] focus:border-[#4285F4] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#606060] focus:outline-hidden transition"
              />
            </div>
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="px-4 py-2.5 bg-[#4285F4] hover:bg-[#3367D6] text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-40 flex items-center gap-1.5 shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Search</span>
            </button>
          </form>

          {/* Preset Prompts */}
          {!result && !isLoading && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-[#606060] font-bold">
                Suggested Mindful Inquiries
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SAMPLE_QUERIES.map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(sample);
                      handleSearch(sample);
                    }}
                    className="p-3 bg-[#161618] hover:bg-[#1E1E20] border border-[#2A2A2D] hover:border-[#3A3A3D] rounded-xl text-left text-xs text-[#A0A0A0] hover:text-[#E0E0E0] transition flex items-start gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#4285F4] shrink-0 mt-0.5" />
                    <span>{sample}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="p-8 text-center space-y-3 bg-[#161618]/50 border border-[#2A2A2D] rounded-2xl animate-in fade-in">
              <Loader2 className="w-6 h-6 animate-spin text-[#4285F4] mx-auto" />
              <p className="text-xs text-[#A0A0A0]">
                Querying Google Search and synthesizing verified grounding citations with Gemini...
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 bg-[#2A1515] border border-[#4A2020] rounded-xl text-xs text-[#F87171]">
              {errorMessage}
            </div>
          )}

          {/* Grounded Insight Result */}
          {result && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-[#161618] border border-[#2A2A2D] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-[#4ADE80] font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Grounded Synthesis
                  </span>
                  <span className="text-[10px] text-[#808080] font-mono">
                    Model: {result.modelUsed}
                  </span>
                </div>
                <div className="text-xs text-[#D0D0D0] leading-relaxed whitespace-pre-wrap">
                  {result.insight}
                </div>
              </div>

              {/* Citations & Sources */}
              {result.sources.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-[#808080] font-bold flex items-center gap-1">
                    <Globe className="w-3 h-3 text-[#4285F4]" /> Grounding Sources & References
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.uri}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161618] border border-[#2A2A2D] hover:border-[#4285F4] text-[11px] text-[#A0A0A0] hover:text-white transition"
                      >
                        <ExternalLink className="w-3 h-3 text-[#4285F4]" />
                        <span className="max-w-[200px] truncate">{src.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0A0A0B] border-t border-[#1E1E20] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-[#808080] hover:text-[#E0E0E0] rounded-xl hover:bg-[#161618] transition"
          >
            Close
          </button>
          {result && (
            <button
              onClick={handleApplyToJournal}
              className="px-4 py-2 bg-[#4285F4] hover:bg-[#3367D6] text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to Journal Thread</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

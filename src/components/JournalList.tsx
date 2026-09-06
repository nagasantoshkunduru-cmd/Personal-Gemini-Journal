import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Tag,
  Calendar,
  Sparkles,
  ArrowUpDown,
  Smile,
  Frown,
  Meh,
  Compass,
  ChevronRight,
  BookOpen,
  PlusCircle,
  Clock,
  Layers,
  Edit3,
  Trash2,
  ArrowRight,
  Check,
  X
} from 'lucide-react';
import type { JournalEntry, FilterState, SentimentType, UserAuthProfile } from '../types';
import { formatDate, formatTime, getSentimentColor } from '../lib/sanitize';
import { getDraft, clearDraft, JournalDraft } from '../lib/draftManager';

interface JournalListProps {
  entries: JournalEntry[];
  currentUser?: UserAuthProfile | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewSession: () => void;
  onUpdateTitle?: (entryId: string, newTitle: string) => Promise<void>;
}

export function JournalList({ entries, currentUser, onSelectEntry, onNewSession, onUpdateTitle }: JournalListProps) {
  const [activeDraft, setActiveDraft] = useState<JournalDraft | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingCardTitle, setEditingCardTitle] = useState('');
  const [isSavingCardTitle, setIsSavingCardTitle] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    searchQuery: '',
    selectedTag: null,
    selectedSentiment: 'ALL',
    sortBy: 'newest',
    dateRange: 'all',
  });

  // Check for active draft
  useEffect(() => {
    if (currentUser?.uid) {
      const draft = getDraft(currentUser.uid);
      setActiveDraft(draft);
    } else {
      setActiveDraft(null);
    }
  }, [currentUser?.uid]);

  const handleDiscardDraft = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentUser?.uid) {
      clearDraft(currentUser.uid);
      setActiveDraft(null);
    }
  };

  const handleStartEditCardTitle = (e: React.MouseEvent, entry: JournalEntry) => {
    e.stopPropagation();
    setEditingCardId(entry.id);
    setEditingCardTitle(entry.title || '');
  };

  const handleSaveCardTitle = async (e: React.MouseEvent | React.FormEvent, entryId: string) => {
    e.stopPropagation();
    if (!onUpdateTitle) return;
    const trimmed = editingCardTitle.trim();
    if (!trimmed) return;

    setIsSavingCardTitle(true);
    try {
      await onUpdateTitle(entryId, trimmed);
      setEditingCardId(null);
    } catch (err) {
      console.error('Failed to update card title:', err);
    } finally {
      setIsSavingCardTitle(false);
    }
  };

  const handleCancelCardTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCardId(null);
    setEditingCardTitle('');
  };

  // Extract all unique tags across entries
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    entries.forEach((e) => {
      e.tags?.forEach((t) => tagSet.add(t.toLowerCase()));
    });
    return Array.from(tagSet).sort();
  }, [entries]);

  // Filtered and sorted entries
  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => {
        // Search query
        if (filterState.searchQuery) {
          const q = filterState.searchQuery.toLowerCase();
          const matchTitle = entry.title?.toLowerCase().includes(q);
          const matchSummary = entry.summary?.toLowerCase().includes(q);
          const matchTags = entry.tags?.some((t) => t.toLowerCase().includes(q));
          const matchTakeaways = entry.keyTakeaways?.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchSummary && !matchTags && !matchTakeaways) return false;
        }

        // Tag filter
        if (filterState.selectedTag) {
          if (!entry.tags?.map((t) => t.toLowerCase()).includes(filterState.selectedTag.toLowerCase())) {
            return false;
          }
        }

        // Sentiment filter
        if (filterState.selectedSentiment !== 'ALL') {
          if (entry.sentiment !== filterState.selectedSentiment) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (filterState.sortBy === 'newest') return b.createdAt - a.createdAt;
        if (filterState.sortBy === 'oldest') return a.createdAt - b.createdAt;
        if (filterState.sortBy === 'sentiment_high') return b.sentimentScore - a.sentimentScore;
        if (filterState.sortBy === 'sentiment_low') return a.sentimentScore - b.sentimentScore;
        return 0;
      });
  }, [entries, filterState]);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Controls: Search, Filters, & Tags */}
      <div className="bg-black border border-[#1E1E20] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#606060] absolute left-3.5 top-3" />
            <input
              id="search-entries-input"
              type="text"
              value={filterState.searchQuery}
              onChange={(e) => setFilterState({ ...filterState, searchQuery: e.target.value })}
              placeholder="Search reflections, tags, insights, keywords..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#161618] border border-[#2A2A2D] rounded-xl text-xs sm:text-sm text-[#E0E0E0] placeholder-[#606060] focus:outline-hidden focus:border-[#4285F4] transition"
            />
          </div>

          {/* Sort By Dropdown & New Entry Button */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            <div className="relative flex items-center shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#606060] absolute left-3 pointer-events-none" />
              <select
                id="sort-entries-select"
                value={filterState.sortBy}
                onChange={(e) => setFilterState({ ...filterState, sortBy: e.target.value as any })}
                className="pl-8 pr-8 py-2.5 bg-[#161618] border border-[#2A2A2D] rounded-xl text-xs font-medium text-[#E0E0E0] focus:outline-hidden focus:border-[#4285F4] appearance-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="sentiment_high">Highest Sentiment</option>
                <option value="sentiment_low">Lowest Sentiment</option>
              </select>
            </div>

            <button
              id="new-entry-list-btn"
              onClick={onNewSession}
              className="btn-primary-cta flex items-center gap-1.5 py-2.5 px-3.5 sm:px-4 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded-xl text-xs font-bold shadow-sm transition shrink-0 whitespace-nowrap cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4 shrink-0 text-neutral-900" />
              <span className="text-neutral-900">New Entry</span>
            </button>
          </div>
        </div>

        {/* Sentiment Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#1E1E20]">
          <span className="text-[10px] uppercase tracking-widest text-[#606060] font-bold mr-1 flex items-center gap-1">
            <Smile className="w-3.5 h-3.5" /> Sentiment:
          </span>
          {(['ALL', 'Positive', 'Neutral', 'Negative', 'Mixed'] as const).map((sent) => (
            <button
              key={sent}
              onClick={() => setFilterState({ ...filterState, selectedSentiment: sent })}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                filterState.selectedSentiment === sent
                  ? 'bg-[#2A2A2D] text-white border border-[#3A3A3D] shadow-xs'
                  : 'bg-[#161618] border border-[#2A2A2D] text-[#808080] hover:text-[#E0E0E0] hover:bg-[#1E1E20]'
              }`}
            >
              {sent}
            </button>
          ))}
        </div>

        {/* Available Tags Chips */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] uppercase tracking-widest text-[#606060] font-bold mr-1 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Tags:
            </span>
            {filterState.selectedTag && (
              <button
                onClick={() => setFilterState({ ...filterState, selectedTag: null })}
                className="px-2.5 py-0.5 bg-[#4285F420] border border-[#4285F450] text-[#4285F4] text-xs font-semibold rounded-lg hover:bg-[#4285F430] transition"
              >
                Clear #{filterState.selectedTag} ✕
              </button>
            )}
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() =>
                  setFilterState({
                    ...filterState,
                    selectedTag: filterState.selectedTag === tag ? null : tag,
                  })
                }
                className={`px-2.5 py-0.5 rounded-lg text-xs font-medium transition border ${
                  filterState.selectedTag === tag
                    ? 'bg-[#4285F4] text-white border-[#4285F4] shadow-xs'
                    : 'bg-[#161618] text-[#A0A0A0] border-[#2A2A2D] hover:border-[#3A3A3D] hover:text-[#E0E0E0]'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active In-Progress Draft Banner (if user has an unsaved draft) */}
      {activeDraft && (
        <div
          id="active-draft-card"
          className="bg-gradient-to-r from-[#161B26] via-[#10141D] to-[#121214] border border-[#4285F440] hover:border-[#4285F470] rounded-2xl p-5 shadow-lg transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden"
        >
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-[#4285F420] text-[#4285F4] rounded-xl border border-[#4285F440] shrink-0 mt-0.5">
              <Edit3 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-[#4285F425] text-[#4285F4] border border-[#4285F450] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4285F4] animate-pulse" />
                  Unsaved Draft
                </span>
                <span className="text-[11px] text-[#808080] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Autosaved {formatDate(activeDraft.lastUpdated)} • {formatTime(activeDraft.lastUpdated)}
                </span>
              </div>
              <h3 className="font-bold text-base text-white">
                {activeDraft.title || 'Untitled Reflection Session'}
              </h3>
              <p className="text-xs text-[#A0A0A0] line-clamp-2 max-w-xl">
                {activeDraft.messages?.filter((m) => m.role === 'user').slice(-1)[0]?.content ||
                  activeDraft.inputText ||
                  'You have an in-progress journaling session ready to resume.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            <button
              id="discard-draft-list-btn"
              onClick={handleDiscardDraft}
              className="px-3 py-2 text-xs font-semibold text-[#808080] hover:text-[#F87171] hover:bg-[#F8717115] rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title="Discard this unsaved draft"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Discard</span>
            </button>
            <button
              id="resume-draft-list-btn"
              onClick={onNewSession}
              className="btn-primary-cta px-4 py-2 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span className="text-neutral-900">Resume Draft</span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-900" />
            </button>
          </div>
        </div>
      )}

      {/* Entries List Header */}
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xs uppercase tracking-widest text-[#606060] font-bold flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#4285F4]" />
          Recent Entries & Archive
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#161618] border border-[#2A2A2D] text-[#808080] font-bold">
            {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
          </span>
        </h2>
      </div>

      {/* Entry Cards Grid */}
      {filteredEntries.length === 0 ? (
        <div className="text-center py-16 px-4 bg-black border border-[#1E1E20] rounded-2xl space-y-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#9B72F3] text-white flex items-center justify-center mx-auto shadow-md">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">
              {entries.length === 0 ? 'No journal entries yet' : 'No matching entries found'}
            </h3>
            <p className="text-xs text-[#808080] max-w-sm mx-auto mt-1">
              {entries.length === 0
                ? 'Begin your first conversation with Gemini to unpack your thoughts and receive automated summaries, key takeaways, and sentiment analytics.'
                : 'Try adjusting your search query, clearing your tag filters, or selecting a different sentiment.'}
            </p>
          </div>
          {entries.length === 0 && (
            <button
              onClick={onNewSession}
              className="btn-primary-cta inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded-xl text-xs font-bold shadow-sm transition active:scale-95"
            >
              <PlusCircle className="w-4 h-4 text-neutral-900" />
              <span className="text-neutral-900">Start Your First Reflection</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEntries.map((entry) => {
            const sentStyle = getSentimentColor(entry.sentiment);
            return (
              <div
                key={entry.id}
                onClick={() => onSelectEntry(entry)}
                className="group bg-black hover:bg-white/[0.03] border border-[#1E1E20] hover:border-[#2A2A2D] rounded-2xl p-5 transition cursor-pointer flex flex-col justify-between space-y-4 shadow-sm"
              >
                {/* Card Top Meta */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border flex items-center gap-1.5 ${sentStyle.badge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${sentStyle.dot}`} />
                      {entry.sentiment} ({entry.confidence}%)
                    </span>
                    <span className="text-[10px] text-[#808080] flex items-center gap-1 font-medium">
                      <Calendar className="w-3 h-3" />
                      {formatDate(entry.createdAt)} • {formatTime(entry.createdAt)}
                    </span>
                  </div>

                  {editingCardId === entry.id ? (
                    <div
                      className="flex items-center gap-1.5 pt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editingCardTitle}
                        onChange={(e) => setEditingCardTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveCardTitle(e, entry.id);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingCardId(null);
                          }
                        }}
                        disabled={isSavingCardTitle}
                        autoFocus
                        placeholder="Session name..."
                        className="font-semibold text-sm text-white bg-[#1C1C1E] border border-[#4285F4] rounded-lg px-2.5 py-1 focus:outline-hidden w-full"
                      />
                      <button
                        onClick={(e) => handleSaveCardTitle(e, entry.id)}
                        disabled={isSavingCardTitle || !editingCardTitle.trim()}
                        className="btn-primary-cta p-1.5 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded-lg transition disabled:opacity-50 shrink-0 cursor-pointer active:scale-95"
                        title="Save title"
                      >
                        <Check className="w-3.5 h-3.5 text-neutral-900" />
                      </button>
                      <button
                        onClick={handleCancelCardTitle}
                        disabled={isSavingCardTitle}
                        className="p-1.5 bg-[#2A2A2D] hover:bg-[#3A3A3D] text-[#A0A0A0] hover:text-white rounded-lg transition shrink-0 cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-base text-white group-hover:text-[#4285F4] transition leading-snug flex-1">
                        {entry.title}
                      </h3>
                      {onUpdateTitle && (
                        <button
                          onClick={(e) => handleStartEditCardTitle(e, entry)}
                          className="p-1 text-[#606060] hover:text-[#4285F4] hover:bg-[#4285F415] rounded-md transition opacity-80 group-hover:opacity-100 shrink-0 cursor-pointer"
                          title="Edit session name"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-[#A0A0A0] line-clamp-3 leading-relaxed">
                    {entry.summary}
                  </p>
                </div>

                {/* Card Footer: Tags & Energy */}
                <div className="space-y-2.5 pt-2 border-t border-[#1E1E20]">
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.tags.slice(0, 3).map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-[#2A2A2D] text-[10px] rounded text-[#E0E0E0] border border-[#3A3A3D]"
                        >
                          #{t}
                        </span>
                      ))}
                      {entry.tags.length > 3 && (
                        <span className="text-[10px] text-[#606060] self-center">
                          +{entry.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-[#808080]">
                    <span className="truncate">
                      Energy: <strong className="font-medium text-[#C0C0C0]">{entry.emotionalEnergy}</strong>
                    </span>
                    <span className="flex items-center gap-1 text-[#4285F4] font-semibold group-hover:translate-x-0.5 transition">
                      View Takeaways <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Feed Bottom Sentinel */}
      {entries.length > 0 && (
        <div id="journal-feed-bottom-sentinel" className="h-6 w-full" aria-hidden="true" />
      )}
    </div>
  );
}

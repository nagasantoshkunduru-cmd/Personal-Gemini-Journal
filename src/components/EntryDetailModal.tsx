import { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Calendar,
  Clock,
  Tag,
  Smile,
  Zap,
  HelpCircle,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Shield,
  FileText,
  CheckCircle,
  Copy,
  Check,
  Lock,
  Edit3
} from 'lucide-react';
import type { JournalEntry, UserAuthProfile } from '../types';
import { formatDate, formatTime, getSentimentColor } from '../lib/sanitize';

interface EntryDetailModalProps {
  entry: JournalEntry | null;
  isOpen: boolean;
  currentUser?: UserAuthProfile | null;
  onClose: () => void;
  onDelete: (entryId: string) => Promise<void>;
  onUpdateTitle?: (entryId: string, newTitle: string) => Promise<void>;
  onTagClick?: (tag: string) => void;
  onRequireAuth?: () => void;
}

export function EntryDetailModal({
  entry,
  isOpen,
  currentUser,
  onClose,
  onDelete,
  onUpdateTitle,
  onTagClick,
  onRequireAuth,
}: EntryDetailModalProps) {
  const [showRawChat, setShowRawChat] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [titleSavedSuccess, setTitleSavedSuccess] = useState(false);

  useEffect(() => {
    if (entry) {
      setEditedTitle(entry.title || '');
      setIsEditingTitle(false);
      setTitleSavedSuccess(false);
    }
  }, [entry?.id, entry?.title]);

  if (!isOpen || !entry) return null;

  const sentimentStyle = getSentimentColor(entry.sentiment);

  const handleExportMarkdown = () => {
    const md = `# ${entry.title}
**Date:** ${formatDate(entry.createdAt)} ${formatTime(entry.createdAt)}
**Sentiment:** ${entry.sentiment} (Score: ${entry.sentimentScore > 0 ? '+' : ''}${entry.sentimentScore.toFixed(2)}, Confidence: ${entry.confidence}%)
**Tags:** ${entry.tags.join(', ')}
**Energy:** ${entry.emotionalEnergy} | **Dominant Emotion:** ${entry.primaryEmotion}

---

## Executive Reflection Summary
${entry.summary}

### Key Takeaways
${entry.keyTakeaways.map((t) => `- ${t}`).join('\n')}

### Gratitude & Strengths
${entry.gratitudeOrWins.map((g) => `- ${g}`).join('\n')}

### Actionable Next Steps
${entry.actionableSteps.map((a) => `- ${a}`).join('\n')}

### Tomorrow's Reflection Prompt
> "${entry.reflectionPromptForTomorrow}"

---

## Complete Session Transcript
${entry.rawTranscript}
`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `journal_${entry.dateString.slice(0, 10)}_${entry.id.slice(-6)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = () => {
    const text = `${entry.title}\n\nSummary:\n${entry.summary}\n\nKey Insights:\n${entry.keyTakeaways.join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveTitle = async () => {
    if (!entry || !onUpdateTitle) return;
    if (!currentUser) {
      if (onRequireAuth) onRequireAuth();
      return;
    }
    const trimmed = editedTitle.trim();
    if (!trimmed) return;
    if (trimmed === entry.title) {
      setIsEditingTitle(false);
      return;
    }

    setIsSavingTitle(true);
    try {
      await onUpdateTitle(entry.id, trimmed);
      setIsEditingTitle(false);
      setTitleSavedSuccess(true);
      setTimeout(() => setTitleSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to update title:', err);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleKeyDownTitle = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditedTitle(entry.title || '');
      setIsEditingTitle(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!currentUser) {
      if (onRequireAuth) {
        onRequireAuth();
      } else {
        alert('Please sign in to delete or make changes to journal entries.');
      }
      return;
    }

    if (confirm('Are you sure you want to permanently delete this journal entry? This cannot be undone.')) {
      setIsDeleting(true);
      try {
        await onDelete(entry.id);
        onClose();
      } catch (err: any) {
        console.error('Delete error:', err);
        alert('Failed to delete entry: ' + (err.message || 'Check your permissions.'));
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div
      id="entry-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in"
    >
      <div className="bg-black border border-[#1E1E20] rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-[#1E1E20] flex items-center justify-between bg-black">
          <div className="flex items-center space-x-2">
            <span
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase border flex items-center gap-1.5 ${sentimentStyle.badge}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${sentimentStyle.dot}`} />
              {entry.sentiment} ({entry.confidence}%)
            </span>
            <span className="text-xs text-[#606060]">•</span>
            <span className="text-xs text-[#808080] font-medium">
              {entry.emotionalEnergy}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              title="Copy Summary"
              className="p-2 text-[#808080] hover:text-[#E0E0E0] hover:bg-[#161618] rounded-xl transition"
            >
              {copied ? <Check className="w-4 h-4 text-[#4ADE80]" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleExportMarkdown}
              title="Export Markdown"
              className="p-2 text-[#808080] hover:text-[#E0E0E0] hover:bg-[#161618] rounded-xl transition"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleDeleteEntry}
              disabled={isDeleting}
              title="Delete Entry"
              className="p-2 text-[#808080] hover:text-[#F87171] hover:bg-[#F8717115] rounded-xl transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              id="close-entry-modal-btn"
              onClick={onClose}
              className="p-2 text-[#808080] hover:text-[#E0E0E0] hover:bg-[#161618] rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Header Info with Small Edit Option next to Name */}
          <div>
            {isEditingTitle ? (
              <div className="flex items-center gap-2 max-w-xl">
                <input
                  id="edit-session-title-input"
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={handleKeyDownTitle}
                  disabled={isSavingTitle}
                  autoFocus
                  placeholder="Enter session title..."
                  className="font-bold text-xl sm:text-2xl text-white bg-[#161618] border border-[#4285F4] rounded-xl px-3 py-1.5 focus:outline-hidden w-full shadow-inner"
                />
                <button
                  id="save-session-title-btn"
                  onClick={handleSaveTitle}
                  disabled={isSavingTitle || !editedTitle.trim()}
                  className="btn-primary-cta p-2 bg-white hover:bg-neutral-100 disabled:opacity-50 text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer shadow-xs active:scale-95"
                  title="Save title (Enter)"
                >
                  <Check className="w-4 h-4 text-neutral-900" />
                </button>
                <button
                  id="cancel-session-title-btn"
                  onClick={() => {
                    setEditedTitle(entry.title || '');
                    setIsEditingTitle(false);
                  }}
                  disabled={isSavingTitle}
                  className="p-2 bg-[#1E1E20] hover:bg-[#2A2A2D] text-[#A0A0A0] hover:text-white rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer"
                  title="Cancel (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 flex-wrap group/title">
                <h1 className="font-bold text-xl sm:text-2xl text-white leading-tight">
                  {entry.title}
                </h1>
                <button
                  id="edit-session-name-btn"
                  onClick={() => {
                    setEditedTitle(entry.title || '');
                    setIsEditingTitle(true);
                  }}
                  className="p-1.5 text-[#808080] hover:text-[#4285F4] hover:bg-[#4285F415] rounded-lg transition shrink-0 cursor-pointer flex items-center gap-1 text-xs font-medium"
                  title="Edit session name"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">Edit name</span>
                </button>
                {titleSavedSuccess && (
                  <span className="text-[11px] text-[#4ADE80] font-medium flex items-center gap-1 bg-[#4ADE8015] border border-[#4ADE8030] px-2 py-0.5 rounded-md animate-in fade-in">
                    <Check className="w-3 h-3" />
                    <span>Saved</span>
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#808080] mt-2">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#606060]" />
                {formatDate(entry.createdAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#606060]" />
                {formatTime(entry.createdAt)}
              </span>
              <span>•</span>
              <span>{entry.wordCount || 0} words</span>
              <span>•</span>
              <span>{entry.turnCount || 0} conversational turns</span>
            </div>
          </div>

          {/* Tags Section */}
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {entry.tags.map((tag, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (onTagClick) {
                      onTagClick(tag);
                      onClose();
                    }
                  }}
                  className="px-2.5 py-1 bg-[#161618] hover:bg-[#1E1E20] text-[#E0E0E0] text-xs font-medium rounded-lg transition border border-[#2A2A2D] hover:border-[#3A3A3D] flex items-center gap-1"
                >
                  <Tag className="w-3 h-3 text-[#808080]" />
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {/* Executive Summary Card */}
          <div className="p-5 bg-[#161618] border border-[#2A2A2D] rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-[#4285F4] uppercase tracking-widest">
              <Sparkles className="w-4 h-4 text-[#4285F4]" />
              Auto-Summary & Synthesis
            </div>
            <p className="text-sm text-[#C0C0C0] leading-relaxed font-sans">
              {entry.summary}
            </p>
          </div>

          {/* Key Insights & Takeaways Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Takeaways */}
            <div className="p-4 bg-[#161618] border border-[#2A2A2D] rounded-2xl space-y-2.5">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#4285F4]" />
                Key Learnings & Takeaways
              </h3>
              <ul className="space-y-1.5 text-xs text-[#A0A0A0]">
                {entry.keyTakeaways.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#4285F4] font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Gratitude & Strengths */}
            <div className="p-4 bg-[#161618] border border-[#2A2A2D] rounded-2xl space-y-2.5">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Smile className="w-3.5 h-3.5 text-[#4ADE80]" />
                Gratitude & Strengths
              </h3>
              <ul className="space-y-1.5 text-xs text-[#A0A0A0]">
                {entry.gratitudeOrWins.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#4ADE80] font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Actionable Steps & Tomorrow's Reflection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#161618] border border-[#2A2A2D] rounded-2xl space-y-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#4285F4]" />
                Actionable Next Steps
              </h3>
              <ul className="space-y-1 text-xs text-[#A0A0A0]">
                {entry.actionableSteps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#4285F4] font-bold">→</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-[#161618] border border-[#2A2A2D] rounded-2xl space-y-2">
              <h3 className="text-xs font-bold text-[#FBBF24] flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[#FBBF24]" />
                Tomorrow's Reflection Prompt
              </h3>
              <p className="text-xs italic text-[#A0A0A0]">
                "{entry.reflectionPromptForTomorrow}"
              </p>
            </div>
          </div>

          {/* Expandable Conversation Transcript */}
          <div className="border border-[#1E1E20] rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowRawChat(!showRawChat)}
              className="w-full px-5 py-3 bg-[#161618] flex items-center justify-between text-xs font-semibold text-[#C0C0C0] hover:bg-[#1E1E20] transition"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#808080]" />
                Original Session Transcript ({entry.messages?.length || 0} turns)
              </span>
              {showRawChat ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showRawChat && (
              <div className="p-5 space-y-4 bg-black text-xs border-t border-[#1E1E20] max-h-72 overflow-y-auto">
                {entry.messages && entry.messages.length > 0 ? (
                  entry.messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl ${
                        m.role === 'user'
                          ? 'bg-[#1E1E20] text-[#E0E0E0] ml-4 border border-[#2A2A2D]'
                          : 'bg-[#161618] text-[#C0C0C0] mr-4 border border-[#1E1E20]'
                      }`}
                    >
                      <span className="font-bold text-[10px] uppercase tracking-wider text-[#606060] block mb-1">
                        {m.role === 'user' ? 'Reflector' : 'Gemini Guide'}
                      </span>
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="whitespace-pre-wrap text-[#A0A0A0] leading-relaxed font-mono text-[11px]">
                    {entry.rawTranscript}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#1E1E20] bg-black flex items-center justify-between text-xs text-[#808080]">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#4ADE80] bg-[#1A3020] border border-[#225030] px-2 py-1 rounded">
            <Shield className="w-3.5 h-3.5" />
            <span>Vault Protected: users/{entry.userId.slice(0, 6)}...</span>
          </div>
          <button
            id="entry-detail-done-btn"
            onClick={onClose}
            className="btn-primary-cta px-4 py-2 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

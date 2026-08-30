import { useState } from 'react';
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
  Lock
} from 'lucide-react';
import type { JournalEntry, UserAuthProfile } from '../types';
import { formatDate, formatTime, getSentimentColor } from '../lib/sanitize';

interface EntryDetailModalProps {
  entry: JournalEntry | null;
  isOpen: boolean;
  currentUser?: UserAuthProfile | null;
  onClose: () => void;
  onDelete: (entryId: string) => Promise<void>;
  onTagClick?: (tag: string) => void;
  onRequireAuth?: () => void;
}

export function EntryDetailModal({
  entry,
  isOpen,
  currentUser,
  onClose,
  onDelete,
  onTagClick,
  onRequireAuth,
}: EntryDetailModalProps) {
  const [showRawChat, setShowRawChat] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

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
      <div className="bg-[#0E0E10] border border-[#1E1E20] rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-[#1E1E20] flex items-center justify-between bg-[#0A0A0B]">
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
          {/* Header Info */}
          <div>
            <h1 className="font-bold text-2xl text-white leading-tight">
              {entry.title}
            </h1>
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
              <div className="p-5 space-y-4 bg-[#0A0A0B] text-xs border-t border-[#1E1E20] max-h-72 overflow-y-auto">
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
        <div className="px-6 py-4 border-t border-[#1E1E20] bg-[#0A0A0B] flex items-center justify-between text-xs text-[#808080]">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#4ADE80] bg-[#1A3020] border border-[#225030] px-2 py-1 rounded">
            <Shield className="w-3.5 h-3.5" />
            <span>Vault Protected: users/{entry.userId.slice(0, 6)}...</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#4285F4] hover:bg-[#3367D6] text-white rounded-xl text-xs font-bold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

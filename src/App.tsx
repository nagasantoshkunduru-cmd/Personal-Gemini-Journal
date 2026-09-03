import { useState, useEffect } from 'react';
import type { JournalEntry, UserAuthProfile } from './types';
import {
  onAuthUserChanged,
  subscribeUserEntries,
  deleteJournalEntry,
  updateJournalEntryTitle,
} from './lib/firebase';
import { Navbar } from './components/Navbar';
import { JournalList } from './components/JournalList';
import { JournalChat } from './components/JournalChat';
import { EntryDetailModal } from './components/EntryDetailModal';
import { SentimentAnalytics } from './components/SentimentAnalytics';
import { SecurityInspector } from './components/SecurityInspector';
import { AuthModal } from './components/AuthModal';
import { PlusCircle } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAuthProfile | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeView, setActiveView] = useState<'journal' | 'analytics'>('journal');
  const [history, setHistory] = useState<('journal' | 'analytics')[]>(['journal']);
  const [isChatting, setIsChatting] = useState(false);
  const [activeSessionTitle, setActiveSessionTitle] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(true);
  const [authModalStep, setAuthModalStep] = useState<'auth' | 'name_prompt'>('auth');
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);

  // 1. Mandatory Firebase Auth listener on app boot
  useEffect(() => {
    const unsubscribeAuth = onAuthUserChanged((profile) => {
      setCurrentUser(profile);
      setAuthInitialized(true);
      if (!profile) {
        setAuthModalStep('auth');
        setIsAuthModalOpen(true);
        setEntries([]);
      } else {
        setIsAuthModalOpen(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Real-time User-Isolated Firestore entries subscription (tied to currentUser.uid)
  useEffect(() => {
    if (!currentUser?.uid) {
      setEntries([]);
      return;
    }

    const unsubscribeFirestore = subscribeUserEntries(
      currentUser.uid,
      (data) => {
        setEntries(data);
      },
      (error) => {
        console.error('Firestore subscription error:', error);
      }
    );

    return () => {
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [currentUser?.uid]);

  // Scroll detector for floating "New Entry" action button on dashboard feed
  useEffect(() => {
    // Hidden by default when fewer than 3 total entries (or <= 3), or when chatting / in analytics
    if (isChatting || activeView !== 'journal' || entries.length <= 3) {
      setIsScrolledToBottom(false);
      return;
    }

    let observer: IntersectionObserver | null = null;

    const checkScrollPosition = () => {
      const windowHeight = window.innerHeight;
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const documentHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.body.clientHeight,
        document.documentElement.clientHeight
      );

      const distanceToBottom = documentHeight - (scrollY + windowHeight);
      // User has scrolled down into the feed and reached near the bottom
      const hasScrolledDown = scrollY > 60;
      const isAtBottom = hasScrolledDown && distanceToBottom <= 350;

      setIsScrolledToBottom(isAtBottom);
    };

    const sentinel = document.getElementById('journal-feed-bottom-sentinel');
    if (sentinel && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entriesList) => {
          const entry = entriesList[0];
          const scrollY = window.scrollY || document.documentElement.scrollTop;
          if (entry && entry.isIntersecting && scrollY > 60) {
            setIsScrolledToBottom(true);
          } else {
            checkScrollPosition();
          }
        },
        { rootMargin: '100px 0px 0px 0px', threshold: 0.1 }
      );
      observer.observe(sentinel);
    }

    window.addEventListener('scroll', checkScrollPosition, { passive: true });
    window.addEventListener('resize', checkScrollPosition, { passive: true });

    // Initial check
    checkScrollPosition();

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('scroll', checkScrollPosition);
      window.removeEventListener('resize', checkScrollPosition);
    };
  }, [isChatting, activeView, entries.length]);

  // Keep selectedEntry in sync when entries change or pendingEntryId resolves
  useEffect(() => {
    if (pendingEntryId && entries.length > 0) {
      const matched = entries.find((e) => e.id === pendingEntryId);
      if (matched) {
        setSelectedEntry(matched);
        setPendingEntryId(null);
      }
    } else if (selectedEntry) {
      const updated = entries.find((e) => e.id === selectedEntry.id);
      if (updated && updated.title !== selectedEntry.title) {
        setSelectedEntry(updated);
      }
    }
  }, [entries, pendingEntryId, selectedEntry]);

  const handleSetActiveView = (view: 'journal' | 'analytics') => {
    if (view !== activeView) {
      setHistory((prev) => [...prev, view]);
    }
    if (isChatting) {
      setIsChatting(false);
    }
    setActiveView(view);
  };

  const handleGoBack = () => {
    if (selectedEntry) {
      setSelectedEntry(null);
      return;
    }
    if (isChatting) {
      setIsChatting(false);
      return;
    }
    if (history.length > 1) {
      const updatedHistory = [...history];
      updatedHistory.pop(); // remove current
      const prevView = updatedHistory[updatedHistory.length - 1] || 'journal';
      setHistory(updatedHistory);
      setActiveView(prevView);
    } else if (activeView === 'analytics') {
      setActiveView('journal');
      setHistory(['journal']);
    } else {
      setActiveView('journal');
    }
  };

  const handleStartNewSession = () => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
    } else {
      setActiveSessionTitle('');
      setIsChatting(true);
    }
  };

  const handleSessionSaved = (newEntryId: string) => {
    setIsChatting(false);
    setActiveSessionTitle('');
    // Find saved entry or mark pending to open detail modal
    const matched = entries.find((e) => e.id === newEntryId);
    if (matched) {
      setSelectedEntry(matched);
    } else {
      setPendingEntryId(newEntryId);
    }
  };

  const handleUpdateEntryTitle = async (entryId: string, newTitle: string) => {
    if (!currentUser?.uid) {
      setIsAuthModalOpen(true);
      return;
    }
    // Optimistic UI updates
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, title: newTitle, updatedAt: Date.now() } : e))
    );
    if (selectedEntry && selectedEntry.id === entryId) {
      setSelectedEntry((prev) => (prev ? { ...prev, title: newTitle, updatedAt: Date.now() } : null));
    }
    await updateJournalEntryTitle(entryId, newTitle, currentUser.uid);
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    await deleteJournalEntry(entryId, currentUser.uid);
  };

  const handleSelectTagFromAnalytics = (_tag: string) => {
    handleSetActiveView('journal');
  };

  const isDashboardHome = activeView === 'journal' && !isChatting && selectedEntry === null;

  return (
    <div
      className={`${
        isChatting ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-screen'
      } bg-[#0A0A0B] text-[#E0E0E0] flex flex-col font-sans selection:bg-[#4285F4]/30 selection:text-white`}
    >
      {/* Top Application Bar with Dynamic Top-Left Back Button & Dynamic Session Title */}
      <Navbar
        user={currentUser}
        activeView={activeView}
        setActiveView={handleSetActiveView}
        isChatting={isChatting}
        sessionTitle={activeSessionTitle}
        onSessionTitleChange={setActiveSessionTitle}
        onOpenNewSession={handleStartNewSession}
        onOpenAuth={() => {
          setAuthModalStep('auth');
          setIsAuthModalOpen(true);
        }}
        onOpenProfile={() => {
          setAuthModalStep('name_prompt');
          setIsAuthModalOpen(true);
        }}
        onOpenSecurityInspector={() => setIsSecurityModalOpen(true)}
        onGoBack={handleGoBack}
        canGoBack={!isDashboardHome}
      />

      {/* Main Content Area */}
      <main className={`flex-1 bg-[#0A0A0B] ${isChatting ? 'flex flex-col min-h-0 overflow-hidden' : ''}`}>
        {/* If user is active in interactive Journal Chat Session */}
        {isChatting ? (
          <JournalChat
            currentUser={currentUser}
            sessionTitle={activeSessionTitle}
            onSessionTitleChange={setActiveSessionTitle}
            onSessionSaved={handleSessionSaved}
            onCancel={() => setIsChatting(false)}
            onRequireAuth={() => setIsAuthModalOpen(true)}
          />
        ) : (
          <>
            {/* View Switcher: Timeline vs Sentiment Analytics */}
            {activeView === 'journal' ? (
              <JournalList
                entries={entries}
                currentUser={currentUser}
                onSelectEntry={(entry) => setSelectedEntry(entry)}
                onNewSession={handleStartNewSession}
                onUpdateTitle={handleUpdateEntryTitle}
              />
            ) : (
              <SentimentAnalytics
                entries={entries}
                onSelectTag={handleSelectTagFromAnalytics}
                onNewSession={handleStartNewSession}
              />
            )}
          </>
        )}
      </main>

      {/* Floating "New Entry" / Plus Action Button (Appears only when user has > 3 entries AND scrolled to bottom of feed) */}
      {!isChatting && activeView === 'journal' && entries.length > 3 && isScrolledToBottom && (
        <div className="fixed bottom-6 right-6 z-30 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <button
            id="floating-new-entry-btn"
            onClick={handleStartNewSession}
            className="flex items-center gap-2.5 px-4 py-3 bg-[#4285F4] hover:bg-[#3367D6] text-white rounded-full shadow-2xl shadow-[#4285F4]/30 border border-[#4285F4]/40 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            title="Start New Journal Entry"
          >
            <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200 shrink-0" />
            <span className="text-xs sm:text-sm font-bold tracking-wide">New Entry</span>
          </button>
        </div>
      )}

      {/* Modals */}
      <EntryDetailModal
        entry={selectedEntry}
        isOpen={Boolean(selectedEntry)}
        currentUser={currentUser}
        onClose={() => setSelectedEntry(null)}
        onDelete={handleDeleteEntry}
        onUpdateTitle={handleUpdateEntryTitle}
        onRequireAuth={() => setIsAuthModalOpen(true)}
      />

      <AuthModal
        isOpen={isAuthModalOpen || !currentUser}
        isDismissible={Boolean(currentUser)}
        initialStep={authModalStep}
        currentUser={currentUser}
        onClose={() => {
          if (currentUser) {
            setIsAuthModalOpen(false);
          }
        }}
        onSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthModalOpen(false);
        }}
      />

      <SecurityInspector
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
}


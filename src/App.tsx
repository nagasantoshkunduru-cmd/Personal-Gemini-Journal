import { useState, useEffect } from 'react';
import type { JournalEntry, UserAuthProfile } from './types';
import { onAuthUserChanged, subscribeUserEntries, deleteJournalEntry } from './lib/firebase';
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
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(true);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  // 1. Mandatory Firebase Auth listener on app boot
  useEffect(() => {
    const unsubscribeAuth = onAuthUserChanged((profile) => {
      setCurrentUser(profile);
      setAuthInitialized(true);
      if (!profile) {
        setIsAuthModalOpen(true);
        setEntries([]);
      } else {
        setIsAuthModalOpen(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Real-time User-Isolated Firestore entries subscription (tied to currentUser.uid)
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
      setIsChatting(true);
    }
  };

  const handleSessionSaved = (newEntryId: string) => {
    setIsChatting(false);
    // Find saved entry or open detail modal
    const matched = entries.find((e) => e.id === newEntryId);
    if (matched) {
      setSelectedEntry(matched);
    }
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
    <div className="min-h-screen bg-[#0A0A0B] text-[#E0E0E0] flex flex-col font-sans transition-colors duration-200 selection:bg-[#4285F4]/30 selection:text-white">
      {/* Top Application Bar with Dynamic Top-Left Back Button */}
      <Navbar
        user={currentUser}
        activeView={activeView}
        setActiveView={handleSetActiveView}
        onOpenNewSession={handleStartNewSession}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenSecurityInspector={() => setIsSecurityModalOpen(true)}
        onGoBack={handleGoBack}
        canGoBack={!isDashboardHome}
      />

      {/* Main Content Area */}
      <main className="flex-1 bg-[#0A0A0B]">
        {/* If user is active in interactive Journal Chat Session */}
        {isChatting ? (
          <JournalChat
            currentUser={currentUser}
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
                onSelectEntry={(entry) => setSelectedEntry(entry)}
                onNewSession={handleStartNewSession}
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

      {/* Floating Quick Action (if on list view and not chatting) */}
      {!isChatting && (
        <div className="fixed bottom-6 right-6 z-30 sm:hidden">
          <button
            id="mobile-fab-new-session"
            onClick={handleStartNewSession}
            className="p-4 bg-[#4285F4] hover:bg-[#3367D6] text-white rounded-full shadow-xl transition flex items-center justify-center cursor-pointer"
          >
            <PlusCircle className="w-6 h-6" />
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
        onRequireAuth={() => setIsAuthModalOpen(true)}
      />

      <AuthModal
        isOpen={isAuthModalOpen || !currentUser}
        isDismissible={Boolean(currentUser)}
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


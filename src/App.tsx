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
import { ShieldCheck, Sparkles, PlusCircle } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAuthProfile | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeView, setActiveView] = useState<'journal' | 'analytics'>('journal');
  const [isChatting, setIsChatting] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthUserChanged((profile) => {
      setCurrentUser(profile);
      setIsLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Real-time Firestore entries subscription strictly scoped to currentUser.uid
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

    return () => unsubscribeFirestore();
  }, [currentUser?.uid]);

  const handleSessionSaved = (newEntryId: string) => {
    setIsChatting(false);
    // Find saved entry or open detail modal
    const matched = entries.find((e) => e.id === newEntryId);
    if (matched) {
      setSelectedEntry(matched);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!currentUser?.uid) return;
    await deleteJournalEntry(currentUser.uid, entryId);
  };

  const handleSelectTagFromAnalytics = (tag: string) => {
    setActiveView('journal');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E0E0E0] flex flex-col font-sans transition-colors duration-200 selection:bg-[#4285F4]/30 selection:text-white">
      {/* Top Application Bar */}
      <Navbar
        user={currentUser}
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenNewSession={() => {
          if (!currentUser) {
            setIsAuthModalOpen(true);
          } else {
            setIsChatting(true);
          }
        }}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenSecurityInspector={() => setIsSecurityModalOpen(true)}
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
                onNewSession={() => {
                  if (!currentUser) {
                    setIsAuthModalOpen(true);
                  } else {
                    setIsChatting(true);
                  }
                }}
              />
            ) : (
              <SentimentAnalytics
                entries={entries}
                onSelectTag={handleSelectTagFromAnalytics}
                onNewSession={() => {
                  if (!currentUser) {
                    setIsAuthModalOpen(true);
                  } else {
                    setIsChatting(true);
                  }
                }}
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
            onClick={() => {
              if (!currentUser) {
                setIsAuthModalOpen(true);
              } else {
                setIsChatting(true);
              }
            }}
            className="p-4 bg-[#4285F4] hover:bg-[#3367D6] text-white rounded-full shadow-xl transition flex items-center justify-center"
          >
            <PlusCircle className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Modals */}
      <EntryDetailModal
        entry={selectedEntry}
        isOpen={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        onDelete={handleDeleteEntry}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
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

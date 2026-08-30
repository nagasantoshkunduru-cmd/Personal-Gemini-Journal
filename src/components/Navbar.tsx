import { useState } from 'react';
import {
  BookOpen,
  ShieldCheck,
  PlusCircle,
  BarChart3,
  LogOut,
  User,
  Sparkles,
  Lock,
  ChevronDown,
  Info,
  Sun,
  Moon
} from 'lucide-react';
import type { UserAuthProfile } from '../types';
import { signOut } from '../lib/firebase';
import { useTheme } from '../lib/theme';

interface NavbarProps {
  user: UserAuthProfile | null;
  activeView: 'journal' | 'analytics';
  setActiveView: (view: 'journal' | 'analytics') => void;
  onOpenNewSession: () => void;
  onOpenAuth: () => void;
  onOpenSecurityInspector: () => void;
}

export function Navbar({
  user,
  activeView,
  setActiveView,
  onOpenNewSession,
  onOpenAuth,
  onOpenSecurityInspector,
}: NavbarProps) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 bg-[#0A0A0B]/95 backdrop-blur-md border-b border-[#1E1E20]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#9B72F3] flex items-center justify-center text-white shadow-md flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg text-white tracking-tight flex items-center gap-1.5">
                Gemini Journal
              </span>
              <span className="hidden sm:inline-block text-[10px] uppercase tracking-widest text-[#808080] font-bold">
                GCP • Firestore Isolated • Gemini 2.5 Flash
              </span>
            </div>
          </div>

          {/* Center Navigation & Security Status Badge */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* View Toggles */}
            <div className="flex bg-[#161618] border border-[#2A2A2D] p-1 rounded-xl text-xs font-medium">
              <button
                id="nav-journal-view-btn"
                onClick={() => setActiveView('journal')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeView === 'journal'
                    ? 'bg-[#2A2A2D] text-white shadow-xs font-semibold'
                    : 'text-[#808080] hover:text-[#E0E0E0]'
                }`}
              >
                Entries
              </button>
              <button
                id="nav-analytics-view-btn"
                onClick={() => setActiveView('analytics')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeView === 'analytics'
                    ? 'bg-[#2A2A2D] text-white shadow-xs font-semibold'
                    : 'text-[#808080] hover:text-[#E0E0E0]'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Intelligence Insights</span>
                <span className="xs:hidden">Insights</span>
              </button>
            </div>

            {/* Security Verification Trigger */}
            <button
              id="security-inspector-badge-btn"
              onClick={onOpenSecurityInspector}
              title="Click to view full Security Architecture and Threat Model"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-[#1A3020] text-[#4ADE80] border border-[#225030] hover:bg-[#1A3824] transition cursor-pointer"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
              <ShieldCheck className="w-3.5 h-3.5 text-[#4ADE80] shrink-0" />
              <span className="hidden md:inline">Vault: Protected</span>
            </button>
          </div>

          {/* Right Actions: Theme Toggle + New Entry + User Auth */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Dark / Light Mode Toggle Button */}
            <button
              id="nav-theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-xl bg-[#161618] border border-[#2A2A2D] hover:bg-[#1E1E20] hover:border-[#3A3A3D] text-[#C0C0C0] hover:text-white transition flex items-center justify-center cursor-pointer shadow-xs"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#FBBF24]" />
              ) : (
                <Moon className="w-4 h-4 text-[#4285F4]" />
              )}
            </button>

            <button
              id="new-session-nav-btn"
              onClick={onOpenNewSession}
              className="flex items-center gap-1.5 py-2 px-3.5 bg-[#4285F4] hover:bg-[#3367D6] text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Reflect & Chat</span>
              <span className="sm:hidden">New</span>
            </button>

            {/* User Profile or Public Access Status */}
            {user ? (
              <div className="relative">
                <button
                  id="user-profile-menu-btn"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center gap-2 p-1 pl-2 bg-[#161618] rounded-full border border-[#2A2A2D] hover:border-[#3A3A3D] transition cursor-pointer"
                >
                  <span className="text-xs font-medium text-[#C0C0C0] max-w-[100px] truncate hidden sm:inline">
                    {user.displayName || (user.isAnonymous ? 'Public User' : 'User')}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-[#2A2A2D] text-[#4285F4] flex items-center justify-center text-xs font-bold">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="Profile"
                        referrerPolicy="no-referrer"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      user.displayName ? user.displayName.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#808080] mr-1" />
                </button>

                {/* Dropdown */}
                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-[#161618] border border-[#2A2A2D] rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2 border-b border-[#2A2A2D]">
                      <p className="text-xs font-bold text-white truncate">
                        {user.displayName || 'Reflective Journaler'}
                      </p>
                      <p className="text-[11px] text-[#808080] truncate">
                        {user.email || 'Public Session'}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[#4ADE80] bg-[#1A3020] border border-[#225030] px-2 py-0.5 rounded-md w-fit font-mono">
                        <Lock className="w-3 h-3" />
                        <span>Authenticated • Write Access</span>
                      </div>
                    </div>

                    {/* Theme Toggle option inside dropdown */}
                    <button
                      onClick={() => {
                        toggleTheme();
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs text-[#C0C0C0] hover:bg-[#1E1E20] flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {theme === 'dark' ? (
                          <Sun className="w-4 h-4 text-[#FBBF24]" />
                        ) : (
                          <Moon className="w-4 h-4 text-[#4285F4]" />
                        )}
                        <span>Theme: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#2A2A2D] text-[#A0A0A0] font-medium">
                        Toggle
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenSecurityInspector();
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-[#C0C0C0] hover:bg-[#1E1E20] flex items-center gap-2 transition cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#4ADE80]" />
                      View Security Rules
                    </button>

                    <button
                      id="sign-out-btn"
                      onClick={async () => {
                        setShowUserDropdown(false);
                        await signOut();
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-[#F87171] hover:bg-[#F8717110] flex items-center gap-2 transition cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  id="nav-sign-in-btn"
                  onClick={onOpenAuth}
                  className="py-2 px-3.5 bg-[#1A2536] text-[#60A5FA] border border-[#254060] hover:bg-[#203248] hover:border-[#386090] rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Sign in to write and save changes"
                >
                  <User className="w-3.5 h-3.5 text-[#4285F4]" />
                  <span>Sign In to Write</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

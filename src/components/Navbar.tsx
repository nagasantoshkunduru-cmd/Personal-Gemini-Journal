import { useState, useEffect } from 'react';
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
  Sun,
  Moon,
  ArrowLeft,
  Menu,
  X,
  Shield,
  Check
} from 'lucide-react';
import type { UserAuthProfile } from '../types';
import { signOut, getEmailNameFallback } from '../lib/firebase';
import { useTheme } from '../lib/theme';

interface NavbarProps {
  user: UserAuthProfile | null;
  activeView: 'journal' | 'analytics';
  setActiveView: (view: 'journal' | 'analytics') => void;
  isChatting?: boolean;
  sessionTitle?: string;
  onSessionTitleChange?: (title: string) => void;
  onOpenNewSession: () => void;
  onOpenAuth: () => void;
  onOpenProfile?: () => void;
  onOpenSecurityInspector: () => void;
  onGoBack?: () => void;
  canGoBack?: boolean;
}

export function Navbar({
  user,
  activeView,
  setActiveView,
  isChatting = false,
  sessionTitle = '',
  onSessionTitleChange,
  onOpenNewSession,
  onOpenAuth,
  onOpenProfile,
  onOpenSecurityInspector,
  onGoBack,
  canGoBack = true,
}: NavbarProps) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Dynamic user display name & avatar initial calculation
  const userDisplayName = user ? (user.displayName || getEmailNameFallback(user.email)) : '';
  const userInitial = userDisplayName ? userDisplayName.charAt(0).toUpperCase() : 'U';

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#user-profile-menu-btn') && !target.closest('#mobile-hamburger-btn')) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Close mobile menu on escape key or resize
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        setShowUserDropdown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-3 w-full">
          {/* Left: Dynamic Back Button & Brand Identity / Dynamic Session Title Input */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
            {/* Top Left Back Button (Visible when navigating away from Home/Dashboard) */}
            {canGoBack && onGoBack && (
              <button
                id="nav-top-left-back-btn"
                onClick={onGoBack}
                aria-label="Go back tab"
                title="Go back to previous tab / view"
                className="group flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#161618] hover:bg-[#202024] text-[#C0C0C0] hover:text-white border border-[#2A2A2D] hover:border-[#4285F4]/60 transition-all duration-150 shadow-xs cursor-pointer active:scale-95 shrink-0"
              >
                <ArrowLeft className="w-4 h-4 text-[#4285F4] transition-transform group-hover:-translate-x-0.5" />
                <span className="text-xs font-semibold tracking-tight hidden sm:inline">Back</span>
              </button>
            )}

            {/* Dynamic Session Title Input when in active reflection session */}
            {isChatting ? (
              <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
                <img
                  src="/metallic_star_logo.png"
                  alt="Gemini Journal"
                  className="h-7 sm:h-8 w-auto object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] shrink-0 select-none"
                />
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <input
                    id="navbar-session-title-input"
                    type="text"
                    value={sessionTitle}
                    onChange={(e) => onSessionTitleChange?.(e.target.value)}
                    placeholder="Session Title (or auto-name)"
                    className="font-bold text-xs sm:text-sm md:text-base text-white bg-transparent border-b border-transparent hover:border-[#2A2A2D] focus:border-[#4285F4] focus:outline-hidden px-1.5 py-1 rounded transition w-full min-w-[70px] truncate placeholder-[#606060]"
                    title="Enter reflection session title"
                  />
                  <span className="hidden xl:flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#4ADE80] font-bold px-2 py-0.5 rounded-md bg-[#1A3020] border border-[#225030] shrink-0 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
                    <span>Active</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2.5 shrink-0">
                <img
                  src="/metallic_star_logo.png"
                  alt="Gemini Journal"
                  className="h-9 sm:h-10 w-auto object-contain filter drop-shadow-[0_0_10px_rgba(255,255,255,0.35)] shrink-0 select-none"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-base sm:text-lg text-white tracking-tight leading-none whitespace-nowrap">
                    Gemini Journal
                  </span>
                  <span className="hidden lg:inline-block text-[10px] uppercase tracking-widest text-[#808080] font-bold mt-0.5">
                    GCP • Firestore Isolated • Gemini 3.6 Flash
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Desktop & Tablet Center Navigation (Visible on md+ only when NOT chatting to prevent clutter) */}
          {!isChatting && (
            <div className="hidden md:flex items-center gap-1.5 lg:gap-3 shrink-0">
              {/* View Toggles */}
              <div className="flex bg-[#161618] border border-[#2A2A2D] p-1 rounded-xl text-xs font-medium shrink-0">
                <button
                  id="nav-journal-view-btn"
                  onClick={() => setActiveView('journal')}
                  className={`px-2.5 lg:px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
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
                  className={`px-2.5 lg:px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
                    activeView === 'analytics'
                      ? 'bg-[#2A2A2D] text-white shadow-xs font-semibold'
                      : 'text-[#808080] hover:text-[#E0E0E0]'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-[#9B72F3] shrink-0" />
                  <span>
                    <span className="hidden xl:inline">Intelligence </span>Insights
                  </span>
                </button>
              </div>

              {/* Security Verification Trigger */}
              <button
                id="security-inspector-badge-btn"
                onClick={onOpenSecurityInspector}
                title="Click to view full Security Architecture and Threat Model"
                className="flex items-center gap-1.5 px-2 lg:px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-[#1A3020] text-[#4ADE80] border border-[#225030] hover:bg-[#1A3824] transition cursor-pointer shrink-0 whitespace-nowrap"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] shrink-0" />
                <ShieldCheck className="w-3.5 h-3.5 text-[#4ADE80] shrink-0" />
                <span>
                  <span className="hidden xl:inline">Vault: </span>Protected
                </span>
              </button>
            </div>
          )}

          {/* Desktop & Tablet Right Actions (Visible on md+) */}
          <div className="hidden md:flex items-center gap-1.5 lg:gap-2.5 shrink-0">
            {/* If chatting, show Auto-saved status indicator in header */}
            {isChatting && (
              <div
                id="navbar-autosave-indicator"
                className="flex items-center gap-1.5 text-[11px] font-medium text-[#4ADE80] bg-[#1A3020] border border-[#225030] px-2.5 py-1.5 rounded-xl shrink-0 shadow-xs whitespace-nowrap"
                title="Autosaved locally in real-time"
              >
                <Check className="w-3.5 h-3.5 text-[#4ADE80] shrink-0" />
                <span className="font-mono text-xs">Auto-saved</span>
              </div>
            )}

            {/* If chatting, show compact Vault Protected badge */}
            {isChatting && (
              <button
                id="security-inspector-badge-btn"
                onClick={onOpenSecurityInspector}
                title="Click to view full Security Architecture and Threat Model"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase bg-[#1A3020] text-[#4ADE80] border border-[#225030] hover:bg-[#1A3824] transition cursor-pointer shrink-0 whitespace-nowrap"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#4ADE80] shrink-0" />
                <span className="hidden lg:inline">Vault: Protected</span>
                <span className="lg:hidden">Vault</span>
              </button>
            )}

            {/* Dark / Light Mode Toggle Button */}
            <button
              id="theme-toggle-btn"
              data-testid="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-xl bg-[#161618] border border-[#2A2A2D] hover:bg-[#1E1E20] hover:border-[#3A3A3D] text-[#C0C0C0] hover:text-white transition flex items-center justify-center cursor-pointer shadow-xs shrink-0"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#FBBF24]" />
              ) : (
                <Moon className="w-4 h-4 text-[#4285F4]" />
              )}
            </button>

            {!isChatting && (
              <button
                id="new-session-nav-btn"
                onClick={onOpenNewSession}
                className="btn-primary-cta flex items-center gap-1.5 py-2 px-3 lg:px-3.5 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
              >
                <PlusCircle className="w-4 h-4 shrink-0 text-neutral-900" />
                <span className="text-neutral-900">Reflect & Chat</span>
              </button>
            )}

            {/* User Profile or Public Access Status */}
            {user ? (
              <div className="relative shrink-0">
                <button
                  id="user-profile-menu-btn"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center gap-1.5 lg:gap-2 p-1 pl-2 bg-[#161618] rounded-full border border-[#2A2A2D] hover:border-[#3A3A3D] transition cursor-pointer shrink-0"
                >
                  <span className="text-xs font-semibold text-[#E0E0E0] max-w-[80px] lg:max-w-[120px] truncate hidden sm:inline">
                    {userDisplayName}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#9B72F3] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs border border-[#4285F4]/40">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={userDisplayName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      userInitial
                    )}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#808080] mr-1 shrink-0" />
                </button>

                {/* Dropdown */}
                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-[#161618] border border-[#2A2A2D] rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2.5 border-b border-[#2A2A2D]">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#9B72F3] text-white flex items-center justify-center text-sm font-bold shrink-0 border border-[#4285F4]/40 shadow-xs">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={userDisplayName}
                              referrerPolicy="no-referrer"
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            userInitial
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">
                            {userDisplayName}
                          </p>
                          <p className="text-[11px] text-[#808080] truncate font-mono">
                            {user.email || (user.isAnonymous ? 'Guest Account' : 'Authenticated')}
                          </p>
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[#4ADE80] bg-[#1A3020] border border-[#225030] px-2 py-0.5 rounded-md w-fit font-mono">
                        <Lock className="w-3 h-3" />
                        <span>Authenticated • Write Access</span>
                      </div>
                    </div>

                    {onOpenProfile && (
                      <button
                        id="nav-edit-display-name-btn"
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenProfile();
                        }}
                        className="w-full px-4 py-2 text-left text-xs text-[#C0C0C0] hover:bg-[#1E1E20] hover:text-white flex items-center gap-2 transition cursor-pointer"
                      >
                        <User className="w-4 h-4 text-[#4285F4]" />
                        <span>Edit Display Name</span>
                      </button>
                    )}

                    <button
                      id="dropdown-theme-toggle-btn"
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

                    <div className="border-t border-[#2A2A2D] my-1" />

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
                  <span>Sign In</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile Right Controls: Fast Action + Quick Theme + Hamburger Button (< md) */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            {isChatting && (
              <div
                id="mobile-navbar-autosave-indicator"
                className="flex items-center gap-1 text-[10px] font-medium text-[#4ADE80] bg-[#1A3020] border border-[#225030] px-2 py-1 rounded-lg shrink-0 whitespace-nowrap"
                title="Autosaved in real-time"
              >
                <Check className="w-3 h-3 text-[#4ADE80] shrink-0" />
                <span className="font-mono">Saved</span>
              </div>
            )}

            {/* Reflect & Chat Action on Mobile (hidden when already chatting) */}
            {!isChatting && (
              <button
                id="mobile-quick-reflect-btn"
                onClick={onOpenNewSession}
                aria-label="Start reflection and chat session"
                className="btn-primary-cta flex items-center gap-1 py-1.5 px-2.5 sm:py-2 sm:px-3 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded-xl text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer shrink-0"
              >
                <PlusCircle className="w-3.5 h-3.5 shrink-0 text-neutral-900" />
                <span className="whitespace-nowrap text-neutral-900">Reflect</span>
              </button>
            )}

            {/* Quick One-Tap Theme Toggle on Mobile */}
            <button
              id="mobile-nav-quick-theme-btn"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="p-2 min-w-[36px] min-h-[36px] rounded-xl bg-[#161618] border border-[#2A2A2D] hover:bg-[#1E1E20] hover:border-[#3A3A3D] text-[#A0A0A0] hover:text-[#4285F4] transition flex items-center justify-center cursor-pointer shadow-xs active:scale-95 shrink-0"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#FBBF24]" />
              ) : (
                <Moon className="w-4 h-4 text-[#60A5FA]" />
              )}
            </button>

            {/* Mobile Hamburger Menu Toggle Button */}
            <button
              id="mobile-hamburger-btn"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
              className="p-2 min-w-[36px] min-h-[36px] rounded-xl bg-[#161618] border border-[#2A2A2D] hover:bg-[#1E1E20] hover:border-[#3A3A3D] text-[#E0E0E0] hover:text-white transition flex items-center justify-center cursor-pointer shadow-xs active:scale-95 shrink-0"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-white" />
              ) : (
                <Menu className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer / Slide-down Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-[#1E1E20] bg-[#0E0E10] px-4 pt-3 pb-6 space-y-4 shadow-2xl animate-in slide-in-from-top-2 duration-200">
          {/* User Status Card */}
          {user ? (
            <div className="p-3 bg-[#161618] border border-[#2A2A2D] rounded-2xl flex items-center justify-between gap-2">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#9B72F3] text-white flex items-center justify-center text-sm font-bold shrink-0 border border-[#4285F4]/40 shadow-xs">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={userDisplayName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    userInitial
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {userDisplayName}
                  </p>
                  <p className="text-[11px] text-[#808080] truncate font-mono">
                    {user.email || (user.isAnonymous ? 'Guest Account' : 'Signed In')}
                  </p>
                </div>
              </div>
              {onOpenProfile ? (
                <button
                  id="mobile-edit-profile-btn"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenProfile();
                  }}
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-[#4285F4] bg-[#4285F415] hover:bg-[#4285F425] border border-[#4285F440] rounded-xl transition shrink-0 cursor-pointer"
                >
                  Edit Name
                </button>
              ) : (
                <div className="flex items-center gap-1 text-[10px] text-[#4ADE80] bg-[#1A3020] border border-[#225030] px-2 py-0.5 rounded-md shrink-0">
                  <Lock className="w-3 h-3" />
                  <span>Active</span>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenAuth();
              }}
              className="w-full py-2.5 px-4 bg-[#1A2536] text-[#60A5FA] border border-[#254060] hover:bg-[#203248] rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <User className="w-4 h-4 text-[#4285F4]" />
              <span>Sign In with Google / Account</span>
            </button>
          )}

          {/* Mobile Main Navigation Tabs */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-[#666666] font-bold px-2 mb-1">Navigation</p>
            <button
              id="mobile-nav-entries-btn"
              onClick={() => {
                setActiveView('journal');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition ${
                activeView === 'journal'
                  ? 'bg-[#2A2A2D] text-white shadow-xs border border-[#3A3A3D]'
                  : 'text-[#A0A0A0] hover:bg-[#161618] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-[#4285F4]" />
                <span>Journal Entries</span>
              </div>
              {activeView === 'journal' && (
                <span className="w-2 h-2 rounded-full bg-[#4285F4]" />
              )}
            </button>

            <button
              id="mobile-nav-insights-btn"
              onClick={() => {
                setActiveView('analytics');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition ${
                activeView === 'analytics'
                  ? 'bg-[#2A2A2D] text-white shadow-xs border border-[#3A3A3D]'
                  : 'text-[#A0A0A0] hover:bg-[#161618] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-4 h-4 text-[#9B72F3]" />
                <span>Intelligence Insights & Analytics</span>
              </div>
              {activeView === 'analytics' && (
                <span className="w-2 h-2 rounded-full bg-[#9B72F3]" />
              )}
            </button>

            <button
              id="mobile-nav-new-reflection-btn"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenNewSession();
              }}
              className="btn-primary-cta w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 transition shadow-xs cursor-pointer active:scale-95"
            >
              <div className="flex items-center gap-2.5">
                <PlusCircle className="w-4 h-4 text-neutral-900" />
                <span className="text-neutral-900">Start New Reflection Session</span>
              </div>
              <span className="text-[10px] bg-neutral-900 text-white px-2 py-0.5 rounded-md font-bold">New</span>
            </button>
          </div>

          {/* Quick Settings & Security Tools */}
          <div className="space-y-1 pt-2 border-t border-[#1E1E20]">
            <p className="text-[10px] uppercase tracking-wider text-[#666666] font-bold px-2 mb-1">Preferences & Security</p>
            
            {/* Theme Toggle in Mobile Menu */}
            <button
              id="mobile-nav-theme-btn"
              onClick={() => {
                toggleTheme();
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs text-[#C0C0C0] hover:bg-[#161618] hover:text-white transition"
            >
              <div className="flex items-center gap-2.5">
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-[#FBBF24]" />
                ) : (
                  <Moon className="w-4 h-4 text-[#4285F4]" />
                )}
                <span>Appearance</span>
              </div>
              <span className="text-[11px] font-semibold text-[#808080] bg-[#1E1E20] px-2 py-0.5 rounded-lg border border-[#2A2A2D]">
                {theme === 'dark' ? 'Dark Mode 🌙' : 'Light Mode ☀️'}
              </span>
            </button>

            {/* Security Architecture / Inspector */}
            <button
              id="mobile-nav-security-btn"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenSecurityInspector();
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs text-[#C0C0C0] hover:bg-[#161618] hover:text-white transition"
            >
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-[#4ADE80]" />
                <span>Security Vault & Rules</span>
              </div>
              <span className="text-[10px] font-bold text-[#4ADE80] bg-[#1A3020] border border-[#225030] px-2 py-0.5 rounded-md">
                Protected
              </span>
            </button>

            {/* Sign Out Button (if logged in) */}
            {user && (
              <button
                id="mobile-nav-sign-out-btn"
                onClick={async () => {
                  setIsMobileMenuOpen(false);
                  await signOut();
                }}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold text-[#F87171] hover:bg-[#F8717115] transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out Account</span>
              </button>
            )}
          </div>

          {/* Info Footer */}
          <div className="pt-2 text-center">
            <span className="text-[10px] text-[#606060] font-mono">
              Cloud Run • Firestore Isolated • Gemini 3.6 Flash
            </span>
          </div>
        </div>
      )}
    </header>
  );
}


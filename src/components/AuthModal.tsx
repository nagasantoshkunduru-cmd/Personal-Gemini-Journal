import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  Key,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  Sparkles,
  X,
  User,
  ArrowRight,
  Check,
} from 'lucide-react';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signInAsGuest,
  updateUserDisplayName,
  getEmailNameFallback,
} from '../lib/firebase';
import type { UserAuthProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  isDismissible?: boolean;
  initialStep?: 'auth' | 'name_prompt';
  initialMode?: 'signin' | 'signup';
  currentUser?: UserAuthProfile | null;
  onClose: () => void;
  onSuccess: (user: UserAuthProfile) => void;
}

export function AuthModal({
  isOpen,
  isDismissible = true,
  initialStep = 'auth',
  initialMode = 'signin',
  currentUser = null,
  onClose,
  onSuccess,
}: AuthModalProps) {
  const [step, setStep] = useState<'auth' | 'name_prompt'>(initialStep);
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Name Onboarding / Profile Step State
  const [pendingUser, setPendingUser] = useState<UserAuthProfile | null>(currentUser);
  const [customDisplayName, setCustomDisplayName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep(initialStep);
      setMode(initialMode);
      setError(null);
      if (currentUser) {
        setPendingUser(currentUser);
        setCustomDisplayName(currentUser.displayName || getEmailNameFallback(currentUser.email));
      } else {
        setCustomDisplayName('');
      }
    }
  }, [isOpen, initialStep, initialMode, currentUser]);

  if (!isOpen) return null;

  const fallbackName = getEmailNameFallback(pendingUser?.email);
  const effectiveDisplayName = customDisplayName.trim() || fallbackName;
  const initialAvatarChar = (effectiveDisplayName || 'U').charAt(0).toUpperCase();

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      if (!user.displayName && user.email) {
        // Prompt for display name if none set
        setPendingUser(user);
        setCustomDisplayName(getEmailNameFallback(user.email));
        setStep('name_prompt');
      } else {
        onSuccess(user);
        onClose();
      }
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed popup; clean return with no jarring red banner
        setError(null);
      } else if (err.code === 'auth/unauthorized-domain' || err.message?.includes('auth/unauthorized-domain')) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'your domain';
        setError(`Domain "${domain}" is not authorized in Firebase. Add "${domain}" to Firebase Console -> Authentication -> Settings -> Authorized domains.`);
      } else if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups for this site to sign in.');
      } else {
        setError(err.message || 'Failed to sign in with Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        // Account Creation: Immediately prompt new user for preferred display name
        const user = await signUpWithEmail(email, password);
        setPendingUser(user);
        setCustomDisplayName('');
        setStep('name_prompt');
      } else {
        const user = await signInWithEmail(email, password);
        onSuccess(user);
        onClose();
      }
    } catch (err: any) {
      console.error('Email Auth Error:', err);
      if (err.code === 'auth/unauthorized-domain' || err.message?.includes('auth/unauthorized-domain')) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'your domain';
        setError(`Domain "${domain}" is not authorized. Add it to Firebase Console -> Authentication -> Settings -> Authorized domains.`);
      } else if (err.code === 'auth/admin-restricted-operation' || err.message?.includes('admin-restricted-operation')) {
        setError('New account sign-ups are restricted in this Firebase project. Try signing in with Google or explore in Guest Demo mode.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password credentials.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else {
        setError(err.message || 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await signInAsGuest();
      onSuccess(user);
      onClose();
    } catch (err: any) {
      console.warn('Guest Auth Notice:', err);
      if (err.code === 'auth/unauthorized-domain' || err.message?.includes('auth/unauthorized-domain')) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'your domain';
        setError(`Domain "${domain}" is not authorized. Add it to Firebase Console -> Authentication -> Settings -> Authorized domains.`);
      } else {
        setError(err.message || 'Guest sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Save custom display name
  const handleSaveDisplayName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const finalName = customDisplayName.trim() || fallbackName;
      const updatedProfile = await updateUserDisplayName(finalName);
      onSuccess(updatedProfile);
      onClose();
    } catch (err: any) {
      console.error('Failed to update display name:', err);
      setError(err.message || 'Could not save display name. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Skip custom display name - automatically use name portion of account email
  const handleSkipDisplayName = async () => {
    setLoading(true);
    setError(null);
    try {
      const updatedProfile = await updateUserDisplayName(fallbackName);
      onSuccess(updatedProfile);
      onClose();
    } catch (err: any) {
      console.error('Failed to apply default email name:', err);
      setError(err.message || 'Could not set default name. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-opacity animate-in fade-in"
      onClick={() => {
        if (isDismissible && step !== 'name_prompt') onClose();
      }}
    >
      <div
        className="bg-[#0E0E10] border border-[#1E1E20] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step 1: Authentication Screen */}
        {step === 'auth' ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-[#1E1E20] flex items-center justify-between bg-black">
              <div className="flex items-center space-x-3">
                <img
                  src="/metallic_star_logo.png"
                  alt="Gemini Journal"
                  className="h-10 w-auto object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] shrink-0 select-none"
                />
                <div>
                  <h2 className="text-base font-bold text-white">
                    {mode === 'signin' ? 'Sign In to Your Journal' : 'Create Secure Journal Account'}
                  </h2>
                  <p className="text-xs text-[#808080]">
                    Strict Isolated User Authentication
                  </p>
                </div>
              </div>
              {isDismissible && (
                <button
                  id="close-auth-modal"
                  onClick={onClose}
                  className="text-[#808080] hover:text-[#E0E0E0] p-1.5 rounded-lg hover:bg-[#161618] transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-[#2A1515] border border-[#4A2020] flex items-start gap-2.5 text-xs text-[#F87171]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Google One-Click Button */}
              <button
                id="btn-google-auth"
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-[#161618] border border-[#2A2A2D] hover:bg-[#1E1E20] hover:border-[#3A3A3D] text-[#E0E0E0] rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continue with Google Identity
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-[#1E1E20] w-full" />
                <span className="bg-[#0E0E10] px-3 text-[10px] font-bold text-[#606060] uppercase tracking-wider absolute">
                  or with email
                </span>
              </div>

              {/* Email / Password Form */}
              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#A0A0A0] mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#606060] absolute left-3 top-2.5" />
                    <input
                      id="auth-email-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-9 pr-3 py-2 bg-[#161618] border border-[#2A2A2D] rounded-xl text-xs text-[#E0E0E0] placeholder-[#505050] focus:outline-hidden focus:border-[#4285F4] focus:ring-1 focus:ring-[#4285F4] transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A0A0A0] mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-[#606060] absolute left-3 top-2.5" />
                    <input
                      id="auth-password-input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-3 py-2 bg-[#161618] border border-[#2A2A2D] rounded-xl text-xs text-[#E0E0E0] placeholder-[#505050] focus:outline-hidden focus:border-[#4285F4] focus:ring-1 focus:ring-[#4285F4] transition"
                    />
                  </div>
                </div>

                <button
                  id="auth-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="btn-primary-cta w-full py-2.5 px-4 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <span className="text-neutral-900 font-bold">{loading ? 'Authenticating...' : mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                </button>
              </form>

              {/* Mode Switcher */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-[#808080]">
                  {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'signin' ? 'signup' : 'signin');
                    setError(null);
                  }}
                  className="text-[#4285F4] font-semibold hover:underline cursor-pointer"
                >
                  {mode === 'signin' ? 'Create one now' : 'Sign in here'}
                </button>
              </div>

              <div className="border-t border-[#1E1E20] pt-3">
                <button
                  id="auth-guest-demo-btn"
                  type="button"
                  onClick={handleGuestDemo}
                  disabled={loading}
                  className="w-full py-2 px-3 bg-[#161618] hover:bg-[#1E1E20] text-[#E0E0E0] border border-[#2A2A2D] hover:border-[#3A3A3D] rounded-xl text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#9B72F3]" />
                  Quick Anonymous Session (Instant Isolated Sandbox)
                </button>
              </div>

              {/* Security Guarantee Note */}
              <div className="p-3 bg-[#161618] rounded-xl border border-[#2A2A2D] flex items-center gap-2 text-[11px] text-[#808080]">
                <ShieldCheck className="w-4 h-4 text-[#4ADE80] shrink-0" />
                <span>Strict data isolation: Journal entries are encrypted and restricted to your unique UID.</span>
              </div>
            </div>
          </>
        ) : (
          /* Step 2: Name Prompt / Profile Setup Screen */
          <div className="animate-in fade-in slide-in-from-right-4 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-[#1E1E20] flex items-center justify-between bg-[#0A0A0B]">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-[#4285F415] border border-[#4285F430] text-[#4285F4] rounded-xl">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    Set Your Display Name
                  </h2>
                  <p className="text-xs text-[#808080]">
                    Personalize your private journaling profile
                  </p>
                </div>
              </div>
              {isDismissible && (
                <button
                  id="close-name-prompt-modal"
                  onClick={onClose}
                  className="text-[#808080] hover:text-[#E0E0E0] p-1.5 rounded-lg hover:bg-[#161618] transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="p-3 rounded-xl bg-[#2A1515] border border-[#4A2020] flex items-start gap-2.5 text-xs text-[#F87171]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Interactive Avatar & Profile Live Preview */}
              <div className="p-4 bg-[#141416] border border-[#242428] rounded-2xl flex items-center gap-4">
                <div
                  id="onboarding-avatar-preview"
                  className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#9B72F3] text-white flex items-center justify-center text-xl font-extrabold shadow-md border-2 border-[#4285F4]/50 shrink-0 transition-all transform duration-150 scale-100"
                >
                  {initialAvatarChar}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[#808080] font-medium uppercase tracking-wider">
                    Avatar Preview
                  </p>
                  <p className="text-sm font-bold text-white truncate mt-0.5">
                    {effectiveDisplayName}
                  </p>
                  <p className="text-[11px] text-[#A0A0A0] truncate mt-0.5 font-mono">
                    {pendingUser?.email || 'Account created'}
                  </p>
                </div>
              </div>

              {/* Display Name Input Form */}
              <form onSubmit={handleSaveDisplayName} className="space-y-4">
                <div>
                  <label
                    htmlFor="onboarding-display-name-input"
                    className="block text-xs font-semibold text-[#C0C0C0] mb-1.5"
                  >
                    What should we call you?
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#606060] absolute left-3 top-3" />
                    <input
                      id="onboarding-display-name-input"
                      type="text"
                      value={customDisplayName}
                      onChange={(e) => setCustomDisplayName(e.target.value)}
                      placeholder={fallbackName || 'e.g. Alex, Sam, Taylor...'}
                      autoFocus
                      className="w-full pl-9 pr-3 py-2.5 bg-[#161618] border border-[#2A2A2D] focus:border-[#4285F4] focus:ring-1 focus:ring-[#4285F4] rounded-xl text-xs sm:text-sm text-white placeholder-[#505050] focus:outline-hidden transition shadow-inner"
                    />
                  </div>
                  <p className="text-[11px] text-[#808080] mt-1.5">
                    Your avatar initial will render as <strong>"{initialAvatarChar}"</strong> in the navigation and session views.
                  </p>
                </div>

                {/* Primary & Skip Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    id="onboarding-save-name-btn"
                    type="submit"
                    disabled={loading}
                    className="btn-primary-cta w-full py-2.5 px-4 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    {loading ? (
                      <span className="text-neutral-900">Saving Profile...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-neutral-900" />
                        <span className="text-neutral-900">Save & Continue</span>
                      </>
                    )}
                  </button>

                  <button
                    id="onboarding-skip-name-btn"
                    type="button"
                    onClick={handleSkipDisplayName}
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-[#161618] hover:bg-[#1E1E20] text-[#A0A0A0] hover:text-white border border-[#2A2A2D] hover:border-[#3A3A3D] rounded-xl text-xs font-semibold transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Skip (Use "{fallbackName}")</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>

              {/* Note */}
              <div className="pt-2 text-center">
                <span className="text-[11px] text-[#606060]">
                  You can update your display name at any time from the account menu.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


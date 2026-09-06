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
  Brain,
  Globe,
  Mic,
} from 'lucide-react';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  updateUserDisplayName,
  getEmailNameFallback,
  resetPassword,
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
  
  // Input fields state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Name Onboarding / Profile Step State (Fallback for Google Signup Display Name Setup)
  const [pendingUser, setPendingUser] = useState<UserAuthProfile | null>(currentUser);
  const [customDisplayName, setCustomDisplayName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep(initialStep);
      setMode(initialMode);
      setError(null);
      setSuccessMessage(null);
      setFullName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      if (currentUser) {
        setPendingUser(currentUser);
        setCustomDisplayName(currentUser.displayName || getEmailNameFallback(currentUser.email));
      } else {
        setCustomDisplayName('');
      }
    }
  }, [isOpen, initialStep, initialMode, currentUser]);

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first so we can send a reset link.');
      setSuccessMessage(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await resetPassword(email);
      setSuccessMessage(`Password reset email sent to ${email}. Please check your inbox.`);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

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
        setError(null);
      } else if (err.code === 'auth/unauthorized-domain' || err.message?.includes('auth/unauthorized-domain')) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'your domain';
        setError(`Domain "${domain}" is not authorized in Firebase. Add "${domain}" to Firebase Console -> Authorized domains.`);
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

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        // Securely Register & synchronously apply user profile displayName
        const user = await signUpWithEmail(email, password);
        const updatedProfile = await updateUserDisplayName(fullName.trim());
        onSuccess(updatedProfile);
        onClose();
      } else {
        const user = await signInWithEmail(email, password);
        onSuccess(user);
        onClose();
      }
    } catch (err: any) {
      console.error('Email Auth Error:', err);
      if (err.code === 'auth/unauthorized-domain' || err.message?.includes('auth/unauthorized-domain')) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'your domain';
        setError(`Domain "${domain}" is not authorized. Add it to Firebase Console -> Authorized domains.`);
      } else if (err.code === 'auth/admin-restricted-operation' || err.message?.includes('admin-restricted-operation')) {
        setError('New account sign-ups are restricted in this Firebase project. Try Google login or Guest mode.');
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
        className="bg-[#0E0E10] border border-[#1E1E20] rounded-2xl w-full md:max-w-4xl shadow-2xl overflow-hidden flex flex-col md:flex-row md:min-h-[580px] min-h-0 h-auto max-w-md md:max-w-4xl max-h-[92vh] md:max-h-none overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Panel: App Branding & Key Value Propositions (Desktop Only) */}
        <div className="hidden md:flex md:w-[42%] bg-gradient-to-br from-neutral-900 to-black p-8 flex-col justify-between border-r border-[#1E1E20] shrink-0 select-none">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/metallic_star_logo.png"
                alt="Gemini Journal Logo"
                className="h-10 w-auto object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] shrink-0"
              />
              <h2 className="font-serif text-xl font-bold tracking-tight text-white leading-tight">
                Personal Gemini Journal
              </h2>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed font-sans">
              Your private sanctuary for deep thoughts and structured mindfulness, guided by resilient AI intelligence.
            </p>
          </div>

          <div className="space-y-5 my-8">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white shrink-0">
                <Brain className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-200">Empathetic AI Personas</h4>
                <p className="text-[11px] text-neutral-400 leading-relaxed mt-0.5">Specialized guides for CBT, Socratic inquiry, and Compassionate Listening.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white shrink-0">
                <Globe className="w-3.5 h-3.5 text-[#4285F4]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-200">Google Search Grounded</h4>
                <p className="text-[11px] text-neutral-400 leading-relaxed mt-0.5">Root your self-discovery in real-world facts with interactive web grounding.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white shrink-0">
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-200">Bidirectional Live Voice</h4>
                <p className="text-[11px] text-neutral-400 leading-relaxed mt-0.5">Express your feelings naturally through real-time spoken audio conversation.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-200">Reflection Analytics</h4>
                <p className="text-[11px] text-neutral-400 leading-relaxed mt-0.5">Gain deep emotional insight with sentiment trends and mental clarity charts.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-200">Strict Security &amp; Privacy</h4>
                <p className="text-[11px] text-neutral-400 leading-relaxed mt-0.5">All journal entries are fully isolated and locked under your unique UID.</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.04]">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/80 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>OWASP &amp; Agentic Threat Protected</span>
            </div>
          </div>
        </div>

        {/* Right Panel: Authentication Form & Dynamic Onboarding Content */}
        <div className="flex-1 flex flex-col justify-between p-4 sm:p-8 bg-[#0E0E10] overflow-y-auto md:overflow-visible">
          {/* Step 1: Login / Sign-up Forms */}
          {step === 'auth' ? (
            <div className="flex-1 flex flex-col justify-between gap-3">
              {/* Header */}
              <div className="pb-4 border-b border-[#1E1E20] flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    {mode === 'signin' ? 'Sign In' : 'Create Secure Account'}
                    <span className="md:hidden">
                      <img src="/metallic_star_logo.png" alt="logo" className="h-5 w-auto filter drop-shadow-[0_0_6px_rgba(255,255,255,0.2)]" />
                    </span>
                  </h2>
                  <p className="text-xs text-[#808080]">
                    {mode === 'signin' ? 'Access your private journal workspace' : 'Get started with strict data isolation'}
                  </p>
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

              {/* Form Content */}
              <div className="py-2 sm:py-4 space-y-3 sm:space-y-4 flex-1 md:overflow-y-auto md:max-h-[400px] pr-1">
                {error && (
                  <div className="p-3 rounded-xl bg-[#2A1515] border border-[#4A2020] flex items-start gap-2.5 text-xs text-[#F87171]">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="p-3 rounded-xl bg-[#152A15] border border-[#204A20] flex items-start gap-2.5 text-xs text-emerald-400">
                    <Check className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Social Button: Continue with Google */}
                <button
                  id="btn-google-auth"
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-[#161618] border border-[#2A2A2D] hover:bg-[#1E1E20] hover:border-[#3A3A3D] text-[#E0E0E0] rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                  Continue with Google
                </button>

                <div className="relative flex items-center justify-center py-1">
                  <div className="border-t border-[#1E1E20] w-full" />
                  <span className="bg-[#0E0E10] px-3 text-[10px] font-bold text-[#606060] uppercase tracking-wider absolute">
                    or email credentials
                  </span>
                </div>

                {/* Main Email / Password Credentials Form */}
                <form onSubmit={handleEmailAuth} className="space-y-3">
                  {/* Account Creation Specific Display Name Input */}
                  {mode === 'signup' && (
                    <div>
                      <label className="block text-xs font-semibold text-[#A0A0A0] mb-1">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-[#606060] absolute left-3 top-2.5" />
                        <input
                          id="auth-name-input"
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Your Display Name"
                          required={mode === 'signup'}
                          className="w-full pl-9 pr-3 py-2 bg-[#161618] border border-[#2A2A2D] rounded-xl text-xs text-[#E0E0E0] placeholder-[#505050] focus:outline-hidden focus:border-[#4285F4] focus:ring-1 focus:ring-[#4285F4] transition"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[#A0A0A0] mb-1">
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

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-semibold text-[#A0A0A0]">
                          Password
                        </label>
                        {mode === 'signin' && (
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-[10px] text-[#4285F4] hover:underline font-medium focus:outline-hidden cursor-pointer"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
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
                      <div className="mt-1 min-h-[14px]">
                        {password && password.length < 6 ? (
                          <span className="text-[10px] text-red-400 font-semibold">
                            Must be at least 6 characters ({password.length}/6)
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#808080]">
                            Passwords must be at least 6 characters
                          </span>
                        )}
                      </div>
                    </div>

                    {mode === 'signup' ? (
                      <div>
                        <label className="block text-xs font-semibold text-[#A0A0A0] mb-1">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <Key className="w-4 h-4 text-[#606060] absolute left-3 top-2.5" />
                          <input
                            id="auth-confirm-password-input"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required={mode === 'signup'}
                            className="w-full pl-9 pr-3 py-2 bg-[#161618] border border-[#2A2A2D] rounded-xl text-xs text-[#E0E0E0] placeholder-[#505050] focus:outline-hidden focus:border-[#4285F4] focus:ring-1 focus:ring-[#4285F4] transition"
                          />
                        </div>
                        <div className="mt-1 min-h-[14px]">
                          {confirmPassword && password !== confirmPassword ? (
                            <span className="text-[10px] text-red-400 font-semibold">
                              Passwords do not match
                            </span>
                          ) : confirmPassword && password === confirmPassword ? (
                            <span className="text-[10px] text-emerald-400 font-semibold">
                              Passwords match
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="hidden sm:block">
                        <label className="block text-xs text-transparent mb-1 select-none">Spacer</label>
                        <div className="py-2.5 text-[11px] text-[#606060] leading-none">
                          Passwords are client-side hashed
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    id="auth-submit-btn"
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-2.5 px-4 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
                  >
                    <span className="text-neutral-900 font-bold">
                      {loading ? 'Authenticating...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
                    </span>
                  </button>
                </form>

                {/* Mode Switcher Link */}
                <div className="flex items-center justify-between text-xs pt-1">
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
              </div>

              {/* Bottom Safety Notice */}
              <div className="border-t border-[#1E1E20] pt-4 mt-auto">
                <div className="p-2.5 bg-[#161618] rounded-xl border border-[#2A2A2D] flex items-center gap-2 text-[10px] text-[#808080] leading-normal">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Strict isolated vaults: Journal logs are sandboxed per UID under your authenticated credentials.</span>
                </div>
              </div>
            </div>
          ) : (
            /* Step 2: Name Prompt / Profile Customization Screen (Google Signup fallback) */
            <div className="flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-right-4 duration-200">
              {/* Header */}
              <div className="pb-4 border-b border-[#1E1E20] flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    Set Your Display Name
                    <User className="w-4 h-4 text-[#4285F4]" />
                  </h2>
                  <p className="text-xs text-[#808080]">
                    Personalize your private journaling profile
                  </p>
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

              {/* Form Content */}
              <div className="py-2 sm:py-4 space-y-3 sm:space-y-4 flex-1 md:overflow-y-auto md:max-h-[400px] pr-1">
                {error && (
                  <div className="p-3 rounded-xl bg-[#2A1515] border border-[#4A2020] flex items-start gap-2.5 text-xs text-[#F87171]">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Live Preview Card */}
                <div className="p-4 bg-[#141416] border border-[#242428] rounded-2xl flex items-center gap-4">
                  <div
                    id="onboarding-avatar-preview"
                    className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#9B72F3] text-white flex items-center justify-center text-xl font-extrabold shadow-md border-2 border-[#4285F4]/50 shrink-0 select-none"
                  >
                    {initialAvatarChar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[#808080] font-semibold uppercase tracking-wider">
                      Live Profile Preview
                    </p>
                    <p className="text-sm font-bold text-white truncate mt-0.5">
                      {effectiveDisplayName}
                    </p>
                    <p className="text-[11px] text-[#A0A0A0] truncate mt-0.5 font-mono">
                      {pendingUser?.email || 'Account registered'}
                    </p>
                  </div>
                </div>

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
                        className="w-full pl-9 pr-3 py-2.5 bg-[#161618] border border-[#2A2A2D] focus:border-[#4285F4] focus:ring-1 focus:ring-[#4285F4] rounded-xl text-xs sm:text-sm text-white placeholder-[#505050] focus:outline-hidden transition"
                      />
                    </div>
                    <p className="text-[11px] text-[#808080] mt-1.5">
                      Your avatar initial will render as <strong>"{initialAvatarChar}"</strong> in the navigation and session views.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    <button
                      id="onboarding-save-name-btn"
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 px-4 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 hover:border-neutral-400 rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      {loading ? (
                        <span className="text-neutral-900 font-bold">Saving Profile...</span>
                      ) : (
                        <>
                          <Check className="w-4 h-4 text-neutral-900" />
                          <span className="text-neutral-900 font-bold">Save &amp; Continue</span>
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
              </div>

              <div className="pt-4 border-t border-[#1E1E20] text-center mt-auto">
                <span className="text-[11px] text-[#606060]">
                  You can update your display name at any time from the account menu.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

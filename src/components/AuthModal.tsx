import React, { useState } from 'react';
import { Lock, Mail, Key, ShieldCheck, UserCheck, AlertCircle, Sparkles, X } from 'lucide-react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, signInAsGuest } from '../lib/firebase';
import type { UserAuthProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  isDismissible?: boolean;
  onClose: () => void;
  onSuccess: (user: UserAuthProfile) => void;
}

export function AuthModal({ isOpen, isDismissible = true, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      onSuccess(user);
      onClose();
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      setError(err.message || 'Failed to sign in with Google.');
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
      let user: UserAuthProfile;
      if (mode === 'signin') {
        user = await signInWithEmail(email, password);
      } else {
        user = await signUpWithEmail(email, password);
      }
      onSuccess(user);
      onClose();
    } catch (err: any) {
      console.error('Email Auth Error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
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
      console.error('Guest Auth Error:', err);
      setError(err.message || 'Guest sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-opacity animate-in fade-in"
      onClick={() => {
        if (isDismissible) onClose();
      }}
    >
      <div
        className="bg-[#0E0E10] border border-[#1E1E20] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[#1E1E20] flex items-center justify-between bg-[#0A0A0B]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#161618] border border-[#2A2A2D] text-[#4285F4] rounded-xl">
              <Lock className="w-5 h-5" />
            </div>
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
              className="text-[#808080] hover:text-[#E0E0E0] p-1.5 rounded-lg hover:bg-[#161618] transition"
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
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-[#161618] border border-[#2A2A2D] hover:bg-[#1E1E20] hover:border-[#3A3A3D] text-[#E0E0E0] rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
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
              className="w-full py-2.5 px-4 bg-[#4285F4] hover:bg-[#3367D6] text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Authenticating...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
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
              className="text-[#4285F4] font-semibold hover:underline"
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
              className="w-full py-2 px-3 bg-[#161618] hover:bg-[#1E1E20] text-[#E0E0E0] border border-[#2A2A2D] hover:border-[#3A3A3D] rounded-xl text-xs font-medium transition flex items-center justify-center gap-2"
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
      </div>
    </div>
  );
}

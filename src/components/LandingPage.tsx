import React, { useMemo } from 'react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Brain,
  Mic,
  Lock,
  Star
} from 'lucide-react';

interface LandingPageProps {
  onOpenLogin: () => void;
  onOpenSignUp: () => void;
  onOpenSandbox?: () => void;
  onOpenSecurityInspector?: () => void;
}

export function LandingPage({
  onOpenLogin,
  onOpenSignUp,
  onOpenSandbox,
  onOpenSecurityInspector,
}: LandingPageProps) {
  // Deterministic starfield array for cosmic background
  const stars = useMemo(() => {
    return Array.from({ length: 65 }, (_, i) => {
      const top = ((i * 37) % 97) + 1;
      const left = ((i * 59) % 99) + 0.5;
      const size = (i % 3 === 0) ? 2.5 : (i % 2 === 0) ? 1.5 : 1;
      const opacity = 0.25 + ((i * 13) % 60) / 100;
      const animationDuration = 2.5 + ((i * 7) % 4);
      const animationDelay = ((i * 11) % 5);
      return { id: i, top, left, size, opacity, animationDuration, animationDelay };
    });
  }, []);

  return (
    <div className="relative min-h-screen bg-black text-[#E0E0E0] flex flex-col font-sans overflow-x-hidden selection:bg-purple-500/30 selection:text-white">
      {/* 1. COSMIC STARFIELD & AMBIENT RADIAL GLOWS */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        {/* Ambient cosmic glow orbs with deep dark falloff */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[550px] bg-gradient-to-b from-purple-700/18 via-indigo-600/10 to-transparent blur-[120px] rounded-full" />
        <div className="absolute top-[28%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-cyan-600/10 via-purple-600/12 to-transparent blur-[140px] rounded-full" />
        <div className="absolute -bottom-40 right-[-10%] w-[500px] h-[500px] bg-indigo-900/10 blur-[150px] rounded-full" />
        
        {/* Subtle star particles */}
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white transition-opacity"
            style={{
              top: `${star.top}%`,
              left: `${star.left}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              boxShadow: star.size > 2 ? '0 0 6px 1px rgba(255, 255, 255, 0.6)' : 'none',
              animation: `pulse ${star.animationDuration}s ease-in-out infinite`,
              animationDelay: `${star.animationDelay}s`,
            }}
          />
        ))}

        {/* Ambient pitch black vignette overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_92%)] opacity-90" />
      </div>

      {/* 2. TOP NAVIGATION BAR */}
      <header className="relative z-20 w-full border-b border-white/[0.08] bg-black/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
          {/* Brand Logo & Name */}
          <div
            className="flex items-center gap-2.5 sm:gap-3 group cursor-pointer min-w-0 shrink"
            onClick={onOpenSignUp}
          >
            {/* Metallic Double-Star Crystal Logo - Natural aspect ratio & precise height match (36px–40px) */}
            <img
              src="/metallic_star_logo.png"
              alt="Gemini Journal Logo"
              className="h-9 sm:h-10 w-auto object-contain filter drop-shadow-[0_0_10px_rgba(255,255,255,0.35)] group-hover:scale-105 transition-transform duration-200 shrink-0 select-none"
            />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                  Gemini Journal
                </span>
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                  AI
                </span>
              </div>
              <span className="hidden sm:block text-[11px] text-neutral-400 font-medium -mt-0.5 truncate">
                Reflective Intelligence
              </span>
            </div>
          </div>

          {/* Navigation Action Area - Clean, Compact & Non-Overflowing */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {onOpenSecurityInspector && (
              <button
                id="landing-security-audit-btn"
                onClick={onOpenSecurityInspector}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] transition-all cursor-pointer"
                title="Verify Zero-Trust Architecture & Threat Models"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Security Audit</span>
              </button>
            )}

            {/* Compact Crisp White "Get Started Free" Action Button */}
            <button
              id="landing-nav-get-started-btn"
              onClick={onOpenSignUp}
              className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-bold bg-white hover:bg-neutral-100 text-neutral-900 shadow-md hover:shadow-white/20 hover:scale-[1.03] active:scale-95 transition-all cursor-pointer shrink-0"
              title="Get Started Free"
            >
              <span className="hidden sm:inline whitespace-nowrap">Get Started Free</span>
              <span className="inline sm:hidden whitespace-nowrap">Get Started</span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
            </button>
          </div>
        </div>
      </header>

      {/* 3. HERO SECTION */}
      <main className="relative z-10 flex-1 flex flex-col justify-center items-center px-4 sm:px-6 pt-10 sm:pt-16 md:pt-20 pb-16 sm:pb-28">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center w-full">
          
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-purple-500/[0.12] border border-purple-400/30 text-purple-300 text-[10px] sm:text-xs font-semibold tracking-wider uppercase mb-6 sm:mb-8 shadow-sm backdrop-blur-md max-w-full text-center animate-in fade-in slide-in-from-top-3 duration-500">
            <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-pulse shrink-0" />
            <span className="truncate sm:whitespace-normal">✦ AI-POWERED REFLECTIVE INTELLIGENCE</span>
          </div>

          {/* Main Heading with Colorful Gradient Accent Word */}
          <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.18] sm:leading-[1.12] mb-4 sm:mb-6 max-w-3xl">
            Bridge the Gap Between Thoughts &amp;{' '}
            <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-purple-400 bg-clip-text text-transparent italic font-normal pr-1 inline-block">
              Clarity
            </span>
          </h1>

          {/* Crisp Subtitle */}
          <p className="text-neutral-300 text-sm sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-normal mb-8 sm:mb-10 px-2 text-balance">
            Reflect with AI • Get personalised insights • Build your self-awareness — all in one place
          </p>

          {/* Centered CTA Buttons (Responsive Flexbox avoiding mobile overlap) */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full max-w-xs sm:max-w-none mb-10 sm:mb-14">
            {/* Prominent Login Button */}
            <button
              id="landing-hero-login-btn"
              onClick={onOpenLogin}
              className="w-full sm:w-auto min-w-[140px] px-7 py-3 sm:py-3.5 rounded-full bg-[#111114] hover:bg-[#1A1A20] border border-white/20 hover:border-white/40 text-white font-medium text-sm sm:text-base shadow-lg shadow-black/60 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Login</span>
            </button>

            {/* Primary Sign Up Button */}
            <button
              id="landing-hero-signup-btn"
              onClick={onOpenSignUp}
              className="w-full sm:w-auto min-w-[160px] px-7 py-3 sm:py-3.5 rounded-full bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-sm sm:text-base shadow-xl shadow-white/10 hover:shadow-white/20 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer flex items-center justify-center gap-2 group"
            >
              <span>Sign Up</span>
              <ArrowRight className="w-4 h-4 text-neutral-950 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Quick Sandbox / Instant Demo Link */}
          {onOpenSandbox && (
            <div className="text-xs text-neutral-400 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mb-12 sm:mb-16 px-4 text-center">
              <span>Just browsing?</span>
              <button
                id="landing-instant-sandbox-btn"
                onClick={onOpenSandbox}
                className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4 font-medium transition-colors cursor-pointer"
              >
                Launch instant sandbox guest session →
              </button>
            </div>
          )}

          {/* 4. COSMIC CAPABILITY HIGHLIGHTS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 w-full max-w-3xl mt-2 text-left">
            <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.08] backdrop-blur-md transition-all hover:-translate-y-1">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3">
                <Brain className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">4 Cognitive Personas</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Choose Socratic inquiry, CBT reframing, Creative Muse, or Compassionate active listening.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.08] backdrop-blur-md transition-all hover:-translate-y-1">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3">
                <Mic className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">Gemini Live Voice</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Real-time bidirectional speech conversation over WebSockets with live audio interruption.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.08] backdrop-blur-md transition-all hover:-translate-y-1">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">Zero-Trust Isolation</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Owner-bound Firestore security rules and server-side secret proxy protect your private thoughts.
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* 5. FOOTER */}
      <footer className="relative z-10 border-t border-white/[0.06] py-6 sm:py-8 text-center text-xs text-neutral-500 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Gemini Journal • Built with Google AI Studio &amp; Gemini 3.5</p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-neutral-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              OWASP &amp; Agentic Threat Protected
            </span>
            <span className="inline-flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
              APAC Ideathon Edition
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

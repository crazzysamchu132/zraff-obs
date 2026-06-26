import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

interface PasswordLockScreenProps {
  onUnlock: () => void;
}

export default function PasswordLockScreen({ onUnlock }: PasswordLockScreenProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    // Simulate a brief verification check for aesthetic pleasure
    setTimeout(() => {
      if (password === 'Arabi45#') {
        onUnlock();
      } else {
        setError(true);
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#020817] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(197,168,92,0.12),rgba(255,255,255,0))]" id="lock-screen-page">
      <div className="w-full max-w-md glass-panel rounded-2xl p-8 sm:p-10 shadow-2xl relative overflow-hidden border border-slate-800/80 bg-slate-950/80 backdrop-blur-xl" id="lock-card">
        
        {/* Aesthetic background glow */}
        <div className="absolute top-0 left-1/4 w-1/2 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent blur-[2px]" />
        
        <div className="text-center mb-8" id="lock-header">
          <div className="mx-auto w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mb-4 text-amber-400 shadow-lg shadow-amber-500/5 animate-pulse" id="lock-icon-container">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display" id="lock-title">
            Restricted Access
          </h2>
          <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed" id="lock-subtitle">
            This tournament control platform is encrypted. Please enter the authorized access password to unlock.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" id="lock-form">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 block tracking-wider uppercase font-mono">
              Access Code
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="••••••••"
                required
                disabled={loading}
                className="w-full bg-slate-900/60 border border-slate-800 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder-slate-600 transition outline-none font-mono tracking-widest"
                id="lock-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition"
                id="lock-password-toggle"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center space-x-2 animate-shake" id="lock-error">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Invalid password. Access was denied.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm transition-all duration-200 transform active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/10 flex items-center justify-center space-x-2"
            id="lock-submit-button"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Verify & Unlock</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-900/60 text-center" id="lock-footer">
          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
            Protected by Arabi Enterprise Security
          </span>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, ArrowRight, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthTab = 'signin' | 'register' | 'reset';

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithEmail, quickSignInDeveloper, registerWithEmail, resetPassword } = useAuth();
  const [tab, setTab] = useState<AuthTab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleQuickDeveloperSignIn = async () => {
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await quickSignInDeveloper();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      if (tab === 'signin') {
        await signInWithEmail(email.trim(), password);
        onClose();
      } else if (tab === 'register') {
        if (!displayName.trim()) {
          setErrorMsg('Please enter your full name.');
          setBusy(false);
          return;
        }
        await registerWithEmail(email.trim(), password, displayName.trim());
        setSuccessMsg(
          'Account created and signed in! Submit a registration request from your Dashboard so the Main Family Head can link you into the Family Tree.'
        );
      } else {
        await resetPassword(email.trim(), newPassword);
        setSuccessMsg('Password updated successfully. You can now sign in with your new password.');
        setNewPassword('');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-sky-300/25 bg-[#081736]/95 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in dialog"
          className="absolute right-4 top-4 p-2 text-sky-200/70 hover:text-white rounded-lg hover:bg-sky-950/60 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <p className="text-xs font-medium tracking-wide text-sky-300">Family Legacy Access</p>
          <h2 id="auth-modal-title" className="font-serif text-2xl font-semibold text-white mt-1">
            {tab === 'signin'
              ? 'Sign in to your family archive'
              : tab === 'register'
                ? 'Create a member account'
                : 'Reset your password'}
          </h2>
          <p className="text-sm text-slate-300 mt-1.5">
            {tab === 'reset'
              ? 'Enter your account email and choose a new password.'
              : 'New family accounts start as Pending and are verified by the Main Family Head.'}
          </p>
        </div>

        {/* Instant Access for Developer & Main Family Administration */}
        <button
          type="button"
          disabled={busy}
          onClick={handleQuickDeveloperSignIn}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-gradient-to-r from-sky-300 to-blue-200 hover:from-sky-200 hover:to-blue-100 text-sky-950 font-semibold text-xs sm:text-sm transition-colors disabled:opacity-60 cursor-pointer shadow-lg"
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Quick Access: Arsal Majeed (Developer &amp; Admin)</span>
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-sky-200/70">
          <div className="h-px flex-1 bg-sky-300/20" />
          <span>or use email &amp; password</span>
          <div className="h-px flex-1 bg-sky-300/20" />
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#050F26] border border-sky-300/20 mb-5">
          {(
            [
              { id: 'signin', label: 'Sign In' },
              { id: 'register', label: 'Register' },
              { id: 'reset', label: 'Recovery' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                tab === item.id
                  ? 'bg-sky-300 text-sky-950'
                  : 'text-sky-100/80 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl bg-[#050F26] border border-sky-300/25 text-white placeholder-sky-200/40 focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-sky-100/85 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-sky-200/60 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl bg-[#050F26] border border-sky-300/25 text-white placeholder-sky-200/40 focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          {tab !== 'reset' ? (
            <div>
              <label className="block text-xs font-medium text-sky-100/85 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-sky-200/60 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl bg-[#050F26] border border-sky-300/25 text-white placeholder-sky-200/40 focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-sky-100/85 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-sky-200/60 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl bg-[#050F26] border border-sky-300/25 text-white placeholder-sky-200/40 focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-300 hover:bg-sky-200 text-sky-950 font-semibold text-sm transition-colors disabled:opacity-60 cursor-pointer"
          >
            <span>
              {busy
                ? 'Processing...'
                : tab === 'signin'
                  ? 'Sign In'
                  : tab === 'register'
                    ? 'Create Account'
                    : 'Update Password'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

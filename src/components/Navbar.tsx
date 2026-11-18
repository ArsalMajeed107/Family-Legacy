import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { AppView, UserAccount } from '../types/family.ts';

interface NavbarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  userProfile: UserAccount | null;
  isSignedIn: boolean;
  onOpenAuth: () => void;
  onSignOut: () => void;
  platformName?: string;
}

export function Navbar({
  currentView,
  onNavigate,
  userProfile,
  isSignedIn,
  onOpenAuth,
  onSignOut,
  platformName = 'Family Legacy',
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin =
    userProfile?.role === 'developer_super_admin' ||
    userProfile?.role === 'family_head' ||
    userProfile?.role === 'branch_admin';
  const isDeveloper = userProfile?.role === 'developer_super_admin';

  const navItems: { id: AppView; label: string }[] = [
    { id: 'home', label: 'Overview' },
    { id: 'tree', label: 'Family Tree' },
    { id: 'heritage', label: 'Heritage' },
    ...(isSignedIn ? [{ id: 'dashboard' as AppView, label: 'Dashboard' }] : []),
    ...(isAdmin ? [{ id: 'admin' as AppView, label: 'Family Admin' }] : []),
    ...(isDeveloper ? [{ id: 'developer' as AppView, label: 'Developer' }] : []),
  ];

  const handleNav = (id: AppView) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-sky-300/20 bg-[#06132E]/80 backdrop-blur-xl no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="font-serif text-xl font-semibold tracking-tight text-sky-200 hover:text-sky-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {platformName}
        </button>

        {/* Zone 2: Concise Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {navItems.map((item) => {
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                  active
                    ? 'text-sky-200 border-sky-400'
                    : 'text-slate-300 border-transparent hover:text-white hover:border-sky-300/40'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {isSignedIn ? (
            <button
              type="button"
              onClick={onSignOut}
              className="hidden md:inline-flex items-center px-4 py-2 text-xs font-semibold text-sky-950 bg-sky-300 hover:bg-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="hidden md:inline-flex items-center px-4 py-2 text-xs font-semibold text-sky-950 bg-sky-300 hover:bg-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign In
            </button>
          )}

          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 text-slate-200 hover:text-sky-200 rounded-lg border border-sky-300/25"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-sky-300/15 bg-[#081736]/95 backdrop-blur-xl px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sky-400/20 text-sky-200'
                    : 'text-slate-300 hover:bg-sky-950/60 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <div className="pt-2 border-t border-sky-300/15">
            {isSignedIn ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onSignOut();
                }}
                className="w-full px-4 py-2.5 text-sm font-semibold text-sky-950 bg-sky-300 rounded-lg"
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth();
                }}
                className="w-full px-4 py-2.5 text-sm font-semibold text-sky-950 bg-sky-300 rounded-lg"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LiveHeritageWallpaper } from './components/LiveHeritageWallpaper.tsx';
import { Navbar } from './components/Navbar.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { HomePage } from './components/HomePage.tsx';
import { FamilyTreeExplorer } from './components/FamilyTreeExplorer.tsx';
import { MemberProfileModal } from './components/MemberProfileModal.tsx';
import { MemberDashboard } from './components/MemberDashboard.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { DeveloperConsole } from './components/DeveloperConsole.tsx';
import { HeritageGallery } from './components/HeritageGallery.tsx';
import { FamilyGuideWidget } from './components/FamilyGuideWidget.tsx';
import type { AppView, FamilyMember } from './types/family.ts';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050E24] text-white flex items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-sky-400/30 bg-[#081736] p-6 text-center">
            <h1 className="font-serif text-2xl font-semibold text-white">
              Something went wrong
            </h1>
            <p className="text-xs text-sky-100/80 mt-2">
              Please reload the page to restore your Family Legacy session.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-5 py-2 rounded-xl bg-sky-300 text-sky-950 font-semibold text-xs cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function FamilyRootsShell() {
  const {
    userProfile,
    isSignedIn,
    loading,
    publicOverview,
    systemSettings,
    announcements,
    gallery,
    stories,
    members,
    branches,
    myRequests,
    allRequests,
    auditLogs,
    refreshData,
    logout,
  } = useAuth();

  const [currentView, setCurrentView] = useState<AppView>('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);

  const isAdmin =
    Boolean(userProfile) &&
    userProfile?.accountStatus === 'active' &&
    (userProfile?.role === 'developer_super_admin' ||
      userProfile?.role === 'family_head' ||
      userProfile?.role === 'branch_admin');

  const publicUpdates = announcements.filter((a) => a.isPublic).slice(0, 3);
  const featuredStory = stories.find((s) => s.isPublic) || stories[0] || null;

  return (
    <div className="relative min-h-screen flex flex-col text-slate-100">
      <LiveHeritageWallpaper
        intensity={systemSettings?.defaultWallpaperIntensity || 'standard'}
        colorTheme={systemSettings?.defaultWallpaperColor || 'sapphire'}
      />

      <Navbar
        currentView={currentView}
        onNavigate={setCurrentView}
        userProfile={userProfile}
        isSignedIn={isSignedIn}
        onOpenAuth={() => setAuthModalOpen(true)}
        onSignOut={async () => {
          await logout();
          setCurrentView('home');
        }}
        platformName={systemSettings?.platformName || 'Family Legacy'}
      />

      {systemSettings?.maintenanceMode && userProfile?.role !== 'developer_super_admin' && (
        <div className="relative z-10 bg-sky-300 text-sky-950 text-xs font-semibold text-center py-2 px-4 no-print">
          Scheduled Heritage Archive Maintenance is in progress. Read-only mode may apply.
        </div>
      )}

      {loading ? (
        <div className="relative z-10 flex-1 flex items-center justify-center py-24">
          <p className="text-sm text-sky-200 font-medium">Loading Family Legacy...</p>
        </div>
      ) : (
        <div className="relative z-10 flex-1">
          {currentView === 'home' && (
            <HomePage
              overview={publicOverview}
              recentUpdates={publicUpdates}
              featuredStory={featuredStory}
              userProfile={userProfile}
              isSignedIn={isSignedIn}
              onNavigate={setCurrentView}
              onOpenAuth={() => setAuthModalOpen(true)}
              onOpenAiGuide={() => setAiOpen(true)}
            />
          )}

          {currentView === 'tree' && (
            <FamilyTreeExplorer
              members={members}
              branches={branches}
              userProfile={userProfile}
              isSignedIn={isSignedIn}
              onSelectMember={(m) => setSelectedMember(m)}
              onOpenAuth={() => setAuthModalOpen(true)}
            />
          )}

          {currentView === 'heritage' && (
            <HeritageGallery
              gallery={gallery}
              stories={stories}
              userProfile={userProfile}
            />
          )}

          {currentView === 'dashboard' && isSignedIn && (
            <MemberDashboard
              members={members}
              branches={branches}
              announcements={announcements}
              myRequests={myRequests}
              onNavigate={setCurrentView}
              onSelectMember={(m) => setSelectedMember(m)}
              onOpenAiGuide={() => setAiOpen(true)}
            />
          )}

          {currentView === 'admin' && isAdmin && userProfile && (
            <AdminDashboard
              members={members}
              branches={branches}
              requests={allRequests}
              announcements={announcements}
              auditLogs={auditLogs}
              userProfile={userProfile}
              onSelectMember={(m) => setSelectedMember(m)}
            />
          )}

          {currentView === 'developer' && (
            <DeveloperConsole members={members} auditLogs={auditLogs} />
          )}
        </div>
      )}

      <footer className="relative z-10 border-t border-sky-300/20 bg-[#050F26]/75 backdrop-blur-lg py-6 px-4 sm:px-6 text-xs text-sky-100/75 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            <span className="font-serif text-sky-300 font-semibold">
              {systemSettings?.platformName || 'Family Legacy'}
            </span>{' '}
            · Pashtoon Heritage &amp; Multigenerational Genealogy Archive
          </p>
          <p>Founding Lineage: Muhammad Ghulam &amp; Amna Gulam</p>
        </div>
      </footer>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      <MemberProfileModal
        member={selectedMember}
        allMembers={members}
        branches={branches}
        userProfile={userProfile}
        onClose={() => setSelectedMember(null)}
        onSelectMember={(m) => setSelectedMember(m)}
        onUpdated={() => {
          refreshData();
        }}
      />

      <FamilyGuideWidget isOpen={aiOpen} onToggle={setAiOpen} />
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <FamilyRootsShell />
      </AuthProvider>
    </AppErrorBoundary>
  );
}

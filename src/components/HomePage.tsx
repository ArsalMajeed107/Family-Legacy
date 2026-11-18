import { ArrowRight, BookOpen, GitBranch, Users, Layers } from 'lucide-react';
import { FOUNDING_ASSETS } from '../lib/seedFamily.ts';
import type {
  AppView,
  FamilyAnnouncement,
  FamilyStory,
  PublicOverview,
  UserAccount,
} from '../types/family.ts';

interface HomePageProps {
  overview: PublicOverview | null;
  recentUpdates: FamilyAnnouncement[];
  featuredStory: FamilyStory | null;
  userProfile: UserAccount | null;
  isSignedIn: boolean;
  onNavigate: (view: AppView) => void;
  onOpenAuth: () => void;
  onOpenAiGuide: () => void;
}

export function HomePage({
  overview,
  recentUpdates,
  featuredStory,
  userProfile,
  isSignedIn,
  onNavigate,
  onOpenAuth,
  onOpenAiGuide,
}: HomePageProps) {
  const grandfatherName = overview?.grandfatherName || 'Muhammad Ghulam';
  const grandmotherName = overview?.grandmotherName || 'Amna Gulam';

  return (
    <main className="relative z-10">
      {/* Hero Section (elevated glassmorphic depth letting live sapphire aurora shine) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-14 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          {/* Left Hero Copy */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <p className="text-xs font-semibold tracking-wider uppercase text-sky-300 mb-3 drop-shadow">
              Family Legacy · Pashtoon Heritage · {grandfatherName} &amp; {grandmotherName} Lineage
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold leading-[1.12] tracking-tight text-white drop-shadow-sm">
              Every Family Has a Story. Preserve Yours Forever.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-sky-50/90 leading-relaxed max-w-2xl">
              Connect generations, preserve family heritage, and bring your entire family together
              in one digital platform.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate('tree')}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-sky-300 hover:bg-sky-200 text-sky-950 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap shadow-lg shadow-sky-500/15"
              >
                <span>Explore 3D Family Tree</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isSignedIn) {
                    onNavigate('dashboard');
                  } else {
                    onOpenAuth();
                  }
                }}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-sky-300/40 bg-[#081736]/48 backdrop-blur-md hover:bg-sky-900/45 text-white font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>
                  {isSignedIn
                    ? userProfile?.role === 'pending_member'
                      ? 'Complete Family Registration'
                      : 'Open Member Dashboard'
                    : 'Family Registration'}
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenAiGuide}
                className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-amber-200 hover:text-amber-100 underline underline-offset-4 cursor-pointer whitespace-nowrap"
              >
                <span>Ask FamilyGuide AI</span>
              </button>
            </div>
          </div>

          {/* Right Focal Anchor: Founding Ancestors & Developer Portrait Showcase */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-sky-300/35 bg-[#081736]/55 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-blue-950/40">
            <div>
              <p className="text-xs font-medium tracking-wider uppercase text-amber-200">
                Founding Generation · Main Family Head
              </p>
              <h2 className="font-serif text-2xl font-semibold text-white mt-1.5">
                {grandfatherName} &amp; {grandmotherName}
              </h2>
              <p className="text-sm text-sky-100/85 mt-2 leading-relaxed">
                {overview?.familyMotto ||
                  'Rooted in Pashtoon honor, united across generations, and remembered with gratitude.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 my-5">
              <div className="group">
                <div className="aspect-square rounded-xl overflow-hidden border border-sky-300/30 bg-[#050F26]/70">
                  <img
                    src={FOUNDING_ASSETS.grandfather}
                    alt={`${grandfatherName} — Main Family Head`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                </div>
                <p className="mt-2 text-sm font-semibold text-white">{grandfatherName}</p>
                <p className="text-xs text-sky-200/75">Grandfather · Main Family Head</p>
              </div>

              <div className="group">
                <div className="aspect-square rounded-xl overflow-hidden border border-sky-300/30 bg-[#050F26]/70">
                  <img
                    src={FOUNDING_ASSETS.grandmother}
                    alt={`${grandmotherName} — Founding Grandmother`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                </div>
                <p className="mt-2 text-sm font-semibold text-white">{grandmotherName}</p>
                <p className="text-xs text-sky-200/75">Grandmother · Founding Matriarch</p>
              </div>
            </div>

            {/* Family Tree Descendant & Developer Portrait Strip */}
            <div className="pt-4 border-t border-sky-300/20 flex items-center gap-3.5">
              <img
                src={FOUNDING_ASSETS.developer}
                alt="Arsal Majeed — Family Tree & Family Legacy Developer"
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-xl object-cover border border-amber-300/50 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-amber-200">
                  Family Tree Descendant &amp; Developer
                </p>
                <p className="text-sm font-semibold text-white truncate">Arsal Majeed</p>
                <p className="text-xs text-sky-200/75 truncate">
                  Architect of Family Legacy Heritage Platform
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('tree')}
                className="text-xs font-semibold text-sky-200 hover:text-sky-100 whitespace-nowrap cursor-pointer"
              >
                View Tree →
              </button>
            </div>
          </div>
        </div>

        {/* Full-Width Live KPI Strip */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-sky-300/25 bg-[#081736]/52 backdrop-blur-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-sky-100/80">Total Family Members</p>
              <p className="font-mono text-3xl font-semibold text-white tabular-nums mt-1">
                {overview?.totalMembers ?? 3}
              </p>
            </div>
            <Users className="w-6 h-6 text-sky-300/90" />
          </div>

          <div className="rounded-xl border border-sky-300/25 bg-[#081736]/52 backdrop-blur-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-sky-100/80">Total Generations</p>
              <p className="font-mono text-3xl font-semibold text-white tabular-nums mt-1">
                {overview?.totalGenerations ?? 3}
              </p>
            </div>
            <Layers className="w-6 h-6 text-sky-300/90" />
          </div>

          <div className="rounded-xl border border-sky-300/25 bg-[#081736]/52 backdrop-blur-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-sky-100/80">Family Branches</p>
              <p className="font-mono text-3xl font-semibold text-white tabular-nums mt-1">
                {overview?.totalBranches ?? 1}
              </p>
            </div>
            <GitBranch className="w-6 h-6 text-sky-300/90" />
          </div>
        </div>
      </section>

      {/* Family History Introduction & Recent Family Updates */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Family History Introduction */}
          <div className="lg:col-span-7 rounded-2xl border border-sky-300/30 bg-[#081736]/55 backdrop-blur-xl p-6 sm:p-8 shadow-xl shadow-blue-950/30">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-sky-300/20">
              <div>
                <p className="text-xs text-amber-200 font-semibold uppercase tracking-[0.14em]">
                  Pashtoon Heritage Chronicle
                </p>
                <h2 className="font-serif text-2xl font-semibold text-white mt-1.5">
                  {featuredStory?.title ||
                    `The Legacy of ${grandfatherName} & ${grandmotherName}`}
                </h2>
              </div>
              <BookOpen className="w-5 h-5 text-sky-300 shrink-0" />
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-5 gap-6 items-start">
              <div className="sm:col-span-2 aspect-[4/3] rounded-xl overflow-hidden border border-sky-300/25 bg-[#050F26]/70">
                <img
                  src={FOUNDING_ASSETS.ancestralHome}
                  alt="Ancestral family courtyard"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="sm:col-span-3 space-y-3 text-sm text-sky-50/90 leading-relaxed">
                <p>
                  {featuredStory?.excerpt ||
                    `Beginning with Grandfather ${grandfatherName} and Grandmother ${grandmotherName}, Family Legacy preserves every son, daughter, spouse, grandchild, and great-grandchild under verified family stewardship.`}
                </p>
                <p className="text-sky-100/80">
                  Every relationship is verified by the Main Family Head before entering the
                  permanent family archive, honoring Pashtoon kinship and each generation.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('heritage')}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-200 hover:text-sky-100 cursor-pointer"
                  >
                    <span>Explore Heritage Gallery &amp; Stories</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Family Updates */}
          <div className="lg:col-span-5 rounded-2xl border border-sky-300/30 bg-[#081736]/55 backdrop-blur-xl p-6 sm:p-8 flex flex-col justify-between shadow-xl shadow-blue-950/30">
            <div>
              <div className="pb-4 border-b border-sky-300/20">
                <p className="text-xs text-amber-200 font-semibold uppercase tracking-[0.14em]">
                  Family Noticeboard
                </p>
                <h2 className="font-serif text-2xl font-semibold text-white mt-1.5">
                  Recent Family Updates
                </h2>
              </div>

              <div className="mt-5 divide-y divide-sky-300/15">
                {recentUpdates.length === 0 ? (
                  <div className="py-6 text-sm text-sky-100/85">
                    <p className="text-white font-medium">
                      Founding Lineage Preservation Active
                    </p>
                    <p className="mt-1 text-sky-100/80">
                      Sign in to view verified family milestones, upcoming birthdays, and reunion
                      announcements.
                    </p>
                  </div>
                ) : (
                  recentUpdates.map((item) => (
                    <article key={item.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2 text-xs text-sky-300">
                        <span className="capitalize">{item.category}</span>
                        {item.eventDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{item.eventDate}</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-white mt-1">{item.title}</h3>
                      <p className="text-xs text-sky-100/80 mt-1 line-clamp-2 leading-relaxed">
                        {item.content}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="pt-5 mt-5 border-t border-sky-300/20">
              <button
                type="button"
                onClick={() => (isSignedIn ? onNavigate('dashboard') : onOpenAuth())}
                className="w-full py-2.5 px-4 rounded-xl border border-sky-300/35 hover:border-sky-200/75 bg-[#050F26]/40 text-sm font-medium text-sky-100 hover:text-white transition-colors cursor-pointer"
              >
                {isSignedIn ? 'View Personal Dashboard' : 'Sign In for Full Family Access'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

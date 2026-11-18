import React, { useMemo, useState } from 'react';
import {
  User as UserIcon,
  Calendar,
  Bell,
  FilePlus2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, notifyDataChanged } from '../lib/apiClient.ts';
import { generateSafeId, getUpcomingBirthdays } from '../lib/genealogy.ts';
import type {
  AppView,
  FamilyAnnouncement,
  FamilyBranch,
  FamilyMember,
  RegistrationRequest,
} from '../types/family.ts';

interface MemberDashboardProps {
  members: FamilyMember[];
  branches: FamilyBranch[];
  announcements: FamilyAnnouncement[];
  myRequests: RegistrationRequest[];
  onNavigate: (view: AppView) => void;
  onSelectMember: (m: FamilyMember) => void;
  onOpenAiGuide: () => void;
}

export function MemberDashboard({
  members,
  branches,
  announcements,
  myRequests,
  onNavigate,
  onSelectMember,
  onOpenAiGuide,
}: MemberDashboardProps) {
  const { userProfile } = useAuth();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Registration Request Form State
  const [requestType, setRequestType] = useState<'new_member' | 'profile_correction'>('new_member');
  const [fullName, setFullName] = useState(userProfile?.displayName || '');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [birthDate, setBirthDate] = useState('');
  const [suggestedFatherName, setSuggestedFatherName] = useState('');
  const [suggestedMotherName, setSuggestedMotherName] = useState('');
  const [suggestedSpouseName, setSuggestedSpouseName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [biography, setBiography] = useState('');

  const linkedMember = useMemo(() => {
    if (!userProfile) return undefined;
    return (
      members.find((m) => m.id === userProfile.memberId) ||
      members.find((m) => m.linkedUid === userProfile.uid)
    );
  }, [members, userProfile]);

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const father = linkedMember?.fatherId ? byId.get(linkedMember.fatherId) : undefined;
  const mother = linkedMember?.motherId ? byId.get(linkedMember.motherId) : undefined;
  const spouse = linkedMember?.spouseId ? byId.get(linkedMember.spouseId) : undefined;
  const children = useMemo(
    () =>
      linkedMember
        ? members.filter((m) => m.fatherId === linkedMember.id || m.motherId === linkedMember.id)
        : [],
    [members, linkedMember]
  );
  const branch = branches.find((b) => b.id === (linkedMember?.branchId || userProfile?.branchId));
  const upcomingBirthdays = useMemo(() => getUpcomingBirthdays(members, 5), [members]);

  const recentRegistrations = useMemo(
    () => [...members].filter((m) => m.status === 'verified').slice(0, 4),
    [members]
  );

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    setSubmitting(true);
    setFormMsg(null);
    const reqId = generateSafeId('req');
    try {
      await apiFetch('/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          id: reqId,
          requestType,
          targetMemberId: linkedMember?.id || '',
          fullName: fullName.trim(),
          gender,
          birthDate: birthDate.trim(),
          suggestedFatherName: suggestedFatherName.trim(),
          suggestedMotherName: suggestedMotherName.trim(),
          suggestedSpouseName: suggestedSpouseName.trim(),
          branchId: branchId || '',
          contactPhone: contactPhone.trim(),
          biography: biography.trim(),
        }),
      });

      notifyDataChanged();
      setFormMsg({
        type: 'ok',
        text: 'Your registration request has been submitted to the Main Family Head for review.',
      });
      setShowRequestForm(false);
    } catch (err) {
      setFormMsg({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Could not submit request. Please ensure all required fields are filled.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Welcome Header */}
      <section className="rounded-2xl border border-sky-300/25 bg-[#081736]/75 backdrop-blur-xl p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border border-sky-300/35 bg-[#050F26] shrink-0 flex items-center justify-center">
              {linkedMember?.photoUrl || userProfile?.photoUrl ? (
                <img
                  src={linkedMember?.photoUrl || userProfile?.photoUrl}
                  alt={userProfile?.displayName || 'Profile'}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon className="w-8 h-8 text-sky-300/50" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-sky-300">
                <span className="capitalize">
                  {(userProfile?.role || 'pending_member').replace(/_/g, ' ')}
                </span>
                <span aria-hidden="true">·</span>
                <span className="capitalize">
                  Account {userProfile?.accountStatus || 'pending'}
                </span>
                {branch && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{branch.name}</span>
                  </>
                )}
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-white mt-1">
                Welcome, {linkedMember?.fullName || userProfile?.displayName || 'Family Member'}
              </h1>
              <p className="text-xs text-sky-200/70 mt-1">{userProfile?.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowRequestForm((prev) => !prev)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-300 hover:bg-sky-200 text-sky-950 font-semibold text-xs transition-colors cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>
                {showRequestForm ? 'Close Registration Form' : 'Submit Registration / Correction'}
              </span>
            </button>
            <button
              type="button"
              onClick={onOpenAiGuide}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-sky-300/30 bg-white/5 hover:bg-white/10 text-sky-200 text-xs font-medium cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Ask FamilyGuide AI</span>
            </button>
          </div>
        </div>

        {formMsg && (
          <div
            className={`mt-5 flex items-start gap-2.5 rounded-xl border p-3.5 text-xs ${
              formMsg.type === 'ok'
                ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
            }`}
          >
            {formMsg.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            )}
            <span>{formMsg.text}</span>
          </div>
        )}

        {/* Collapsible Registration Request Form */}
        {showRequestForm && (
          <form
            onSubmit={handleSubmitRequest}
            className="mt-6 pt-6 border-t border-slate-700/60 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="font-serif text-xl font-semibold text-white">
                Family Registration &amp; Verification Request
              </h2>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#050F26] border border-sky-300/25">
                <button
                  type="button"
                  onClick={() => setRequestType('new_member')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                    requestType === 'new_member'
                      ? 'bg-sky-300 text-sky-950'
                      : 'text-sky-100/80'
                  }`}
                >
                  New Member
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType('profile_correction')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                    requestType === 'profile_correction'
                      ? 'bg-sky-300 text-sky-950'
                      : 'text-sky-100/80'
                  }`}
                >
                  Profile Correction
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other')}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Father&apos;s Name
                </label>
                <input
                  type="text"
                  value={suggestedFatherName}
                  onChange={(e) => setSuggestedFatherName(e.target.value)}
                  placeholder="Father's full name"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Mother&apos;s Name
                </label>
                <input
                  type="text"
                  value={suggestedMotherName}
                  onChange={(e) => setSuggestedMotherName(e.target.value)}
                  placeholder="Mother's full name"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Spouse&apos;s Name (Optional)
                </label>
                <input
                  type="text"
                  value={suggestedSpouseName}
                  onChange={(e) => setSuggestedSpouseName(e.target.value)}
                  placeholder="Spouse's full name"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Family Branch
                </label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                >
                  <option value="">Select branch if known</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Contact Number (Optional)
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+92 300 0000000"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Biography / Notes for Family Head
              </label>
              <textarea
                rows={3}
                value={biography}
                onChange={(e) => setBiography(e.target.value)}
                placeholder="Share details that help the Main Family Head verify your lineage placement..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-sky-300 hover:bg-sky-200 text-sky-950 font-semibold text-xs cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit for Family Head Review'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <section className="rounded-2xl border border-sky-300/20 bg-[#081736]/70 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-sky-300/20">
              <div>
                <p className="text-xs text-sky-300 font-medium">Personal Lineage</p>
                <h2 className="font-serif text-xl font-semibold text-white mt-0.5">
                  Your Family Connections
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('tree')}
                className="text-xs font-semibold text-sky-300 hover:text-sky-200 cursor-pointer"
              >
                Open Full Tree →
              </button>
            </div>

            {linkedMember ? (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-sky-300/20 bg-[#050F26]/65 p-4">
                  <p className="text-xs text-sky-200/70">Parents</p>
                  <div className="mt-1.5 space-y-1">
                    <p className="text-sm text-white">
                      Father:{' '}
                      {father ? (
                        <button
                          type="button"
                          onClick={() => onSelectMember(father)}
                          className="text-sky-300 hover:underline cursor-pointer"
                        >
                          {father.fullName}
                        </button>
                      ) : (
                        <span className="text-sky-200/60">Not linked</span>
                      )}
                    </p>
                    <p className="text-sm text-white">
                      Mother:{' '}
                      {mother ? (
                        <button
                          type="button"
                          onClick={() => onSelectMember(mother)}
                          className="text-sky-300 hover:underline cursor-pointer"
                        >
                          {mother.fullName}
                        </button>
                      ) : (
                        <span className="text-sky-200/60">Not linked</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-sky-300/20 bg-[#050F26]/65 p-4">
                  <p className="text-xs text-sky-200/70">Spouse &amp; Children</p>
                  <div className="mt-1.5 space-y-1">
                    <p className="text-sm text-white">
                      Spouse:{' '}
                      {spouse ? (
                        <button
                          type="button"
                          onClick={() => onSelectMember(spouse)}
                          className="text-sky-300 hover:underline cursor-pointer"
                        >
                          {spouse.fullName}
                        </button>
                      ) : (
                        <span className="text-sky-200/60">None recorded</span>
                      )}
                    </p>
                    <p className="text-sm text-white">
                      Children:{' '}
                      {children.length > 0 ? (
                        <span className="text-sky-300">
                          {children.map((c) => c.fullName).join(', ')}
                        </span>
                      ) : (
                        <span className="text-sky-200/60">None recorded</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="sm:col-span-2 flex items-center justify-between pt-2">
                  <span className="text-xs text-sky-200/70">
                    Generation {linkedMember.generation} · {branch?.name || 'Central Lineage'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectMember(linkedMember)}
                    className="text-xs font-medium text-sky-300 hover:text-sky-200 cursor-pointer"
                  >
                    Edit My Profile &amp; Contact Details →
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 text-sm text-sky-100/80">
                <p>
                  Your login account is not yet linked to a verified node in the family tree.
                  Submit a Registration Request above so the Main Family Head can verify and link
                  your profile.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-sky-300/20 bg-[#081736]/70 backdrop-blur-xl p-6">
            <h2 className="font-serif text-xl font-semibold text-white pb-3 border-b border-sky-300/20">
              My Registration Requests
            </h2>
            {myRequests.length === 0 ? (
              <p className="text-sm text-sky-200/70 mt-4">
                You have not submitted any registration or correction requests yet.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-sky-300/15">
                {myRequests.map((req) => (
                  <div key={req.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{req.fullName}</p>
                      <span
                        className={`text-xs font-semibold capitalize ${
                          req.status === 'approved'
                            ? 'text-emerald-400'
                            : req.status === 'rejected'
                              ? 'text-rose-400'
                              : 'text-amber-300'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-sky-200/70 mt-0.5 capitalize">
                      {req.requestType.replace(/_/g, ' ')}
                      {req.suggestedFatherName ? ` · Father: ${req.suggestedFatherName}` : ''}
                    </p>
                    {req.reviewNotes && (
                      <p className="text-xs text-sky-100/80 mt-1.5">
                        Reviewer Note: {req.reviewNotes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-2xl border border-sky-300/20 bg-[#081736]/70 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-sky-300/20">
              <h2 className="font-serif text-xl font-semibold text-white">Family Announcements</h2>
              <Bell className="w-4 h-4 text-sky-300" />
            </div>
            <div className="mt-4 divide-y divide-sky-300/15">
              {announcements.length === 0 ? (
                <p className="text-sm text-sky-200/70">No announcements posted yet.</p>
              ) : (
                announcements.slice(0, 4).map((a) => (
                  <div key={a.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-xs text-sky-300 capitalize">
                      {a.category}
                      {a.eventDate ? ` · ${a.eventDate}` : ''}
                    </p>
                    <p className="text-sm font-semibold text-white mt-0.5">{a.title}</p>
                    <p className="text-xs text-sky-100/80 mt-1 leading-relaxed">{a.content}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-sky-300/20 bg-[#081736]/70 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-sky-300/20">
              <h2 className="font-serif text-xl font-semibold text-white">Upcoming Birthdays</h2>
              <Calendar className="w-4 h-4 text-sky-300" />
            </div>
            <div className="mt-4 space-y-3">
              {upcomingBirthdays.length === 0 ? (
                <p className="text-sm text-sky-200/70">
                  Upcoming birthdays appear once member birth dates are recorded.
                </p>
              ) : (
                upcomingBirthdays.map((b) => (
                  <div key={b.member.id} className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => onSelectMember(b.member)}
                      className="text-sky-100 hover:text-sky-300 font-medium cursor-pointer text-left"
                    >
                      {b.member.fullName}
                    </button>
                    <span className="font-mono text-sky-200/70 tabular-nums">
                      {b.monthDayLabel} ·{' '}
                      {b.daysUntil === 0 ? 'Today' : `in ${b.daysUntil}d`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-sky-300/20 bg-[#081736]/70 backdrop-blur-xl p-6">
            <h2 className="font-serif text-xl font-semibold text-white pb-3 border-b border-sky-300/20">
              Verified Family Directory
            </h2>
            <div className="mt-4 space-y-2.5">
              {recentRegistrations.length === 0 ? (
                <p className="text-sm text-sky-200/70">
                  Verified family members will appear here once approved.
                </p>
              ) : (
                recentRegistrations.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => onSelectMember(m)}
                      className="text-sky-100 hover:text-sky-300 font-medium cursor-pointer text-left"
                    >
                      {m.fullName}
                    </button>
                    <span className="text-sky-200/70">Generation {m.generation}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

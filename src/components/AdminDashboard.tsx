import React, { useMemo, useState } from 'react';
import {
  UserPlus,
  GitBranch,
  Check,
  X,
  Upload,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  Trash2,
} from 'lucide-react';
import { apiFetch, notifyDataChanged } from '../lib/apiClient.ts';
import {
  compressImageToDataUrl,
  computeGenerationFromParents,
  findPotentialDuplicates,
  generateSafeId,
  validateRelationshipIntegrity,
} from '../lib/genealogy.ts';
import type {
  AuditLog,
  FamilyAnnouncement,
  FamilyBranch,
  FamilyMember,
  RegistrationRequest,
  UserAccount,
} from '../types/family.ts';

interface AdminDashboardProps {
  members: FamilyMember[];
  branches: FamilyBranch[];
  requests: RegistrationRequest[];
  announcements: FamilyAnnouncement[];
  auditLogs: AuditLog[];
  userProfile: UserAccount;
  onSelectMember: (m: FamilyMember) => void;
}

type AdminTab = 'overview' | 'add_member' | 'approvals' | 'branches' | 'announcements' | 'logs';

export function AdminDashboard({
  members,
  branches,
  requests,
  announcements,
  auditLogs,
  userProfile,
  onSelectMember,
}: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Add Member Form State
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [birthDate, setBirthDate] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [isDeceased, setIsDeceased] = useState(false);
  const [fatherId, setFatherId] = useState('');
  const [motherId, setMotherId] = useState('');
  const [spouseId, setSpouseId] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [relationshipLabel, setRelationshipLabel] = useState('');
  const [biography, setBiography] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactAddress, setContactAddress] = useState('');

  // Branch Form
  const [branchName, setBranchName] = useState('');
  const [branchLocation, setBranchLocation] = useState('');
  const [branchDescription, setBranchDescription] = useState('');

  // Announcement Form
  const [annTitle, setAnnTitle] = useState('');
  const [annCategory, setAnnCategory] = useState<FamilyAnnouncement['category']>('announcement');
  const [annDate, setAnnDate] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPublic, setAnnPublic] = useState(true);

  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const isFamilyHeadOrDev =
    userProfile.role === 'family_head' || userProfile.role === 'developer_super_admin';

  const stats = useMemo(() => {
    const active = members.filter((m) => m.status !== 'archived');
    const maxGen = active.reduce((acc, m) => Math.max(acc, m.generation || 1), active.length ? 1 : 0);
    const maleCount = active.filter((m) => m.gender === 'male').length;
    const femaleCount = active.filter((m) => m.gender === 'female').length;
    const approvedReqs = requests.filter((r) => r.status === 'approved').length;
    const pendingReqs = requests.filter((r) => r.status === 'pending').length;
    const rejectedReqs = requests.filter((r) => r.status === 'rejected').length;

    return {
      totalMembers: active.length,
      totalGenerations: maxGen,
      maleCount,
      femaleCount,
      totalBranches: branches.length,
      approvedReqs,
      pendingReqs,
      rejectedReqs,
    };
  }, [members, branches, requests]);

  const potentialDuplicates = useMemo(
    () => findPotentialDuplicates(fullName, birthDate, members),
    [fullName, birthDate, members]
  );

  const writeAudit = async (action: string, targetCollection: string, targetId: string, details: string) => {
    await apiFetch('/api/audit', {
      method: 'POST',
      body: JSON.stringify({
        id: generateSafeId('log'),
        action,
        targetCollection,
        targetId,
        details,
      }),
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file, 420, 0.8);
      setPhotoUrl(compressed);
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Image upload error.' });
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);

    const memberId = generateSafeId('member');
    try {
      const integrityError = validateRelationshipIntegrity(
        {
          id: memberId,
          fatherId: fatherId || undefined,
          motherId: motherId || undefined,
          spouseId: spouseId || undefined,
        },
        members
      );
      if (integrityError) {
        setNotice({ type: 'err', text: integrityError });
        setBusy(false);
        return;
      }

      const generation = computeGenerationFromParents(
        fatherId || undefined,
        motherId || undefined,
        members,
        1
      );

      await apiFetch('/api/members', {
        method: 'POST',
        body: JSON.stringify({
          id: memberId,
          fullName: fullName.trim(),
          gender,
          birthDate: birthDate.trim(),
          deathDate: isDeceased ? deathDate.trim() : '',
          isDeceased,
          generation,
          fatherId: fatherId || '',
          motherId: motherId || '',
          spouseId: spouseId || '',
          branchId: branchId || '',
          photoUrl: photoUrl || '',
          biography: biography.trim(),
          relationshipLabel: relationshipLabel.trim(),
          isFoundingAncestor: false,
          status: 'verified',
        }),
      });

      if (isFamilyHeadOrDev && (contactEmail || contactPhone || contactAddress)) {
        await apiFetch(`/api/private-info/${memberId}`, {
          method: 'PUT',
          body: JSON.stringify({
            email: contactEmail.trim(),
            phone: contactPhone.trim(),
            address: contactAddress.trim(),
          }),
        });
      }

      await writeAudit(
        'ADD_FAMILY_MEMBER',
        'members',
        memberId,
        `Added verified member ${fullName.trim()} (Generation ${generation})`
      );
      notifyDataChanged();

      setNotice({ type: 'ok', text: `Successfully registered ${fullName.trim()} into the family tree.` });
      setFullName('');
      setBirthDate('');
      setDeathDate('');
      setIsDeceased(false);
      setFatherId('');
      setMotherId('');
      setSpouseId('');
      setRelationshipLabel('');
      setBiography('');
      setPhotoUrl('');
      setContactEmail('');
      setContactPhone('');
      setContactAddress('');
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save family member.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReviewRequest = async (req: RegistrationRequest, decision: 'approved' | 'rejected') => {
    setBusy(true);
    setNotice(null);
    try {
      const note = (reviewNotes[req.id] || '').trim();
      await apiFetch(`/api/requests/${req.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ decision, reviewNotes: note }),
      });

      await writeAudit(
        `REGISTRATION_${decision.toUpperCase()}`,
        'registrationRequests',
        req.id,
        `${decision} request for ${req.fullName}`
      );
      notifyDataChanged();
      setNotice({ type: 'ok', text: `Request for ${req.fullName} marked as ${decision}.` });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to process registration request.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;
    setBusy(true);
    setNotice(null);
    const id = generateSafeId('branch');
    try {
      await apiFetch('/api/branches', {
        method: 'POST',
        body: JSON.stringify({
          id,
          name: branchName.trim(),
          heritageLocation: branchLocation.trim(),
          description: branchDescription.trim(),
        }),
      });
      await writeAudit('CREATE_BRANCH', 'branches', id, `Created branch ${branchName.trim()}`);
      notifyDataChanged();
      setBranchName('');
      setBranchLocation('');
      setBranchDescription('');
      setNotice({ type: 'ok', text: 'New family branch created.' });
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Failed to create branch.' });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;
    setBusy(true);
    setNotice(null);
    const id = generateSafeId('ann');
    try {
      await apiFetch('/api/announcements', {
        method: 'POST',
        body: JSON.stringify({
          id,
          title: annTitle.trim(),
          content: annContent.trim(),
          category: annCategory,
          eventDate: annDate.trim(),
          isPublic: annPublic,
        }),
      });
      await writeAudit('POST_ANNOUNCEMENT', 'announcements', id, `Published "${annTitle.trim()}"`);
      notifyDataChanged();
      setAnnTitle('');
      setAnnDate('');
      setAnnContent('');
      setNotice({ type: 'ok', text: 'Announcement published.' });
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Failed to publish announcement.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-sky-300 font-medium">Centralized Family Administration</p>
          <h1 className="font-serif text-3xl font-semibold text-white mt-1">
            Main Family Head Console
          </h1>
        </div>

        <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-[#081736]/90 border border-sky-300/25">
          {(
            [
              { id: 'overview', label: 'Statistics' },
              { id: 'add_member', label: 'Add Member' },
              { id: 'approvals', label: `Approvals (${stats.pendingReqs})` },
              ...(isFamilyHeadOrDev ? [{ id: 'branches' as AdminTab, label: 'Branches' }] : []),
              { id: 'announcements', label: 'Updates' },
              { id: 'logs', label: 'Activity Logs' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                tab === item.id
                  ? 'bg-sky-300 text-sky-950'
                  : 'text-sky-100/80 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs ${
            notice.type === 'ok'
              ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
              : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
          }`}
        >
          {notice.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Family Members', value: stats.totalMembers },
              { label: 'Total Generations', value: stats.totalGenerations },
              { label: 'Male Members', value: stats.maleCount },
              { label: 'Female Members', value: stats.femaleCount },
              { label: 'Family Branches', value: stats.totalBranches },
              { label: 'Approved Requests', value: stats.approvedReqs },
              { label: 'Pending Approvals', value: stats.pendingReqs },
              { label: 'Rejected Requests', value: stats.rejectedReqs },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-sky-300/20 bg-[#081736]/75 backdrop-blur-xl p-5"
              >
                <p className="text-xs text-sky-200/70">{s.label}</p>
                <p className="font-mono text-2xl font-semibold text-white tabular-nums mt-1.5">
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-sky-300/20 bg-[#081736]/75 backdrop-blur-xl p-6">
            <h2 className="font-serif text-xl font-semibold text-white pb-3 border-b border-sky-300/20">
              Verified Family Roster
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-sky-300/15 text-sky-200/70">
                    <th className="py-2.5 pr-4 font-medium">Full Name</th>
                    <th className="py-2.5 px-4 font-medium">Generation</th>
                    <th className="py-2.5 px-4 font-medium">Gender</th>
                    <th className="py-2.5 px-4 font-medium">Branch</th>
                    <th className="py-2.5 pl-4 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-300/10">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-sky-950/35">
                      <td className="py-2.5 pr-4 font-medium text-white">{m.fullName}</td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-sky-100/80">
                        Gen {m.generation}
                      </td>
                      <td className="py-2.5 px-4 capitalize text-sky-100/80">{m.gender}</td>
                      <td className="py-2.5 px-4 text-sky-100/80">
                        {branches.find((b) => b.id === m.branchId)?.name || 'Central'}
                      </td>
                      <td className="py-2.5 pl-4 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectMember(m)}
                          className="text-sky-300 hover:text-sky-200 font-medium cursor-pointer"
                        >
                          Inspect / Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'add_member' && (
        <form
          onSubmit={handleAddMember}
          className="rounded-2xl border border-sky-300/20 bg-[#081736]/80 backdrop-blur-xl p-6 sm:p-8 space-y-5"
        >
          <div className="flex items-center gap-2.5 pb-4 border-b border-sky-300/20">
            <UserPlus className="w-5 h-5 text-sky-300" />
            <h2 className="font-serif text-xl font-semibold text-white">
              Register New Verified Family Member
            </h2>
          </div>

          {potentialDuplicates.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/50 bg-amber-950/40 p-3.5 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
              <div>
                <p className="font-semibold">Potential Duplicate Account Detected</p>
                <p className="mt-0.5">
                  Similar existing record(s):{' '}
                  {potentialDuplicates.map((d) => `${d.fullName} (Gen ${d.generation})`).join(', ')}
                  . Verify before adding to avoid duplicate records.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Tariq Mahmood Ghulam"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Date of Birth</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Father</label>
              <select
                value={fatherId}
                onChange={(e) => setFatherId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
              >
                <option value="">None / Unknown</option>
                {members
                  .filter((m) => m.gender === 'male')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} (Gen {m.generation})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Mother</label>
              <select
                value={motherId}
                onChange={(e) => setMotherId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
              >
                <option value="">None / Unknown</option>
                {members
                  .filter((m) => m.gender === 'female')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} (Gen {m.generation})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Spouse</label>
              <select
                value={spouseId}
                onChange={(e) => setSpouseId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
              >
                <option value="">None</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} (Gen {m.generation})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Family Branch</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
              >
                <option value="">Select branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Relationship Title
              </label>
              <input
                type="text"
                value={relationshipLabel}
                onChange={(e) => setRelationshipLabel(e.target.value)}
                placeholder="e.g. Eldest Son, Daughter-in-law"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
              />
            </div>
            <div className="flex items-end gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-sky-300/25 bg-[#050F26] hover:bg-sky-950/60 text-xs font-medium text-sky-100 cursor-pointer w-full justify-center">
                <Upload className="w-4 h-4 text-sky-300" />
                <span>{photoUrl ? 'Photo Attached' : 'Upload Portrait'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isDeceased}
                onChange={(e) => setIsDeceased(e.target.checked)}
              />
              <span>Deceased Family Member</span>
            </label>
            {isDeceased && (
              <input
                type="date"
                value={deathDate}
                onChange={(e) => setDeathDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Biography</label>
            <textarea
              rows={3}
              value={biography}
              onChange={(e) => setBiography(e.target.value)}
              placeholder="Life highlights, heritage notes, accomplishments..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
            />
          </div>

          {isFamilyHeadOrDev && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-800">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Private Contact Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Private Phone</label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Private Address</label>
                <input
                  type="text"
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-2.5 rounded-xl bg-sky-300 hover:bg-sky-200 text-sky-950 font-semibold text-xs cursor-pointer disabled:opacity-60"
            >
              {busy ? 'Saving Member...' : 'Save & Link Family Member'}
            </button>
          </div>
        </form>
      )}

      {tab === 'approvals' && (
        <div className="rounded-2xl border border-sky-300/20 bg-[#081736]/80 backdrop-blur-xl p-6 space-y-4">
          <h2 className="font-serif text-xl font-semibold text-white pb-3 border-b border-sky-300/20">
            Registration &amp; Correction Queue
          </h2>
          {requests.length === 0 ? (
            <p className="text-sm text-slate-400">No registration requests submitted yet.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {requests.map((req) => {
                const dupes = findPotentialDuplicates(req.fullName, req.birthDate, members);
                return (
                  <div key={req.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {req.fullName}{' '}
                          <span className="text-xs font-normal text-slate-400">
                            ({req.gender} · {req.requestType.replace(/_/g, ' ')})
                          </span>
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Father: {req.suggestedFatherName || '—'} · Mother:{' '}
                          {req.suggestedMotherName || '—'} · Spouse:{' '}
                          {req.suggestedSpouseName || '—'}
                        </p>
                      </div>
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

                    {dupes.length > 0 && req.status === 'pending' && (
                      <p className="text-xs text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>
                          Possible existing profile: {dupes.map((d) => d.fullName).join(', ')}
                        </span>
                      </p>
                    )}

                    {req.biography && (
                      <p className="text-xs text-slate-300 leading-relaxed">{req.biography}</p>
                    )}

                    {req.status === 'pending' && (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                        <input
                          type="text"
                          value={reviewNotes[req.id] || ''}
                          onChange={(e) =>
                            setReviewNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                          }
                          placeholder="Review note (optional for approval, helpful for rejection)"
                          className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleReviewRequest(req, 'approved')}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleReviewRequest(req, 'rejected')}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-rose-500/50 text-rose-300 hover:bg-rose-950/40 font-semibold text-xs cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'branches' && isFamilyHeadOrDev && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreateBranch}
            className="lg:col-span-5 rounded-2xl border border-sky-300/20 bg-[#081736]/80 backdrop-blur-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-sky-300/20">
              <GitBranch className="w-4 h-4 text-sky-300" />
              <h2 className="font-serif text-lg font-semibold text-white">Create Family Branch</h2>
            </div>
            <div>
              <label className="block text-xs text-sky-100/80 mb-1">Branch Name</label>
              <input
                type="text"
                required
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="e.g. Eldest Son Branch — Peshawar"
                className="w-full px-3.5 py-2 rounded-xl bg-[#050F26] border border-sky-300/25 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-sky-100/80 mb-1">Heritage Location</label>
              <input
                type="text"
                value={branchLocation}
                onChange={(e) => setBranchLocation(e.target.value)}
                placeholder="City / Ancestral Region"
                className="w-full px-3.5 py-2 rounded-xl bg-[#050F26] border border-sky-300/25 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-sky-100/80 mb-1">Description</label>
              <textarea
                rows={3}
                value={branchDescription}
                onChange={(e) => setBranchDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#050F26] border border-sky-300/25 text-sm text-white"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-sky-300 hover:bg-sky-200 text-sky-950 font-semibold text-xs cursor-pointer"
            >
              Add Branch
            </button>
          </form>

          <div className="lg:col-span-7 rounded-2xl border border-sky-300/20 bg-[#081736]/80 backdrop-blur-xl p-6">
            <h2 className="font-serif text-lg font-semibold text-white pb-3 border-b border-sky-300/20">
              Active Family Branches ({branches.length})
            </h2>
            <div className="mt-4 divide-y divide-sky-300/15">
              {branches.map((b) => (
                <div key={b.id} className="py-3.5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{b.name}</p>
                    <p className="text-xs text-sky-300/90 mt-0.5">
                      {b.heritageLocation || 'Global Family Branch'}
                    </p>
                    {b.description && <p className="text-xs text-sky-200/70 mt-1">{b.description}</p>}
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${b.name}`}
                    onClick={async () => {
                      await apiFetch(`/api/branches/${b.id}`, { method: 'DELETE' });
                      await writeAudit('DELETE_BRANCH', 'branches', b.id, `Removed branch ${b.name}`);
                      notifyDataChanged();
                    }}
                    className="p-2 text-sky-200/70 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreateAnnouncement}
            className="lg:col-span-5 rounded-2xl border border-sky-300/20 bg-[#081736]/80 backdrop-blur-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-sky-300/20">
              <Megaphone className="w-4 h-4 text-sky-300" />
              <h2 className="font-serif text-lg font-semibold text-white">Publish Announcement</h2>
            </div>
            <div>
              <label className="block text-xs text-sky-100/80 mb-1">Title</label>
              <input
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#050F26] border border-sky-300/25 text-sm text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-sky-100/80 mb-1">Category</label>
                <select
                  value={annCategory}
                  onChange={(e) => setAnnCategory(e.target.value as FamilyAnnouncement['category'])}
                  className="w-full px-3 py-2 rounded-xl bg-[#050F26] border border-sky-300/25 text-xs text-white"
                >
                  <option value="announcement">Announcement</option>
                  <option value="event">Family Event</option>
                  <option value="birthday">Birthday</option>
                  <option value="anniversary">Wedding Anniversary</option>
                  <option value="milestone">Milestone</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-sky-100/80 mb-1">Date</label>
                <input
                  type="date"
                  value={annDate}
                  onChange={(e) => setAnnDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#050F26] border border-sky-300/25 text-xs text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-sky-100/80 mb-1">Details</label>
              <textarea
                rows={3}
                required
                value={annContent}
                onChange={(e) => setAnnContent(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#050F26] border border-sky-300/25 text-sm text-white"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-sky-100/80 cursor-pointer">
              <input
                type="checkbox"
                checked={annPublic}
                onChange={(e) => setAnnPublic(e.target.checked)}
              />
              <span>Visible on public homepage updates</span>
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-sky-300 hover:bg-sky-200 text-sky-950 font-semibold text-xs cursor-pointer"
            >
              Publish Update
            </button>
          </form>

          <div className="lg:col-span-7 rounded-2xl border border-sky-300/20 bg-[#081736]/80 backdrop-blur-xl p-6">
            <h2 className="font-serif text-lg font-semibold text-white pb-3 border-b border-sky-300/20">
              Published Updates ({announcements.length})
            </h2>
            <div className="mt-4 divide-y divide-sky-300/15">
              {announcements.map((a) => (
                <div key={a.id} className="py-3.5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-sky-300 capitalize">
                      {a.category}
                      {a.eventDate ? ` · ${a.eventDate}` : ''}
                    </p>
                    <p className="text-sm font-semibold text-white mt-0.5">{a.title}</p>
                    <p className="text-xs text-sky-200/70 mt-1">{a.content}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${a.title}`}
                    onClick={async () => {
                      await apiFetch(`/api/announcements/${a.id}`, { method: 'DELETE' });
                      notifyDataChanged();
                    }}
                    className="p-2 text-sky-200/70 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="rounded-2xl border border-sky-300/20 bg-[#081736]/80 backdrop-blur-xl p-6">
          <h2 className="font-serif text-xl font-semibold text-white pb-3 border-b border-sky-300/20">
            Family Administrative Activity Logs
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-sky-300/15 text-sky-200/70">
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 px-4 font-medium">Actor</th>
                  <th className="py-2 px-4 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-300/10">
                {auditLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5 pr-4 font-mono text-sky-300">{l.action}</td>
                    <td className="py-2.5 px-4 text-sky-100/80">{l.actorEmail || l.actorUid}</td>
                    <td className="py-2.5 px-4 text-sky-100/80">{l.details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}

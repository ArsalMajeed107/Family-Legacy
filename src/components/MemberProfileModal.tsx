import React, { useEffect, useState } from 'react';
import { X, Upload, Save, Shield, User as UserIcon, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiFetch, notifyDataChanged } from '../lib/apiClient.ts';
import {
  compressImageToDataUrl,
  computeGenerationFromParents,
  validateRelationshipIntegrity,
} from '../lib/genealogy.ts';
import type {
  FamilyBranch,
  FamilyMember,
  MemberPrivateInfo,
  UserAccount,
} from '../types/family.ts';

interface MemberProfileModalProps {
  member: FamilyMember | null;
  allMembers: FamilyMember[];
  branches: FamilyBranch[];
  userProfile: UserAccount | null;
  onClose: () => void;
  onSelectMember: (m: FamilyMember) => void;
  onUpdated: () => void;
}

export function MemberProfileModal({
  member,
  allMembers,
  branches,
  userProfile,
  onClose,
  onSelectMember,
  onUpdated,
}: MemberProfileModalProps) {
  const [privateInfo, setPrivateInfo] = useState<MemberPrivateInfo | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [birthDate, setBirthDate] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [isDeceased, setIsDeceased] = useState(false);
  const [fatherId, setFatherId] = useState('');
  const [motherId, setMotherId] = useState('');
  const [spouseId, setSpouseId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [relationshipLabel, setRelationshipLabel] = useState('');
  const [biography, setBiography] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // Private PII fields
  const [privateEmail, setPrivateEmail] = useState('');
  const [privatePhone, setPrivatePhone] = useState('');
  const [privateAddress, setPrivateAddress] = useState('');

  const isAdmin =
    userProfile?.role === 'developer_super_admin' ||
    userProfile?.role === 'family_head' ||
    userProfile?.role === 'branch_admin';

  const isFamilyHeadOrDev =
    userProfile?.role === 'developer_super_admin' || userProfile?.role === 'family_head';

  const isLinkedSelf = Boolean(member?.linkedUid && userProfile?.uid === member.linkedUid);
  const canEdit = isAdmin || isLinkedSelf;
  const canViewPii = isFamilyHeadOrDev || isLinkedSelf;

  useEffect(() => {
    if (!member) return;
    setEditing(false);
    setErrorMsg(null);
    setSuccessMsg(null);

    setFullName(member.fullName);
    setGender(member.gender);
    setBirthDate(member.birthDate || '');
    setDeathDate(member.deathDate || '');
    setIsDeceased(member.isDeceased);
    setFatherId(member.fatherId || '');
    setMotherId(member.motherId || '');
    setSpouseId(member.spouseId || '');
    setBranchId(member.branchId || '');
    setRelationshipLabel(member.relationshipLabel || '');
    setBiography(member.biography || '');
    setPhotoUrl(member.photoUrl || '');

    if (canViewPii) {
      apiFetch<{ info: MemberPrivateInfo | null }>(`/api/private-info/${member.id}`)
        .then((res) => {
          if (res.info) {
            setPrivateInfo(res.info);
            setPrivateEmail(res.info.email || '');
            setPrivatePhone(res.info.phone || '');
            setPrivateAddress(res.info.address || '');
          } else {
            setPrivateInfo(null);
            setPrivateEmail('');
            setPrivatePhone('');
            setPrivateAddress('');
          }
        })
        .catch(() => {
          setPrivateInfo(null);
        });
    } else {
      setPrivateInfo(null);
    }
  }, [member, canViewPii]);

  if (!member) return null;

  const byId = new Map(allMembers.map((m) => [m.id, m]));
  const father = member.fatherId ? byId.get(member.fatherId) : undefined;
  const mother = member.motherId ? byId.get(member.motherId) : undefined;
  const spouse = member.spouseId ? byId.get(member.spouseId) : undefined;
  const children = allMembers.filter((m) => m.fatherId === member.id || m.motherId === member.id);
  const branch = branches.find((b) => b.id === member.branchId);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file, 420, 0.8);
      setPhotoUrl(compressed);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process photo.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isAdmin) {
        const integrityError = validateRelationshipIntegrity(
          {
            id: member.id,
            fatherId: fatherId || undefined,
            motherId: motherId || undefined,
            spouseId: spouseId || undefined,
          },
          allMembers
        );
        if (integrityError) {
          setErrorMsg(integrityError);
          setSaving(false);
          return;
        }

        const computedGen = computeGenerationFromParents(
          fatherId || undefined,
          motherId || undefined,
          allMembers,
          member.generation || 1
        );

        await apiFetch(`/api/members/${member.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            fullName: fullName.trim(),
            gender,
            birthDate: birthDate.trim(),
            deathDate: isDeceased ? deathDate.trim() : '',
            isDeceased,
            generation: member.isFoundingAncestor ? 1 : computedGen,
            fatherId: fatherId || '',
            motherId: motherId || '',
            spouseId: spouseId || '',
            branchId: branchId || '',
            photoUrl: photoUrl || '',
            biography: biography.trim(),
            relationshipLabel: relationshipLabel.trim(),
          }),
        });
      } else if (isLinkedSelf) {
        await apiFetch(`/api/members/${member.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            biography: biography.trim(),
            photoUrl: photoUrl || '',
          }),
        });
      }

      if (canViewPii) {
        await apiFetch(`/api/private-info/${member.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            linkedUid: member.linkedUid || '',
            email: privateEmail.trim(),
            phone: privatePhone.trim(),
            address: privateAddress.trim(),
          }),
        });
      }

      notifyDataChanged();
      setSuccessMsg('Profile updated and saved to family archive.');
      setEditing(false);
      onUpdated();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-profile-title"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-sky-300/25 bg-[#081736] p-6 sm:p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close member profile"
          className="absolute right-4 top-4 p-2 text-sky-200/70 hover:text-white rounded-lg hover:bg-sky-950/70 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-sky-300/20">
          <div className="w-24 h-24 rounded-2xl overflow-hidden border border-sky-300/35 bg-[#050F26] shrink-0 flex items-center justify-center">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={member.fullName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <UserIcon className="w-10 h-10 text-sky-300/50" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-sky-300">
              <span>Generation {member.generation}</span>
              {branch && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{branch.name}</span>
                </>
              )}
              {member.isDeceased && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-300">In Loving Memory</span>
                </>
              )}
            </div>

            <h2 id="member-profile-title" className="font-serif text-2xl font-semibold text-white mt-1">
              {member.fullName}
            </h2>
            <p className="text-sm text-slate-300 mt-0.5">
              {member.relationshipLabel || 'Verified Family Member'}
            </p>
            {(member.birthDate || member.deathDate) && (
              <p className="font-mono text-xs text-slate-400 tabular-nums mt-1.5">
                {member.birthDate ? `Born ${member.birthDate}` : ''}
                {member.isDeceased && member.deathDate ? ` · Passed ${member.deathDate}` : ''}
              </p>
            )}
          </div>

          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="self-start sm:self-center px-4 py-2 rounded-xl bg-sky-300 hover:bg-sky-200 text-sky-950 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              Edit Profile
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {!editing ? (
          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Lineage Connections
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-sky-300/20 bg-[#050F26]/70 p-3.5">
                  <p className="text-xs text-sky-200/70">Father</p>
                  {father ? (
                    <button
                      type="button"
                      onClick={() => onSelectMember(father)}
                      className="text-sm font-medium text-sky-300 hover:text-sky-200 mt-0.5 cursor-pointer text-left"
                    >
                      {father.fullName}
                    </button>
                  ) : (
                    <p className="text-sm text-sky-200/50 mt-0.5">Not recorded</p>
                  )}
                </div>

                <div className="rounded-xl border border-sky-300/20 bg-[#050F26]/70 p-3.5">
                  <p className="text-xs text-sky-200/70">Mother</p>
                  {mother ? (
                    <button
                      type="button"
                      onClick={() => onSelectMember(mother)}
                      className="text-sm font-medium text-sky-300 hover:text-sky-200 mt-0.5 cursor-pointer text-left"
                    >
                      {mother.fullName}
                    </button>
                  ) : (
                    <p className="text-sm text-sky-200/50 mt-0.5">Not recorded</p>
                  )}
                </div>

                <div className="rounded-xl border border-sky-300/20 bg-[#050F26]/70 p-3.5">
                  <p className="text-xs text-sky-200/70">Spouse</p>
                  {spouse ? (
                    <button
                      type="button"
                      onClick={() => onSelectMember(spouse)}
                      className="text-sm font-medium text-sky-300 hover:text-sky-200 mt-0.5 cursor-pointer text-left"
                    >
                      {spouse.fullName}
                    </button>
                  ) : (
                    <p className="text-sm text-sky-200/50 mt-0.5">None listed</p>
                  )}
                </div>

                <div className="rounded-xl border border-sky-300/20 bg-[#050F26]/70 p-3.5">
                  <p className="text-xs text-sky-200/70">Children ({children.length})</p>
                  {children.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {children.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onSelectMember(c)}
                          className="text-sm font-medium text-sky-300 hover:text-sky-200 cursor-pointer"
                        >
                          {c.fullName}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-sky-200/50 mt-0.5">No children recorded</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-200/70 mb-2">
                Biography &amp; Heritage Notes
              </h3>
              <p className="text-sm text-sky-50/90 leading-relaxed whitespace-pre-line">
                {member.biography || 'No biography has been written for this member yet.'}
              </p>
            </div>

            {canViewPii && (
              <div className="rounded-xl border border-sky-300/25 bg-[#050F26]/80 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-sky-300 mb-2.5">
                  <Shield className="w-4 h-4" />
                  <span>Protected Contact Details (Visible Only to Owner &amp; Family Head)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-sky-200/70 block">Email</span>
                    <span className="text-sky-50">{privateInfo?.email || '—'}</span>
                  </div>
                  <div>
                    <span className="text-sky-200/70 block">Contact Number</span>
                    <span className="text-sky-50 font-mono">{privateInfo?.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-sky-200/70 block">Address</span>
                    <span className="text-sky-50">{privateInfo?.address || '—'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="mt-6 space-y-4">
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-sky-300/25 bg-[#050F26] hover:bg-sky-950/60 text-xs font-medium text-sky-100 cursor-pointer">
                <Upload className="w-4 h-4 text-sky-300" />
                <span>Upload Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="sr-only"
                />
              </label>
              <span className="text-xs text-slate-400">
                Automatically compressed for fast archive loading.
              </span>
            </div>

            {isAdmin && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Family Branch</label>
                    <select
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                    >
                      <option value="">Unassigned</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Relationship Label
                    </label>
                    <input
                      type="text"
                      value={relationshipLabel}
                      onChange={(e) => setRelationshipLabel(e.target.value)}
                      placeholder="e.g. Eldest Son"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Father</label>
                    <select
                      value={fatherId}
                      onChange={(e) => setFatherId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                    >
                      <option value="">Unknown / None</option>
                      {allMembers
                        .filter((m) => m.id !== member.id)
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
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                    >
                      <option value="">Unknown / None</option>
                      {allMembers
                        .filter((m) => m.id !== member.id)
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
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                    >
                      <option value="">None</option>
                      {allMembers
                        .filter((m) => m.id !== member.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.fullName} (Gen {m.generation})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDeceased}
                      onChange={(e) => setIsDeceased(e.target.checked)}
                      className="rounded border-slate-600"
                    />
                    <span>Deceased Ancestor / In Memoriam</span>
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
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Biography</label>
              <textarea
                rows={3}
                value={biography}
                onChange={(e) => setBiography(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
              />
            </div>

            {canViewPii && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Private Email</label>
                  <input
                    type="email"
                    value={privateEmail}
                    onChange={(e) => setPrivateEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={privatePhone}
                    onChange={(e) => setPrivatePhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={privateAddress}
                    onChange={(e) => setPrivateAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-2 rounded-xl border border-sky-300/25 text-xs font-medium text-sky-100/80 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-sky-300 hover:bg-sky-200 text-sky-950 font-semibold text-xs cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

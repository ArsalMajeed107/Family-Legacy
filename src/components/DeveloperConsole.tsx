import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Sliders,
  Database,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, notifyDataChanged } from '../lib/apiClient.ts';
import { generateSafeId } from '../lib/genealogy.ts';
import { FOUNDING_ASSETS, initializeFoundingLineage } from '../lib/seedFamily.ts';
import type {
  AuditLog,
  FamilyMember,
  SystemSettings,
  UserAccount,
  UserRole,
} from '../types/family.ts';

interface DeveloperConsoleProps {
  members: FamilyMember[];
  auditLogs: AuditLog[];
}

export function DeveloperConsole({ members, auditLogs }: DeveloperConsoleProps) {
  const { userProfile, systemSettings, users } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [platformName, setPlatformName] = useState(systemSettings?.platformName || 'Family Legacy');
  const [registrationEnabled, setRegistrationEnabled] = useState(
    systemSettings?.registrationEnabled ?? true
  );
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState(
    systemSettings?.aiAssistantEnabled ?? true
  );
  const [maintenanceMode, setMaintenanceMode] = useState(
    systemSettings?.maintenanceMode ?? false
  );
  const [wallpaperIntensity, setWallpaperIntensity] = useState<
    SystemSettings['defaultWallpaperIntensity']
  >(systemSettings?.defaultWallpaperIntensity || 'standard');
  const [wallpaperColor, setWallpaperColor] = useState<
    NonNullable<SystemSettings['defaultWallpaperColor']>
  >(systemSettings?.defaultWallpaperColor || 'sapphire');

  useEffect(() => {
    if (systemSettings) {
      setPlatformName(systemSettings.platformName);
      setRegistrationEnabled(systemSettings.registrationEnabled);
      setAiAssistantEnabled(systemSettings.aiAssistantEnabled);
      setMaintenanceMode(systemSettings.maintenanceMode);
      setWallpaperIntensity(systemSettings.defaultWallpaperIntensity || 'standard');
      setWallpaperColor(systemSettings.defaultWallpaperColor || 'sapphire');
    }
  }, [systemSettings]);

  if (userProfile?.role !== 'developer_super_admin') {
    return (
      <main className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="rounded-2xl border border-rose-500/30 bg-[#081736]/85 p-8">
          <h1 className="font-serif text-2xl text-white">Developer Access Restricted</h1>
          <p className="text-sm text-slate-300 mt-2">
            Only the designated Developer Super Admin is authorized to access system configuration,
            source architecture controls, and technical logs.
          </p>
        </div>
      </main>
    );
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          platformName: platformName.trim() || 'Family Legacy',
          registrationEnabled,
          aiAssistantEnabled,
          maintenanceMode,
          defaultWallpaperIntensity: wallpaperIntensity || 'standard',
          defaultWallpaperColor: wallpaperColor || 'sapphire',
        }),
      });

      await apiFetch('/api/audit', {
        method: 'POST',
        body: JSON.stringify({
          id: generateSafeId('log'),
          action: 'UPDATE_SYSTEM_SETTINGS',
          targetCollection: 'systemSettings',
          targetId: 'global',
          details: `Updated global settings (Platform: ${platformName.trim()}, Wallpaper: ${wallpaperColor}/${wallpaperIntensity}, AI: ${aiAssistantEnabled}, Registration: ${registrationEnabled})`,
        }),
      });

      notifyDataChanged();
      setMsg({ type: 'ok', text: 'Global system settings updated.' });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to save settings.' });
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateUserRole = async (
    targetUid: string,
    role: UserRole,
    accountStatus: UserAccount['accountStatus'],
    memberId?: string
  ) => {
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch(`/api/users/${targetUid}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role,
          accountStatus,
          memberId: memberId || '',
        }),
      });

      await apiFetch('/api/audit', {
        method: 'POST',
        body: JSON.stringify({
          id: generateSafeId('log'),
          action: 'ASSIGN_USER_ROLE',
          targetCollection: 'users',
          targetId: targetUid,
          details: `Assigned role ${role} (${accountStatus})`,
        }),
      });

      notifyDataChanged();
      setMsg({ type: 'ok', text: 'Updated role & status for user.' });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed updating user role.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSeedFounding = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await initializeFoundingLineage();
      setMsg({
        type: 'ok',
        text: res.created
          ? 'Founding lineage (Muhammad Ghulam, Amna Gulam & Arsal Majeed) initialized.'
          : 'Lineage verified & developer tree node synchronized.',
      });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Initialization failed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <section className="rounded-2xl border border-sky-300/25 bg-[#081736]/85 backdrop-blur-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <img
            src={userProfile.photoUrl || FOUNDING_ASSETS.developer}
            alt="Developer Super Admin"
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-2xl object-cover border border-sky-300/45 shrink-0"
          />
          <div>
            <p className="text-xs text-sky-300 font-medium">
              Exclusive Developer Super Admin · Family Legacy
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-white mt-0.5">
              {userProfile.displayName || 'Arsal Majeed'}
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              {userProfile.email} · Native Express Store (Firebase Disabled)
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={handleSeedFounding}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-300 hover:bg-sky-200 text-sky-950 font-semibold text-xs cursor-pointer disabled:opacity-60 self-start sm:self-center"
        >
          <Database className="w-4 h-4" />
          <span>Sync / Initialize Founding Lineage</span>
        </button>
      </section>

      {msg && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs ${
            msg.type === 'ok'
              ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
              : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
          }`}
        >
          {msg.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSaveSettings}
          className="lg:col-span-5 rounded-2xl border border-sky-300/20 bg-[#081736]/80 backdrop-blur-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-sky-300/15">
            <Sliders className="w-4 h-4 text-sky-300" />
            <h2 className="font-serif text-lg font-semibold text-white">
              Global System Configuration
            </h2>
          </div>

          <div className="rounded-xl border border-sky-300/20 bg-[#050F26] px-3.5 py-2.5 text-xs text-sky-100/90">
            <span className="text-sky-300 font-semibold block">Database &amp; Auth Engine</span>
            <span>Native Express JSON Store &amp; HMAC Session Auth · Firebase Disabled</span>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Platform Title</label>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#050F26] border border-sky-300/25 text-sm text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Live Wallpaper Color Theme
              </label>
              <select
                value={wallpaperColor}
                onChange={(e) =>
                  setWallpaperColor(
                    e.target.value as NonNullable<SystemSettings['defaultWallpaperColor']>
                  )
                }
                className="w-full px-3.5 py-2 rounded-xl bg-[#050F26] border border-sky-300/25 text-sm text-white"
              >
                <option value="sapphire">Midnight Sapphire &amp; Gold</option>
                <option value="emerald">Royal Emerald &amp; Gold</option>
                <option value="amber">Warm Heritage Amber</option>
                <option value="rose">Pashtoon Pink / Rose</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Animation Intensity
              </label>
              <select
                value={wallpaperIntensity}
                onChange={(e) =>
                  setWallpaperIntensity(
                    e.target.value as SystemSettings['defaultWallpaperIntensity']
                  )
                }
                className="w-full px-3.5 py-2 rounded-xl bg-[#050F26] border border-sky-300/25 text-sm text-white"
              >
                <option value="subtle">Subtle (Low Motion)</option>
                <option value="standard">Standard Heritage</option>
                <option value="luminous">Luminous Canopy</option>
              </select>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <label className="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
              <span>Allow New Member Registrations</span>
              <input
                type="checkbox"
                checked={registrationEnabled}
                onChange={(e) => setRegistrationEnabled(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
              <span>FamilyGuide AI Assistant Active</span>
              <input
                type="checkbox"
                checked={aiAssistantEnabled}
                onChange={(e) => setAiAssistantEnabled(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
              <span>Maintenance Mode Banner</span>
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-xl bg-sky-300 hover:bg-sky-200 text-sky-950 font-semibold text-xs cursor-pointer"
          >
            Save System Settings
          </button>
        </form>

        <div className="lg:col-span-7 rounded-2xl border border-sky-300/20 bg-[#081736]/80 backdrop-blur-xl p-6">
          <div className="flex items-center gap-2 pb-3 border-b border-sky-300/15">
            <ShieldCheck className="w-4 h-4 text-sky-300" />
            <h2 className="font-serif text-lg font-semibold text-white">
              Account &amp; Role Governance ({users.length})
            </h2>
          </div>

          <div className="mt-4 divide-y divide-sky-300/10">
            {users.map((u) => (
              <div key={u.uid} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {u.photoUrl && (
                    <img
                      src={u.photoUrl}
                      alt={u.displayName}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-lg object-cover border border-sky-300/30 shrink-0"
                    />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white">{u.displayName}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={u.role}
                    disabled={busy || u.uid === userProfile.uid}
                    onChange={(e) =>
                      handleUpdateUserRole(
                        u.uid,
                        e.target.value as UserRole,
                        e.target.value === 'pending_member' ? 'pending' : 'active',
                        u.memberId
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[#050F26] border border-sky-300/25 text-xs text-white"
                  >
                    <option value="developer_super_admin">Developer Super Admin</option>
                    <option value="family_head">Main Family Head</option>
                    <option value="branch_admin">Branch Admin</option>
                    <option value="verified_member">Verified Member</option>
                    <option value="pending_member">Pending Member</option>
                  </select>

                  <select
                    value={u.accountStatus}
                    disabled={busy || u.uid === userProfile.uid}
                    onChange={(e) =>
                      handleUpdateUserRole(
                        u.uid,
                        u.role,
                        e.target.value as UserAccount['accountStatus'],
                        u.memberId
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[#050F26] border border-sky-300/25 text-xs text-white"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>

                  <select
                    value={u.memberId || ''}
                    disabled={busy}
                    onChange={(e) =>
                      handleUpdateUserRole(u.uid, u.role, u.accountStatus, e.target.value)
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[#050F26] border border-sky-300/25 text-xs text-white max-w-[150px]"
                  >
                    <option value="">Link Tree Profile...</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-300/20 bg-[#081736]/80 backdrop-blur-xl p-6">
        <h2 className="font-serif text-lg font-semibold text-white pb-3 border-b border-sky-300/15">
          Technical Security &amp; System Audit Logs
        </h2>
        <div className="mt-4 overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-sky-300/15 text-slate-400">
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 px-4 font-medium">Role</th>
                <th className="py-2 px-4 font-medium">Actor</th>
                <th className="py-2 px-4 font-medium">Target</th>
                <th className="py-2 pl-4 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-300/10">
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2 pr-4 font-mono text-sky-300">{log.action}</td>
                  <td className="py-2 px-4 text-slate-400">{log.actorRole || 'system'}</td>
                  <td className="py-2 px-4 text-slate-300">{log.actorEmail || log.actorUid}</td>
                  <td className="py-2 px-4 font-mono text-slate-400">{log.targetCollection || '—'}</td>
                  <td className="py-2 pl-4 text-slate-300">{log.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

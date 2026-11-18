import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  DATA_CHANGED_EVENT,
  apiFetch,
  getStoredToken,
  setStoredToken,
} from '../lib/apiClient.ts';
import type {
  AiMessage,
  AuditLog,
  FamilyAnnouncement,
  FamilyBranch,
  FamilyMember,
  FamilyStory,
  GalleryItem,
  PublicOverview,
  RegistrationRequest,
  SystemSettings,
  UserAccount,
} from '../types/family.ts';

interface ApiDataPayload {
  publicOverview: PublicOverview | null;
  systemSettings: SystemSettings | null;
  announcements: FamilyAnnouncement[];
  gallery: GalleryItem[];
  stories: FamilyStory[];
  members: FamilyMember[];
  branches: FamilyBranch[];
  myRequests: RegistrationRequest[];
  allRequests: RegistrationRequest[];
  auditLogs: AuditLog[];
  users: UserAccount[];
  aiMessages: AiMessage[];
}

interface AuthContextValue {
  userProfile: UserAccount | null;
  isSignedIn: boolean;
  loading: boolean;
  publicOverview: PublicOverview | null;
  systemSettings: SystemSettings | null;
  announcements: FamilyAnnouncement[];
  gallery: GalleryItem[];
  stories: FamilyStory[];
  members: FamilyMember[];
  branches: FamilyBranch[];
  myRequests: RegistrationRequest[];
  allRequests: RegistrationRequest[];
  auditLogs: AuditLog[];
  users: UserAccount[];
  aiMessages: AiMessage[];
  signInWithEmail: (email: string, password: string) => Promise<void>;
  quickSignInDeveloper: () => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  resetPassword: (email: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshData: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const DEFAULT_OVERVIEW: PublicOverview = {
  totalMembers: 3,
  totalGenerations: 3,
  totalBranches: 1,
  grandfatherName: 'Muhammad Ghulam',
  grandmotherName: 'Amna Gulam',
  familyMotto:
    'Rooted in Pashtoon honor, united across generations, and remembered with gratitude.',
  updatedAt: null,
};

const DEFAULT_SETTINGS: SystemSettings = {
  platformName: 'Family Legacy',
  registrationEnabled: true,
  aiAssistantEnabled: true,
  maintenanceMode: false,
  defaultWallpaperIntensity: 'standard',
  defaultWallpaperColor: 'sapphire',
  updatedAt: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [publicOverview, setPublicOverview] = useState<PublicOverview | null>(DEFAULT_OVERVIEW);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(DEFAULT_SETTINGS);
  const [announcements, setAnnouncements] = useState<FamilyAnnouncement[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [stories, setStories] = useState<FamilyStory[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [branches, setBranches] = useState<FamilyBranch[]>([]);
  const [myRequests, setMyRequests] = useState<RegistrationRequest[]>([]);
  const [allRequests, setAllRequests] = useState<RegistrationRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);

  const loadAllState = useCallback(async () => {
    try {
      const token = getStoredToken();
      if (token) {
        try {
          const me = await apiFetch<{ user: UserAccount | null }>('/api/auth/me');
          setUserProfile(me.user);
          if (!me.user) {
            setStoredToken(null);
          }
        } catch {
          setUserProfile(null);
          setStoredToken(null);
        }
      } else {
        setUserProfile(null);
      }

      const data = await apiFetch<ApiDataPayload>('/api/data');
      setPublicOverview(data.publicOverview || DEFAULT_OVERVIEW);
      setSystemSettings(data.systemSettings || DEFAULT_SETTINGS);
      setAnnouncements(data.announcements || []);
      setGallery(data.gallery || []);
      setStories(data.stories || []);
      setMembers(data.members || []);
      setBranches(data.branches || []);
      setMyRequests(data.myRequests || []);
      setAllRequests(data.allRequests || []);
      setAuditLogs(data.auditLogs || []);
      setUsers(data.users || []);
      setAiMessages(data.aiMessages || []);
    } catch (err) {
      console.warn('Error loading Family Legacy data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllState();

    const handleDataChanged = () => {
      loadAllState();
    };
    window.addEventListener(DATA_CHANGED_EVENT, handleDataChanged);
    return () => {
      window.removeEventListener(DATA_CHANGED_EVENT, handleDataChanged);
    };
  }, [loadAllState]);

  const signInWithEmail = async (email: string, password: string) => {
    const res = await apiFetch<{ token: string; user: UserAccount }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    setUserProfile(res.user);
    await loadAllState();
  };

  const quickSignInDeveloper = async () => {
    const res = await apiFetch<{ token: string; user: UserAccount }>('/api/auth/quick-dev', {
      method: 'POST',
    });
    setStoredToken(res.token);
    setUserProfile(res.user);
    await loadAllState();
  };

  const registerWithEmail = async (email: string, password: string, displayName: string) => {
    const res = await apiFetch<{ token: string; user: UserAccount }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    setStoredToken(res.token);
    setUserProfile(res.user);
    await loadAllState();
  };

  const resetPassword = async (email: string, newPassword: string) => {
    await apiFetch<{ ok: boolean }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, newPassword }),
    });
  };

  const logout = async () => {
    setStoredToken(null);
    setUserProfile(null);
    await loadAllState();
  };

  const getIdToken = async () => getStoredToken();

  return (
    <AuthContext.Provider
      value={{
        userProfile,
        isSignedIn: Boolean(userProfile),
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
        users,
        aiMessages,
        signInWithEmail,
        quickSignInDeveloper,
        registerWithEmail,
        resetPassword,
        logout,
        refreshData: loadAllState,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

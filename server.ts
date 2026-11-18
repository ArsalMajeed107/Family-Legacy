import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'fessional-db.json');
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(process.env.GEMINI_API_KEY || 'family-legacy-local-heritage-key').digest('hex');

const BOOTSTRAP_DEV_EMAIL = 'arsalmajeed287@gmail.com';

interface StoredUser {
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  role: 'developer_super_admin' | 'family_head' | 'branch_admin' | 'verified_member' | 'pending_member';
  accountStatus: 'active' | 'pending' | 'suspended';
  emailVerified: boolean;
  phoneVerified: boolean;
  memberId?: string;
  branchId?: string;
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredDb {
  users: Record<string, StoredUser>;
  members: Record<string, Record<string, unknown>>;
  branches: Record<string, Record<string, unknown>>;
  announcements: Record<string, Record<string, unknown>>;
  gallery: Record<string, Record<string, unknown>>;
  stories: Record<string, Record<string, unknown>>;
  registrationRequests: Record<string, Record<string, unknown>>;
  auditLogs: Record<string, Record<string, unknown>>;
  memberPrivateInfo: Record<string, Record<string, unknown>>;
  aiConversations: Record<string, Record<string, unknown>[]>;
  systemSettings: {
    platformName: string;
    registrationEnabled: boolean;
    aiAssistantEnabled: boolean;
    maintenanceMode: boolean;
    defaultWallpaperIntensity: 'subtle' | 'standard' | 'luminous';
    defaultWallpaperColor?: 'emerald' | 'sapphire' | 'amber' | 'rose';
    updatedBy?: string;
    updatedAt: string;
  };
  publicSummary: {
    totalMembers: number;
    totalGenerations: number;
    totalBranches: number;
    grandfatherName: string;
    grandmotherName: string;
    familyMotto: string;
    updatedAt: string;
  };
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const keyBuf = Buffer.from(key, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function signSessionToken(uid: string): string {
  const payload = Buffer.from(JSON.stringify({ uid, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { uid: string; exp: number };
    if (!parsed.uid || parsed.exp < Date.now()) return null;
    return parsed.uid;
  } catch {
    return null;
  }
}

function createInitialDb(): StoredDb {
  const now = new Date().toISOString();
  const devUid = 'uid_arsal_majeed';
  const branchId = 'branch_ghulam_central';

  return {
    users: {
      [devUid]: {
        uid: devUid,
        email: BOOTSTRAP_DEV_EMAIL,
        displayName: 'Arsal Majeed',
        photoUrl: '/assets/aistudio/arsal_pic_a1e52d81.jpeg',
        role: 'developer_super_admin',
        accountStatus: 'active',
        emailVerified: true,
        phoneVerified: true,
        memberId: 'member_arsal_majeed',
        branchId,
        createdAt: now,
        updatedAt: now,
      },
    },
    branches: {
      [branchId]: {
        id: branchId,
        name: 'Founding Lineage — Ghulam Heritage',
        description:
          'The primary ancestral trunk established by Grandfather Muhammad Ghulam and Grandmother Amna Gulam.',
        heritageLocation: 'Pashtoon Ancestral Homestead',
        founderMemberId: 'member_muhammad_ghula',
        accentTone: 'pink',
        createdBy: devUid,
        createdAt: now,
        updatedAt: now,
      },
    },
    members: {
      member_muhammad_ghula: {
        id: 'member_muhammad_ghula',
        fullName: 'Muhammad Ghulam',
        gender: 'male',
        birthDate: '1942-03-14',
        isDeceased: false,
        generation: 1,
        spouseId: 'member_amna_gulam',
        branchId,
        photoUrl: '/src/assets/images/portrait_grandfather_1795008100818.jpg',
        biography:
          'Founding Patriarch and Main Family Head. Honored for Pashtoon hospitality, integrity, and keeping every branch of the family united.',
        relationshipLabel: 'Founding Grandfather · Main Family Head',
        isFoundingAncestor: true,
        status: 'verified',
        createdBy: devUid,
        createdAt: now,
        updatedAt: now,
      },
      member_amna_gulam: {
        id: 'member_amna_gulam',
        fullName: 'Amna Gulam',
        gender: 'female',
        birthDate: '1947-08-22',
        isDeceased: false,
        generation: 1,
        spouseId: 'member_muhammad_ghula',
        branchId,
        photoUrl: '/src/assets/images/portrait_grandmother_1795008101922.jpg',
        biography:
          'Founding Matriarch whose warmth, oral storytelling, and enduring care nurtured every generation of the Ghulam household.',
        relationshipLabel: 'Founding Grandmother · Matriarch',
        isFoundingAncestor: true,
        status: 'verified',
        createdBy: devUid,
        createdAt: now,
        updatedAt: now,
      },
      member_arsal_majeed: {
        id: 'member_arsal_majeed',
        fullName: 'Arsal Majeed',
        gender: 'male',
        isDeceased: false,
        generation: 3,
        branchId,
        photoUrl: '/assets/aistudio/arsal_pic_a1e52d81.jpeg',
        biography:
          'Grandson of Muhammad Ghulam & Amna Gulam, and Lead Architect & Developer Super Admin of Family Legacy.',
        relationshipLabel: 'Grandson · Platform Developer',
        linkedUid: devUid,
        isFoundingAncestor: false,
        status: 'verified',
        createdBy: devUid,
        createdAt: now,
        updatedAt: now,
      },
    },
    announcements: {
      ann_founding_welcome: {
        id: 'ann_founding_welcome',
        title: 'Family Legacy Heritage Archive Opened for All Generations',
        content:
          'Welcome to Family Legacy. The founding records of Grandfather Muhammad Ghulam and Grandmother Amna Gulam are now preserved. Family members may sign in to submit their registration requests.',
        category: 'milestone',
        eventDate: now.slice(0, 10),
        isPublic: true,
        authorUid: devUid,
        authorName: 'Family Administration',
        createdAt: now,
      },
    },
    gallery: {
      gal_ancestral_courtyard: {
        id: 'gal_ancestral_courtyard',
        title: 'The Ancestral Courtyard',
        caption:
          'Where generations gathered during seasonal reunions, shared meals, and passed down Pashtoon traditions.',
        imageUrl: '/src/assets/images/gallery_ancestral_home_1795008101426.jpg',
        category: 'historical',
        year: '1978',
        isPublic: true,
        uploadedBy: devUid,
        createdAt: now,
      },
      gal_chronicle_ledger: {
        id: 'gal_chronicle_ledger',
        title: 'The Family Chronicle & Keepsakes',
        caption:
          'Handwritten notebooks, letters, and archival portraits preserved from the early decades of Muhammad Ghulam and Amna Gulam.',
        imageUrl: '/src/assets/images/gallery_heirloom_chronicle_1795008101618.jpg',
        category: 'document',
        year: '1984',
        isPublic: true,
        uploadedBy: devUid,
        createdAt: now,
      },
    },
    stories: {
      story_founding_roots: {
        id: 'story_founding_roots',
        title: 'From Pashtoon Roots to a Living Multigenerational Legacy',
        era: '1965 – Present',
        authorName: 'Ghulam Heritage Archive',
        authorUid: devUid,
        excerpt:
          'How Grandfather Muhammad Ghulam and Grandmother Amna Gulam built a home anchored in Pashtoon honor, education, and kinship.',
        content:
          'Every enduring family begins with two individuals whose quiet perseverance shapes generations yet unborn. Grandfather Muhammad Ghulam and Grandmother Amna Gulam established a household where elders were honored, children were encouraged to learn, and relatives from every branch always found an open hujra and warm hospitality.\n\nThis digital chronicle preserves those memories so grandchildren and great-grandchildren across the world can trace their roots, celebrate milestones, and carry forward a shared heritage.',
        isPublic: true,
        createdAt: now,
      },
    },
    registrationRequests: {},
    auditLogs: {
      log_init_founding: {
        id: 'log_init_founding',
        actorUid: devUid,
        actorEmail: BOOTSTRAP_DEV_EMAIL,
        actorRole: 'developer_super_admin',
        action: 'INITIALIZE_FOUNDING_LINEAGE',
        targetCollection: 'members',
        targetId: 'member_muhammad_ghula',
        details: 'Initialized founding grandparents Muhammad Ghulam & Amna Gulam and developer node Arsal Majeed.',
        createdAt: now,
      },
    },
    memberPrivateInfo: {},
    aiConversations: {},
    systemSettings: {
      platformName: 'Family Legacy',
      registrationEnabled: true,
      aiAssistantEnabled: true,
      maintenanceMode: false,
      defaultWallpaperIntensity: 'standard',
      defaultWallpaperColor: 'sapphire',
      updatedBy: devUid,
      updatedAt: now,
    },
    publicSummary: {
      totalMembers: 3,
      totalGenerations: 3,
      totalBranches: 1,
      grandfatherName: 'Muhammad Ghulam',
      grandmotherName: 'Amna Gulam',
      familyMotto:
        'Rooted in Pashtoon honor, united across generations, and remembered with gratitude.',
      updatedAt: now,
    },
  };
}

function loadDb(): StoredDb {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw) as StoredDb;
      if (parsed.systemSettings) {
        if (!parsed.systemSettings.defaultWallpaperColor) {
          parsed.systemSettings.defaultWallpaperColor = 'sapphire';
        }
        if (parsed.systemSettings.platformName === 'Fessional') {
          parsed.systemSettings.platformName = 'Family Legacy';
        }
      }
      return parsed;
    }
  } catch (err) {
    console.warn('Could not read local DB file, initializing fresh store:', err);
  }
  const initial = createInitialDb();
  saveDb(initial);
  return initial;
}

function saveDb(data: StoredDb): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist DB file to disk (running in-memory):', err);
  }
}

let dbState: StoredDb = loadDb();

function recomputeOverview() {
  const activeMembers = Object.values(dbState.members).filter((m) => m.status !== 'archived');
  const maxGen = activeMembers.reduce((acc, m) => Math.max(acc, Number(m.generation) || 1), activeMembers.length > 0 ? 1 : 0);
  const gf = dbState.members['member_muhammad_ghula'] || activeMembers.find((m) => m.isFoundingAncestor && m.gender === 'male');
  const gm = dbState.members['member_amna_gulam'] || activeMembers.find((m) => m.isFoundingAncestor && m.gender === 'female');
  dbState.publicSummary = {
    totalMembers: activeMembers.length,
    totalGenerations: maxGen,
    totalBranches: Object.keys(dbState.branches).length,
    grandfatherName: (gf?.fullName as string) || 'Muhammad Ghulam',
    grandmotherName: (gm?.fullName as string) || 'Amna Gulam',
    familyMotto: dbState.publicSummary?.familyMotto || 'Rooted in Pashtoon honor, united across generations, and remembered with gratitude.',
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeUser(u: StoredUser) {
  const { passwordHash: _omit, ...safe } = u;
  return safe;
}

function getCallerUser(req: express.Request): StoredUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  const uid = verifySessionToken(token);
  if (!uid) return null;
  return dbState.users[uid] || null;
}

function isAdminUser(user: StoredUser | null): boolean {
  if (!user || user.accountStatus !== 'active') return false;
  return (
    user.role === 'developer_super_admin' ||
    user.role === 'family_head' ||
    user.role === 'branch_admin'
  );
}

const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'Family Legacy', firebaseEnabled: false, timestamp: new Date().toISOString() });
});

// ==================== AUTH ROUTES (Firebase Disabled — Native Auth) ====================

app.post('/api/auth/quick-dev', (_req, res) => {
  const devUser = Object.values(dbState.users).find(
    (u) => u.email.toLowerCase() === BOOTSTRAP_DEV_EMAIL.toLowerCase()
  );
  if (!devUser) {
    return res.status(404).json({ error: 'Developer account not initialized.' });
  }
  const token = signSessionToken(devUser.uid);
  return res.json({ token, user: sanitizeUser(devUser) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = (req.body || {}) as { email?: string; password?: string };
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    return res.status(400).json({ error: 'Please enter both email and password.' });
  }
  const user = Object.values(dbState.users).find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    return res.status(401).json({ error: 'No account found with this email address. Please register first.' });
  }
  if (!user.passwordHash) {
    // Allow developer or passwordless legacy account to set password on first login
    user.passwordHash = hashPassword(password);
    user.updatedAt = new Date().toISOString();
    saveDb(dbState);
  } else if (!verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  if (user.accountStatus === 'suspended') {
    return res.status(403).json({ error: 'This account is currently suspended.' });
  }
  const token = signSessionToken(user.uid);
  return res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, displayName } = (req.body || {}) as {
    email?: string;
    password?: string;
    displayName?: string;
  };
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password || password.length < 6) {
    return res.status(400).json({ error: 'Valid email and password (minimum 6 characters) are required.' });
  }
  if (!displayName?.trim()) {
    return res.status(400).json({ error: 'Please enter your full name.' });
  }
  const existing = Object.values(dbState.users).find((u) => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
  }

  const isDev = cleanEmail === BOOTSTRAP_DEV_EMAIL.toLowerCase();
  const now = new Date().toISOString();
  const uid = `uid_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const newUser: StoredUser = {
    uid,
    email: cleanEmail,
    displayName: displayName.trim(),
    photoUrl: isDev ? '/assets/aistudio/arsal_pic_a1e52d81.jpeg' : undefined,
    role: isDev ? 'developer_super_admin' : 'pending_member',
    accountStatus: isDev ? 'active' : 'pending',
    emailVerified: true,
    phoneVerified: false,
    memberId: isDev ? 'member_arsal_majeed' : undefined,
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };
  dbState.users[uid] = newUser;
  saveDb(dbState);
  const token = signSessionToken(uid);
  return res.json({ token, user: sanitizeUser(newUser) });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, newPassword } = (req.body || {}) as { email?: string; newPassword?: string };
  const cleanEmail = (email || '').trim().toLowerCase();
  const user = Object.values(dbState.users).find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    return res.status(404).json({ error: 'No account found with that email address.' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Please enter a new password of at least 6 characters.' });
  }
  user.passwordHash = hashPassword(newPassword);
  user.updatedAt = new Date().toISOString();
  saveDb(dbState);
  return res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const caller = getCallerUser(req);
  if (!caller) {
    return res.json({ user: null });
  }
  return res.json({ user: sanitizeUser(caller) });
});

// ==================== DATA & GENEALOGY ROUTES ====================

app.get('/api/data', (req, res) => {
  const caller = getCallerUser(req);
  const verifiedMember = Boolean(caller && caller.accountStatus === 'active' && caller.role !== 'pending_member');
  const admin = isAdminUser(caller);
  const dev = caller?.role === 'developer_super_admin';

  const sortByCreatedDesc = (items: Record<string, unknown>[]) =>
    [...items].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  const announcements = sortByCreatedDesc(Object.values(dbState.announcements)).filter(
    (a) => verifiedMember || a.isPublic === true
  );
  const gallery = sortByCreatedDesc(Object.values(dbState.gallery)).filter(
    (g) => verifiedMember || g.isPublic === true
  );
  const stories = sortByCreatedDesc(Object.values(dbState.stories)).filter(
    (s) => verifiedMember || s.isPublic === true
  );

  // Members & branches are visible to verified members (plus safe founding preview in FamilyTreeExplorer when guest)
  const members = verifiedMember
    ? Object.values(dbState.members).sort((a, b) => (Number(a.generation) || 1) - (Number(b.generation) || 1))
    : [];
  const branches = verifiedMember ? Object.values(dbState.branches) : [];

  const myRequests = caller
    ? sortByCreatedDesc(Object.values(dbState.registrationRequests)).filter((r) => r.requesterUid === caller.uid)
    : [];
  const allRequests = admin ? sortByCreatedDesc(Object.values(dbState.registrationRequests)) : [];
  const auditLogs = admin ? sortByCreatedDesc(Object.values(dbState.auditLogs)) : [];
  const users = dev ? Object.values(dbState.users).map(sanitizeUser) : [];
  const aiMessages = caller ? dbState.aiConversations[caller.uid] || [] : [];

  res.json({
    publicOverview: dbState.publicSummary,
    systemSettings: dbState.systemSettings,
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
  });
});

app.post('/api/members', (req, res) => {
  const caller = getCallerUser(req);
  if (!isAdminUser(caller)) return res.status(403).json({ error: 'Admin permission required.' });
  const member = req.body as Record<string, unknown>;
  const id = String(member.id || `member_${crypto.randomUUID().slice(0, 12)}`);
  const now = new Date().toISOString();
  dbState.members[id] = {
    ...member,
    id,
    createdBy: caller!.uid,
    createdAt: now,
    updatedAt: now,
  };
  if (member.spouseId && dbState.members[String(member.spouseId)]) {
    dbState.members[String(member.spouseId)].spouseId = id;
    dbState.members[String(member.spouseId)].updatedAt = now;
  }
  recomputeOverview();
  saveDb(dbState);
  res.json({ ok: true, id });
});

app.patch('/api/members/:id', (req, res) => {
  const caller = getCallerUser(req);
  if (!caller) return res.status(401).json({ error: 'Authentication required.' });
  const id = req.params.id;
  const existing = dbState.members[id];
  if (!existing) return res.status(404).json({ error: 'Member not found.' });

  const admin = isAdminUser(caller);
  const isSelf = existing.linkedUid === caller.uid;
  if (!admin && !isSelf) return res.status(403).json({ error: 'Permission denied.' });

  const updates = req.body as Record<string, unknown>;
  const now = new Date().toISOString();
  if (admin) {
    const prevSpouse = existing.spouseId;
    dbState.members[id] = { ...existing, ...updates, id, updatedAt: now };
    if (updates.spouseId && updates.spouseId !== prevSpouse && dbState.members[String(updates.spouseId)]) {
      dbState.members[String(updates.spouseId)].spouseId = id;
      dbState.members[String(updates.spouseId)].updatedAt = now;
    }
  } else {
    dbState.members[id] = {
      ...existing,
      biography: typeof updates.biography === 'string' ? updates.biography : existing.biography,
      photoUrl: typeof updates.photoUrl === 'string' ? updates.photoUrl : existing.photoUrl,
      updatedAt: now,
    };
  }
  recomputeOverview();
  saveDb(dbState);
  res.json({ ok: true });
});

app.get('/api/private-info/:memberId', (req, res) => {
  const caller = getCallerUser(req);
  if (!caller) return res.status(401).json({ error: 'Authentication required.' });
  const member = dbState.members[req.params.memberId];
  const canView =
    caller.role === 'developer_super_admin' ||
    caller.role === 'family_head' ||
    (member && member.linkedUid === caller.uid);
  if (!canView) return res.status(403).json({ error: 'Protected contact details restricted.' });
  res.json({ info: dbState.memberPrivateInfo[req.params.memberId] || null });
});

app.put('/api/private-info/:memberId', (req, res) => {
  const caller = getCallerUser(req);
  if (!caller) return res.status(401).json({ error: 'Authentication required.' });
  const member = dbState.members[req.params.memberId];
  const canEdit =
    caller.role === 'developer_super_admin' ||
    caller.role === 'family_head' ||
    (member && member.linkedUid === caller.uid);
  if (!canEdit) return res.status(403).json({ error: 'Permission denied.' });
  dbState.memberPrivateInfo[req.params.memberId] = {
    ...(req.body as Record<string, unknown>),
    memberId: req.params.memberId,
    updatedAt: new Date().toISOString(),
  };
  saveDb(dbState);
  res.json({ ok: true });
});

app.post('/api/branches', (req, res) => {
  const caller = getCallerUser(req);
  if (!caller || (caller.role !== 'developer_super_admin' && caller.role !== 'family_head')) {
    return res.status(403).json({ error: 'Family Head permission required.' });
  }
  const branch = req.body as Record<string, unknown>;
  const id = String(branch.id || `branch_${crypto.randomUUID().slice(0, 10)}`);
  const now = new Date().toISOString();
  dbState.branches[id] = { ...branch, id, createdBy: caller.uid, createdAt: now, updatedAt: now };
  recomputeOverview();
  saveDb(dbState);
  res.json({ ok: true, id });
});

app.delete('/api/branches/:id', (req, res) => {
  const caller = getCallerUser(req);
  if (!caller || (caller.role !== 'developer_super_admin' && caller.role !== 'family_head')) {
    return res.status(403).json({ error: 'Family Head permission required.' });
  }
  delete dbState.branches[req.params.id];
  recomputeOverview();
  saveDb(dbState);
  res.json({ ok: true });
});

app.post('/api/announcements', (req, res) => {
  const caller = getCallerUser(req);
  if (!isAdminUser(caller)) return res.status(403).json({ error: 'Admin permission required.' });
  const item = req.body as Record<string, unknown>;
  const id = String(item.id || `ann_${crypto.randomUUID().slice(0, 10)}`);
  dbState.announcements[id] = {
    ...item,
    id,
    authorUid: caller!.uid,
    authorName: caller!.displayName,
    createdAt: new Date().toISOString(),
  };
  saveDb(dbState);
  res.json({ ok: true, id });
});

app.delete('/api/announcements/:id', (req, res) => {
  const caller = getCallerUser(req);
  if (!isAdminUser(caller)) return res.status(403).json({ error: 'Admin permission required.' });
  delete dbState.announcements[req.params.id];
  saveDb(dbState);
  res.json({ ok: true });
});

app.post('/api/gallery', (req, res) => {
  const caller = getCallerUser(req);
  if (!isAdminUser(caller)) return res.status(403).json({ error: 'Admin permission required.' });
  const item = req.body as Record<string, unknown>;
  const id = String(item.id || `gal_${crypto.randomUUID().slice(0, 10)}`);
  dbState.gallery[id] = {
    ...item,
    id,
    uploadedBy: caller!.uid,
    createdAt: new Date().toISOString(),
  };
  saveDb(dbState);
  res.json({ ok: true, id });
});

app.delete('/api/gallery/:id', (req, res) => {
  const caller = getCallerUser(req);
  if (!isAdminUser(caller)) return res.status(403).json({ error: 'Admin permission required.' });
  delete dbState.gallery[req.params.id];
  saveDb(dbState);
  res.json({ ok: true });
});

app.post('/api/stories', (req, res) => {
  const caller = getCallerUser(req);
  if (!caller || caller.accountStatus !== 'active' || caller.role === 'pending_member') {
    return res.status(403).json({ error: 'Verified member access required.' });
  }
  const item = req.body as Record<string, unknown>;
  const id = String(item.id || `story_${crypto.randomUUID().slice(0, 10)}`);
  dbState.stories[id] = {
    ...item,
    id,
    authorName: caller.displayName,
    authorUid: caller.uid,
    createdAt: new Date().toISOString(),
  };
  saveDb(dbState);
  res.json({ ok: true, id });
});

app.post('/api/requests', (req, res) => {
  const caller = getCallerUser(req);
  if (!caller) return res.status(401).json({ error: 'Authentication required.' });
  const body = req.body as Record<string, unknown>;
  const id = String(body.id || `req_${crypto.randomUUID().slice(0, 10)}`);
  const now = new Date().toISOString();
  dbState.registrationRequests[id] = {
    ...body,
    id,
    requesterUid: caller.uid,
    requesterEmail: caller.email,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  saveDb(dbState);
  res.json({ ok: true, id });
});

app.patch('/api/requests/:id', (req, res) => {
  const caller = getCallerUser(req);
  if (!isAdminUser(caller)) return res.status(403).json({ error: 'Admin permission required.' });
  const existing = dbState.registrationRequests[req.params.id];
  if (!existing) return res.status(404).json({ error: 'Request not found.' });

  const { decision, reviewNotes } = req.body as { decision: 'approved' | 'rejected'; reviewNotes?: string };
  const now = new Date().toISOString();
  dbState.registrationRequests[req.params.id] = {
    ...existing,
    status: decision,
    reviewNotes: reviewNotes || (decision === 'approved' ? 'Verified by Family Administration' : 'Needs clarification'),
    reviewedBy: caller!.uid,
    updatedAt: now,
  };

  if (decision === 'approved' && existing.requestType === 'new_member') {
    const memberId = `member_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    dbState.members[memberId] = {
      id: memberId,
      fullName: existing.fullName,
      gender: existing.gender,
      birthDate: existing.birthDate || '',
      isDeceased: false,
      generation: 2,
      branchId: existing.branchId || '',
      biography: existing.biography || '',
      relationshipLabel: existing.suggestedFatherName
        ? `Child of ${existing.suggestedFatherName}`
        : 'Verified Member',
      linkedUid: existing.requesterUid,
      isFoundingAncestor: false,
      status: 'verified',
      createdBy: caller!.uid,
      createdAt: now,
      updatedAt: now,
    };

    const targetUser = dbState.users[String(existing.requesterUid)];
    if (targetUser) {
      targetUser.role = 'verified_member';
      targetUser.accountStatus = 'active';
      targetUser.memberId = memberId;
      targetUser.branchId = String(existing.branchId || '');
      targetUser.updatedAt = now;
    }

    if (existing.contactPhone || existing.requesterEmail) {
      dbState.memberPrivateInfo[memberId] = {
        memberId,
        linkedUid: existing.requesterUid,
        email: existing.requesterEmail || '',
        phone: existing.contactPhone || '',
        updatedAt: now,
      };
    }
    recomputeOverview();
  }

  saveDb(dbState);
  res.json({ ok: true });
});

app.post('/api/audit', (req, res) => {
  const caller = getCallerUser(req);
  if (!isAdminUser(caller)) return res.status(403).json({ error: 'Admin permission required.' });
  const body = req.body as Record<string, unknown>;
  const id = String(body.id || `log_${crypto.randomUUID().slice(0, 10)}`);
  dbState.auditLogs[id] = {
    ...body,
    id,
    actorUid: caller!.uid,
    actorEmail: caller!.email,
    actorRole: caller!.role,
    createdAt: new Date().toISOString(),
  };
  saveDb(dbState);
  res.json({ ok: true });
});

app.put('/api/settings', (req, res) => {
  const caller = getCallerUser(req);
  if (caller?.role !== 'developer_super_admin') {
    return res.status(403).json({ error: 'Developer Super Admin required.' });
  }
  dbState.systemSettings = {
    ...dbState.systemSettings,
    ...(req.body as Partial<StoredDb['systemSettings']>),
    updatedBy: caller.uid,
    updatedAt: new Date().toISOString(),
  };
  saveDb(dbState);
  res.json({ ok: true, systemSettings: dbState.systemSettings });
});

app.patch('/api/users/:uid', (req, res) => {
  const caller = getCallerUser(req);
  if (caller?.role !== 'developer_super_admin') {
    return res.status(403).json({ error: 'Developer Super Admin required.' });
  }
  const target = dbState.users[req.params.uid];
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const { role, accountStatus, memberId } = req.body as Partial<StoredUser>;
  if (role) target.role = role;
  if (accountStatus) target.accountStatus = accountStatus;
  if (typeof memberId === 'string') {
    target.memberId = memberId;
    if (memberId && dbState.members[memberId]) {
      dbState.members[memberId].linkedUid = target.uid;
      dbState.members[memberId].updatedAt = new Date().toISOString();
    }
  }
  target.updatedAt = new Date().toISOString();
  saveDb(dbState);
  res.json({ ok: true });
});

app.post('/api/seed/sync', (req, res) => {
  const caller = getCallerUser(req);
  if (caller?.role !== 'developer_super_admin') {
    return res.status(403).json({ error: 'Developer Super Admin required.' });
  }
  const fresh = createInitialDb();
  let created = false;
  if (Object.keys(dbState.members).length === 0) {
    dbState.members = fresh.members;
    dbState.branches = fresh.branches;
    created = true;
  } else {
    if (dbState.members['member_muhammad_ghula']) {
      dbState.members['member_muhammad_ghula'].fullName = 'Muhammad Ghulam';
    }
    if (!dbState.members['member_arsal_majeed']) {
      dbState.members['member_arsal_majeed'] = fresh.members['member_arsal_majeed'];
    } else {
      dbState.members['member_arsal_majeed'].photoUrl = '/assets/aistudio/arsal_pic_a1e52d81.jpeg';
    }
  }
  recomputeOverview();
  saveDb(dbState);
  res.json({ ok: true, created });
});

app.post('/api/ai/history', (req, res) => {
  const caller = getCallerUser(req);
  if (!caller) return res.status(401).json({ error: 'Auth required.' });
  const msg = req.body as Record<string, unknown>;
  if (!dbState.aiConversations[caller.uid]) {
    dbState.aiConversations[caller.uid] = [];
  }
  dbState.aiConversations[caller.uid].push({
    ...msg,
    createdAt: new Date().toISOString(),
  });
  saveDb(dbState);
  res.json({ ok: true });
});

app.delete('/api/ai/history', (req, res) => {
  const caller = getCallerUser(req);
  if (!caller) return res.status(401).json({ error: 'Auth required.' });
  dbState.aiConversations[caller.uid] = [];
  saveDb(dbState);
  res.json({ ok: true });
});

// ==================== AI ASSISTANT ENDPOINT ====================

interface ChatHistoryTurn {
  sender: 'user' | 'assistant';
  text: string;
}

interface AiChatBody {
  message?: string;
  language?: 'auto' | 'en' | 'ur' | 'roman-ur';
  history?: ChatHistoryTurn[];
  userContext?: {
    role?: string;
    accountStatus?: string;
    displayName?: string;
    branchName?: string;
  };
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      timeout: 25000,
    },
  });
}

app.post('/api/ai/chat', async (req, res) => {
  try {
    const caller = getCallerUser(req);
    const body = (req.body || {}) as AiChatBody;
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (
      dbState.systemSettings?.aiAssistantEnabled === false &&
      caller?.role !== 'developer_super_admin'
    ) {
      return res.status(403).json({
        error: 'FamilyGuide AI is currently paused by the platform administrator.',
      });
    }

    if (!message) {
      return res.status(400).json({ error: 'Please enter a message for FamilyGuide AI.' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message is too long. Please keep questions under 2,000 characters.' });
    }

    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'FamilyGuide AI is currently unavailable because GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
    }

    const langPreference = body.language || 'auto';
    const userRole = caller ? caller.role : 'guest';
    const accountStatus = caller ? caller.accountStatus : 'guest';
    const branchName = body.userContext?.branchName || 'Unassigned';

    // Non-PII family structure context for accurate guidance
    const isVerified =
      Boolean(caller) && caller?.accountStatus === 'active' && caller?.role !== 'pending_member';
    const branchSummary = isVerified
      ? Object.values(dbState.branches)
          .map((b) => `- ${String(b.name || b.id)}${b.heritageLocation ? ` (${String(b.heritageLocation)})` : ''}`)
          .join('\n')
      : '- Founding Lineage — Ghulam Heritage (full branch directory visible after verification)';

    const callerRequestsSummary = caller
      ? Object.values(dbState.registrationRequests)
          .filter((r) => r.requesterUid === caller.uid)
          .slice(0, 5)
          .map(
            (r) =>
              `- Request for "${String(r.fullName || 'Member')}": status=${String(r.status || 'pending')}${
                r.reviewNotes ? `, notes="${String(r.reviewNotes)}"` : ''
              }`
          )
          .join('\n')
      : '';

    const languageInstruction =
      langPreference === 'ur'
        ? 'Respond exclusively in polite, clear Urdu script (اُردُو).'
        : langPreference === 'roman-ur'
          ? 'Respond in polite, natural Roman Urdu (e.g., "Assalam-o-Alaikum, aap is tarah...").'
          : langPreference === 'en'
            ? 'Respond in clear, warm English.'
            : 'Detect the user language automatically: if they write in Urdu script, respond in Urdu script; if they write in Roman Urdu (Urdu written with English letters), respond in Roman Urdu; otherwise respond in clear, warm English.';

    const systemInstruction = `You are FamilyGuide AI, the official intelligent assistant for Family Legacy — a private Pashtoon heritage, digital family management, and genealogy preservation platform.

Founding Family Lineage (verified baseline):
- Founding Grandfather & Main Family Head: Muhammad Ghulam (Generation I)
- Founding Grandmother: Amna Gulam (Generation I)
- Family Tree Descendant & Platform Architect (Developer Super Admin): Arsal Majeed (Generation III)
- Platform Stats: ${dbState.publicSummary.totalMembers} verified members across ${dbState.publicSummary.totalGenerations} generations and ${dbState.publicSummary.totalBranches} family branch(es).
- Subsequent generations (sons, daughters, spouses, grandchildren, great-grandchildren) are verified and maintained by the Main Family Head and authorized Branch Administrators.

Verified Family Branches:
${branchSummary}

Platform Guidance Knowledge:
1. Registration & Approvals:
   - Ordinary users register with email & password and start as Pending Family Members.
   - To join the verified family tree or update a record, they open "Submit Registration / Correction" in their Dashboard and fill in: Full Name, Gender, Date of Birth, Suggested Father's Name, Mother's Name, Spouse's Name, Family Branch, Contact Phone, and Biography.
   - Pending requests appear in the Main Family Head / Branch Admin Console under "Approvals". Once approved, the admin adds/links their verified profile in the Family Tree and activates their account.
2. Interactive 3D & 2D Family Tree Navigation:
   - The Family Tree page defaults to an interactive **3D Heritage Tree** (and lets verified members switch anytime between **3D Tree** and **2D Chart**).
   - In 3D Tree mode: drag to orbit, scroll to zoom, click any portrait medallion to focus and highlight parent-child boughs, double-click or click "Profile" to open the member's full profile modal, switch between **Canopy Arc** and **360° Spiral** layouts, use camera presets (**Full Tree**, **Founding Roots**, **Aerial Crown**), toggle **Auto-Orbit**, press **H** to hide/show controls, or download a **Snapshot** PNG.
   - In 2D Chart mode: supports zoom in/out, drag/pan, expand/collapse generations, Print, and PDF Export.
   - Both views support member search, branch filtering, and **Full Tree / Ancestors / Descendants** focus modes.
3. Roles & Permissions:
   - Developer Super Admin: Exclusive technical/system owner (source code, architecture, global settings, technical logs, admin account control).
   - Main Family Head: Manages all family members, branches, relationships, registration approvals, gallery, announcements, and family history.
   - Branch Administrator: Manages members and requests within authorized branches.
   - Verified Family Member: Explores full 3D & 2D tree, views personal dashboard, edits own permitted bio/photo/contact info, shares stories, submits correction requests.
   - Pending Family Member: Can view own request status, preview the 3D founding roots, ask FamilyGuide AI, and submit a registration request.
4. Security & Privacy Rules (STRICT — NEVER VIOLATE):
   - NEVER invent, guess, or fabricate any family relationships, dates, or members not explicitly provided.
   - NEVER claim you can create, edit, delete, or approve family records or accounts on your own. Always explain that only the Main Family Head or Branch Admin can approve/modify verified genealogy records.
   - NEVER disclose private contact information (emails, phone numbers, home addresses) of any family member.
   - Only append the exact token [ESCALATE_ADMIN] at the very end of your response when the user actually reports a complex ancestry dispute, duplicate profile conflict, account lockout, permission issue, or repeated rejection that requires administrator intervention (do NOT append it for ordinary how-to or navigation questions).

Current Caller Session Context (non-PII):
- Authenticated: ${Boolean(caller)}
- Role: ${userRole}
- Account Status: ${accountStatus}
- Branch: ${branchName}${
      callerRequestsSummary
        ? `\n- Caller's Registration Requests:\n${callerRequestsSummary}`
        : ''
    }

Language Directive:
${languageInstruction}

Formatting Directive:
- Format responses cleanly as plain text using numbered steps (1., 2., 3.) and bullet points (•) so it reads cleanly in a chat bubble. Do NOT use Markdown symbols like **, ##, or ###.`;

    const formattedHistory = Array.isArray(body.history)
      ? body.history
          .slice(-8)
          .filter(
            (h): h is ChatHistoryTurn =>
              Boolean(h) &&
              (h.sender === 'user' || h.sender === 'assistant') &&
              typeof h.text === 'string' &&
              h.text.trim().length > 0
          )
          .map((h) => ({
            role: h.sender === 'user' ? ('user' as const) : ('model' as const),
            parts: [{ text: h.text.slice(0, 1200) }],
          }))
      : [];

    const sendToModel = async (
      model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite',
      timeoutMs: number
    ) => {
      const thinkingLevel =
        model === 'gemini-3.1-flash-lite' ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
      const chat = ai.chats.create({
        model,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel },
        },
        history: formattedHistory,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs)
      );

      return await Promise.race([chat.sendMessage({ message }), timeoutPromise]);
    };

    const callGeminiWithFallback = async () => {
      try {
        return await sendToModel('gemini-4-hydrogen', 6500);
      } catch (primaryErr) {
        const errObj = primaryErr as { status?: number; message?: string };
        const msg = errObj?.message || String(primaryErr);
        const isRecoverable =
          errObj?.status === 503 ||
          errObj?.status === 504 ||
          errObj?.status === 429 ||
          msg.includes('DEADLINE_EXCEEDED') ||
          msg.includes('GEMINI_TIMEOUT') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('503') ||
          msg.includes('504') ||
          msg.includes('429');

        if (!isRecoverable) throw primaryErr;

        console.warn(
          `FamilyGuide AI primary model (gemini-4-hydrogen) hit ${errObj?.status || msg}; falling back to gemini-3.1-flash-lite.`
        );
        return await sendToModel('gemini-3.1-flash-lite', 15000);
      }
    };

    const response = await callGeminiWithFallback();
    const rawText = (response.text || '').trim();
    if (!rawText) {
      return res.status(502).json({ error: 'FamilyGuide AI returned an empty response. Please try again.' });
    }

    const suggestEscalation = rawText.includes('[ESCALATE_ADMIN]');
    const cleanReply = rawText.replace(/\[ESCALATE_ADMIN\]/g, '').trim();

    return res.json({
      reply: cleanReply,
      suggestEscalation,
    });
  } catch (error: unknown) {
    const errObj = error as { status?: number; code?: string; message?: string; cause?: { code?: string; message?: string } };
    const rawMsg = errObj?.message || String(error || 'Unexpected server error');
    const causeMsg = errObj?.cause?.code || errObj?.cause?.message || '';
    const errDetail = `${errObj?.status ? `[${errObj.status}] ` : ''}${rawMsg}${causeMsg ? ` (${causeMsg})` : ''}`.replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED]');
    console.error('FamilyGuide AI endpoint error:', errDetail);

    if (
      rawMsg.includes('API_KEY_INVALID') ||
      rawMsg.includes('PERMISSION_DENIED') ||
      rawMsg.includes('API key not valid') ||
      errObj?.status === 400 ||
      errObj?.status === 403
    ) {
      return res.status(502).json({
        error: 'Gemini API authentication or request configuration failed. Please check GEMINI_API_KEY in Settings > Secrets.',
        code: errObj?.status || 'AUTH_OR_REQUEST_ERROR',
      });
    }
    if (rawMsg.includes('404') || rawMsg.includes('NOT_FOUND') || errObj?.status === 404) {
      return res.status(502).json({
        error: `Gemini model lookup failed (${errDetail}).`,
        code: 'MODEL_NOT_FOUND',
      });
    }
    if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED') || errObj?.status === 429) {
      return res.status(429).json({
        error: 'FamilyGuide AI is receiving many requests right now. Please wait a few seconds and try again.',
        code: 'RATE_LIMITED',
      });
    }
    if (
      errObj?.status === 504 ||
      rawMsg.includes('DEADLINE_EXCEEDED') ||
      rawMsg.includes('GEMINI_TIMEOUT') ||
      rawMsg.includes('ETIMEDOUT') ||
      causeMsg.includes('ETIMEDOUT')
    ) {
      return res.status(504).json({
        error: 'FamilyGuide AI took too long to respond. Please try sending your question again.',
        code: 'TIMEOUT',
      });
    }
    return res.status(500).json({
      error: `FamilyGuide AI encountered a temporary issue (${errDetail.slice(0, 140)}). Please try again in a moment.`,
      code: 'UPSTREAM_ERROR',
    });
  }
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Family Legacy server running on http://0.0.0.0:${PORT} (Firebase disabled; local persistence active)`);
  });
}

startServer();

export type UserRole =
  | 'developer_super_admin'
  | 'family_head'
  | 'branch_admin'
  | 'verified_member'
  | 'pending_member';

export type AccountStatus = 'active' | 'pending' | 'suspended';

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  accountStatus: AccountStatus;
  memberId?: string;
  branchId?: string;
  photoUrl?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface FamilyBranch {
  id: string;
  name: string;
  description?: string;
  heritageLocation?: string;
  founderMemberId?: string;
  accentTone?: string;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface FamilyMember {
  id: string;
  fullName: string;
  gender: 'male' | 'female' | 'other';
  birthDate?: string;
  deathDate?: string;
  isDeceased: boolean;
  generation: number;
  fatherId?: string;
  motherId?: string;
  spouseId?: string;
  branchId?: string;
  photoUrl?: string;
  biography?: string;
  relationshipLabel?: string;
  linkedUid?: string;
  isFoundingAncestor?: boolean;
  status: 'verified' | 'pending' | 'archived';
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface MemberPrivateInfo {
  memberId: string;
  linkedUid?: string;
  email?: string;
  phone?: string;
  address?: string;
  phoneVerified?: boolean;
  updatedAt: unknown;
}

export interface RegistrationRequest {
  id: string;
  requesterUid: string;
  requesterEmail?: string;
  requestType: 'new_member' | 'profile_correction';
  targetMemberId?: string;
  fullName: string;
  gender: 'male' | 'female' | 'other';
  birthDate?: string;
  suggestedFatherName?: string;
  suggestedMotherName?: string;
  suggestedSpouseName?: string;
  branchId?: string;
  contactPhone?: string;
  biography?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNotes?: string;
  reviewedBy?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface FamilyAnnouncement {
  id: string;
  title: string;
  content: string;
  category: 'announcement' | 'event' | 'birthday' | 'anniversary' | 'milestone';
  eventDate?: string;
  isPublic: boolean;
  authorUid: string;
  authorName?: string;
  createdAt: unknown;
}

export interface GalleryItem {
  id: string;
  title: string;
  caption?: string;
  imageUrl: string;
  category: 'historical' | 'family_event' | 'portrait' | 'document';
  year?: string;
  isPublic: boolean;
  uploadedBy: string;
  createdAt: unknown;
}

export interface FamilyStory {
  id: string;
  title: string;
  era?: string;
  authorName?: string;
  authorUid: string;
  excerpt?: string;
  content: string;
  isPublic: boolean;
  createdAt: unknown;
}

export interface AiMessage {
  id: string;
  userId: string;
  sender: 'user' | 'assistant';
  language?: 'en' | 'ur' | 'roman-ur';
  text: string;
  escalated?: boolean;
  createdAt: unknown;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  targetCollection?: string;
  targetId?: string;
  details?: string;
  createdAt: unknown;
}

export interface PublicOverview {
  totalMembers: number;
  totalGenerations: number;
  totalBranches: number;
  grandfatherName: string;
  grandmotherName: string;
  familyMotto?: string;
  updatedAt: unknown;
}

export interface SystemSettings {
  platformName: string;
  registrationEnabled: boolean;
  aiAssistantEnabled: boolean;
  maintenanceMode: boolean;
  defaultWallpaperIntensity?: 'subtle' | 'standard' | 'luminous';
  defaultWallpaperColor?: 'emerald' | 'sapphire' | 'amber' | 'rose';
  updatedBy?: string;
  updatedAt: unknown;
}

export type AppView =
  | 'home'
  | 'tree'
  | 'heritage'
  | 'dashboard'
  | 'admin'
  | 'developer';

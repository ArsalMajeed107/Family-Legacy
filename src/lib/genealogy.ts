import { jsPDF } from 'jspdf';
import type { FamilyBranch, FamilyMember } from '../types/family.ts';

export function generateSafeId(prefix = 'id'): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '');
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 14)
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return `${cleanPrefix}_${rand}`;
}

export function wouldCreateParentCycle(
  memberId: string,
  candidateParentId: string | undefined,
  members: FamilyMember[]
): boolean {
  if (!candidateParentId) return false;
  if (candidateParentId === memberId) return true;

  const byId = new Map(members.map((m) => [m.id, m]));
  const visited = new Set<string>();
  const stack = [candidateParentId];

  while (stack.length > 0) {
    const curr = stack.pop()!;
    if (curr === memberId) return true;
    if (visited.has(curr)) continue;
    visited.add(curr);
    const node = byId.get(curr);
    if (node?.fatherId) stack.push(node.fatherId);
    if (node?.motherId) stack.push(node.motherId);
  }
  return false;
}

export function validateRelationshipIntegrity(
  candidate: {
    id: string;
    fatherId?: string;
    motherId?: string;
    spouseId?: string;
  },
  members: FamilyMember[]
): string | null {
  if (candidate.fatherId && candidate.fatherId === candidate.id) {
    return 'A family member cannot be set as their own father.';
  }
  if (candidate.motherId && candidate.motherId === candidate.id) {
    return 'A family member cannot be set as their own mother.';
  }
  if (candidate.spouseId && candidate.spouseId === candidate.id) {
    return 'A family member cannot be linked as their own spouse.';
  }
  if (candidate.fatherId && candidate.motherId && candidate.fatherId === candidate.motherId) {
    return 'Father and mother must be two distinct records.';
  }
  if (wouldCreateParentCycle(candidate.id, candidate.fatherId, members)) {
    return 'Invalid father assignment: this would create a circular ancestry loop.';
  }
  if (wouldCreateParentCycle(candidate.id, candidate.motherId, members)) {
    return 'Invalid mother assignment: this would create a circular ancestry loop.';
  }
  if (
    candidate.spouseId &&
    (candidate.spouseId === candidate.fatherId || candidate.spouseId === candidate.motherId)
  ) {
    return 'Invalid spouse assignment: a parent cannot be linked as a spouse.';
  }
  return null;
}

export function computeGenerationFromParents(
  fatherId: string | undefined,
  motherId: string | undefined,
  members: FamilyMember[],
  fallbackGeneration = 1
): number {
  const byId = new Map(members.map((m) => [m.id, m]));
  const fGen = fatherId ? byId.get(fatherId)?.generation : undefined;
  const mGen = motherId ? byId.get(motherId)?.generation : undefined;
  if (typeof fGen === 'number' && typeof mGen === 'number') {
    return Math.max(fGen, mGen) + 1;
  }
  if (typeof fGen === 'number') return fGen + 1;
  if (typeof mGen === 'number') return mGen + 1;
  return Math.max(1, fallbackGeneration);
}

export function getAncestorIds(memberId: string, members: FamilyMember[]): Set<string> {
  const byId = new Map(members.map((m) => [m.id, m]));
  const result = new Set<string>();
  const stack = [memberId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    const m = byId.get(id);
    if (m?.fatherId) stack.push(m.fatherId);
    if (m?.motherId) stack.push(m.motherId);
  }
  return result;
}

export function getDescendantIds(memberId: string, members: FamilyMember[]): Set<string> {
  const result = new Set<string>();
  const queue = [memberId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (result.has(id)) continue;
    result.add(id);
    for (const m of members) {
      if (m.fatherId === id || m.motherId === id) {
        queue.push(m.id);
      }
    }
  }
  return result;
}

export function findPotentialDuplicates(
  fullName: string,
  birthDate: string | undefined,
  members: FamilyMember[],
  excludeId?: string
): FamilyMember[] {
  const normalized = fullName.trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalized.length < 2) return [];
  return members.filter((m) => {
    if (excludeId && m.id === excludeId) return false;
    const other = m.fullName.trim().toLowerCase().replace(/\s+/g, ' ');
    const nameMatch = other === normalized || other.includes(normalized) || normalized.includes(other);
    if (!nameMatch) return false;
    if (birthDate && m.birthDate && birthDate.slice(0, 4) !== m.birthDate.slice(0, 4)) {
      return false;
    }
    return true;
  });
}

export interface UpcomingBirthday {
  member: FamilyMember;
  daysUntil: number;
  turningAge: number | null;
  monthDayLabel: string;
}

export function getUpcomingBirthdays(members: FamilyMember[], maxResults = 5): UpcomingBirthday[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const list: UpcomingBirthday[] = [];

  for (const m of members) {
    if (m.isDeceased || !m.birthDate) continue;
    const parsed = new Date(m.birthDate);
    if (Number.isNaN(parsed.getTime())) continue;

    let next = new Date(today.getFullYear(), parsed.getMonth(), parsed.getDate());
    if (next < today) {
      next = new Date(today.getFullYear() + 1, parsed.getMonth(), parsed.getDate());
    }
    const diffDays = Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const turningAge = next.getFullYear() - parsed.getFullYear();
    const monthDayLabel = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    list.push({
      member: m,
      daysUntil: diffDays,
      turningAge: turningAge > 0 ? turningAge : null,
      monthDayLabel,
    });
  }

  return list.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, maxResults);
}

export async function compressImageToDataUrl(file: File, maxDim = 480, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported or corrupted image file.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas compression unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function exportFamilyTreePdf(members: FamilyMember[], branches: FamilyBranch[]): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  let y = 52;

  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Header Banner
  doc.setFillColor(14, 41, 94);
  doc.rect(0, 0, pageWidth, 96, 'F');
  doc.setTextColor(125, 211, 252);
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.text('Family Legacy — Official Lineage Chronicle', margin, 42);

  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const maxGen = members.reduce((acc, m) => Math.max(acc, m.generation || 1), 1);
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}  |  ${members.length} Verified Members  |  ${maxGen} Generations  |  ${branches.length} Branches`,
    margin,
    68
  );

  y = 122;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 52;
    }
  };

  // Group by generation
  const generations = Array.from(new Set(members.map((m) => m.generation || 1))).sort((a, b) => a - b);

  for (const gen of generations) {
    ensureSpace(46);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, pageWidth - margin * 2, 24, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.text(`Generation ${gen}`, margin + 10, y + 16);
    y += 34;

    const genMembers = members.filter((m) => (m.generation || 1) === gen);
    for (const m of genMembers) {
      ensureSpace(64);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      const lifeSpan = m.birthDate
        ? ` (${m.birthDate.slice(0, 4)}${m.isDeceased ? ` - ${m.deathDate ? m.deathDate.slice(0, 4) : 'Deceased'}` : ''})`
        : m.isDeceased
          ? ' (Deceased)'
          : '';
      doc.text(`${m.fullName}${lifeSpan}`, margin + 8, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);

      const relParts: string[] = [];
      if (m.relationshipLabel) relParts.push(m.relationshipLabel);
      if (m.branchId && branchMap.get(m.branchId)) relParts.push(`Branch: ${branchMap.get(m.branchId)}`);
      if (m.fatherId && memberMap.get(m.fatherId)) relParts.push(`Father: ${memberMap.get(m.fatherId)!.fullName}`);
      if (m.motherId && memberMap.get(m.motherId)) relParts.push(`Mother: ${memberMap.get(m.motherId)!.fullName}`);
      if (m.spouseId && memberMap.get(m.spouseId)) relParts.push(`Spouse: ${memberMap.get(m.spouseId)!.fullName}`);

      const relLine = relParts.join('  •  ') || 'Verified Family Member';
      const splitRel = doc.splitTextToSize(relLine, pageWidth - margin * 2 - 16);
      doc.text(splitRel, margin + 8, y + 14);
      y += 14 + splitRel.length * 11;

      if (m.biography) {
        const bioLines = doc.splitTextToSize(m.biography.slice(0, 260), pageWidth - margin * 2 - 16);
        ensureSpace(bioLines.length * 11 + 8);
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(9);
        doc.text(bioLines, margin + 8, y + 2);
        y += bioLines.length * 11 + 8;
      } else {
        y += 6;
      }

      doc.setDrawColor(226, 232, 240);
      doc.line(margin + 8, y, pageWidth - margin - 8, y);
      y += 12;
    }
    y += 8;
  }

  doc.save('Family-Legacy-Lineage-Chronicle.pdf');
}

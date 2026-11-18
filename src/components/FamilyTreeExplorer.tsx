import React, { useMemo, useRef, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  User as UserIcon,
  Heart,
  Lock,
  Box,
  GitBranch,
} from 'lucide-react';
import {
  exportFamilyTreePdf,
  getAncestorIds,
  getDescendantIds,
} from '../lib/genealogy.ts';
import { FOUNDING_ASSETS } from '../lib/seedFamily.ts';
import { FamilyTree3D } from './FamilyTree3D.tsx';
import type { FamilyBranch, FamilyMember, UserAccount } from '../types/family.ts';

interface FamilyTreeExplorerProps {
  members: FamilyMember[];
  branches: FamilyBranch[];
  userProfile: UserAccount | null;
  isSignedIn: boolean;
  onSelectMember: (member: FamilyMember) => void;
  onOpenAuth: () => void;
}

type FocusMode = 'all' | 'ancestors' | 'descendants';
type TreeViewMode = '3d' | '2d';

const PUBLIC_FOUNDING_PREVIEW_MEMBERS: FamilyMember[] = [
  {
    id: 'preview_muhammad_ghulam',
    fullName: 'Muhammad Ghulam',
    gender: 'male',
    isDeceased: false,
    generation: 1,
    spouseId: 'preview_amna_gulam',
    photoUrl: FOUNDING_ASSETS.grandfather,
    relationshipLabel: 'Founding Grandfather · Main Family Head',
    isFoundingAncestor: true,
    status: 'verified',
    createdBy: 'system',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'preview_amna_gulam',
    fullName: 'Amna Gulam',
    gender: 'female',
    isDeceased: false,
    generation: 1,
    spouseId: 'preview_muhammad_ghulam',
    photoUrl: FOUNDING_ASSETS.grandmother,
    relationshipLabel: 'Founding Grandmother · Matriarch',
    isFoundingAncestor: true,
    status: 'verified',
    createdBy: 'system',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'preview_arsal_majeed',
    fullName: 'Arsal Majeed',
    gender: 'male',
    isDeceased: false,
    generation: 3,
    photoUrl: FOUNDING_ASSETS.developer,
    relationshipLabel: 'Grandson · Platform Developer',
    isFoundingAncestor: false,
    status: 'verified',
    createdBy: 'system',
    createdAt: '',
    updatedAt: '',
  },
];

export function FamilyTreeExplorer({
  members,
  branches,
  userProfile,
  isSignedIn,
  onSelectMember,
  onOpenAuth,
}: FamilyTreeExplorerProps) {
  const [treeViewMode, setTreeViewMode] = useState<TreeViewMode>('3d');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [focusMode, setFocusMode] = useState<FocusMode>('all');
  const [focusMemberId, setFocusMemberId] = useState<string | null>(null);
  const [previewFocusId, setPreviewFocusId] = useState<string | null>(null);
  const [collapsedGens, setCollapsedGens] = useState<Set<number>>(new Set());

  const isVerifiedAccess =
    userProfile &&
    userProfile.accountStatus === 'active' &&
    userProfile.role !== 'pending_member';

  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);

  const visibleMembers = useMemo(() => {
    let list = members.filter((m) => m.status !== 'archived');

    if (selectedBranchId !== 'all') {
      list = list.filter((m) => m.branchId === selectedBranchId || m.isFoundingAncestor);
    }

    if (focusMemberId && focusMode === 'ancestors') {
      const ids = getAncestorIds(focusMemberId, members);
      list = list.filter((m) => ids.has(m.id));
    } else if (focusMemberId && focusMode === 'descendants') {
      const ids = getDescendantIds(focusMemberId, members);
      list = list.filter((m) => ids.has(m.id));
    }

    return list;
  }, [members, selectedBranchId, focusMemberId, focusMode]);

  const searchMatches = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return new Set<string>();
    return new Set(
      visibleMembers
        .filter(
          (m) =>
            m.fullName.toLowerCase().includes(q) ||
            (m.relationshipLabel || '').toLowerCase().includes(q)
        )
        .map((m) => m.id)
    );
  }, [visibleMembers, searchTerm]);

  const layout = useMemo(() => {
    const CARD_W = 228;
    const CARD_H = 104;
    const COUPLE_GAP = 26;
    const UNIT_GAP = 42;
    const ROW_GAP = 88;

    const genNums = Array.from(new Set(visibleMembers.map((m) => m.generation || 1))).sort(
      (a, b) => a - b
    );

    const visibleSet = new Set(visibleMembers.map((m) => m.id));
    const positions = new Map<string, { x: number; y: number; w: number; h: number }>();
    const coupleEdges: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];

    let maxRowWidth = 900;
    const rowUnitsByGen = new Map<number, FamilyMember[][]>();

    for (const gen of genNums) {
      if (collapsedGens.has(gen)) continue;
      const genMembers = visibleMembers
        .filter((m) => (m.generation || 1) === gen)
        .sort((a, b) => {
          if (a.isFoundingAncestor && !b.isFoundingAncestor) return -1;
          if (!a.isFoundingAncestor && b.isFoundingAncestor) return 1;
          return a.fullName.localeCompare(b.fullName);
        });

      const placed = new Set<string>();
      const units: FamilyMember[][] = [];

      for (const m of genMembers) {
        if (placed.has(m.id)) continue;
        placed.add(m.id);
        const spouse =
          m.spouseId && visibleSet.has(m.spouseId)
            ? genMembers.find((cand) => cand.id === m.spouseId && !placed.has(cand.id))
            : undefined;
        if (spouse) {
          placed.add(spouse.id);
          units.push([m, spouse]);
        } else {
          units.push([m]);
        }
      }

      rowUnitsByGen.set(gen, units);
      const rowWidth = units.reduce(
        (acc, u, idx) =>
          acc + (u.length === 2 ? CARD_W * 2 + COUPLE_GAP : CARD_W) + (idx > 0 ? UNIT_GAP : 0),
        0
      );
      if (rowWidth + 120 > maxRowWidth) maxRowWidth = rowWidth + 120;
    }

    let currentY = 48;
    const genYHeaders: { gen: number; y: number; count: number; collapsed: boolean }[] = [];

    for (const gen of genNums) {
      const isCollapsed = collapsedGens.has(gen);
      const genCount = visibleMembers.filter((m) => (m.generation || 1) === gen).length;
      genYHeaders.push({ gen, y: currentY, count: genCount, collapsed: isCollapsed });

      if (isCollapsed) {
        currentY += 54;
        continue;
      }

      const units = rowUnitsByGen.get(gen) || [];
      const rowWidth = units.reduce(
        (acc, u, idx) =>
          acc + (u.length === 2 ? CARD_W * 2 + COUPLE_GAP : CARD_W) + (idx > 0 ? UNIT_GAP : 0),
        0
      );

      let cursorX = (maxRowWidth - rowWidth) / 2;
      const cardY = currentY + 34;

      for (const unit of units) {
        if (unit.length === 2) {
          const [a, b] = unit;
          positions.set(a.id, { x: cursorX, y: cardY, w: CARD_W, h: CARD_H });
          positions.set(b.id, { x: cursorX + CARD_W + COUPLE_GAP, y: cardY, w: CARD_W, h: CARD_H });
          coupleEdges.push({
            x1: cursorX + CARD_W,
            y1: cardY + CARD_H / 2,
            x2: cursorX + CARD_W + COUPLE_GAP,
            y2: cardY + CARD_H / 2,
            key: `spouse_${a.id}_${b.id}`,
          });
          cursorX += CARD_W * 2 + COUPLE_GAP + UNIT_GAP;
        } else {
          const [a] = unit;
          positions.set(a.id, { x: cursorX, y: cardY, w: CARD_W, h: CARD_H });
          cursorX += CARD_W + UNIT_GAP;
        }
      }

      currentY = cardY + CARD_H + ROW_GAP;
    }

    const childEdges: { d: string; key: string; highlighted: boolean }[] = [];
    for (const child of visibleMembers) {
      const childPos = positions.get(child.id);
      if (!childPos) continue;

      const fatherPos = child.fatherId ? positions.get(child.fatherId) : undefined;
      const motherPos = child.motherId ? positions.get(child.motherId) : undefined;
      if (!fatherPos && !motherPos) continue;

      let startX = 0;
      let startY = 0;
      if (fatherPos && motherPos) {
        startX = (fatherPos.x + fatherPos.w / 2 + motherPos.x + motherPos.w / 2) / 2;
        startY = Math.max(fatherPos.y, motherPos.y) + CARD_H / 2;
      } else if (fatherPos) {
        startX = fatherPos.x + fatherPos.w / 2;
        startY = fatherPos.y + CARD_H;
      } else if (motherPos) {
        startX = motherPos.x + motherPos.w / 2;
        startY = motherPos.y + CARD_H;
      }

      const endX = childPos.x + childPos.w / 2;
      const endY = childPos.y;
      const midY = (startY + endY) / 2;

      const highlighted =
        focusMemberId === child.id ||
        focusMemberId === child.fatherId ||
        focusMemberId === child.motherId;

      childEdges.push({
        key: `pc_${child.id}`,
        d: `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`,
        highlighted,
      });
    }

    return {
      width: maxRowWidth,
      height: Math.max(460, currentY + 40),
      positions,
      coupleEdges,
      childEdges,
      genYHeaders,
    };
  }, [visibleMembers, collapsedGens, focusMemberId]);

  const toggleGeneration = (gen: number) => {
    setCollapsedGens((prev) => {
      const next = new Set(prev);
      if (next.has(gen)) next.delete(gen);
      else next.add(gen);
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };

  const handleMouseUp = () => setDragging(false);

  if (!isVerifiedAccess) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="rounded-2xl border border-sky-300/25 bg-[#081736]/85 backdrop-blur-xl p-6 sm:p-8 text-center">
          <Lock className="w-8 h-8 text-sky-300 mx-auto mb-2.5" />
          <p className="text-xs uppercase tracking-wider text-amber-200 font-medium">
            Family Legacy · 3D Founding Heritage Preview
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-white mt-1.5">
            Founding Roots of Muhammad Ghulam &amp; Amna Gulam
          </h1>
          <p className="text-sm text-slate-200 max-w-2xl mx-auto mt-2.5 leading-relaxed">
            {isSignedIn
              ? 'Your account is currently awaiting verification by the Main Family Head. Explore our 3D founding roots below while verification completes.'
              : 'Explore the 3D Heritage Tree of our founding grandparents and platform architect below. Sign in or request registration to unlock all verified generations and member profiles.'}
          </p>

          {!isSignedIn && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="mt-5 px-6 py-2.5 rounded-xl bg-sky-300 hover:bg-sky-200 text-sky-950 font-semibold text-sm transition-colors cursor-pointer"
            >
              Sign In to Explore Full 3D &amp; 2D Tree
            </button>
          )}
        </div>

        <FamilyTree3D
          members={PUBLIC_FOUNDING_PREVIEW_MEMBERS}
          branches={[]}
          searchMatches={new Set()}
          focusMemberId={previewFocusId}
          onFocusMember={setPreviewFocusId}
          onSelectMember={() => {
            if (!isSignedIn) onOpenAuth();
          }}
          heightClassName="h-[460px] sm:h-[540px]"
        />
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 print-only-full">
      {/* Toolbar */}
      <div className="rounded-2xl border border-sky-300/20 bg-[#081736]/85 backdrop-blur-xl p-4 sm:p-5 mb-6 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-sky-300 font-medium">Interactive Pashtoon Genealogy</p>
            <h1 className="font-serif text-2xl font-semibold text-white">
              Family Legacy Multigenerational Family Tree
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 3D / 2D View Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#050F26] border border-sky-300/30">
              <button
                type="button"
                onClick={() => setTreeViewMode('3d')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  treeViewMode === '3d'
                    ? 'bg-sky-300 text-sky-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D Tree</span>
              </button>
              <button
                type="button"
                onClick={() => setTreeViewMode('2d')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  treeViewMode === '2d'
                    ? 'bg-sky-300 text-sky-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>2D Chart</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-sky-200/70 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search family member..."
                className="pl-9 pr-3 py-2 text-xs rounded-xl bg-[#050F26] border border-sky-300/25 text-white placeholder-slate-400 w-44 focus:outline-none focus:border-sky-300"
              />
            </div>

            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              aria-label="Filter by family branch"
              className="px-3 py-2 text-xs rounded-xl bg-[#050F26] border border-sky-300/25 text-white focus:outline-none focus:border-sky-300"
            >
              <option value="all">All Family Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#050F26] border border-sky-300/25">
              {(
                [
                  { id: 'all', label: 'Full Tree' },
                  { id: 'ancestors', label: 'Ancestors' },
                  { id: 'descendants', label: 'Descendants' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFocusMode(m.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    focusMode === m.id
                      ? 'bg-sky-300 text-sky-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {treeViewMode === '2d' && (
              <div className="flex items-center gap-1 rounded-xl bg-[#050F26] border border-sky-300/25 p-1">
                <button
                  type="button"
                  aria-label="Zoom out"
                  onClick={() => setZoom((z) => Math.max(0.45, Number((z - 0.15).toFixed(2))))}
                  className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="px-1.5 font-mono text-xs text-slate-300 tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  aria-label="Zoom in"
                  onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
                  className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Reset view"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                    setFocusMemberId(null);
                    setFocusMode('all');
                  }}
                  className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => exportFamilyTreePdf(visibleMembers, branches)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-300 hover:bg-sky-200 text-sky-950 font-semibold text-xs cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-sky-300/35 hover:border-sky-200/70 text-slate-100 text-xs font-medium cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {(focusMode !== 'all' || focusMemberId) && (
          <div className="mt-3 pt-3 border-t border-sky-300/15 flex items-center justify-between text-xs text-slate-200">
            <span>
              {focusMemberId
                ? `Focused on: ${members.find((m) => m.id === focusMemberId)?.fullName || 'Selected Member'} (${focusMode} view)`
                : 'Tip: Click any member card below to isolate their Ancestors or Descendants.'}
            </span>
            {focusMemberId && (
              <button
                type="button"
                onClick={() => {
                  setFocusMemberId(null);
                  setFocusMode('all');
                }}
                className="text-sky-300 hover:text-sky-200 cursor-pointer"
              >
                Clear Focus
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3D Tree or 2D Interactive Pan/Zoom Tree Viewport */}
      {treeViewMode === '3d' ? (
        visibleMembers.length === 0 ? (
          <div className="rounded-2xl border border-sky-300/25 bg-[#050F26]/85 backdrop-blur-xl py-24 px-6 text-center">
            <p className="font-serif text-xl text-white">No matching family records found</p>
            <p className="text-sm text-slate-300 mt-1">
              Adjust your search filter or ask the Main Family Head to add verified members.
            </p>
          </div>
        ) : (
          <FamilyTree3D
            members={visibleMembers}
            branches={branches}
            searchMatches={searchMatches}
            focusMemberId={focusMemberId}
            onFocusMember={setFocusMemberId}
            onSelectMember={onSelectMember}
          />
        )
      ) : (
        <div
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`relative overflow-auto rounded-2xl border border-sky-300/25 bg-[#050F26]/85 backdrop-blur-xl min-h-[560px] max-h-[75vh] print-only-full ${
            dragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          {visibleMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
              <p className="font-serif text-xl text-white">No matching family records found</p>
              <p className="text-sm text-slate-300 mt-1">
                Adjust your search filter or ask the Main Family Head to add verified members.
              </p>
            </div>
          ) : (
          <div
            style={{
              width: layout.width,
              height: layout.height,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top center',
            }}
            className="relative mx-auto transition-transform duration-75"
          >
            {/* SVG Connections */}
            <svg
              width={layout.width}
              height={layout.height}
              className="absolute inset-0 pointer-events-none"
            >
              {layout.coupleEdges.map((edge) => (
                <g key={edge.key}>
                  <line
                    x1={edge.x1}
                    y1={edge.y1}
                    x2={edge.x2}
                    y2={edge.y2}
                    stroke="#F5C56B"
                    strokeWidth="2.2"
                    strokeDasharray="4 2"
                  />
                </g>
              ))}
              {layout.childEdges.map((edge) => (
                <path
                  key={edge.key}
                  d={edge.d}
                  fill="none"
                  stroke={edge.highlighted ? '#7DD3FC' : 'rgba(56, 189, 248, 0.5)'}
                  strokeWidth={edge.highlighted ? 2.5 : 1.6}
                />
              ))}
            </svg>

            {/* Generation Band Headers */}
            {layout.genYHeaders.map((hdr) => (
              <div
                key={`gen_hdr_${hdr.gen}`}
                style={{ top: hdr.y, left: 24, right: 24 }}
                className="absolute flex items-center justify-between border-b border-sky-300/20 pb-1.5"
              >
                <button
                  type="button"
                  onClick={() => toggleGeneration(hdr.gen)}
                  className="inline-flex items-center gap-2 text-xs font-medium text-sky-200 hover:text-sky-100 cursor-pointer"
                >
                  {hdr.collapsed ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  <span>
                    Generation {hdr.gen} · {hdr.count} {hdr.count === 1 ? 'member' : 'members'}
                  </span>
                </button>
              </div>
            ))}

            {/* Member Cards */}
            {visibleMembers.map((m) => {
              const pos = layout.positions.get(m.id);
              if (!pos) return null;
              const isMatch = searchMatches.has(m.id);
              const isFocused = focusMemberId === m.id;
              const branch = m.branchId ? branchMap.get(m.branchId) : undefined;

              return (
                <div
                  key={m.id}
                  style={{ left: pos.x, top: pos.y, width: pos.w, height: pos.h }}
                  className={`absolute rounded-xl border p-3 transition-all shadow-lg ${
                    isFocused || isMatch
                      ? 'border-sky-300 bg-[#10295E] ring-2 ring-sky-300/45'
                      : m.isFoundingAncestor
                        ? 'border-amber-300/55 bg-[#0C214A]'
                        : 'border-sky-300/25 bg-[#09193A] hover:border-sky-300/60'
                  }`}
                >
                  <div className="flex items-start gap-3 h-full">
                    <button
                      type="button"
                      onClick={() => {
                        setFocusMemberId(m.id);
                        onSelectMember(m);
                      }}
                      className="w-12 h-12 rounded-xl overflow-hidden border border-sky-300/35 bg-[#050F26] shrink-0 flex items-center justify-center cursor-pointer"
                    >
                      {m.photoUrl ? (
                        <img
                          src={m.photoUrl}
                          alt={m.fullName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserIcon className="w-5 h-5 text-sky-200/60" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setFocusMemberId(m.id);
                            onSelectMember(m);
                          }}
                          className="text-left text-sm font-semibold text-white hover:text-sky-200 truncate block w-full cursor-pointer"
                        >
                          {m.fullName}
                        </button>
                        <p className="text-[11px] text-slate-300 truncate mt-0.5">
                          {m.relationshipLabel || (m.gender === 'female' ? 'Daughter / Spouse' : 'Son / Member')}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="truncate max-w-[115px]">
                          {branch ? branch.name : `Gen ${m.generation}`}
                        </span>
                        {m.spouseId && (
                          <span title="Married" className="text-amber-300 flex items-center gap-0.5">
                            <Heart className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      )}
    </main>
  );
}

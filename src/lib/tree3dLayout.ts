import type { FamilyMember } from '../types/family.ts';

export type Tree3DLayoutMode = 'canopy' | 'spiral';

export interface MemberNode3D {
  member: FamilyMember;
  position: [number, number, number];
  yaw: number;
  scale: number;
}

export interface ParentChildEdge3D {
  key: string;
  childId: string;
  parentIds: string[];
  start: [number, number, number];
  end: [number, number, number];
  control1: [number, number, number];
  control2: [number, number, number];
}

export interface SpouseEdge3D {
  key: string;
  aId: string;
  bId: string;
  aPos: [number, number, number];
  bPos: [number, number, number];
  mid: [number, number, number];
}

export interface TrunkBranchCurve {
  points: [number, number, number][];
  radiusStart: number;
  radiusEnd: number;
}

export interface Tree3DLayout {
  nodes: MemberNode3D[];
  nodeMap: Map<string, MemberNode3D>;
  parentChildEdges: ParentChildEdge3D[];
  spouseEdges: SpouseEdge3D[];
  trunkBranches: TrunkBranchCurve[];
  canopyAnchors: [number, number, number][];
  maxY: number;
  maxRadius: number;
  center: [number, number, number];
}

export function computeTree3DLayout(
  members: FamilyMember[],
  mode: Tree3DLayoutMode = 'canopy'
): Tree3DLayout {
  const nodes: MemberNode3D[] = [];
  const nodeMap = new Map<string, MemberNode3D>();
  const visibleSet = new Set(members.map((m) => m.id));

  if (members.length === 0) {
    return {
      nodes: [],
      nodeMap,
      parentChildEdges: [],
      spouseEdges: [],
      trunkBranches: [],
      canopyAnchors: [],
      maxY: 6,
      maxRadius: 6,
      center: [0, 3.2, 0],
    };
  }

  const genNums = Array.from(new Set(members.map((m) => Math.max(1, m.generation || 1)))).sort(
    (a, b) => a - b
  );
  const minGen = genNums[0] ?? 1;

  const baseGenHeight = 3.1;
  const tierStepY = 3.15;
  const spouseSpacing = 2.35;
  const coupleUnitGap = 1.65;

  let maxY = baseGenHeight;
  let maxRadius = 4.5;
  const spouseEdges: SpouseEdge3D[] = [];
  const canopyAnchors: [number, number, number][] = [];
  const trunkBranches: TrunkBranchCurve[] = [];

  for (const gen of genNums) {
    const tierIndex = gen - minGen;
    const y = baseGenHeight + tierIndex * tierStepY;
    if (y > maxY) maxY = y;

    const genMembers = members
      .filter((m) => Math.max(1, m.generation || 1) === gen)
      .sort((a, b) => {
        if (a.isFoundingAncestor && !b.isFoundingAncestor) return -1;
        if (!a.isFoundingAncestor && b.isFoundingAncestor) return 1;
        // Group siblings with same parents close together
        const pa = `${a.fatherId || ''}_${a.motherId || ''}`;
        const pb = `${b.fatherId || ''}_${b.motherId || ''}`;
        if (pa !== pb) return pa.localeCompare(pb);
        return a.fullName.localeCompare(b.fullName);
      });

    // Pair spouses into family units
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

    const totalSlots = units.reduce((acc, u) => acc + (u.length === 2 ? 2 : 1), 0);

    if (mode === 'canopy') {
      // Amphitheater semicircular 3D arc facing viewer (+Z)
      const totalWidth =
        units.reduce(
          (acc, u, idx) =>
            acc + (u.length === 2 ? spouseSpacing : 0) + (idx > 0 ? coupleUnitGap + 1.4 : 0),
          0
        ) + 0.01;
      const tierRadius = Math.max(2.6, Math.min(13.5, 2.4 + tierIndex * 2.1 + totalSlots * 0.45));
      if (tierRadius > maxRadius) maxRadius = tierRadius;

      // Span angle across front hemisphere
      const maxArcSpan = Math.min(Math.PI * 1.18, 0.36 * Math.max(1, totalSlots - 1) + 0.42);
      let cursor = -totalWidth / 2;

      units.forEach((unit, uIdx) => {
        const unitSpan = unit.length === 2 ? spouseSpacing : 0;
        const unitCenterOffset = cursor + unitSpan / 2;
        const normT = totalWidth > 0.1 ? unitCenterOffset / (totalWidth / 2) : 0;
        const baseAngle = normT * (maxArcSpan * 0.5);

        if (unit.length === 2) {
          const [a, b] = unit;
          const halfAngularOffset = Math.min(0.24, 1.28 / Math.max(2.6, tierRadius));
          const angleA = baseAngle - halfAngularOffset;
          const angleB = baseAngle + halfAngularOffset;

          const xA = Math.sin(angleA) * tierRadius;
          const zA =
            tierIndex === 0 ? 0.65 : Math.cos(angleA) * (tierRadius * 0.52) - tierIndex * 0.35;
          const xB = Math.sin(angleB) * tierRadius;
          const zB =
            tierIndex === 0 ? 0.65 : Math.cos(angleB) * (tierRadius * 0.52) - tierIndex * 0.35;

          const posA: [number, number, number] = [xA, y, zA];
          const posB: [number, number, number] = [xB, y, zB];
          const yawA = Math.atan2(-xA, 14 - zA) * 0.45;
          const yawB = Math.atan2(-xB, 14 - zB) * 0.45;
          const nodeScale = a.isFoundingAncestor ? 1.18 : 1;

          const nodeA: MemberNode3D = { member: a, position: posA, yaw: yawA, scale: nodeScale };
          const nodeB: MemberNode3D = {
            member: b,
            position: posB,
            yaw: yawB,
            scale: b.isFoundingAncestor ? 1.18 : 1,
          };
          nodes.push(nodeA, nodeB);
          nodeMap.set(a.id, nodeA);
          nodeMap.set(b.id, nodeB);

          spouseEdges.push({
            key: `sp_${a.id}_${b.id}`,
            aId: a.id,
            bId: b.id,
            aPos: posA,
            bPos: posB,
            mid: [(xA + xB) / 2, y + 0.12, (zA + zB) / 2],
          });
          canopyAnchors.push([(xA + xB) / 2, y + 1.0, (zA + zB) / 2]);
        } else {
          const [a] = unit;
          const x = tierIndex === 0 && units.length === 1 ? 0 : Math.sin(baseAngle) * tierRadius;
          const z =
            tierIndex === 0
              ? 0.65
              : Math.cos(baseAngle) * (tierRadius * 0.52) -
                tierIndex * 0.35 +
                (uIdx % 2 === 0 ? 0.25 : -0.25);
          const pos: [number, number, number] = [x, y, z];
          const yaw = Math.atan2(-x, 14 - z) * 0.45;
          const node: MemberNode3D = {
            member: a,
            position: pos,
            yaw,
            scale: a.isFoundingAncestor ? 1.18 : 1,
          };
          nodes.push(node);
          nodeMap.set(a.id, node);
          canopyAnchors.push([x, y + 1.0, z]);
        }

        cursor += unitSpan + coupleUnitGap + 1.4;
      });
    } else {
      // 360-degree Helical Heritage Tree Spiral
      const tierRadius = tierIndex === 0 ? 1.45 : Math.max(3.4, 2.8 + tierIndex * 1.65 + totalSlots * 0.35);
      if (tierRadius > maxRadius) maxRadius = tierRadius;

      const phaseOffset = tierIndex * 0.72;
      units.forEach((unit, uIdx) => {
        const angle = phaseOffset + (uIdx / Math.max(1, units.length)) * Math.PI * 2;
        if (unit.length === 2) {
          const [a, b] = unit;
          const deltaAngle = Math.min(0.45, 1.22 / Math.max(1.6, tierRadius));
          const angleA = angle - deltaAngle;
          const angleB = angle + deltaAngle;
          const posA: [number, number, number] = [
            Math.sin(angleA) * tierRadius,
            y,
            Math.cos(angleA) * tierRadius,
          ];
          const posB: [number, number, number] = [
            Math.sin(angleB) * tierRadius,
            y,
            Math.cos(angleB) * tierRadius,
          ];
          const nodeA: MemberNode3D = {
            member: a,
            position: posA,
            yaw: angleA,
            scale: a.isFoundingAncestor ? 1.16 : 1,
          };
          const nodeB: MemberNode3D = {
            member: b,
            position: posB,
            yaw: angleB,
            scale: b.isFoundingAncestor ? 1.16 : 1,
          };
          nodes.push(nodeA, nodeB);
          nodeMap.set(a.id, nodeA);
          nodeMap.set(b.id, nodeB);
          spouseEdges.push({
            key: `sp_${a.id}_${b.id}`,
            aId: a.id,
            bId: b.id,
            aPos: posA,
            bPos: posB,
            mid: [(posA[0] + posB[0]) / 2, y + 0.14, (posA[2] + posB[2]) / 2],
          });
          canopyAnchors.push([(posA[0] + posB[0]) / 2, y + 0.95, (posA[2] + posB[2]) / 2]);
        } else {
          const [a] = unit;
          const pos: [number, number, number] = [
            Math.sin(angle) * tierRadius,
            y,
            Math.cos(angle) * tierRadius,
          ];
          const node: MemberNode3D = {
            member: a,
            position: pos,
            yaw: angle,
            scale: a.isFoundingAncestor ? 1.16 : 1,
          };
          nodes.push(node);
          nodeMap.set(a.id, node);
          canopyAnchors.push([pos[0], y + 0.95, pos[2]]);
        }
      });
    }
  }

  // Parent -> Child 3D curved boughs
  const parentChildEdges: ParentChildEdge3D[] = [];
  for (const child of members) {
    const childNode = nodeMap.get(child.id);
    if (!childNode) continue;

    const fatherNode = child.fatherId ? nodeMap.get(child.fatherId) : undefined;
    const motherNode = child.motherId ? nodeMap.get(child.motherId) : undefined;

    let start: [number, number, number];
    const parentIds: string[] = [];

    if (fatherNode && motherNode) {
      parentIds.push(fatherNode.member.id, motherNode.member.id);
      start = [
        (fatherNode.position[0] + motherNode.position[0]) / 2,
        Math.max(fatherNode.position[1], motherNode.position[1]) + 0.25,
        (fatherNode.position[2] + motherNode.position[2]) / 2,
      ];
    } else if (fatherNode) {
      parentIds.push(fatherNode.member.id);
      start = [fatherNode.position[0], fatherNode.position[1] + 0.55, fatherNode.position[2]];
    } else if (motherNode) {
      parentIds.push(motherNode.member.id);
      start = [motherNode.position[0], motherNode.position[1] + 0.55, motherNode.position[2]];
    } else {
      // Connect members without direct recorded parents to the central ancestral heart trunk
      if ((child.generation || 1) <= minGen) continue;
      start = [0, baseGenHeight - 0.15, 0];
    }

    const end: [number, number, number] = [
      childNode.position[0],
      childNode.position[1] - 0.85 * childNode.scale,
      childNode.position[2],
    ];

    const dy = end[1] - start[1];
    const control1: [number, number, number] = [
      start[0] * 0.82 + end[0] * 0.18,
      start[1] + Math.max(0.7, dy * 0.42),
      start[2] * 0.82 + end[2] * 0.18,
    ];
    const control2: [number, number, number] = [
      start[0] * 0.22 + end[0] * 0.78,
      end[1] - Math.max(0.65, dy * 0.36),
      start[2] * 0.22 + end[2] * 0.78,
    ];

    parentChildEdges.push({
      key: `pc3d_${child.id}`,
      childId: child.id,
      parentIds,
      start,
      end,
      control1,
      control2,
    });
  }

  // Sculptural central heritage tree trunk & primary roots feeding Founding Generation
  const firstGenNodes = nodes.filter((n) => Math.max(1, n.member.generation || 1) === minGen);
  for (const fg of firstGenNodes) {
    trunkBranches.push({
      points: [
        [0, 0.35, 0],
        [fg.position[0] * 0.28, 1.45, fg.position[2] * 0.28],
        [fg.position[0] * 0.76, fg.position[1] - 1.15, fg.position[2] * 0.76],
        [fg.position[0], fg.position[1] - 0.82 * fg.scale, fg.position[2]],
      ],
      radiusStart: 0.28,
      radiusEnd: 0.08,
    });
  }

  const centerY = Math.max(2.6, (baseGenHeight + maxY) * 0.46);
  return {
    nodes,
    nodeMap,
    parentChildEdges,
    spouseEdges,
    trunkBranches,
    canopyAnchors,
    maxY,
    maxRadius,
    center: [0, centerY, 0],
  };
}

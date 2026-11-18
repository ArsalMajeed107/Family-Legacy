import { useEffect, useRef } from 'react';
import { FOUNDING_ASSETS } from '../lib/seedFamily.ts';

export type WallpaperColorTheme = 'emerald' | 'sapphire' | 'amber' | 'rose';

interface LiveHeritageWallpaperProps {
  intensity?: 'subtle' | 'standard' | 'luminous';
  colorTheme?: WallpaperColorTheme;
}

interface PetalParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
  rotation: number;
  rotSpeed: number;
  kind: 'petal' | 'sparkle' | 'ring';
}

interface BokehOrb {
  xRatio: number;
  yRatio: number;
  radiusRatio: number;
  speedX: number;
  speedY: number;
  phase: number;
  color: [number, number, number];
  alpha: number;
}

interface TreeNode {
  x: number;
  y: number;
  parentIdx: number | null;
  depth: number;
}

interface ThemePalette {
  bgGradient: string;
  scrimGradient: string;
  imageTintClass: string;
  khamakPrimary: string;
  khamakSecondary: string;
  orbs: [number, number, number][];
  aurora1: [string, string];
  aurora2: [string, string];
  auroraFade: string;
  star1: string;
  star2: string;
  star3: string;
  bridgeStroke: string;
  branchStops: [string, string, string];
  pulseFill: string;
  nodeGlow0: string;
  nodeGlow1: string;
  nodeCore: string;
  petalRgb: string;
  ringRgb: string;
  sparkleRgb: string;
}

const PALETTES: Record<WallpaperColorTheme, ThemePalette> = {
  emerald: {
    bgGradient:
      'bg-[radial-gradient(ellipse_at_top,#0E5C4E_0%,#052D27_48%,#02110F_100%)]',
    scrimGradient:
      'bg-gradient-to-b from-[#041C18]/45 via-[#041E1A]/28 to-[#020F0D]/72',
    imageTintClass: 'hue-rotate-[128deg] saturate-125',
    khamakPrimary: '#6EE7B7',
    khamakSecondary: '#F5C56B',
    orbs: [
      [16, 185, 129],
      [20, 184, 166],
      [52, 211, 153],
      [245, 197, 107],
      [45, 212, 191],
    ],
    aurora1: ['16, 185, 129', '13, 148, 136'],
    aurora2: ['52, 211, 153', '245, 197, 107'],
    auroraFade: 'rgba(2, 16, 14, 0)',
    star1: '110, 231, 183',
    star2: '45, 212, 191',
    star3: '245, 197, 107',
    bridgeStroke: '110, 231, 183',
    branchStops: ['52, 211, 153', '167, 243, 208', '245, 197, 107'],
    pulseFill: '253, 230, 138',
    nodeGlow0: '167, 243, 208',
    nodeGlow1: '16, 185, 129',
    nodeCore: '236, 253, 245',
    petalRgb: '52, 211, 153',
    ringRgb: '110, 231, 183',
    sparkleRgb: '254, 243, 199',
  },
  sapphire: {
    bgGradient:
      'bg-[radial-gradient(ellipse_at_top,#1E4EAE_0%,#0E295E_48%,#050E24_100%)]',
    scrimGradient:
      'bg-gradient-to-b from-[#071638]/40 via-[#0A1E4A]/24 to-[#040B1D]/68',
    imageTintClass: 'hue-rotate-[195deg] saturate-140',
    khamakPrimary: '#7DD3FC',
    khamakSecondary: '#F5C56B',
    orbs: [
      [56, 189, 248],
      [37, 99, 235],
      [96, 165, 250],
      [245, 197, 107],
      [14, 165, 233],
    ],
    aurora1: ['56, 189, 248', '37, 99, 235'],
    aurora2: ['96, 165, 250', '245, 197, 107'],
    auroraFade: 'rgba(5, 14, 36, 0)',
    star1: '125, 211, 252',
    star2: '147, 197, 253',
    star3: '245, 197, 107',
    bridgeStroke: '125, 211, 252',
    branchStops: ['56, 189, 248', '186, 230, 253', '245, 197, 107'],
    pulseFill: '253, 230, 138',
    nodeGlow0: '186, 230, 253',
    nodeGlow1: '59, 130, 246',
    nodeCore: '240, 249, 255',
    petalRgb: '96, 165, 250',
    ringRgb: '125, 211, 252',
    sparkleRgb: '224, 242, 254',
  },
  amber: {
    bgGradient:
      'bg-[radial-gradient(ellipse_at_top,#6B3E11_0%,#331B07_48%,#160B03_100%)]',
    scrimGradient:
      'bg-gradient-to-b from-[#211104]/45 via-[#261405]/28 to-[#120902]/72',
    imageTintClass: 'hue-rotate-[12deg] saturate-135',
    khamakPrimary: '#FCD34D',
    khamakSecondary: '#FDBA74',
    orbs: [
      [245, 158, 11],
      [251, 191, 36],
      [234, 88, 12],
      [253, 224, 71],
      [251, 146, 60],
    ],
    aurora1: ['245, 158, 11', '217, 119, 6'],
    aurora2: ['251, 191, 36', '251, 146, 60'],
    auroraFade: 'rgba(22, 11, 3, 0)',
    star1: '252, 211, 77',
    star2: '253, 186, 116',
    star3: '254, 240, 138',
    bridgeStroke: '252, 211, 77',
    branchStops: ['245, 158, 11', '253, 230, 138', '251, 146, 60'],
    pulseFill: '254, 249, 195',
    nodeGlow0: '253, 230, 138',
    nodeGlow1: '245, 158, 11',
    nodeCore: '255, 251, 235',
    petalRgb: '251, 191, 36',
    ringRgb: '252, 211, 77',
    sparkleRgb: '254, 243, 199',
  },
  rose: {
    bgGradient:
      'bg-[radial-gradient(ellipse_at_top,#5B1543_0%,#2A0922_48%,#12040F_100%)]',
    scrimGradient:
      'bg-gradient-to-b from-[#1A0716]/45 via-[#1C0817]/30 to-[#10040D]/72',
    imageTintClass: 'hue-rotate-[290deg] saturate-150',
    khamakPrimary: '#F9A8D4',
    khamakSecondary: '#F5C56B',
    orbs: [
      [236, 72, 153],
      [244, 114, 182],
      [219, 39, 119],
      [245, 197, 107],
      [249, 168, 212],
    ],
    aurora1: ['244, 114, 182', '219, 39, 119'],
    aurora2: ['249, 168, 212', '245, 197, 107'],
    auroraFade: 'rgba(18, 4, 15, 0)',
    star1: '249, 168, 212',
    star2: '244, 114, 182',
    star3: '245, 197, 107',
    bridgeStroke: '249, 168, 212',
    branchStops: ['244, 114, 182', '251, 207, 232', '245, 197, 107'],
    pulseFill: '253, 230, 138',
    nodeGlow0: '251, 207, 232',
    nodeGlow1: '244, 114, 182',
    nodeCore: '255, 241, 248',
    petalRgb: '244, 114, 182',
    ringRgb: '249, 168, 212',
    sparkleRgb: '253, 230, 240',
  },
};

export function LiveHeritageWallpaper({
  intensity = 'standard',
  colorTheme = 'sapphire',
}: LiveHeritageWallpaperProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const palette = PALETTES[colorTheme] || PALETTES.sapphire;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReduced = motionQuery.matches;

    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReduced = e.matches;
    };
    motionQuery.addEventListener('change', handleMotionChange);

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const intensityBoost = intensity === 'subtle' ? 0.7 : intensity === 'luminous' ? 1.35 : 1.05;
    const particleCount = width < 768 ? 48 : 92;

    let pointerX = 0;
    let pointerY = 0;
    let targetPointerX = 0;
    let targetPointerY = 0;

    const onPointerMove = (e: MouseEvent) => {
      targetPointerX = (e.clientX / Math.max(1, width) - 0.5) * 24;
      targetPointerY = (e.clientY / Math.max(1, height) - 0.5) * 18;
    };
    window.addEventListener('mousemove', onPointerMove, { passive: true });

    const bokehOrbs: BokehOrb[] = [
      { xRatio: 0.18, yRatio: 0.22, radiusRatio: 0.28, speedX: 0.005, speedY: 0.004, phase: 0.2, color: palette.orbs[0], alpha: 0.25 },
      { xRatio: 0.82, yRatio: 0.18, radiusRatio: 0.3, speedX: -0.004, speedY: 0.005, phase: 1.4, color: palette.orbs[1], alpha: 0.23 },
      { xRatio: 0.52, yRatio: 0.45, radiusRatio: 0.34, speedX: 0.003, speedY: -0.004, phase: 2.5, color: palette.orbs[2], alpha: 0.18 },
      { xRatio: 0.25, yRatio: 0.78, radiusRatio: 0.26, speedX: 0.004, speedY: -0.003, phase: 3.7, color: palette.orbs[3], alpha: 0.15 },
      { xRatio: 0.78, yRatio: 0.74, radiusRatio: 0.29, speedX: -0.005, speedY: -0.004, phase: 4.8, color: palette.orbs[4], alpha: 0.19 },
    ];

    const particles: PetalParticle[] = Array.from({ length: particleCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.42,
      vy: -0.22 - Math.random() * 0.48,
      size: i % 4 === 0 ? 4 + Math.random() * 4.2 : i % 7 === 0 ? 3 + Math.random() * 3 : 1.5 + Math.random() * 2.4,
      alpha: 0.32 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.025,
      kind: i % 4 === 0 ? 'petal' : i % 11 === 0 ? 'ring' : 'sparkle',
    }));

    const buildConstellation = (w: number, h: number): TreeNode[] => {
      const cx = w * 0.5;
      const rootY = h * 0.86;
      const nodes: TreeNode[] = [
        { x: cx - 36, y: rootY, parentIdx: null, depth: 0 },
        { x: cx + 36, y: rootY, parentIdx: null, depth: 0 },
      ];

      const gen2Offsets = [-0.28, -0.095, 0.095, 0.28];
      gen2Offsets.forEach((off, idx) => {
        nodes.push({
          x: cx + w * off,
          y: h * 0.61 - (idx === 1 || idx === 2 ? h * 0.04 : 0),
          parentIdx: idx < 2 ? 0 : 1,
          depth: 1,
        });
      });

      const gen2Start = 2;
      for (let i = 0; i < 4; i++) {
        const p = nodes[gen2Start + i];
        nodes.push({
          x: p.x - w * 0.068,
          y: h * 0.35 + (i % 2) * h * 0.03,
          parentIdx: gen2Start + i,
          depth: 2,
        });
        nodes.push({
          x: p.x + w * 0.068,
          y: h * 0.33 + ((i + 1) % 2) * h * 0.03,
          parentIdx: gen2Start + i,
          depth: 2,
        });
      }

      const gen3Start = 6;
      for (let j = 0; j < 8; j++) {
        const p = nodes[gen3Start + j];
        nodes.push({
          x: p.x + (j % 2 === 0 ? -w * 0.028 : w * 0.028),
          y: h * 0.16 + (j % 3) * h * 0.025,
          parentIdx: gen3Start + j,
          depth: 3,
        });
      }

      return nodes;
    };

    let treeNodes = buildConstellation(width, height);

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      treeNodes = buildConstellation(width, height);
    };
    window.addEventListener('resize', onResize);

    const drawPashtoonStar = (
      cx: number,
      cy: number,
      radius: number,
      rot: number,
      strokeColor: string
    ) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.15;

      for (let sq = 0; sq < 2; sq++) {
        ctx.save();
        ctx.rotate((sq * Math.PI) / 4);
        ctx.strokeRect(-radius * 0.7, -radius * 0.7, radius * 1.4, radius * 1.4);
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.42, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.08, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    const drawAuroraRibbon = (
      baseYRatio: number,
      amplitude: number,
      phaseOffset: number,
      colorStops: [string, string, string]
    ) => {
      const yBase = height * baseYRatio;
      const t = prefersReduced ? 0 : time * 0.012 + phaseOffset;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(0, yBase + Math.sin(t) * amplitude);

      const segments = 6;
      for (let i = 1; i <= segments; i++) {
        const xPrev = ((i - 1) / segments) * width;
        const xCurr = (i / segments) * width;
        const xMid = (xPrev + xCurr) * 0.5;
        const yWave =
          yBase +
          Math.sin(t + i * 0.85) * amplitude +
          Math.cos(t * 0.7 - i * 0.6) * (amplitude * 0.45);
        const yCtrl = yBase + Math.sin(t + (i - 0.5) * 0.9) * amplitude * 1.15;
        ctx.quadraticCurveTo(xMid, yCtrl, xCurr, yWave);
      }

      ctx.lineTo(width, height);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, yBase - amplitude * 1.4, 0, height);
      grad.addColorStop(0, colorStops[0]);
      grad.addColorStop(0.35, colorStops[1]);
      grad.addColorStop(1, colorStops[2]);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    };

    let animId = 0;
    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      if (!prefersReduced) {
        pointerX += (targetPointerX - pointerX) * 0.04;
        pointerY += (targetPointerY - pointerY) * 0.04;
      }

      for (const orb of bokehOrbs) {
        const ox =
          orb.xRatio * width +
          (prefersReduced ? 0 : Math.sin(time * orb.speedX + orb.phase) * width * 0.08) +
          pointerX * 0.6;
        const oy =
          orb.yRatio * height +
          (prefersReduced ? 0 : Math.cos(time * orb.speedY + orb.phase) * height * 0.07) +
          pointerY * 0.6;
        const r = Math.max(width, height) * orb.radiusRatio;
        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
        grad.addColorStop(0, `rgba(${orb.color[0]}, ${orb.color[1]}, ${orb.color[2]}, ${orb.alpha * intensityBoost})`);
        grad.addColorStop(0.5, `rgba(${orb.color[0]}, ${orb.color[1]}, ${orb.color[2]}, ${orb.alpha * 0.38 * intensityBoost})`);
        grad.addColorStop(1, `rgba(${orb.color[0]}, ${orb.color[1]}, ${orb.color[2]}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ox, oy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      drawAuroraRibbon(0.54, 48, 0.0, [
        `rgba(${palette.aurora1[0]}, ${0.17 * intensityBoost})`,
        `rgba(${palette.aurora1[1]}, ${0.1 * intensityBoost})`,
        palette.auroraFade,
      ]);
      drawAuroraRibbon(0.68, 38, 2.2, [
        `rgba(${palette.aurora2[0]}, ${0.14 * intensityBoost})`,
        `rgba(${palette.aurora2[1]}, ${0.08 * intensityBoost})`,
        palette.auroraFade,
      ]);

      const sway = (idx: number, depth: number) => {
        if (prefersReduced) return { dx: 0, dy: 0 };
        const amp = (depth + 1) * 3.0;
        return {
          dx: Math.sin(time * 0.011 + idx * 0.9) * amp + pointerX * (0.12 * (depth + 1)),
          dy: Math.cos(time * 0.009 + idx * 1.1) * (amp * 0.5) + pointerY * (0.1 * (depth + 1)),
        };
      };

      const medRot = prefersReduced ? 0 : time * 0.0022;
      drawPashtoonStar(
        width * 0.14 + pointerX * 0.35,
        height * 0.24 + pointerY * 0.35,
        width < 768 ? 58 : 102,
        medRot,
        `rgba(${palette.star1}, ${0.24 * intensityBoost})`
      );
      drawPashtoonStar(
        width * 0.86 + pointerX * 0.35,
        height * 0.28 + pointerY * 0.35,
        width < 768 ? 64 : 114,
        -medRot * 0.85,
        `rgba(${palette.star2}, ${0.22 * intensityBoost})`
      );
      drawPashtoonStar(
        width * 0.5 + pointerX * 0.25,
        height * 0.5 + pointerY * 0.25,
        width < 768 ? 96 : 165,
        medRot * 0.55,
        `rgba(${palette.star3}, ${0.17 * intensityBoost})`
      );

      const p0 = treeNodes[0];
      const p1 = treeNodes[1];
      const s0 = sway(0, 0);
      const s1 = sway(1, 0);
      ctx.beginPath();
      ctx.moveTo(p0.x + s0.dx, p0.y + s0.dy);
      ctx.lineTo(p1.x + s1.dx, p1.y + s1.dy);
      ctx.strokeStyle = `rgba(${palette.bridgeStroke}, ${0.55 * intensityBoost})`;
      ctx.lineWidth = 2.1;
      ctx.stroke();

      for (let i = 2; i < treeNodes.length; i++) {
        const node = treeNodes[i];
        if (node.parentIdx === null) continue;
        const parent = treeNodes[node.parentIdx];
        const sn = sway(i, node.depth);
        const sp = sway(node.parentIdx, parent.depth);

        const x1 = parent.x + sp.dx;
        const y1 = parent.y + sp.dy;
        const x2 = node.x + sn.dx;
        const y2 = node.y + sn.dy;
        const midY = (y1 + y2) * 0.5;

        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, `rgba(${palette.branchStops[0]}, ${0.46 * intensityBoost})`);
        grad.addColorStop(0.5, `rgba(${palette.branchStops[1]}, ${0.38 * intensityBoost})`);
        grad.addColorStop(1, `rgba(${palette.branchStops[2]}, ${0.32 * intensityBoost})`);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(x1, midY, x2, midY, x2, y2);
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1.0, 2.2 - node.depth * 0.34);
        ctx.stroke();

        if (!prefersReduced) {
          const pulseT = (time * 0.007 + i * 0.21) % 1;
          const invT = 1 - pulseT;
          const px =
            invT * invT * invT * x1 +
            3 * invT * invT * pulseT * x1 +
            3 * invT * pulseT * pulseT * x2 +
            pulseT * pulseT * pulseT * x2;
          const py =
            invT * invT * invT * y1 +
            3 * invT * invT * pulseT * midY +
            3 * invT * pulseT * pulseT * midY +
            pulseT * pulseT * pulseT * y2;
          ctx.fillStyle = `rgba(${palette.pulseFill}, ${0.68 * Math.sin(pulseT * Math.PI)})`;
          ctx.beginPath();
          ctx.arc(px, py, 2.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (let i = 0; i < treeNodes.length; i++) {
        const node = treeNodes[i];
        const s = sway(i, node.depth);
        const nx = node.x + s.dx;
        const ny = node.y + s.dy;
        const pulse = prefersReduced ? 1 : 0.85 + 0.28 * Math.sin(time * 0.03 + i);
        const glowRadius = (node.depth === 0 ? 24 : 14 - node.depth * 1.6) * pulse;

        const radGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, glowRadius);
        radGrad.addColorStop(0, `rgba(${palette.nodeGlow0}, ${0.7 * intensityBoost})`);
        radGrad.addColorStop(0.5, `rgba(${palette.nodeGlow1}, ${0.3 * intensityBoost})`);
        radGrad.addColorStop(1, `rgba(${palette.nodeGlow1}, 0)`);
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(nx, ny, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${palette.nodeCore}, ${0.9 * intensityBoost})`;
        ctx.beginPath();
        ctx.arc(nx, ny, node.depth === 0 ? 3.8 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const p of particles) {
        if (!prefersReduced) {
          p.x += p.vx + Math.sin(time * 0.015 + p.phase) * 0.28;
          p.y += p.vy;
          p.rotation += p.rotSpeed;
          if (p.y < -18) {
            p.y = height + 18;
            p.x = Math.random() * width;
          }
          if (p.x < -18) p.x = width + 18;
          if (p.x > width + 18) p.x = -18;
        }
        const twinkle = prefersReduced ? 1 : 0.6 + 0.4 * Math.sin(time * 0.04 + p.phase);

        if (p.kind === 'petal') {
          ctx.save();
          ctx.translate(p.x + pointerX * 0.3, p.y + pointerY * 0.3);
          ctx.rotate(p.rotation);
          ctx.fillStyle = `rgba(${palette.petalRgb}, ${Math.min(0.85, p.alpha * twinkle * intensityBoost)})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 1.25, p.size * 0.62, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.kind === 'ring') {
          ctx.strokeStyle = `rgba(${palette.ringRgb}, ${Math.min(0.6, p.alpha * twinkle * 0.7 * intensityBoost)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x + pointerX * 0.2, p.y + pointerY * 0.2, p.size * 1.4, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${palette.sparkleRgb}, ${Math.min(0.9, p.alpha * twinkle * intensityBoost)})`;
          ctx.beginPath();
          ctx.arc(p.x + pointerX * 0.15, p.y + pointerY * 0.15, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!prefersReduced) {
        time += 1;
        animId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onPointerMove);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, [intensity, palette]);

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none no-print"
      aria-hidden="true"
    >
      {/* Dynamic Heritage Base Gradient */}
      <div className={`absolute inset-0 transition-colors duration-700 ${palette.bgGradient}`} />

      {/* Generated Heritage Tree Artwork tinted cleanly for active palette */}
      <img
        src={FOUNDING_ASSETS.heroTree}
        alt=""
        referrerPolicy="no-referrer"
        className={`absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-screen scale-105 transition-all duration-700 ${palette.imageTintClass}`}
      />

      {/* Pashtoon Khamak Geometric SVG Lattice Overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.11]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="pashtoon-khamak" width="96" height="96" patternUnits="userSpaceOnUse">
            <path
              d="M48 4 L62 34 L92 48 L62 62 L48 92 L34 62 L4 48 L34 34 Z"
              fill="none"
              stroke={palette.khamakPrimary}
              strokeWidth="1.05"
            />
            <circle cx="48" cy="48" r="10" fill="none" stroke={palette.khamakSecondary} strokeWidth="0.95" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pashtoon-khamak)" />
      </svg>

      {/* Balanced Scrim for Readability while Letting Live Aurora Shine */}
      <div className={`absolute inset-0 transition-colors duration-700 ${palette.scrimGradient}`} />

      {/* Live Animated Aurora, Medallions, Family Tree & Petals */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}

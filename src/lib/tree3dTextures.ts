import * as THREE from 'three';
import type { FamilyMember } from '../types/family.ts';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'FL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function drawMedallionCanvas(
  canvas: HTMLCanvasElement,
  member: FamilyMember,
  loadedImage: HTMLImageElement | null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Midnight sapphire radial backdrop
  const bg = ctx.createRadialGradient(cx, cy * 0.75, 20, cx, cy, size * 0.56);
  if (member.isFoundingAncestor) {
    bg.addColorStop(0, '#1D4696');
    bg.addColorStop(0.65, '#0C214A');
    bg.addColorStop(1, '#050F26');
  } else {
    bg.addColorStop(0, '#153678');
    bg.addColorStop(0.68, '#091A3C');
    bg.addColorStop(1, '#040C20');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Subtle Pashtoon star-polygon halo watermark behind portrait
  ctx.save();
  ctx.translate(cx, cy - 28);
  ctx.strokeStyle = member.isFoundingAncestor
    ? 'rgba(245, 197, 107, 0.22)'
    : 'rgba(125, 211, 252, 0.16)';
  ctx.lineWidth = 2;
  for (let rIdx = 0; rIdx < 2; rIdx++) {
    ctx.rotate(Math.PI / 8);
    ctx.strokeRect(-130, -130, 260, 260);
  }
  ctx.restore();

  // Circular portrait region
  const portraitR = 136;
  const portraitCy = 196;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, portraitCy, portraitR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (loadedImage && loadedImage.complete && loadedImage.naturalWidth > 0) {
    const iw = loadedImage.naturalWidth;
    const ih = loadedImage.naturalHeight;
    const targetSize = portraitR * 2;
    const scale = Math.max(targetSize / iw, targetSize / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(loadedImage, cx - dw / 2, portraitCy - dh / 2, dw, dh);
  } else {
    const avatarBg = ctx.createLinearGradient(0, portraitCy - portraitR, 0, portraitCy + portraitR);
    avatarBg.addColorStop(0, '#1B418C');
    avatarBg.addColorStop(1, '#081736');
    ctx.fillStyle = avatarBg;
    ctx.fillRect(cx - portraitR, portraitCy - portraitR, portraitR * 2, portraitR * 2);

    ctx.fillStyle = member.isFoundingAncestor ? '#F5C56B' : '#BAE6FD';
    ctx.font = 'bold 88px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getInitials(member.fullName), cx, portraitCy + 4);
  }
  ctx.restore();

  // Portrait rim stroke
  ctx.beginPath();
  ctx.arc(cx, portraitCy, portraitR + 3, 0, Math.PI * 2);
  ctx.strokeStyle = member.isFoundingAncestor ? '#F5C56B' : '#7DD3FC';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Generation pill badge at top
  const genLabel = `GENERATION ${member.generation || 1}`;
  ctx.save();
  ctx.fillStyle = member.isFoundingAncestor
    ? 'rgba(245, 197, 107, 0.94)'
    : 'rgba(14, 41, 94, 0.94)';
  const pillW = 190;
  const pillH = 34;
  const pillX = cx - pillW / 2;
  const pillY = 26;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 17);
  ctx.fill();
  ctx.strokeStyle = member.isFoundingAncestor ? '#FDE68A' : '#38BDF8';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = member.isFoundingAncestor ? '#081736' : '#BAE6FD';
  ctx.font = 'bold 17px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(genLabel, cx, pillY + pillH / 2 + 1);
  ctx.restore();

  // Lower nameplate banner
  const bannerGrad = ctx.createLinearGradient(0, 336, 0, size);
  bannerGrad.addColorStop(0, 'rgba(6, 19, 46, 0.78)');
  bannerGrad.addColorStop(1, 'rgba(4, 12, 32, 0.98)');
  ctx.fillStyle = bannerGrad;
  ctx.fillRect(0, 344, size, size - 344);

  // Subtle gold divider line
  ctx.strokeStyle = member.isFoundingAncestor ? 'rgba(245, 197, 107, 0.7)' : 'rgba(56, 189, 248, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(46, 350);
  ctx.lineTo(size - 46, 350);
  ctx.stroke();

  // Member Full Name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 31px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let displayName = member.fullName.trim();
  if (displayName.length > 22) {
    displayName = `${displayName.slice(0, 20)}…`;
  }
  ctx.fillText(displayName, cx, 392);

  // Relationship label / role
  const subLabel =
    member.relationshipLabel ||
    (member.isDeceased
      ? 'Beloved Elder · In Memoriam'
      : member.gender === 'female'
        ? 'Daughter / Family Member'
        : 'Son / Family Member');
  let trimmedSub = subLabel.trim();
  if (trimmedSub.length > 34) {
    trimmedSub = `${trimmedSub.slice(0, 32)}…`;
  }
  ctx.fillStyle = member.isFoundingAncestor ? '#FDE68A' : '#7DD3FC';
  ctx.font = '600 18px Inter, system-ui, sans-serif';
  ctx.fillText(trimmedSub, cx, 434);

  // Memorial or birth year line
  if (member.birthDate || member.isDeceased) {
    const yearStr = member.birthDate ? member.birthDate.slice(0, 4) : '';
    const lifeText = member.isDeceased
      ? `${yearStr ? `${yearStr} – ` : ''}${member.deathDate ? member.deathDate.slice(0, 4) : 'In Memoriam'}`
      : `Born ${yearStr}`;
    ctx.fillStyle = 'rgba(203, 213, 225, 0.82)';
    ctx.font = '500 15px ui-monospace, monospace';
    ctx.fillText(lifeText, cx, 466);
  }
}

export function createMemberMedallionTexture(
  member: FamilyMember,
  maxAnisotropy: number,
  onAsyncUpdate: () => void
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;

  drawMedallionCanvas(canvas, member, null);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;

  if (member.photoUrl) {
    const img = new Image();
    if (/^https?:\/\//i.test(member.photoUrl)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      drawMedallionCanvas(canvas, member, img);
      texture.needsUpdate = true;
      onAsyncUpdate();
    };
    img.onerror = () => {
      // Keep crisp monogram crest fallback
    };
    img.src = member.photoUrl;
  }

  return texture;
}

export function createSanctuaryFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;

    const grad = ctx.createRadialGradient(cx, cy, 40, cx, cy, size * 0.52);
    grad.addColorStop(0, '#13316D');
    grad.addColorStop(0.45, '#091A3E');
    grad.addColorStop(0.85, '#050F26');
    grad.addColorStop(1, '#040B1D');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Subtle stone tiles + Pashtoon geometric star mandala rings
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.14)';
    ctx.lineWidth = 2;
    [130, 210, 300, 395, 470].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 16 radial compass spokes
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(245, 197, 107, 0.2)' : 'rgba(56, 189, 248, 0.1)';
      ctx.lineWidth = i % 2 === 0 ? 2.2 : 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 95, cy + Math.sin(a) * 95);
      ctx.lineTo(cx + Math.cos(a) * 470, cy + Math.sin(a) * 470);
      ctx.stroke();
    }

    // 8-point Pashtoon heirloom star
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(245, 197, 107, 0.34)';
    ctx.lineWidth = 3;
    for (let s = 0; s < 2; s++) {
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-145, -145, 290, 290);
    }
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createWoodBronzeBarkTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#3B281B';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 180; i++) {
      const x = Math.random() * size;
      const w = 1.5 + Math.random() * 4;
      const h = 30 + Math.random() * 110;
      const y = Math.random() * size;
      ctx.fillStyle =
        i % 3 === 0
          ? 'rgba(217, 169, 98, 0.16)'
          : i % 2 === 0
            ? 'rgba(22, 14, 9, 0.38)'
            : 'rgba(92, 62, 38, 0.25)';
      ctx.fillRect(x, y, w, h);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(2, 6, 18, 0.85)');
    grad.addColorStop(0.55, 'rgba(2, 8, 22, 0.42)');
    grad.addColorStop(1, 'rgba(2, 8, 22, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

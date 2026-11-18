import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  Orbit,
  RotateCcw,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { computeTree3DLayout, type Tree3DLayoutMode } from '../lib/tree3dLayout.ts';
import {
  createContactShadowTexture,
  createMemberMedallionTexture,
  createSanctuaryFloorTexture,
  createWoodBronzeBarkTexture,
} from '../lib/tree3dTextures.ts';
import type { FamilyBranch, FamilyMember } from '../types/family.ts';

interface FamilyTree3DProps {
  members: FamilyMember[];
  branches: FamilyBranch[];
  searchMatches: Set<string>;
  focusMemberId: string | null;
  onFocusMember: (memberId: string | null) => void;
  onSelectMember: (member: FamilyMember) => void;
  heightClassName?: string;
}

type CameraPreset = 'overview' | 'roots' | 'crown';

// Pre-allocated scratch math helpers (zero GC inside animation loop)
const _dummy = new THREE.Object3D();
const _targetCamPos = new THREE.Vector3();
const _targetCtrl = new THREE.Vector3();
const _color = new THREE.Color();

function detectSoftwareWebGL(): boolean {
  try {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

interface NodeVisualEntry {
  member: FamilyMember;
  group: THREE.Group;
  collider: THREE.Mesh;
  haloMesh: THREE.Mesh;
  bezelMat: THREE.MeshStandardMaterial;
  basePos: THREE.Vector3;
  baseScale: number;
  seedPhase: number;
}

interface LeafInstanceMeta {
  basePos: THREE.Vector3;
  baseRot: THREE.Euler;
  baseScale: number;
  phase: number;
}

export function FamilyTree3D({
  members,
  branches,
  searchMatches,
  focusMemberId,
  onFocusMember,
  onSelectMember,
  heightClassName = 'h-[580px] sm:h-[640px]',
}: FamilyTree3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [layoutMode, setLayoutMode] = useState<Tree3DLayoutMode>('canopy');
  const [autoRotate, setAutoRotate] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  const layout = useMemo(() => computeTree3DLayout(members, layoutMode), [members, layoutMode]);
  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  // Mutable refs so callbacks & animation loop never trigger WebGL teardown
  const callbacksRef = useRef({ onFocusMember, onSelectMember });
  callbacksRef.current = { onFocusMember, onSelectMember };

  const stateRef = useRef({
    focusMemberId,
    hoveredId: null as string | null,
    searchMatches,
    autoRotate,
  });
  stateRef.current.focusMemberId = focusMemberId;
  stateRef.current.searchMatches = searchMatches;
  stateRef.current.autoRotate = autoRotate;

  const cameraGoalRef = useRef<{
    active: boolean;
    camPos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    camPos: new THREE.Vector3(0, 7.5, 17.5),
    target: new THREE.Vector3(0, 4.2, 0),
  });

  const sceneRefs = useRef<{
    renderer: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    controls: OrbitControls | null;
    treeGroup: THREE.Group | null;
    nodeEntries: Map<string, NodeVisualEntry>;
    edgeMatMap: Map<
      string,
      { childId: string; parentIds: string[]; material: THREE.MeshStandardMaterial }
    >;
    leafMesh: THREE.InstancedMesh | null;
    leafMeta: LeafInstanceMeta[];
    moteMesh: THREE.InstancedMesh | null;
    moteSeeds: { x: number; y: number; z: number; speed: number; phase: number }[];
    disposables: {
      geometries: THREE.BufferGeometry[];
      materials: THREE.Material[];
      textures: THREE.Texture[];
    };
    isSoftwareGl: boolean;
  }>({
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    treeGroup: null,
    nodeEntries: new Map(),
    edgeMatMap: new Map(),
    leafMesh: null,
    leafMeta: [],
    moteMesh: null,
    moteSeeds: [],
    disposables: { geometries: [], materials: [], textures: [] },
    isSoftwareGl: false,
  });

  // Keyboard shortcut 'H' to toggle dock (Zen mode)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Initialize Three.js WebGLRenderer, Scene, Lighting & Animation Loop ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    sceneRefs.current.isSoftwareGl = isSoftwareGl;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('3D WebGL context could not be initialized in this browser.');
      return;
    }

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 360);

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050e24);
    scene.fog = new THREE.FogExp2(0x050e24, 0.0155);

    // Studio Environment Reflection (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 140);
    camera.position.set(0, 7.6, 17.8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 4.2;
    controls.maxDistance = 42;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 4.2, 0);
    controls.update();

    // Cancel scripted camera fly-to if user drags/zooms manually
    const onControlStart = () => {
      cameraGoalRef.current.active = false;
    };
    controls.addEventListener('start', onControlStart);

    // 3-Point Warm/Cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x88ccff, 0x050e24, 0.9);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.25);
    keyLight.position.set(11, 20, 14);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 55;
    keyLight.shadow.camera.left = -16;
    keyLight.shadow.camera.right = 16;
    keyLight.shadow.camera.top = 18;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.35);
    rimLight.position.set(-12, 14, -14);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0x60a5fa, 1.4, 38, 1.6);
    fillLight.position.set(0, 6.5, 6);
    scene.add(fillLight);

    // Ground Courtyard Sanctuary + Contact Shadow Plane
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const floorTex = createSanctuaryFloorTexture(maxAniso);
    const shadowTex = createContactShadowTexture();

    const floorBaseGeo = new THREE.CylinderGeometry(24, 24.4, 0.2, 64);
    const floorBaseMat = new THREE.MeshStandardMaterial({
      color: 0x071430,
      roughness: 0.72,
      metalness: 0.22,
    });
    const floorBaseMesh = new THREE.Mesh(floorBaseGeo, floorBaseMat);
    floorBaseMesh.position.y = -0.1;
    floorBaseMesh.receiveShadow = !isSoftwareGl;
    scene.add(floorBaseMesh);

    const floorMedallionGeo = new THREE.CircleGeometry(18.5, 64);
    floorMedallionGeo.rotateX(-Math.PI / 2);
    const floorMedallionMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.48,
      metalness: 0.18,
    });
    const floorMedallionMesh = new THREE.Mesh(floorMedallionGeo, floorMedallionMat);
    floorMedallionMesh.position.y = 0.02;
    floorMedallionMesh.receiveShadow = !isSoftwareGl;
    scene.add(floorMedallionMesh);

    const contactShadowGeo = new THREE.PlaneGeometry(7.2, 7.2);
    contactShadowGeo.rotateX(-Math.PI / 2);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    });
    const contactShadowMesh = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadowMesh.position.y = 0.04;
    scene.add(contactShadowMesh);

    // Floating Heritage Golden Dust Motes (InstancedMesh)
    const moteCount = 56;
    const moteGeo = new THREE.OctahedronGeometry(0.055, 0);
    const moteMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.4,
      roughness: 0.2,
      metalness: 0.8,
    });
    const moteMesh = new THREE.InstancedMesh(moteGeo, moteMat, moteCount);
    moteMesh.frustumCulled = false;
    const moteSeeds: { x: number; y: number; z: number; speed: number; phase: number }[] = [];
    for (let i = 0; i < moteCount; i++) {
      const r = 1.5 + Math.random() * 11.5;
      const a = Math.random() * Math.PI * 2;
      moteSeeds.push({
        x: Math.cos(a) * r,
        y: 0.6 + Math.random() * 11.5,
        z: Math.sin(a) * r,
        speed: 0.25 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
      });
    }
    scene.add(moteMesh);

    // Dedicated group for dynamic tree geometry & nodes
    const treeGroup = new THREE.Group();
    scene.add(treeGroup);

    sceneRefs.current.renderer = renderer;
    sceneRefs.current.scene = scene;
    sceneRefs.current.camera = camera;
    sceneRefs.current.controls = controls;
    sceneRefs.current.treeGroup = treeGroup;
    sceneRefs.current.moteMesh = moteMesh;
    sceneRefs.current.moteSeeds = moteSeeds;

    // Pre-warm shaders on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Interaction: Raycaster on layer 1
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverCheck = 0;

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const pickMemberId = (clientX: number, clientY: number): string | null => {
      updatePointer(clientX, clientY);
      raycaster.setFromCamera(pointer, camera);
      const colliders: THREE.Object3D[] = [];
      sceneRefs.current.nodeEntries.forEach((entry) => colliders.push(entry.collider));
      if (colliders.length === 0) return null;
      const hits = raycaster.intersectObjects(colliders, false);
      if (hits.length > 0) {
        return String(hits[0].object.userData.memberId || '') || null;
      }
      return null;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 40) return;
      lastHoverCheck = now;
      const hitId = pickMemberId(e.clientX, e.clientY);
      if (hitId !== stateRef.current.hoveredId) {
        stateRef.current.hoveredId = hitId;
        setHoveredId(hitId);
        renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (Math.hypot(dx, dy) > 6) return; // Dragged orbit, ignore click

      const hitId = pickMemberId(e.clientX, e.clientY);
      if (hitId) {
        const entry = sceneRefs.current.nodeEntries.get(hitId);
        callbacksRef.current.onFocusMember(hitId);
        if (entry) {
          // Glide camera toward the selected medallion while keeping tree orientation
          const offsetDir = _targetCamPos
            .copy(camera.position)
            .sub(controls.target)
            .normalize();
          const idealDist = Math.min(Math.max(camera.position.distanceTo(controls.target), 6.2), 10.5);
          cameraGoalRef.current.target.copy(entry.basePos);
          cameraGoalRef.current.camPos
            .copy(entry.basePos)
            .addScaledVector(offsetDir, idealDist);
          cameraGoalRef.current.camPos.y = Math.max(cameraGoalRef.current.camPos.y, 2.2);
          cameraGoalRef.current.active = true;
        }
      }
    };

    const handleDoubleClick = (e: MouseEvent) => {
      const hitId = pickMemberId(e.clientX, e.clientY);
      if (hitId) {
        const entry = sceneRefs.current.nodeEntries.get(hitId);
        if (entry) {
          callbacksRef.current.onSelectMember(entry.member);
        }
      }
    };

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('dblclick', handleDoubleClick);

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 320);
      const h = Math.max(container.clientHeight, 360);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Paced Animation Loop (Software-WebGL safe via afterDraw)
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Smooth damped camera preset / focus fly-to
      if (cameraGoalRef.current.active) {
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          cameraGoalRef.current.camPos.x,
          5.2,
          delta
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          cameraGoalRef.current.camPos.y,
          5.2,
          delta
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          cameraGoalRef.current.camPos.z,
          5.2,
          delta
        );
        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          cameraGoalRef.current.target.x,
          5.8,
          delta
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          cameraGoalRef.current.target.y,
          5.8,
          delta
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          cameraGoalRef.current.target.z,
          5.8,
          delta
        );
        if (
          camera.position.distanceTo(cameraGoalRef.current.camPos) < 0.04 &&
          controls.target.distanceTo(cameraGoalRef.current.target) < 0.04
        ) {
          cameraGoalRef.current.active = false;
        }
      }

      controls.autoRotate = !isSoftwareGl && stateRef.current.autoRotate;
      controls.autoRotateSpeed = 0.85;
      controls.update();

      // Gentle float & highlight reaction on member medallions
      const focused = stateRef.current.focusMemberId;
      const hovered = stateRef.current.hoveredId;
      const matches = stateRef.current.searchMatches;

      sceneRefs.current.nodeEntries.forEach((entry, id) => {
        const isFocused = focused === id;
        const isHovered = hovered === id;
        const isMatch = matches.has(id);

        const floatY = Math.sin(elapsed * 1.4 + entry.seedPhase) * 0.045;
        const targetY = entry.basePos.y + floatY + (isHovered || isFocused ? 0.12 : 0);
        entry.group.position.y = THREE.MathUtils.damp(entry.group.position.y, targetY, 6, delta);

        const targetScale =
          entry.baseScale * (isFocused ? 1.15 : isHovered ? 1.1 : isMatch ? 1.12 : 1.0);
        const s = THREE.MathUtils.damp(entry.group.scale.x, targetScale, 8, delta);
        entry.group.scale.setScalar(s);

        const haloMat = entry.haloMesh.material as THREE.MeshBasicMaterial;
        if (isFocused || isMatch) {
          haloMat.color.setHex(0xfde68a);
          haloMat.opacity = 0.92;
        } else if (isHovered) {
          haloMat.color.setHex(0x7dd3fc);
          haloMat.opacity = 0.82;
        } else {
          haloMat.opacity = 0.0;
        }
      });

      // Highlight lineage boughs connected to focused member
      sceneRefs.current.edgeMatMap.forEach((edgeInfo) => {
        const active =
          Boolean(focused) &&
          (edgeInfo.childId === focused || edgeInfo.parentIds.includes(focused!));
        edgeInfo.material.emissiveIntensity = THREE.MathUtils.damp(
          edgeInfo.material.emissiveIntensity,
          active ? 1.25 : 0.25,
          6,
          delta
        );
      });

      // Subtle canopy leaf breeze
      const leafMesh = sceneRefs.current.leafMesh;
      if (leafMesh && sceneRefs.current.leafMeta.length > 0) {
        const meta = sceneRefs.current.leafMeta;
        for (let i = 0; i < meta.length; i++) {
          const m = meta[i];
          _dummy.position.copy(m.basePos);
          _dummy.position.y += Math.sin(elapsed * 1.1 + m.phase) * 0.04;
          _dummy.rotation.set(
            m.baseRot.x + Math.sin(elapsed * 0.9 + m.phase) * 0.08,
            m.baseRot.y + Math.cos(elapsed * 0.7 + m.phase) * 0.08,
            m.baseRot.z
          );
          _dummy.scale.setScalar(m.baseScale);
          _dummy.updateMatrix();
          leafMesh.setMatrixAt(i, _dummy.matrix);
        }
        leafMesh.instanceMatrix.needsUpdate = true;
      }

      // Floating heritage motes
      if (moteMesh) {
        for (let i = 0; i < moteSeeds.length; i++) {
          const seed = moteSeeds[i];
          const yCycle = ((seed.y + elapsed * seed.speed) % 13) + 0.3;
          _dummy.position.set(
            seed.x + Math.sin(elapsed * 0.55 + seed.phase) * 0.35,
            yCycle,
            seed.z + Math.cos(elapsed * 0.45 + seed.phase) * 0.35
          );
          const pulseScale = 0.75 + 0.35 * Math.sin(elapsed * 2 + seed.phase);
          _dummy.rotation.set(elapsed * 0.6 + seed.phase, elapsed * 0.8, 0);
          _dummy.scale.setScalar(pulseScale);
          _dummy.updateMatrix();
          moteMesh.setMatrixAt(i, _dummy.matrix);
        }
        moteMesh.instanceMatrix.needsUpdate = true;
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      renderer.render(scene, camera);
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('dblclick', handleDoubleClick);

      // Dispose dynamic tree assets
      sceneRefs.current.disposables.geometries.forEach((g) => g.dispose());
      sceneRefs.current.disposables.materials.forEach((m) => m.dispose());
      sceneRefs.current.disposables.textures.forEach((t) => t.dispose());

      floorBaseGeo.dispose();
      floorBaseMat.dispose();
      floorMedallionGeo.dispose();
      floorMedallionMat.dispose();
      contactShadowGeo.dispose();
      contactShadowMat.dispose();
      moteGeo.dispose();
      moteMat.dispose();
      floorTex.dispose();
      shadowTex.dispose();
      envTex.dispose();

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Rebuild 3D Heritage Tree Geometry & Portrait Medallions whenever members or layoutMode change
  useEffect(() => {
    const { renderer, treeGroup, isSoftwareGl } = sceneRefs.current;
    if (!renderer || !treeGroup) return;

    // Clear and dispose previous tree build
    while (treeGroup.children.length > 0) {
      treeGroup.remove(treeGroup.children[0]);
    }
    sceneRefs.current.disposables.geometries.forEach((g) => g.dispose());
    sceneRefs.current.disposables.materials.forEach((m) => m.dispose());
    sceneRefs.current.disposables.textures.forEach((t) => t.dispose());
    sceneRefs.current.disposables = { geometries: [], materials: [], textures: [] };
    sceneRefs.current.nodeEntries.clear();
    sceneRefs.current.edgeMatMap.clear();
    sceneRefs.current.leafMesh = null;
    sceneRefs.current.leafMeta = [];

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      sceneRefs.current.disposables.geometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      sceneRefs.current.disposables.materials.push(m);
      return m;
    };
    const trackTex = <T extends THREE.Texture>(t: T): T => {
      sceneRefs.current.disposables.textures.push(t);
      return t;
    };

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const barkTex = trackTex(createWoodBronzeBarkTexture(maxAniso));

    const barkMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: barkTex,
        color: 0x8b6240,
        roughness: 0.78,
        metalness: 0.14,
      })
    );
    const goldMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xf5c56b,
        roughness: 0.18,
        metalness: 0.9,
        clearcoat: 0.6,
      })
    );
    const sapphirePlinthMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0e295e,
        roughness: 0.42,
        metalness: 0.48,
      })
    );
    const crownGemMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        roughness: 0.12,
        metalness: 0.15,
        clearcoat: 1.0,
      })
    );

    // 1. Grounded Ancestral Stone & Brass Plinth (LatheGeometry, pivot at bottom-center y=0)
    const plinthPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(2.35, 0),
      new THREE.Vector2(2.25, 0.2),
      new THREE.Vector2(1.78, 0.26),
      new THREE.Vector2(1.66, 0.48),
      new THREE.Vector2(1.18, 0.56),
      new THREE.Vector2(1.06, 0.72),
      new THREE.Vector2(0, 0.72),
    ];
    const plinthGeo = trackGeo(new THREE.LatheGeometry(plinthPoints, 48));
    const plinthMesh = new THREE.Mesh(plinthGeo, sapphirePlinthMat);
    plinthMesh.castShadow = !isSoftwareGl;
    plinthMesh.receiveShadow = !isSoftwareGl;
    treeGroup.add(plinthMesh);

    const plinthRingGeo = trackGeo(new THREE.TorusGeometry(1.72, 0.045, 16, 48));
    plinthRingGeo.rotateX(Math.PI / 2);
    const plinthRing = new THREE.Mesh(plinthRingGeo, goldMat);
    plinthRing.position.y = 0.49;
    treeGroup.add(plinthRing);

    // 2. Sculpted Central Heartwood Trunk (LatheGeometry rising from plinth y=0.68 -> y=3.1)
    const trunkPoints = [
      new THREE.Vector2(0.88, 0.68),
      new THREE.Vector2(0.58, 1.05),
      new THREE.Vector2(0.44, 1.58),
      new THREE.Vector2(0.38, 2.25),
      new THREE.Vector2(0.46, 2.78),
      new THREE.Vector2(0.22, 3.08),
      new THREE.Vector2(0, 3.16),
    ];
    const trunkGeo = trackGeo(new THREE.LatheGeometry(trunkPoints, 28));
    const trunkMesh = new THREE.Mesh(trunkGeo, barkMat);
    trunkMesh.castShadow = !isSoftwareGl;
    trunkMesh.receiveShadow = !isSoftwareGl;
    treeGroup.add(trunkMesh);

    // 6 Splayed Ancestral Root Buttresses gripping the plinth
    for (let r = 0; r < 6; r++) {
      const a = (r / 6) * Math.PI * 2 + 0.22;
      const rootCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 0.42, 1.35, Math.sin(a) * 0.42),
        new THREE.Vector3(Math.cos(a) * 0.92, 0.72, Math.sin(a) * 0.92),
        new THREE.Vector3(Math.cos(a) * 1.54, 0.28, Math.sin(a) * 1.54),
      ]);
      const rootGeo = trackGeo(new THREE.TubeGeometry(rootCurve, 16, 0.11, 10, false));
      const rootMesh = new THREE.Mesh(rootGeo, barkMat);
      rootMesh.castShadow = !isSoftwareGl;
      treeGroup.add(rootMesh);
    }

    // Primary trunk forks feeding the Founding Generation
    layout.trunkBranches.forEach((tb) => {
      const curve = new THREE.CatmullRomCurve3(
        tb.points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
      );
      const geo = trackGeo(new THREE.TubeGeometry(curve, 22, tb.radiusEnd * 1.35, 10, false));
      const mesh = new THREE.Mesh(geo, barkMat);
      mesh.castShadow = !isSoftwareGl;
      treeGroup.add(mesh);
    });

    // 3. Parent -> Child Curved Sapling Boughs (Glowing Sapphire-Gold Conduits)
    layout.parentChildEdges.forEach((edge) => {
      const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(...edge.start),
        new THREE.Vector3(...edge.control1),
        new THREE.Vector3(...edge.control2),
        new THREE.Vector3(...edge.end)
      );
      const tubeGeo = trackGeo(new THREE.TubeGeometry(curve, 26, 0.052, 8, false));
      const edgeMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0ea5e9,
          emissiveIntensity: 0.25,
          roughness: 0.34,
          metalness: 0.55,
        })
      );
      const edgeMesh = new THREE.Mesh(tubeGeo, edgeMat);
      edgeMesh.castShadow = !isSoftwareGl;
      treeGroup.add(edgeMesh);
      sceneRefs.current.edgeMatMap.set(edge.key, {
        childId: edge.childId,
        parentIds: edge.parentIds,
        material: edgeMat,
      });
    });

    // 4. Spouse Union Bridges + Central Marriage Gem
    const unionGemGeo = trackGeo(new THREE.OctahedronGeometry(0.14, 0));
    layout.spouseEdges.forEach((sp) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(...sp.aPos),
        new THREE.Vector3(sp.mid[0], sp.mid[1] + 0.16, sp.mid[2]),
        new THREE.Vector3(...sp.bPos),
      ]);
      const tubeGeo = trackGeo(new THREE.TubeGeometry(curve, 20, 0.042, 8, false));
      const spMesh = new THREE.Mesh(tubeGeo, goldMat);
      treeGroup.add(spMesh);

      const gemMesh = new THREE.Mesh(unionGemGeo, goldMat);
      gemMesh.position.set(sp.mid[0], sp.mid[1] + 0.16, sp.mid[2]);
      treeGroup.add(gemMesh);
    });

    // 5. Shared Geometries for 5-Part Composite Member Portrait Medallions
    const backBodyGeo = trackGeo(new THREE.CylinderGeometry(0.95, 1.02, 0.14, 42));
    backBodyGeo.rotateX(Math.PI / 2);

    const rimTorusGeo = trackGeo(new THREE.TorusGeometry(0.95, 0.055, 14, 48));
    const faceDiscGeo = trackGeo(new THREE.CircleGeometry(0.9, 44));
    const finialStemGeo = trackGeo(new THREE.CylinderGeometry(0.032, 0.055, 0.22, 12));
    const finialGemGeo = trackGeo(new THREE.OctahedronGeometry(0.15, 0));
    const haloRingGeo = trackGeo(new THREE.TorusGeometry(1.13, 0.034, 12, 48));
    const proxyGeo = trackGeo(new THREE.CylinderGeometry(1.16, 1.16, 0.45, 16));
    proxyGeo.rotateX(Math.PI / 2);
    const proxyMat = trackMat(new THREE.MeshBasicMaterial({ visible: false }));

    const silverBezelMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        roughness: 0.26,
        metalness: 0.78,
      })
    );
    const deceasedBezelMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.38,
        metalness: 0.65,
      })
    );
    const plaqueBackMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x081736,
        roughness: 0.55,
        metalness: 0.42,
      })
    );

    layout.nodes.forEach((node, idx) => {
      const m = node.member;
      const group = new THREE.Group();
      group.position.set(node.position[0], node.position[1], node.position[2]);
      group.rotation.y = node.yaw;
      group.scale.setScalar(node.scale);

      const bezelMat = m.isFoundingAncestor
        ? goldMat
        : m.isDeceased
          ? deceasedBezelMat
          : silverBezelMat;

      // Part 1: Metallic Medallion Housing
      const bodyMesh = new THREE.Mesh(backBodyGeo, plaqueBackMat);
      bodyMesh.castShadow = !isSoftwareGl;
      group.add(bodyMesh);

      // Part 2: Metallic Bevel Rim Torus
      const rimMesh = new THREE.Mesh(rimTorusGeo, bezelMat);
      rimMesh.position.z = 0.055;
      group.add(rimMesh);

      // Part 3: Portrait + Nameplate Front Face Disc
      const faceTex = trackTex(
        createMemberMedallionTexture(m, maxAniso, () => {
          // CanvasTexture updated asynchronously when portrait image finishes loading
        })
      );
      const faceMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: faceTex,
          roughness: 0.35,
          metalness: 0.08,
        })
      );
      const faceMesh = new THREE.Mesh(faceDiscGeo, faceMat);
      faceMesh.position.z = 0.075;
      group.add(faceMesh);

      // Rear mirrored portrait emblem so 360-degree orbiting reads cleanly from behind too
      const backFaceMesh = new THREE.Mesh(faceDiscGeo, faceMat);
      backFaceMesh.position.z = -0.075;
      backFaceMesh.rotation.y = Math.PI;
      group.add(backFaceMesh);

      // Part 4: Top Crown Finial Stem & Gem
      const stemMesh = new THREE.Mesh(finialStemGeo, bezelMat);
      stemMesh.position.y = 1.07;
      group.add(stemMesh);

      const gemMesh = new THREE.Mesh(
        finialGemGeo,
        m.isFoundingAncestor ? goldMat : crownGemMat
      );
      gemMesh.position.y = 1.24;
      group.add(gemMesh);

      // Part 5: Selection / Search Highlight Halo
      const haloMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xfde68a,
          transparent: true,
          opacity: 0,
        })
      );
      const haloMesh = new THREE.Mesh(haloRingGeo, haloMat);
      haloMesh.position.z = 0.04;
      group.add(haloMesh);

      // Part 6: Invisible Simplified Raycasting Proxy on Layer 1
      const collider = new THREE.Mesh(proxyGeo, proxyMat);
      collider.layers.set(1);
      collider.userData.memberId = m.id;
      group.add(collider);

      treeGroup.add(group);
      sceneRefs.current.nodeEntries.set(m.id, {
        member: m,
        group,
        collider,
        haloMesh,
        bezelMat,
        basePos: new THREE.Vector3(...node.position),
        baseScale: node.scale,
        seedPhase: idx * 0.85,
      });
    });

    // 6. Instanced Canopy Heritage Leaves / Blossoms around every tree crown anchor
    const leafAnchors =
      layout.canopyAnchors.length > 0 ? layout.canopyAnchors : [[0, 4.5, 0] as [number, number, number]];
    const leavesPerAnchor = Math.max(8, Math.min(24, Math.floor(220 / leafAnchors.length)));
    const totalLeaves = leafAnchors.length * leavesPerAnchor;

    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, -0.14);
    leafShape.quadraticCurveTo(0.11, 0, 0, 0.22);
    leafShape.quadraticCurveTo(-0.11, 0, 0, -0.14);
    const leafGeo = trackGeo(
      new THREE.ExtrudeGeometry(leafShape, {
        depth: 0.02,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.008,
        bevelSegments: 2,
      })
    );
    const leafMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.36,
        metalness: 0.35,
      })
    );
    const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, totalLeaves);
    const leafMeta: LeafInstanceMeta[] = [];
    const paletteHexes = [0x38bdf8, 0x1d4ed8, 0x60a5fa, 0x7dd3fc, 0xf5c56b];

    let lIdx = 0;
    leafAnchors.forEach((anchor, aIdx) => {
      for (let k = 0; k < leavesPerAnchor; k++) {
        const theta = (k / leavesPerAnchor) * Math.PI * 2 + aIdx * 0.5;
        const spreadR = 1.05 + (k % 3) * 0.42;
        const pos = new THREE.Vector3(
          anchor[0] + Math.cos(theta) * spreadR,
          anchor[1] + 0.32 + ((k % 4) - 1.5) * 0.24,
          anchor[2] + Math.sin(theta) * spreadR * 0.85
        );
        const rot = new THREE.Euler(
          0.35 + (k % 3) * 0.25,
          theta + Math.PI * 0.5,
          ((k % 5) - 2) * 0.15
        );
        const scale = 0.72 + ((k + aIdx) % 4) * 0.14;

        _dummy.position.copy(pos);
        _dummy.rotation.copy(rot);
        _dummy.scale.setScalar(scale);
        _dummy.updateMatrix();
        leafMesh.setMatrixAt(lIdx, _dummy.matrix);

        _color.setHex(paletteHexes[(lIdx + aIdx) % paletteHexes.length]);
        leafMesh.setColorAt(lIdx, _color);

        leafMeta.push({ basePos: pos, baseRot: rot, baseScale: scale, phase: lIdx * 0.41 });
        lIdx++;
      }
    });
    leafMesh.instanceMatrix.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
    leafMesh.computeBoundingSphere();
    treeGroup.add(leafMesh);
    sceneRefs.current.leafMesh = leafMesh;
    sceneRefs.current.leafMeta = leafMeta;

    // Frame camera gently on layout update
    const idealDist = Math.max(12.5, layout.maxRadius * 1.65 + layout.maxY * 0.65);
    cameraGoalRef.current.target.set(layout.center[0], layout.center[1], layout.center[2]);
    cameraGoalRef.current.camPos.set(0, layout.center[1] + 2.8, idealDist);
    cameraGoalRef.current.active = true;
  }, [layout]);

  const applyCameraPreset = (preset: CameraPreset) => {
    if (preset === 'overview') {
      const dist = Math.max(12.5, layout.maxRadius * 1.65 + layout.maxY * 0.65);
      cameraGoalRef.current.target.set(layout.center[0], layout.center[1], layout.center[2]);
      cameraGoalRef.current.camPos.set(0, layout.center[1] + 2.8, dist);
      cameraGoalRef.current.active = true;
      onFocusMember(null);
    } else if (preset === 'roots') {
      cameraGoalRef.current.target.set(0, 2.5, 0);
      cameraGoalRef.current.camPos.set(0, 3.2, 8.6);
      cameraGoalRef.current.active = true;
    } else if (preset === 'crown') {
      cameraGoalRef.current.target.set(0, Math.max(3.5, layout.maxY * 0.65), 0);
      cameraGoalRef.current.camPos.set(0, layout.maxY + 7.5, Math.max(11, layout.maxRadius * 1.25));
      cameraGoalRef.current.active = true;
    }
  };

  const handleCaptureSnapshot = () => {
    const { renderer, scene, camera } = sceneRefs.current;
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'Family-Legacy-3D-Tree.png';
    a.click();
  };

  const activeInspectMember =
    (hoveredId && memberMap.get(hoveredId)) ||
    (focusMemberId && memberMap.get(focusMemberId)) ||
    null;

  const activeBranchName =
    activeInspectMember?.branchId ? branchMap.get(activeInspectMember.branchId)?.name : null;

  const generationCount = useMemo(
    () => new Set(members.map((m) => m.generation || 1)).size,
    [members]
  );

  if (webglError) {
    return (
      <div className="rounded-2xl border border-sky-300/25 bg-[#050F26] p-10 text-center">
        <p className="font-serif text-xl text-white">3D View Unavailable</p>
        <p className="text-sm text-slate-300 mt-2">{webglError}</p>
        <p className="text-xs text-sky-300 mt-2">
          Switch to the 2D Chart tab above to view your complete interactive family tree.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full ${heightClassName} rounded-2xl border border-sky-300/25 bg-[#050E24] overflow-hidden select-none`}
    >
      {/* Dedicated WebGL Canvas Mount Outside HUD Overlays */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Top-Left Minimal Title / Inspected Member Readout (solid rgba, zero backdrop-filter) */}
      <div className="absolute top-3.5 left-3.5 right-3.5 sm:right-auto sm:max-w-sm pointer-events-none">
        <div className="pointer-events-auto rounded-xl border border-sky-300/30 bg-[#050F26]/92 px-3.5 py-2.5 shadow-xl">
          {activeInspectMember ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg overflow-hidden border border-sky-300/35 bg-[#081736] shrink-0 flex items-center justify-center">
                  {activeInspectMember.photoUrl ? (
                    <img
                      src={activeInspectMember.photoUrl}
                      alt={activeInspectMember.fullName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserIcon className="w-4 h-4 text-sky-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {activeInspectMember.fullName}
                  </p>
                  <p className="text-[11px] text-sky-200/85 truncate">
                    Gen {activeInspectMember.generation} ·{' '}
                    {activeInspectMember.relationshipLabel ||
                      activeBranchName ||
                      'Family Member'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectMember(activeInspectMember)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-300 hover:bg-sky-200 text-sky-950 font-semibold text-[11px] shrink-0 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Profile</span>
              </button>
            </div>
          ) : (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-amber-200 font-semibold">
                3D Heritage Tree · {members.length} {members.length === 1 ? 'Member' : 'Members'} ·{' '}
                {generationCount} {generationCount === 1 ? 'Generation' : 'Generations'}
              </p>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Drag to orbit · Scroll to zoom · Click a medallion to inspect · Double-click for profile
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Bottom Control Dock (Zero Mid-Screen Occlusion) */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 bottom-3.5 z-20 flex flex-col items-center transition-transform duration-300 max-w-[95vw] ${
          dockCollapsed ? 'translate-y-[calc(100%-30px)]' : 'translate-y-0'
        }`}
      >
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-t-lg border border-b-0 border-sky-300/30 bg-[#050F26]/95 text-[11px] font-medium text-sky-200 hover:text-white cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Show 3D Controls (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Hide Controls (H)</span>
            </>
          )}
        </button>

        <div className="rounded-xl border border-sky-300/30 bg-[#050F26]/95 px-2.5 py-2 shadow-2xl flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          {/* Camera Presets */}
          <div className="flex items-center gap-1 pr-2 border-r border-sky-300/20">
            <button
              type="button"
              onClick={() => applyCameraPreset('overview')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0C214A] hover:bg-sky-300 hover:text-sky-950 text-sky-100 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Full Tree</span>
            </button>
            <button
              type="button"
              onClick={() => applyCameraPreset('roots')}
              className="px-2.5 py-1.5 rounded-lg bg-[#0C214A] hover:bg-sky-300 hover:text-sky-950 text-sky-100 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              Founding Roots
            </button>
            <button
              type="button"
              onClick={() => applyCameraPreset('crown')}
              className="px-2.5 py-1.5 rounded-lg bg-[#0C214A] hover:bg-sky-300 hover:text-sky-950 text-sky-100 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              Aerial Crown
            </button>
          </div>

          {/* 3D Structure Mode */}
          <div className="flex items-center gap-1 pr-2 border-r border-sky-300/20">
            <button
              type="button"
              onClick={() => setLayoutMode('canopy')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                layoutMode === 'canopy'
                  ? 'bg-sky-300 text-sky-950 font-semibold'
                  : 'bg-[#0C214A] text-slate-200 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Canopy Arc</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('spiral')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                layoutMode === 'spiral'
                  ? 'bg-sky-300 text-sky-950 font-semibold'
                  : 'bg-[#0C214A] text-slate-200 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>360° Spiral</span>
            </button>
          </div>

          {/* Orbit & Snapshot */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAutoRotate((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                autoRotate
                  ? 'bg-amber-300 text-sky-950 font-semibold'
                  : 'bg-[#0C214A] text-slate-200 hover:text-white'
              }`}
            >
              <Orbit className="w-3.5 h-3.5" />
              <span>Auto-Orbit</span>
            </button>
            <button
              type="button"
              onClick={handleCaptureSnapshot}
              title="Save 3D tree snapshot as PNG"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0C214A] hover:bg-sky-800 text-sky-100 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Snapshot</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

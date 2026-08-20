/**
 * RechargeStructureScene.jsx — real WebGL 3D preview of the recharge
 * structure returned by the backend design engine. Replaces the fake flat
 * SVG "3D" in the old `RwhVisualization3D.jsx`.
 *
 * 1 Three.js world unit = 1 metre. Every mesh's dimensions come directly
 * from `result.pit` / `result.trench` / `result.injection_borewell` /
 * `result.filter_media` / `result.groundwater_depth_m` — nothing is
 * hand-modeled. This is the single component `DesignResults.jsx` mounts;
 * it internally composes `FilterStackLayers`, `ExplodeControls`,
 * `CutSectionPlane`, `WireframeToggle` and `SceneToolbar` so the parent
 * doesn't need to orchestrate five separate pieces.
 */
import { useMemo, useRef, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { AlertTriangle, Box } from "lucide-react";
import EmptyState from "../ui/EmptyState.jsx";
import FilterStackLayers from "./FilterStackLayers.jsx";
import WireframeToggle from "./WireframeToggle.jsx";
import { useCutPlane, setCutOffset, CutSectionPlaneVisual } from "./CutSectionPlane.jsx";
import SceneToolbar from "./SceneToolbar.jsx";
import { useUiStore } from "../../store/uiStore.js";
import { resolveMaterialKey } from "../../lib/materialPatterns.jsx";
import { tokenColorHex, tokenColorCss } from "../../lib/threeColorTokens.js";

const n = (v, d = 2) => (v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toFixed(d));

/**
 * Resolves the backend response into a plain-metres structure descriptor.
 * Backend `structure_type` is always exactly "recharge_pit" or
 * "recharge_trench" (confirmed against `backend/app/schemas/design.py` and
 * `backend/app/services/rwh_design_engine.py` in Phase 4) — falls back to
 * whichever of `pit`/`trench` is populated if that ever drifts.
 */
function deriveDims(result) {
  if (!result) return null;
  const { pit, trench } = result;

  if ((result.structure_type === "recharge_pit" || !trench) && pit) {
    return {
      kind: "pit",
      diameterM: pit.diameter_m,
      depthM: pit.depth_m,
      freeboardM: pit.freeboard_m ?? 0,
      pitCount: pit.pit_count ?? 1,
      label: `Recharge Pit${pit.pit_count > 1 ? ` × ${pit.pit_count}` : ""} — Ø${n(pit.diameter_m)}m × ${n(pit.depth_m)}m`,
    };
  }
  if (trench) {
    return {
      kind: "trench",
      widthM: trench.width_m,
      depthM: trench.depth_m,
      freeboardM: 0,
      totalLengthM: trench.total_length_m,
      segmentLengthM: trench.segment_length_m,
      segmentCount: trench.segment_count ?? 1,
      label: `Recharge Trench — ${n(trench.width_m)}m W × ${n(trench.total_length_m, 1)}m L × ${n(trench.depth_m)}m D`,
    };
  }
  return null;
}

function framing(dims) {
  if (!dims) return { horizontal: 3, vertical: 2 };
  if (dims.kind === "pit") {
    return { horizontal: dims.diameterM, vertical: dims.depthM + dims.freeboardM };
  }
  return { horizontal: Math.max(dims.widthM, dims.totalLengthM || dims.widthM), vertical: dims.depthM };
}

export default function RechargeStructureScene({ result }) {
  const theme = useUiStore((s) => s.theme);
  const isDark = theme !== "light";

  const dims = useMemo(() => deriveDims(result), [result]);
  const filterMedia = result?.filter_media || [];
  const groundwaterDepthM = result?.groundwater_depth_m;
  const borewell = result?.injection_borewell;

  const { horizontal, vertical } = framing(dims);
  const groundExtent = Math.max(horizontal * 4.5, 6);
  const stackTotalHeight = (dims?.freeboardM || 0) + (dims?.depthM || 0);
  const boreDepthM = borewell?.conceptual_depth_m ?? null;

  const camDist = Math.max(horizontal, vertical) * 2.3 + 2;
  const camTarget = useMemo(() => new THREE.Vector3(0, -stackTotalHeight / 2, 0), [stackTotalHeight]);
  const camInitialPos = useMemo(
    () => new THREE.Vector3(camDist * 0.85, camDist * 0.55 + stackTotalHeight * 0.15, camDist * 0.95),
    [camDist, stackTotalHeight]
  );

  const controlsRef = useRef(null);
  const rendererRef = useRef(null);

  const [explodeOn, setExplodeOn] = useState(false);
  const [wireframeOn, setWireframeOn] = useState(false);
  const [cutOn, setCutOn] = useState(false);
  const cutHalfRange = Math.max(horizontal / 2, 0.5);
  const [cutValue, setCutValue] = useState(0);
  const [snapshotUrl, setSnapshotUrl] = useState(null);

  const clipPlane = useCutPlane([1, 0, 0]);
  setCutOffset(clipPlane, cutValue);

  const handleResetCamera = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.object.position.copy(camInitialPos);
    controls.target.copy(camTarget);
    controls.update();
  }, [camInitialPos, camTarget]);

  const zoom = useCallback((factor) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const camera = controls.object;
    const target = controls.target;
    const dir = camera.position.clone().sub(target).multiplyScalar(factor);
    camera.position.copy(target.clone().add(dir));
    controls.update();
  }, []);

  const handleSnapshot = useCallback(() => {
    const gl = rendererRef.current;
    if (!gl) return;
    try {
      const url = gl.domElement.toDataURL("image/png");
      setSnapshotUrl(url);
    } catch {
      // Snapshot can fail if the WebGL context was lost; nothing to do but skip it.
    }
  }, []);

  if (!result || !dims) {
    return (
      <EmptyState
        icon={<Box size={18} />}
        title="No 3D geometry available"
        description="This design has no pit or trench dimensions to render."
        className="h-64"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <Box size={15} className="text-accent" /> Interactive 3D Structure Model
          </h3>
          <p className="text-[11px] text-slate-400">
            Real WebGL scene, scaled 1:1 to the computed design — {dims.label}
          </p>
        </div>
        {borewell && (
          <span className="flex items-center gap-1.5 rounded-md border border-info/30 bg-info/10 px-2.5 py-1 text-[10px] text-info">
            <AlertTriangle size={11} className="shrink-0" />
            Includes conceptual injection borewell casing (Ø150mm × {n(boreDepthM, 1)}m)
          </span>
        )}
      </div>

      <div className="relative h-[460px] w-full overflow-hidden rounded-lg border border-slate-800 bg-[#050b14]">
        <Canvas
          shadows={false}
          gl={{ antialias: true, preserveDrawingBuffer: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.localClippingEnabled = true;
            gl.setClearColor(isDark ? 0x050b14 : 0xeef2f7, 1);
            rendererRef.current = gl;
          }}
          camera={{ position: camInitialPos.toArray(), fov: 42, near: 0.05, far: Math.max(200, camDist * 6) }}
        >
          <hemisphereLight args={[isDark ? 0x33475f : 0xffffff, isDark ? 0x0a0f18 : 0x5b4632, 0.65]} />
          <ambientLight intensity={isDark ? 0.35 : 0.55} />
          <directionalLight position={[horizontal * 2, horizontal * 3 + 4, horizontal * 1.5]} intensity={1.1} />
          <directionalLight position={[-horizontal * 2, horizontal * 1.5, -horizontal * 1.5]} intensity={0.35} />

          <gridHelper
            args={[groundExtent, Math.min(24, Math.max(8, Math.round(groundExtent))), 0x64748b, 0x1e293b]}
            position={[0, 0.005, 0]}
          />

          {/* Ground surface plane */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[groundExtent, groundExtent]} />
            <meshStandardMaterial color={tokenColorHex("topsoil", isDark)} roughness={1} metalness={0} />
          </mesh>

          {/* Structure excavation envelope (freeboard void + full depth), translucent */}
          <StructureEnvelope dims={dims} isDark={isDark} />

          {/* Filter media stack */}
          <FilterStackLayers
            dims={dims}
            filterMedia={filterMedia}
            explodeTarget={explodeOn}
            clipPlane={clipPlane}
            cutEnabled={cutOn}
            isDark={isDark}
          />

          {/* Deep injection borewell casing, if this design has one */}
          {borewell && boreDepthM > 0 && (
            <mesh position={[0, -boreDepthM / 2, 0]}>
              <cylinderGeometry args={[0.075, 0.075, boreDepthM, 20]} />
              <meshStandardMaterial color={tokenColorHex("info", isDark)} roughness={0.4} metalness={0.15} transparent opacity={0.85} />
            </mesh>
          )}

          {/* Water table plane */}
          {groundwaterDepthM != null && groundwaterDepthM > 0 && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -groundwaterDepthM, 0]}>
              <planeGeometry args={[groundExtent, groundExtent]} />
              <meshStandardMaterial
                color={tokenColorHex("groundwater", isDark)}
                roughness={0.15}
                metalness={0.05}
                transparent
                opacity={0.32}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}

          <CutSectionPlaneVisual plane={clipPlane} size={Math.max(groundExtent * 0.4, 3)} active={cutOn} />

          <WireframeToggle enabled={wireframeOn} />

          <OrbitControls
            ref={controlsRef}
            makeDefault
            target={camTarget.toArray()}
            enableDamping
            dampingFactor={0.08}
            minDistance={Math.max(horizontal, vertical) * 0.5}
            maxDistance={camDist * 3}
            maxPolarAngle={Math.PI * 0.49}
          />
        </Canvas>

        <SceneToolbar
          onResetCamera={handleResetCamera}
          onZoomIn={() => zoom(0.85)}
          onZoomOut={() => zoom(1.18)}
          explodeOn={explodeOn}
          onToggleExplode={() => setExplodeOn((v) => !v)}
          wireframeOn={wireframeOn}
          onToggleWireframe={() => setWireframeOn((v) => !v)}
          cutOn={cutOn}
          onToggleCut={() => setCutOn((v) => !v)}
          cutValue={cutValue}
          cutRange={[-cutHalfRange, cutHalfRange]}
          onCutChange={setCutValue}
          onSnapshot={handleSnapshot}
          snapshotUrl={snapshotUrl}
          onDismissSnapshot={() => setSnapshotUrl(null)}
        />

        <FilterLegend filterMedia={filterMedia} isDark={isDark} />

        <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-md border border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-[10px] text-slate-400">
          Drag to rotate · scroll to zoom · right-drag to pan
        </div>
      </div>
    </div>
  );
}

/** Translucent shell showing the excavation cavity (freeboard void + filter-stack depth). */
function StructureEnvelope({ dims, isDark }) {
  const totalHeight = (dims.freeboardM || 0) + (dims.depthM || 0);
  if (totalHeight <= 0) return null;
  const color = 0x8a8f98;

  if (dims.kind === "pit") {
    const r = dims.diameterM / 2 + 0.015;
    return (
      <mesh position={[0, -totalHeight / 2, 0]}>
        <cylinderGeometry args={[r, r, totalHeight, 48, 1, true]} />
        <meshStandardMaterial color={color} roughness={1} transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    );
  }

  const segCount = Math.max(1, dims.segmentCount || 1);
  const segLen = dims.segmentLengthM || dims.totalLengthM / segCount;
  const gap = Math.min(0.15, segLen * 0.06);
  const boxLen = Math.max(segLen - gap, 0.1);
  const totalLen = dims.totalLengthM || segLen * segCount;
  const startZ = -totalLen / 2;

  return (
    <group>
      {Array.from({ length: segCount }).map((_, i) => {
        const centerZ = startZ + segLen * i + segLen / 2;
        return (
          <mesh key={i} position={[0, -totalHeight / 2, centerZ]}>
            <boxGeometry args={[dims.widthM + 0.03, totalHeight, boxLen]} />
            <meshStandardMaterial color={color} roughness={1} transparent opacity={0.08} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function FilterLegend({ filterMedia, isDark }) {
  const ordered = [...(filterMedia || [])].sort((a, b) => a.layer_order - b.layer_order);
  if (ordered.length === 0) return null;
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-950/85 p-2.5 text-[10px] text-slate-300">
      <span className="mb-0.5 font-semibold uppercase tracking-wide text-slate-500">Filter stack</span>
      {ordered.map((l) => (
        <div key={l.layer_order} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: tokenColorCss(tokenForMaterial(l.material), isDark) }}
          />
          <span>
            {l.material} ({n(l.thickness_fraction * 100, 0)}%)
          </span>
        </div>
      ))}
    </div>
  );
}

function tokenForMaterial(materialName) {
  const key = resolveMaterialKey(materialName);
  const map = { sand: "sand", gravel: "gravel", aggregate: "aggregate", rock: "rock", clay: "clay", water: "rechargeWater", concrete: "ground" };
  return (key && map[key]) || "gravel";
}

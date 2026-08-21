/**
 * FilterStackLayers.jsx — one mesh per `result.filter_media[]` entry,
 * stacked inside the pit/trench cavity from the top of the filter media
 * (below any freeboard void) down to the structure's full depth.
 *
 * Layer height is proportional to `thickness_fraction * depthM`, ordered by
 * `layer_order` (1 = topmost, per the backend engine). Colors reuse the same
 * material -> color resolution as the 2D CAD drawings via
 * `materialColorHex()` (built on `resolveMaterialKey` from
 * `materialPatterns.jsx`), so a sand layer here is the same color as the
 * sand pattern fill in the 2D cross section.
 *
 * Materials are flat `meshStandardMaterial` (no textures) per the
 * flat-shaded/schematic guidance — no photoreal PBR.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useExplodeProgress } from "./ExplodeControls.jsx";
import { materialColorHex } from "../../lib/threeColorTokens.js";

const EXPLODE_GAP_M = 0.32;

export default function FilterStackLayers({ dims, filterMedia, explodeTarget, clipPlane, cutEnabled, isDark }) {
  const ordered = useMemo(
    () => [...(filterMedia || [])].filter((l) => l.thickness_fraction > 0).sort((a, b) => a.layer_order - b.layer_order),
    [filterMedia]
  );

  // Shared lerp progress for every layer in this stack, so they explode in
  // lockstep instead of each running its own independent easing curve.
  const progressRef = useExplodeProgress(explodeTarget);

  if (!dims || ordered.length === 0) return null;

  const freeboardM = dims.freeboardM || 0;
  const depthM = dims.depthM || 0;
  const mid = (ordered.length - 1) / 2;

  let cum = 0;
  const layers = ordered.map((layer, index) => {
    const y0 = freeboardM + cum * depthM;
    cum += layer.thickness_fraction;
    const y1 = freeboardM + cum * depthM;
    const thickness = Math.max(y1 - y0, 0.02);
    // World Y is negative going down (ground = 0), matching the rest of the scene.
    const baseCenterY = -(y0 + y1) / 2;
    // layer_order 1 (index 0) is topmost -> explodes upward (+Y); the
    // deepest layer explodes downward (-Y); the middle layer (odd count)
    // stays put.
    const dir = index < mid ? 1 : index > mid ? -1 : 0;
    const explodeDistance = dir * Math.abs(index - mid) * EXPLODE_GAP_M;
    return { layer, thickness, baseCenterY, explodeDistance };
  });

  return (
    <group>
      {layers.map((l) => (
        <FilterLayerMesh
          key={l.layer.layer_order}
          dims={dims}
          layer={l.layer}
          thickness={l.thickness}
          baseCenterY={l.baseCenterY}
          explodeDistance={l.explodeDistance}
          progressRef={progressRef}
          clipPlane={clipPlane}
          cutEnabled={cutEnabled}
          isDark={isDark}
        />
      ))}
    </group>
  );
}

function FilterLayerMesh({ dims, layer, thickness, baseCenterY, explodeDistance, progressRef, clipPlane, cutEnabled, isDark }) {
  const groupRef = useRef(null);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.y = baseCenterY + explodeDistance * progressRef.current;
  });

  const color = materialColorHex(layer.material, isDark);
  const clippingPlanes = cutEnabled && clipPlane ? [clipPlane] : undefined;

  return (
    <group ref={groupRef} position={[0, baseCenterY, 0]}>
      <mesh castShadow={false} receiveShadow={false}>
        {dims.kind === "pit" ? (
          <cylinderGeometry args={[dims.diameterM / 2, dims.diameterM / 2, thickness, 48]} />
        ) : dims.kind === "rect_pit" ? (
          <boxGeometry args={[dims.lengthM, thickness, dims.widthM]} />
        ) : (
          <boxGeometry args={[dims.widthM, thickness, dims.totalLengthM || dims.widthM]} />
        )}
        <meshStandardMaterial
          color={color}
          roughness={0.92}
          metalness={0.02}
          side={THREE.DoubleSide}
          clippingPlanes={clippingPlanes}
        />
      </mesh>
    </group>
  );
}

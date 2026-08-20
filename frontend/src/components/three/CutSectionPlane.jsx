/**
 * CutSectionPlane.jsx — Three.js clipping-plane cut-section support.
 *
 * `renderer.localClippingEnabled` must be set to `true` on the Canvas's `gl`
 * (done once in `RechargeStructureScene.jsx`). Every material that should be
 * sliced by the cut then references the SAME `THREE.Plane` instance in its
 * `clippingPlanes` array — moving the plane (mutating `.constant`) re-slices
 * every material at once without touching them individually.
 */
import { useMemo } from "react";
import * as THREE from "three";

/**
 * Creates (once) a stable `THREE.Plane` for cut-section clipping.
 * @param {[number,number,number]} normal - plane normal, world space.
 */
export function useCutPlane(normal = [1, 0, 0]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => new THREE.Plane(new THREE.Vector3(...normal), 0), []);
}

/** Moves a cut plane along its normal (three.js convention: normal·X + constant = 0). */
export function setCutOffset(plane, offsetM) {
  if (plane) plane.constant = offsetM;
}

/**
 * Thin translucent quad rendered at the current clip-plane position so the
 * user can see where the section cut is being taken, purely cosmetic (not
 * itself clipped).
 */
export function CutSectionPlaneVisual({ plane, size = 6, active, color = "#22d3ee" }) {
  // Hooks must run unconditionally on every render (Rules of Hooks) — `plane`
  // is a stable object from useCutPlane() so it's always safe to read from,
  // even on renders where the visual won't actually be shown.
  const n = plane ? plane.normal : null;
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    if (n) q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n.clone().normalize());
    return q;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n?.x, n?.y, n?.z]);

  if (!active || !plane) return null;

  const position = [-n.x * plane.constant, -n.y * plane.constant, -n.z * plane.constant];

  return (
    <mesh position={position} quaternion={quaternion}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial color={color} transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

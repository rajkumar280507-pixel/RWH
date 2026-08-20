/**
 * WireframeToggle.jsx — flips every mesh material in the scene between solid
 * and wireframe rendering.
 *
 * Rather than keeping a manual registry of materials, this traverses the
 * live r3f scene graph (`useThree().scene`) whenever `enabled` changes and
 * sets `material.wireframe` on every mesh it finds — the simplest robust
 * approach for a scene whose mesh set doesn't change after mount.
 *
 * Mount once inside <Canvas>, as a sibling of the scene content. Renders
 * nothing itself.
 */
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

export default function WireframeToggle({ enabled }) {
  const { scene } = useThree();

  useEffect(() => {
    scene.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((m) => {
        if (m && "wireframe" in m) m.wireframe = Boolean(enabled);
      });
    });
  }, [enabled, scene]);

  return null;
}

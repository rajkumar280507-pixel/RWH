/**
 * ExplodeControls.jsx — drives the "explode amount" animation for
 * `FilterStackLayers.jsx`.
 *
 * Framer Motion cannot animate Three.js object transforms (it only knows
 * how to tween DOM/SVG props), so the explode animation instead uses
 * react-three-fiber's `useFrame` per-frame hook with a manual lerp toward a
 * 0/1 target — this is the one piece of "animation" logic in the whole
 * scene and it deliberately does NOT use Framer Motion.
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * Smoothly interpolates a mutable ref toward `target` (falsy -> 0, truthy ->
 * 1) once per rendered frame. Must be called from a component rendered
 * inside `<Canvas>` (useFrame requires the r3f render loop).
 *
 * Returns a ref object — read `.current` from *another* useFrame callback
 * (see `FilterStackLayers.jsx`), not during React render, since the value is
 * mutated outside React's render cycle.
 */
export function useExplodeProgress(target, lerpSpeed = 4) {
  const progressRef = useRef(0);
  useFrame((_, delta) => {
    const t = target ? 1 : 0;
    const diff = t - progressRef.current;
    if (Math.abs(diff) > 0.0008) {
      progressRef.current += diff * Math.min(1, lerpSpeed * delta);
    } else {
      progressRef.current = t;
    }
  });
  return progressRef;
}

/**
 * Render-prop convenience wrapper around `useExplodeProgress` for callers
 * that would rather compose than call the hook directly.
 *
 *   <ExplodeControls target={explodeOn}>
 *     {(progressRef) => <FilterStackLayers explodeProgressRef={progressRef} ... />}
 *   </ExplodeControls>
 */
export default function ExplodeControls({ target, lerpSpeed = 4, children }) {
  const progressRef = useExplodeProgress(target, lerpSpeed);
  return typeof children === "function" ? children(progressRef) : children ?? null;
}

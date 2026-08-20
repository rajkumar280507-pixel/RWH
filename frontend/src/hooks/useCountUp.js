import { useEffect, useRef, useState } from "react";

/**
 * Animates a displayed number easing from its previous value to
 * `targetValue` whenever it changes, using requestAnimationFrame.
 *
 * Usage: const display = useCountUp(42.5, { duration: 800, decimals: 1 });
 *
 * Non-numeric input (NaN, undefined, null) is passed through as 0 so
 * callers that guard with `typeof value === "number"` before calling this
 * hook never see it throw.
 */
export function useCountUp(targetValue, { duration = 800, decimals = 0 } = {}) {
  const target = Number.isFinite(Number(targetValue)) ? Number(targetValue) : 0;
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = displayRef.current;
    if (from === target) return undefined;

    let start = null;
    const step = (timestamp) => {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(1, duration === 0 ? 1 : elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (target - from) * eased;
      displayRef.current = next;
      setDisplay(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  const rounded = Number(display.toFixed(decimals));
  return decimals > 0 ? rounded : Math.round(rounded);
}

export default useCountUp;

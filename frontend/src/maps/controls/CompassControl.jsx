import { Compass } from "lucide-react";

/**
 * Static north-arrow indicator. Leaflet does not support map rotation out of
 * the box, so this is a fixed visual reference only — it does not track or
 * imply any actual bearing/rotation of the map.
 */
export default function CompassControl({ className = "" }) {
  return (
    <div
      className={`glass-panel flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-800/70 shadow-lg dark:border-slate-800/70 ${className}`}
      title="North is up — this map does not rotate"
    >
      <Compass size={18} className="text-accent" strokeWidth={2.25} />
    </div>
  );
}

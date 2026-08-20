/**
 * SceneToolbar.jsx — floating 2D UI control bar overlaying the WebGL
 * `<Canvas>` (an absolutely positioned sibling, never inside the canvas).
 * Framer Motion is used here for the ordinary DOM entrance/hover animation
 * of this bar — it never touches Three.js objects, only this HTML overlay.
 */
import { motion } from "framer-motion";
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Layers,
  Box as BoxIcon,
  Scissors,
  Camera,
  Download,
  X,
} from "lucide-react";

export default function SceneToolbar({
  onResetCamera,
  onZoomIn,
  onZoomOut,
  explodeOn,
  onToggleExplode,
  wireframeOn,
  onToggleWireframe,
  cutOn,
  onToggleCut,
  cutValue,
  cutRange,
  onCutChange,
  onSnapshot,
  snapshotUrl,
  onDismissSnapshot,
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="glass-panel pointer-events-auto absolute left-3 top-3 z-10 flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 p-1"
      >
        <ToolBtn label="Reset view" onClick={onResetCamera}>
          <RotateCcw size={14} />
        </ToolBtn>
        <ToolBtn label="Zoom in" onClick={onZoomIn}>
          <ZoomIn size={14} />
        </ToolBtn>
        <ToolBtn label="Zoom out" onClick={onZoomOut}>
          <ZoomOut size={14} />
        </ToolBtn>
        <Divider />
        <ToolBtn label="Explode filter stack" active={explodeOn} onClick={onToggleExplode}>
          <Layers size={14} />
        </ToolBtn>
        <ToolBtn label="Wireframe" active={wireframeOn} onClick={onToggleWireframe}>
          <BoxIcon size={14} />
        </ToolBtn>
        <ToolBtn label="Cut section" active={cutOn} onClick={onToggleCut}>
          <Scissors size={14} />
        </ToolBtn>
        <Divider />
        <ToolBtn label="Snapshot" onClick={onSnapshot}>
          <Camera size={14} />
        </ToolBtn>
      </motion.div>

      {cutOn && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="glass-panel pointer-events-auto absolute left-3 top-14 z-10 flex w-56 flex-col gap-1 rounded-lg border border-slate-800 p-2.5"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Cut-section position
          </span>
          <input
            type="range"
            min={cutRange[0]}
            max={cutRange[1]}
            step={0.02}
            value={cutValue}
            onChange={(e) => onCutChange(Number(e.target.value))}
            className="accent-accent"
          />
          <span className="text-[10px] text-slate-500">{cutValue.toFixed(2)} m from center</span>
        </motion.div>
      )}

      {snapshotUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel pointer-events-auto absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-lg border border-slate-800 p-2"
        >
          <img src={snapshotUrl} alt="3D scene snapshot" className="h-16 w-24 rounded object-cover" />
          <div className="flex flex-col gap-1">
            <a
              href={snapshotUrl}
              download="rwh-3d-structure-snapshot.png"
              className="flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent hover:bg-accent/20"
            >
              <Download size={11} /> Save PNG
            </a>
            <button
              onClick={onDismissSnapshot}
              className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200"
            >
              <X size={11} /> Dismiss
            </button>
          </div>
        </motion.div>
      )}
    </>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-slate-800" />;
}

function ToolBtn({ label, onClick, active, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`flex items-center justify-center rounded-md p-2 text-slate-300 transition hover:bg-slate-800/70 hover:text-slate-100 ${
        active ? "bg-accent/20 text-accent" : ""
      }`}
    >
      {children}
    </button>
  );
}

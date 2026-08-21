import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MapPinned, PenSquare, RotateCcw, AlertTriangle } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout.jsx";
import DesignForm from "../components/DesignForm.jsx";
import DesignResults from "../components/DesignResults.jsx";
import QuantityTakeoffPanel from "../components/cad/QuantityTakeoffPanel.jsx";
import DrawRoofMap from "../maps/DrawRoofMap.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { getRoofMaterials, getSoilTypes, getLiveContext, createRwhDesign } from "../services/api.js";
import { polygonAreaSqm, polygonCentroid, squareFootprint, TN_CENTER } from "../lib/geo.js";

/**
 * Persistent two-column RWH design workspace: the left ~30% column captures
 * a rooftop catchment + design inputs via DesignForm (always visible, with
 * a live debounced dry-run quantity preview), the right ~70% column shows
 * either a friendly empty state (before the first submit) or the full
 * tabbed DesignResults for the returned RwhDesignResponse — POST
 * /rwh/design. This replaces the previous sequential form -> results step
 * wizard with both panels visible at once (see Phase D of the Pass-2
 * redesign plan); the backend engine remains the single source of truth
 * for both the numbers and the persisted design record.
 */
export default function RwhDesignPage() {
  const [result, setResult] = useState(null);
  const [roofMode, setRoofMode] = useState("map"); // "map" | "manual"
  const [polygon, setPolygon] = useState(null);
  const [manualAreaSqm, setManualAreaSqm] = useState(150);

  const roofMaterialsQ = useQuery({ queryKey: ["roof-materials"], queryFn: getRoofMaterials, staleTime: Infinity });
  const soilTypesQ = useQuery({ queryKey: ["soil-types"], queryFn: getSoilTypes, staleTime: Infinity });

  const roofAreaSqm = useMemo(() => {
    if (roofMode === "map") return polygon ? polygonAreaSqm(polygon) : 0;
    return Number(manualAreaSqm) || 0;
  }, [roofMode, polygon, manualAreaSqm]);

  const center = useMemo(() => {
    if (roofMode === "map" && polygon) return polygonCentroid(polygon);
    return TN_CENTER;
  }, [roofMode, polygon]);

  const hasPolygon = roofMode === "map" ? !!polygon : roofAreaSqm > 0;

  // Shared by both the real submit (below) and DesignForm's debounced
  // live-preview dry run, so the two build the exact same footprint.
  const footprint = useMemo(() => {
    if (!hasPolygon) return null;
    return roofMode === "map" && polygon ? polygon : squareFootprint(center.lat, center.lon, roofAreaSqm);
  }, [hasPolygon, roofMode, polygon, center, roofAreaSqm]);

  const liveContextQ = useQuery({
    queryKey: ["rwh-live-context", center.lon, center.lat],
    queryFn: () => getLiveContext(center.lon, center.lat),
    enabled: hasPolygon,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: createRwhDesign,
    onSuccess: (data) => setResult(data),
  });

  const handleSubmit = (formValues) => {
    mutation.mutate({ ...formValues, footprint });
  };

  const handleNewDesign = () => {
    setResult(null);
    mutation.reset();
  };

  return (
    <DashboardLayout
      title="Rainwater Harvesting Design Studio"
      subtitle="Draw or specify a rooftop catchment, then generate an engineering-grade recharge design from the live CGWB/NWDP-fed calculation engine."
      actions={
        result ? (
          <button
            type="button"
            onClick={handleNewDesign}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-panel/60 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-accent/40 hover:text-accent dark:border-slate-800 dark:text-slate-300"
          >
            <RotateCcw size={14} />
            New Design
          </button>
        ) : null
      }
    >
      {/* True two-column workspace (~30/70), matching the ~70/30 dominant-map
          pattern established on DashboardPage.jsx. Both columns are always
          mounted — this is purely a layout change, the data flow (submit /
          live dry-run preview) is unchanged. Stacks to one column below
          `lg`, same breakpoint used across the rest of the shell. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_7fr] lg:items-start">
        {/* LEFT: rooftop capture + design inputs, independently scrollable
            and sticky within DashboardLayout's own `<main>` scroll
            container so it stays in view while the (usually taller) right
            column scrolls past it. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1"
        >
          <RoofCapturePanel
            roofMode={roofMode}
            setRoofMode={setRoofMode}
            polygon={polygon}
            setPolygon={setPolygon}
            manualAreaSqm={manualAreaSqm}
            setManualAreaSqm={setManualAreaSqm}
            roofAreaSqm={roofAreaSqm}
          />

          <div className="glass-panel rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
            <h2 className="mb-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100">Design Inputs</h2>
            {roofMaterialsQ.isLoading || soilTypesQ.isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : roofMaterialsQ.isError || soilTypesQ.isError ? (
              <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                <AlertTriangle size={14} className="shrink-0" />
                Could not load roof material / soil type reference data from the backend. Confirm the API is
                running.
              </div>
            ) : (
              <DesignForm
                roofMaterials={roofMaterialsQ.data}
                soilTypes={soilTypesQ.data}
                hasPolygon={hasPolygon}
                submitting={mutation.isPending}
                liveContext={liveContextQ.data}
                roofAreaSqm={roofAreaSqm}
                footprint={footprint}
                onSubmit={handleSubmit}
              />
            )}

            {mutation.isError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  {mutation.error?.response?.data?.detail
                    ? String(mutation.error.response.data.detail)
                    : "Design generation failed. Check the inputs and try again."}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* RIGHT: the generated design, or a friendly empty state prompting
            the operator to use the form on the left — never a blank box. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05, ease: "easeOut" }}
          className="flex flex-col gap-4"
        >
          {result && <QuantityTakeoffPanel result={result} />}
          <DesignResults result={result} />
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

function RoofCapturePanel({ roofMode, setRoofMode, polygon, setPolygon, manualAreaSqm, setManualAreaSqm, roofAreaSqm }) {
  return (
    <div className="glass-panel flex flex-col gap-3 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Rooftop Catchment</h2>
        <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px] dark:border-slate-800 dark:bg-slate-900/60">
          <ModeButton active={roofMode === "map"} onClick={() => setRoofMode("map")} icon={MapPinned} label="Draw" />
          <ModeButton active={roofMode === "manual"} onClick={() => setRoofMode("manual")} icon={PenSquare} label="Enter area" />
        </div>
      </div>

      {roofMode === "map" ? (
        <>
          <div className="h-[320px] overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <DrawRoofMap onChange={setPolygon} />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Use the rectangle/polygon tool in the map's top-right toolbar to trace the rooftop outline. Area and the
            nearest live rainfall/groundwater stations are picked up automatically.
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            Roof area (m²)
            <input
              type="number"
              min="1"
              step="1"
              value={manualAreaSqm}
              onChange={(e) => setManualAreaSqm(Math.max(1, Number(e.target.value)))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
            />
          </label>
          <p className="text-[11px] text-warning">
            No location is captured in manual mode, so a nominal site coordinate is used for live rainfall/groundwater
            lookup — switch to "Draw on map" for an accurate live-telemetry match, or fill rainfall/groundwater in
            manually below.
          </p>
        </div>
      )}

      <div className="mt-1 flex items-center justify-between rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs">
        <span className="text-slate-500 dark:text-slate-400">Catchment area</span>
        <span className="font-semibold text-accent">{roofAreaSqm > 0 ? `${roofAreaSqm.toFixed(1)} m²` : "—"}</span>
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition ${
        active
          ? "bg-accent/15 text-accent"
          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

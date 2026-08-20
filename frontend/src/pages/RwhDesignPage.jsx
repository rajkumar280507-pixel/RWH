import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
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
 * Two-step RWH design wizard: (1) capture a rooftop catchment + design
 * inputs via DesignForm, hitting POST /rwh/design; (2) render the returned
 * RwhDesignResponse via DesignResults. This replaces the old standalone
 * `InteractiveRechargePitDesigner` client-only calculator as the primary
 * flow — the backend engine is now the single source of truth for both
 * the numbers and the persisted design record.
 */
export default function RwhDesignPage() {
  const [step, setStep] = useState("form");
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
    onSuccess: (data) => {
      setResult(data);
      setStep("results");
    },
  });

  const handleSubmit = (formValues) => {
    mutation.mutate({ ...formValues, footprint });
  };

  const handleNewDesign = () => {
    setResult(null);
    mutation.reset();
    setStep("form");
  };

  return (
    <DashboardLayout
      title="Rainwater Harvesting Design Studio"
      subtitle="Draw or specify a rooftop catchment, then generate an engineering-grade recharge design from the live CGWB/NWDP-fed calculation engine."
      actions={
        step === "results" ? (
          <button
            type="button"
            onClick={handleNewDesign}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-panel/60 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-accent/40 hover:text-accent"
          >
            <RotateCcw size={14} />
            New Design
          </button>
        ) : null
      }
    >
      <AnimatePresence mode="wait">
        {step === "form" ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]"
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

            <div className="glass-panel rounded-xl border border-slate-800 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">Design Inputs</h2>
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
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            <QuantityTakeoffPanel result={result} />
            <DesignResults result={result} />
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function RoofCapturePanel({ roofMode, setRoofMode, polygon, setPolygon, manualAreaSqm, setManualAreaSqm, roofAreaSqm }) {
  return (
    <div className="glass-panel flex flex-col gap-3 rounded-xl border border-slate-800 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Rooftop Catchment</h2>
        <div className="flex rounded-lg border border-slate-800 bg-surface/60 p-0.5 text-[11px]">
          <ModeButton active={roofMode === "map"} onClick={() => setRoofMode("map")} icon={MapPinned} label="Draw on map" />
          <ModeButton active={roofMode === "manual"} onClick={() => setRoofMode("manual")} icon={PenSquare} label="Enter area" />
        </div>
      </div>

      {roofMode === "map" ? (
        <>
          <div className="h-[380px] overflow-hidden rounded-lg border border-slate-800">
            <DrawRoofMap onChange={setPolygon} />
          </div>
          <p className="text-[11px] text-slate-500">
            Use the rectangle/polygon tool in the map's top-right toolbar to trace the rooftop outline. Area and the
            nearest live rainfall/groundwater stations are picked up automatically.
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Roof area (m²)
            <input
              type="number"
              min="1"
              step="1"
              value={manualAreaSqm}
              onChange={(e) => setManualAreaSqm(Math.max(1, Number(e.target.value)))}
              className="rounded-lg border border-slate-700/60 bg-surface/60 px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
            />
          </label>
          <p className="text-[11px] text-amber-400/90">
            No location is captured in manual mode, so a nominal site coordinate is used for live rainfall/groundwater
            lookup — switch to "Draw on map" for an accurate live-telemetry match, or fill rainfall/groundwater in
            manually below.
          </p>
        </div>
      )}

      <div className="mt-1 flex items-center justify-between rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs">
        <span className="text-slate-400">Catchment area</span>
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
        active ? "bg-accent/15 text-accent" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

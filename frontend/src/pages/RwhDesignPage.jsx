import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { RotateCcw, AlertTriangle } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout.jsx";
import DesignForm from "../components/DesignForm.jsx";
import DesignResults from "../components/DesignResults.jsx";
import QuantityTakeoffPanel from "../components/cad/QuantityTakeoffPanel.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import {
  getRoofMaterials,
  getSoilTypes,
  getLiveContext,
  createRwhDesign,
  getFilterOptions,
  getLatestGroundwater,
  getLatestRainfall,
} from "../services/api.js";
import { squareFootprint, TN_CENTER } from "../lib/geo.js";

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
  const [searchParams] = useSearchParams();
  const urlTaluk = searchParams.get("taluk") || "";
  const urlLat = searchParams.get("lat");
  const urlLng = searchParams.get("lng");
  const urlGw = searchParams.get("gw");
  const urlRf = searchParams.get("rf");
  const urlRoofArea = searchParams.get("roofArea");
  const urlRoofMaterial = searchParams.get("roofMaterial");

  const [result, setResult] = useState(null);
  const [manualAreaSqm, setManualAreaSqm] = useState(() => (urlRoofArea ? Number(urlRoofArea) || 150 : 150));
  const [district, setDistrict] = useState(() => localStorage.getItem("rwh_district") || "");
  const [taluk, setTaluk] = useState(() => urlTaluk || localStorage.getItem("rwh_taluk") || "");

  useEffect(() => {
    if (urlTaluk) {
      setTaluk(urlTaluk);
    }
  }, [urlTaluk]);

  useEffect(() => {
    const syncLocation = () => {
      const d = localStorage.getItem("rwh_district") || "";
      const t = localStorage.getItem("rwh_taluk") || "";
      if (d !== district) setDistrict(d);
      if (!urlTaluk && t !== taluk) setTaluk(t);
    };
    window.addEventListener("storage", syncLocation);
    window.addEventListener("focus", syncLocation);
    return () => {
      window.removeEventListener("storage", syncLocation);
      window.removeEventListener("focus", syncLocation);
    };
  }, [district, taluk, urlTaluk]);

  const roofMaterialsQ = useQuery({ queryKey: ["roof-materials"], queryFn: getRoofMaterials, staleTime: Infinity });
  const soilTypesQ = useQuery({ queryKey: ["soil-types"], queryFn: getSoilTypes, staleTime: Infinity });
  const filterOptionsQ = useQuery({ queryKey: ["filter-options"], queryFn: getFilterOptions, staleTime: 300_000 });

  const roofAreaSqm = Number(manualAreaSqm) || 0;

  // Real station coordinates for the selected District/Taluk — averaged
  // from whichever live groundwater/rainfall stations actually match, so the
  // live-context lookup below reflects the operator's chosen project
  // location instead of always centering on the same Tamil Nadu centroid.
  // Real station coordinates and live telemetry for the selected District/Taluk
  const siteStationsQ = useQuery({
    queryKey: ["rwh-site-stations", district, taluk],
    queryFn: async () => {
      const params = { district, ...(taluk ? { taluk } : {}) };
      const [gw, rf] = await Promise.all([getLatestGroundwater(params), getLatestRainfall(params)]);
      return { gw, rf, all: [...gw, ...rf] };
    },
    staleTime: 60_000,
  });

  const liveAvgGw = useMemo(() => {
    if (urlGw) return Number(Number(urlGw).toFixed(2));
    const gwList = siteStationsQ.data?.gw ?? [];
    const valid = gwList.map((d) => Number(d.water_level_m)).filter((v) => !isNaN(v) && v != null);
    if (!valid.length) return null;
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    return Number(Math.abs(avg).toFixed(2));
  }, [urlGw, siteStationsQ.data]);

  const liveAvgRf = useMemo(() => {
    if (urlRf) return Number(Number(urlRf).toFixed(2));
    const rfList = siteStationsQ.data?.rf ?? [];
    const valid = rfList.map((d) => Number(d.rainfall_mm)).filter((v) => !isNaN(v) && v != null);
    if (!valid.length) return null;
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    return Number(avg.toFixed(2));
  }, [urlRf, siteStationsQ.data]);

  const center = useMemo(() => {
    if (urlLat && urlLng) {
      return { lat: Number(urlLat), lon: Number(urlLng) };
    }
    const stations = siteStationsQ.data?.all ?? [];
    const withCoords = stations.filter((s) => s.latitude != null && s.longitude != null);
    if (!withCoords.length) return TN_CENTER;
    const lat = withCoords.reduce((s, r) => s + Number(r.latitude), 0) / withCoords.length;
    const lon = withCoords.reduce((s, r) => s + Number(r.longitude), 0) / withCoords.length;
    return { lat, lon };
  }, [urlLat, urlLng, siteStationsQ.data]);

  const hasPolygon = roofAreaSqm > 0;

  const footprint = useMemo(() => {
    if (!hasPolygon) return null;
    return squareFootprint(center.lat, center.lon, roofAreaSqm);
  }, [hasPolygon, center, roofAreaSqm]);

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
      title={result ? "RWH Design Results & 2D CAD Blueprint" : "RWH Design Inputs"}
      contentClassName="w-full p-3 sm:p-6"
      actions={
        result ? (
          <button
            type="button"
            onClick={handleNewDesign}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-panel/60 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-sky-500/40 hover:text-sky-600 dark:border-slate-800 dark:text-slate-300 cursor-pointer shadow-sm"
          >
            <RotateCcw size={14} className="text-sky-500" />
            ← Edit Inputs
          </button>
        ) : null
      }
    >
      {/* 2-Step Workflow: Stage 1 = Inputs Only (Centered); Stage 2 = Results (Full CAD Drawings & Metrics) */}
      {!result ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="mx-auto flex max-w-2xl flex-col gap-4"
        >
          <RoofCapturePanel
            manualAreaSqm={manualAreaSqm}
            setManualAreaSqm={setManualAreaSqm}
            roofAreaSqm={roofAreaSqm}
            district={district}
            taluk={taluk}
          />

          <div className="glass-panel rounded-xl border border-slate-200 p-4 shadow-sm dark:border-slate-800">
            <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-slate-100">Design Inputs</h2>
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
                initialGw={liveAvgGw}
                initialRf={liveAvgRf}
                initialRoofMaterial={urlRoofMaterial}
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex flex-col gap-4 min-w-0"
        >
          <DesignResults result={result} />
        </motion.div>
      )}
    </DashboardLayout>
  );
}

function RoofCapturePanel({
  manualAreaSqm,
  setManualAreaSqm,
  roofAreaSqm,
  district,
  taluk,
}) {
  return (
    <div className="glass-panel flex flex-col gap-3.5 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Rooftop Catchment</h2>

      <div className="flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-400">Dashboard Location</span>
        <span className="font-bold text-sky-600 dark:text-sky-400">
          {district ? `${district}${taluk ? ` › ${taluk}` : ""}` : "Tamil Nadu (Default)"}
        </span>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
        Roof area (m²)
        <input
          type="number"
          min="1"
          step="1"
          value={manualAreaSqm}
          onChange={(e) => setManualAreaSqm(Math.max(1, Number(e.target.value)))}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>
    </div>
  );
}

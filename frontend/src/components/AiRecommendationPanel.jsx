import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import Skeleton from "./ui/Skeleton.jsx";

const PRIORITY_STYLES = {
  High: "border-danger/40 bg-danger/10 text-danger",
  Medium: "border-warning/40 bg-warning/10 text-warning",
  Low: "border-success/40 bg-success/10 text-success",
};

// Rule-based text synthesis over already-available dashboard figures
// (groundwater depth, rainfall, harvest/recharge estimates). This is
// deliberately simple if/else logic, not a model call — the panel is
// labelled "Decision Support Recommendation", never "AI-generated".
function buildRecommendation({
  groundwaterDepthM,
  rainfallMm,
  netHarvestM3,
  expectedGwRiseM,
  pitCount,
  locationLabel,
}) {
  const reasons = [];
  let priority = "Medium";
  let headline = "";

  const deep = groundwaterDepthM > 15;
  const moderate = groundwaterDepthM > 8 && groundwaterDepthM <= 15;
  const goodRain = rainfallMm >= 800;
  const lowRain = rainfallMm < 500;

  if (deep) {
    priority = "High";
    headline = `Groundwater at ${locationLabel} is deep (${groundwaterDepthM.toFixed(1)} m bgl) — prioritize recharge structures here.`;
    reasons.push(`Water table depth of ${groundwaterDepthM.toFixed(1)} m bgl indicates significant aquifer drawdown.`);
  } else if (moderate) {
    priority = "Medium";
    headline = `Groundwater at ${locationLabel} is at a moderate depth (${groundwaterDepthM.toFixed(1)} m bgl) — recharge is recommended as a preventive measure.`;
    reasons.push(`Water table depth is within a manageable range but trending toward depletion risk without intervention.`);
  } else {
    priority = "Low";
    headline = `Groundwater at ${locationLabel} is relatively shallow (${groundwaterDepthM.toFixed(1)} m bgl) — levels currently appear adequate.`;
    reasons.push(`Current water table depth suggests existing recharge is broadly keeping pace with extraction.`);
  }

  if (goodRain) {
    reasons.push(`Annual rainfall (${Math.round(rainfallMm)} mm) is favorable for rooftop harvesting and recharge.`);
  } else if (lowRain) {
    reasons.push(`Annual rainfall (${Math.round(rainfallMm)} mm) is comparatively low — size storage conservatively and treat recharge as supplementary.`);
  } else {
    reasons.push(`Annual rainfall (${Math.round(rainfallMm)} mm) is moderate — a balanced harvesting-plus-recharge approach is appropriate.`);
  }

  if (netHarvestM3 != null && !Number.isNaN(Number(netHarvestM3))) {
    reasons.push(
      `Estimated annual harvest of ${netHarvestM3} m³ could support ${pitCount ?? 1} recharge pit${(pitCount ?? 1) === 1 ? "" : "s"} sized per IS 15797:2008.`
    );
  }

  if (expectedGwRiseM != null && Number(expectedGwRiseM) > 0) {
    reasons.push(`Recharge from this catchment could raise the local water table by an estimated ${expectedGwRiseM} m/yr.`);
  }

  return { headline, reasons, priority };
}

/**
 * Decision-support card: short rule-based recommendation synthesized from
 * figures already shown elsewhere on the dashboard. Explicitly NOT an
 * AI/LLM output — no backend AI endpoint exists — so the copy here must
 * stay "Decision Support" / "Recommendation", never "AI-generated".
 */
export default function AiRecommendationPanel({
  groundwaterDepthM,
  rainfallMm,
  netHarvestM3,
  expectedGwRiseM,
  pitCount,
  locationLabel = "this location",
  loading = false,
}) {
  const hasData =
    !loading &&
    typeof groundwaterDepthM === "number" &&
    Number.isFinite(groundwaterDepthM) &&
    typeof rainfallMm === "number" &&
    Number.isFinite(rainfallMm);

  const rec = hasData
    ? buildRecommendation({ groundwaterDepthM, rainfallMm, netHarvestM3, expectedGwRiseM, pitCount, locationLabel })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="glass-panel flex flex-col rounded-xl border border-slate-200 bg-panel/70 p-4 dark:border-slate-800 dark:bg-panel/70"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Lightbulb size={15} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Decision Support Recommendation</h3>
            <p className="text-[10px] text-slate-500">Rule-based guidance from live telemetry — not AI/LLM generated</p>
          </div>
        </div>
        {rec && (
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLES[rec.priority]}`}>
            {rec.priority} priority
          </span>
        )}
      </div>

      {!rec ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">{rec.headline}</p>
          <ul className="flex flex-col gap-1.5">
            {rec.reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {reason}
              </li>
            ))}
          </ul>
        </>
      )}
    </motion.div>
  );
}

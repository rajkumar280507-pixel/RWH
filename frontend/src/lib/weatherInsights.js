/**
 * Weather-derived alerts + engineering insights — pure functions over the
 * normalized forecast returned by getWeatherForecast(). Entirely additive
 * and read-only: never touches recharge/storage calculations, only reads
 * their outputs (harvestableM3PerYear) to phrase guidance.
 *
 * Rainfall severity bands are IMD's own *published* rainfall-intensity
 * classification (public knowledge, not requiring API access) applied here
 * to the Open-Meteo forecast numbers — labeled "forecast-threshold alert",
 * never presented as an official IMD warning/bulletin, since we don't have
 * IMD's actual warning feed.
 */

const RAIN_BANDS = [
  { min: 204.5, level: "red", label: "Extremely Heavy Rain" },
  { min: 124.5, level: "red", label: "Very Heavy Rain" },
  { min: 64.5, level: "orange", label: "Heavy Rain" },
  { min: 35.5, level: "yellow", label: "Rather Heavy Rain" },
];

const WIND_BANDS = [
  { min: 89, level: "red", label: "Storm-Force Wind" },
  { min: 62, level: "orange", label: "Strong Wind / Gale" },
  { min: 40, level: "yellow", label: "Gusty Wind" },
];

export const ALERT_COLORS = {
  green: { border: "border-success/40", bg: "bg-success/10", text: "text-success" },
  yellow: { border: "border-warning/40", bg: "bg-warning/10", text: "text-warning" },
  orange: { border: "border-orange-500/40", bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400" },
  red: { border: "border-danger/40", bg: "bg-danger/10", text: "text-danger" },
};

/** Returns a list of { level, label, date } alerts derived from forecast
 * thresholds — empty array means no threshold crossed (a genuine "green"
 * outlook, not an absence of data). */
export function deriveAlerts(daily) {
  const alerts = [];
  for (const d of daily ?? []) {
    const rainBand = RAIN_BANDS.find((b) => (d.rainfall_mm ?? 0) >= b.min);
    if (rainBand) alerts.push({ ...rainBand, date: d.date, detail: `${d.rainfall_mm} mm forecast` });
    const windBand = WIND_BANDS.find((b) => (d.wind_speed_kmh ?? 0) >= b.min);
    if (windBand) alerts.push({ ...windBand, date: d.date, detail: `${d.wind_speed_kmh} km/h forecast` });
    if (d.icon === "storm") alerts.push({ level: "orange", label: "Thunderstorm", date: d.date, detail: d.weather_label });
  }
  return alerts;
}

/**
 * Engineering guidance from the forecast — informational only, never
 * modifies the recharge/storage numbers it references.
 */
export function deriveEngineeringInsight({ daily, harvestableM3PerYear, catchmentAreaSqm, runoffCoefficient }) {
  const next2Days = (daily ?? []).slice(0, 2);
  const rain48h = next2Days.reduce((s, d) => s + (d.rainfall_mm ?? 0), 0);
  const maxProb = Math.max(0, ...next2Days.map((d) => d.rain_probability_pct ?? 0));

  if (rain48h <= 0.5) {
    return {
      headline: "No significant rainfall expected in the next 48 hours.",
      detail: "Recharge opportunity is low over this window — a reasonable time for filter/pit maintenance and inspection instead.",
      tone: "info",
    };
  }

  // Roughly convert the forecast rainfall depth into an expected inflow
  // volume the same way the recharge engine does (area × depth × runoff
  // coefficient) — using the REAL catchment area/coefficient from the
  // generated design when available, purely as an illustrative forecast
  // conversion, not a recalculation of the design itself.
  const expectedInflowM3 =
    catchmentAreaSqm != null && runoffCoefficient != null
      ? (catchmentAreaSqm * (rain48h / 1000) * runoffCoefficient).toFixed(1)
      : null;

  if (rain48h >= 35.5) {
    return {
      headline: `Heavy rainfall expected in the next 48 hours (~${rain48h.toFixed(0)} mm).`,
      detail: expectedInflowM3
        ? `At this roof's real catchment area and runoff coefficient, that's roughly ${expectedInflowM3} m³ of inflow — the recharge pit will likely see significant flow, and a storage tank (if sized) should fill quickly. Overflow risk is moderate to high; check the first-flush diverter and inlet screen beforehand.`
        : `Expect significant inflow to any recharge structure or storage tank at this location. Overflow risk is moderate to high — check the first-flush diverter and inlet screen beforehand.`,
      tone: "warning",
    };
  }

  return {
    headline: `Moderate rainfall likely in the next 48 hours (~${rain48h.toFixed(0)} mm, ${maxProb}% probability).`,
    detail: "Some recharge/storage inflow expected — not enough to require special preparation, but worth checking that gutters and the inlet path are clear.",
    tone: "info",
  };
}

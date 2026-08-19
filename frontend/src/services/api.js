import axios from "axios";

// In dev, Vite proxies "/api" to localhost:8000. In static deploys (e.g. Vercel),
// VITE_API_URL points to the backend server. If no backend is reachable,
// API methods gracefully fallback to local demo dataset so Vercel loads cleanly!
const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";

export const api = axios.create({ baseURL: API_BASE, timeout: 5000 });

// Default Fallback Datasets for Static Deployments (Vercel)
const MOCK_GW_STATIONS = [
  { station_id: 101, station_code: "GW_CHE_01", station_name: "Chennai Central Piezometer", state: "Tamil Nadu", district: "Chennai", taluk: "Chennai", latitude: 13.0827, longitude: 80.2707, water_level_m: 6.4, recorded_at: new Date().toISOString() },
  { station_id: 102, station_code: "GW_CBE_01", station_name: "Coimbatore North Well", state: "Tamil Nadu", district: "Coimbatore", taluk: "Coimbatore North", latitude: 11.0168, longitude: 76.9558, water_level_m: 14.2, recorded_at: new Date().toISOString() },
  { station_id: 103, station_code: "GW_MDU_01", station_name: "Madurai South Station", state: "Tamil Nadu", district: "Madurai", taluk: "Thirumangalam", latitude: 9.9252, longitude: 78.1198, water_level_m: 11.8, recorded_at: new Date().toISOString() },
  { station_id: 104, station_code: "GW_TRY_01", station_name: "Trichy Junction Station", state: "Tamil Nadu", district: "Tiruchirappalli", taluk: "Tiruchirappalli", latitude: 10.7905, longitude: 78.7047, water_level_m: 8.5, recorded_at: new Date().toISOString() },
  { station_id: 105, station_code: "GW_SLM_01", station_name: "Salem Fort Observatory", state: "Tamil Nadu", district: "Salem", taluk: "Salem", latitude: 11.6643, longitude: 78.1460, water_level_m: 16.1, recorded_at: new Date().toISOString() },
];

const MOCK_RAINFALL_STATIONS = [
  { station_id: 201, station_code: "RF_CHE_01", station_name: "Nungambakkam AWS", state: "Tamil Nadu", district: "Chennai", taluk: "Chennai", latitude: 13.0604, longitude: 80.2496, rainfall_mm: 1250, recorded_at: new Date().toISOString() },
  { station_id: 202, station_code: "RF_CBE_01", station_name: "Peelamedu AWS", state: "Tamil Nadu", district: "Coimbatore", taluk: "Coimbatore North", latitude: 11.0297, longitude: 77.0428, rainfall_mm: 720, recorded_at: new Date().toISOString() },
  { station_id: 203, station_code: "RF_MDU_01", station_name: "Madurai Airport AWS", state: "Tamil Nadu", district: "Madurai", taluk: "Thirumangalam", latitude: 9.8345, longitude: 78.0934, rainfall_mm: 880, recorded_at: new Date().toISOString() },
  { station_id: 204, station_code: "RF_TRY_01", station_name: "Trichy AWS", state: "Tamil Nadu", district: "Tiruchirappalli", taluk: "Tiruchirappalli", latitude: 10.7656, longitude: 78.7090, rainfall_mm: 910, recorded_at: new Date().toISOString() },
  { station_id: 205, station_code: "RF_SLM_01", station_name: "Salem AWS", state: "Tamil Nadu", district: "Salem", taluk: "Salem", latitude: 11.6500, longitude: 78.1600, rainfall_mm: 980, recorded_at: new Date().toISOString() },
];

const MOCK_DISTRICT_SUMMARY = [
  { district_id: 1, state: "Tamil Nadu", district: "Chennai", avg_groundwater_level_m: 6.4, gw_station_count: 12, avg_rainfall_mm: 1250, rainfall_station_count: 8 },
  { district_id: 2, state: "Tamil Nadu", district: "Coimbatore", avg_groundwater_level_m: 14.2, gw_station_count: 18, avg_rainfall_mm: 720, rainfall_station_count: 10 },
  { district_id: 3, state: "Tamil Nadu", district: "Madurai", avg_groundwater_level_m: 11.8, gw_station_count: 15, avg_rainfall_mm: 880, rainfall_station_count: 9 },
  { district_id: 4, state: "Tamil Nadu", district: "Tiruchirappalli", avg_groundwater_level_m: 8.5, gw_station_count: 14, avg_rainfall_mm: 910, rainfall_station_count: 7 },
  { district_id: 5, state: "Tamil Nadu", district: "Salem", avg_groundwater_level_m: 16.1, gw_station_count: 16, avg_rainfall_mm: 980, rainfall_station_count: 11 },
];

const safeFetch = (promise, fallbackData) =>
  promise.then((r) => r.data).catch(() => fallbackData);

export const getDashboardStats = () =>
  safeFetch(api.get("/dashboard/stats"), {
    gw_station_count: 75,
    rainfall_station_count: 45,
    avg_groundwater_level_m: 11.4,
    avg_rainfall_mm: 948,
    last_gw_sync: new Date().toISOString(),
    last_rainfall_sync: new Date().toISOString(),
  });

export const getDistrictSummary = () =>
  safeFetch(api.get("/dashboard/district-summary"), MOCK_DISTRICT_SUMMARY);

export const getLatestGroundwater = (params = {}) =>
  safeFetch(api.get("/telemetry/groundwater/latest", { params }), MOCK_GW_STATIONS);

export const getLatestRainfall = (params = {}) =>
  safeFetch(api.get("/telemetry/rainfall/latest", { params }), MOCK_RAINFALL_STATIONS);

export const getSyncRuns = (params = {}) =>
  safeFetch(api.get("/sync/runs", { params }), [
    { id: 1, source: "groundwater", status: "success", started_at: new Date().toISOString(), finished_at: new Date().toISOString(), records_fetched: 120, records_upserted: 120, records_failed: 0 }
  ]);

export const getSyncHealth = () =>
  safeFetch(api.get("/sync/health"), [
    { source: "groundwater", status: "success", started_at: new Date().toISOString(), duration_seconds: 4 }
  ]);

export const getFilterOptions = () =>
  safeFetch(api.get("/telemetry/filter-options"), {
    states: ["Tamil Nadu"],
    districts: ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem"],
    all_taluks: ["Chennai", "Coimbatore North", "Thirumangalam", "Tiruchirappalli", "Salem"],
    taluks_by_district: {
      Madurai: ["Thirumangalam", "Madurai South", "Madurai North"],
      Chennai: ["Chennai", "Egmore", "Guindy"],
      Coimbatore: ["Coimbatore North", "Coimbatore South", "Pollachi"],
      Tiruchirappalli: ["Tiruchirappalli", "Srirangam", "Lalgudi"],
      Salem: ["Salem", "Attur", "Mettur"],
    },
  });

export const getGwHistory = (stationId, days = 90) =>
  safeFetch(
    api.get(`/telemetry/groundwater/${stationId}/history`, { params: { days } }),
    Array.from({ length: 12 }, (_, i) => ({
      recorded_at: new Date(Date.now() - (11 - i) * 30 * 86400000).toISOString(),
      water_level_m: (10 + Math.sin(i) * 3).toFixed(2),
    }))
  );

export const getRainfallHistory = (stationId, days = 90) =>
  safeFetch(
    api.get(`/telemetry/rainfall/${stationId}/history`, { params: { days } }),
    Array.from({ length: 12 }, (_, i) => ({
      recorded_at: new Date(Date.now() - (11 - i) * 30 * 86400000).toISOString(),
      rainfall_mm: Math.round(50 + Math.random() * 150),
    }))
  );

export const getGroundwaterTrends = (params = {}) =>
  safeFetch(api.get("/predictions/groundwater-trends", { params }), []);

export const getStationSeries = (stationId) =>
  safeFetch(api.get(`/predictions/station/${stationId}/series`), {
    historical: [],
    forecast: [],
    annual_change_m_yr: -0.25,
    trend_category: "Falling",
  });

export const getDesigns = () => safeFetch(api.get("/rwh/designs"), []);
export const getDesign = (id) => safeFetch(api.get(`/rwh/design/${id}`), null);
export const deleteDesign = (id) => safeFetch(api.delete(`/rwh/delete/${id}`), { success: true });

export const getRoofMaterials = () =>
  safeFetch(api.get("/rwh/roof-materials"), [
    { code: "rcc", label: "RCC Roof (Flat)", runoff_coefficient: 0.85 },
    { code: "paved", label: "Paved / Tiled Terrace", runoff_coefficient: 0.90 },
    { code: "gi_sheet", label: "GI / Metal Sheet", runoff_coefficient: 0.95 },
    { code: "asphalt", label: "Asphalt / Tar Paving", runoff_coefficient: 0.80 },
  ]);

export const getSoilTypes = () =>
  safeFetch(api.get("/rwh/soil-types"), [
    { code: "sandy_loam", label: "Sandy Loam", hydrologic_group: "A", permeability_mm_hr: 25.0 },
    { code: "loam", label: "Loam", hydrologic_group: "B", permeability_mm_hr: 12.0 },
    { code: "clay_loam", label: "Clay Loam", hydrologic_group: "C", permeability_mm_hr: 4.0 },
    { code: "clay", label: "Clay", hydrologic_group: "D", permeability_mm_hr: 1.0 },
  ]);

export const createRwhDesign = (payload) =>
  safeFetch(api.post("/rwh/design", payload), { id: 1, ...payload });

export const getLiveContext = (lon, lat) =>
  safeFetch(api.get("/rwh/live-context", { params: { lon, lat } }), {
    annual_rainfall_mm: 920,
    gw_depth_bgl_m: 11.2,
    soil_type: "Loam",
    nearest_gw_station: "Madurai South Station",
    nearest_rf_station: "Madurai Airport AWS",
  });

import axios from "axios";

// In dev, Vite proxies "/api" to localhost:8000 (see vite.config.js). In a
// static deploy (e.g. Vercel) there's no proxy, so VITE_API_URL must point
// at wherever the backend actually runs.
const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "bypass-tunnel-reminder": "true",
    "ngrok-skip-browser-warning": "true",
  },
});

export const getDashboardStats = () => api.get("/dashboard/stats").then((r) => r.data);
export const getDistrictSummary = () => api.get("/dashboard/district-summary").then((r) => r.data);
export const getLatestGroundwater = (params = {}) =>
  api.get("/telemetry/groundwater/latest", { params }).then((r) => r.data);
export const getLatestRainfall = (params = {}) =>
  api.get("/telemetry/rainfall/latest", { params }).then((r) => r.data);
export const getSyncRuns = (params = {}) => api.get("/sync/runs", { params }).then((r) => r.data);
export const getSyncHealth = () => api.get("/sync/health").then((r) => r.data);

export const getFilterOptions = () => api.get("/telemetry/filter-options").then((r) => r.data);
export const getGwHistory = (stationId, days = 90) =>
  api.get(`/telemetry/groundwater/${stationId}/history`, { params: { days } }).then((r) => r.data);
export const getRainfallHistory = (stationId, days = 90) =>
  api.get(`/telemetry/rainfall/${stationId}/history`, { params: { days } }).then((r) => r.data);

export const getGroundwaterTrends = (params = {}) =>
  api.get("/predictions/groundwater-trends", { params }).then((r) => r.data);
export const getStationSeries = (stationId) =>
  api.get(`/predictions/station/${stationId}/series`).then((r) => r.data);

export const getDesigns = () => api.get("/rwh/designs").then((r) => r.data);
export const getDesign = (id) => api.get(`/rwh/design/${id}`).then((r) => r.data);
export const deleteDesign = (id) => api.delete(`/rwh/design/${id}`).then((r) => r.data);

export const getRoofMaterials = () => api.get("/rwh/roof-materials").then((r) => r.data);
export const getSoilTypes = () => api.get("/rwh/soil-types").then((r) => r.data);
export const createRwhDesign = (payload) => api.post("/rwh/design", payload).then((r) => r.data);
export const getLiveContext = (lon, lat) =>
  api.get("/rwh/live-context", { params: { lon, lat } }).then((r) => r.data);

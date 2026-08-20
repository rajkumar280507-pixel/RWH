import axios from "axios";

// In dev, Vite proxies "/api" to localhost:8000 (see vite.config.js). In a
// static deploy (e.g. Vercel) there's no proxy, so VITE_API_URL must point
// at wherever the backend actually runs.
const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";

export const api = axios.create({ baseURL: API_BASE });

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

// Phase 7: PDF report generation for a saved design. Additive only — see
// backend/app/api/reports.py for the route implementations.
export const generateReport = (designId, { cadDrawingImage, snapshot3dImage, preparedBy, reviewedBy } = {}) =>
  api
    .post(`/reports/${designId}/generate`, {
      cad_drawing_image: cadDrawingImage ?? null,
      snapshot_3d_image: snapshot3dImage ?? null,
      prepared_by_name: preparedBy?.name ?? null,
      prepared_by_designation: preparedBy?.designation ?? null,
      reviewed_by_name: reviewedBy?.name ?? null,
      reviewed_by_designation: reviewedBy?.designation ?? null,
    })
    .then((r) => r.data);
export const getReport = (designId) => api.get(`/reports/${designId}`).then((r) => r.data);
// Returns the absolute download URL for the browser to navigate/open directly
// (FileResponse download, not JSON) — resolved against the API's own origin
// so it works whether or not VITE_API_URL is set.
export const downloadReportUrl = (designId) => `${api.defaults.baseURL}/reports/${designId}/download`;
// Backend-served static assets (e.g. QR code PNGs under /static/reports/)
// live outside the /api prefix — resolve them against the API's own origin
// the same way, so they work behind both the dev proxy and VITE_API_URL.
export const resolveStaticUrl = (path) =>
  path ? `${import.meta.env.VITE_API_URL ?? ""}${path}` : null;

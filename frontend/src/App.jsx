import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage.jsx";
import RwhDesignPage from "./pages/RwhDesignPage.jsx";
import GisMapPage from "./pages/GisMapPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/gis-map" element={<GisMapPage />} />
        <Route path="/rwh-design" element={<RwhDesignPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

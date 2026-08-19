import DashboardLayout from "../layouts/DashboardLayout.jsx";
import InteractiveRechargePitDesigner from "../components/InteractiveRechargePitDesigner.jsx";

export default function RwhDesignPage() {
  return (
    <DashboardLayout
      title="Rooftop Rainwater Harvesting Recharge Pit Designer"
      subtitle="Interactive 2D CAD Engineering Drawing Engine & Hydrogeological Sizing System"
    >
      <InteractiveRechargePitDesigner />
    </DashboardLayout>
  );
}

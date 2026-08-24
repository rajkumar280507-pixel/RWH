import { useMemo } from "react";
import ReactECharts from "echarts-for-react";

/**
 * Water-balance Sankey diagram: Rainwater Available splits into Stored
 * (used) and Overflow; overflow feeds the Recharge Pit, which feeds
 * Groundwater Benefit. If demand exceeds what's stored, a Municipal Supply
 * node feeds the remaining shortfall — so the diagram always reconciles to
 * real numbers from `balance` (lib/waterDemand.js's calcWaterBalance), never
 * a decorative/illustrative shape.
 */
export default function WaterBalanceFlow({ balance }) {
  const { nodes, links } = useMemo(() => {
    if (!balance) return { nodes: [], links: [] };
    const l = [];
    const nodeMap = new Map();

    const addLink = (source, target, value, sourceColor, targetColor) => {
      const val = Number((value || 0).toFixed(1));
      if (val <= 0) return;
      if (!nodeMap.has(source)) nodeMap.set(source, { name: source, itemStyle: { color: sourceColor } });
      if (!nodeMap.has(target)) nodeMap.set(target, { name: target, itemStyle: { color: targetColor } });
      l.push({ source, target, value: val });
    };

    const storedVal = balance.waterStoredM3 || 0;
    const overflowVal = balance.overflowM3 || 0;
    const shortfallVal = balance.shortfallM3 || 0;

    addLink("Rainwater Available", "Stored (used)", storedVal, "#0ea5e9", "#22c55e");
    if (overflowVal > 0) {
      addLink("Rainwater Available", "Overflow", overflowVal, "#0ea5e9", "#f59e0b");
      addLink("Overflow", "Recharge Pit", overflowVal, "#f59e0b", "#0891b2");
      addLink("Recharge Pit", "Groundwater Benefit", overflowVal, "#0891b2", "#2563eb");
    }
    if (shortfallVal > 0) {
      addLink("Municipal Supply (shortfall)", "Stored (used)", shortfallVal, "#94a3b8", "#22c55e");
    }

    return { nodes: Array.from(nodeMap.values()), links: l };
  }, [balance]);

  const option = useMemo(
    () => ({
      tooltip: { trigger: "item", formatter: (p) => (p.dataType === "edge" ? `${p.data.source} → ${p.data.target}<br/>${p.data.value} m³/yr` : `${p.name}`) },
      series: [
        {
          type: "sankey",
          data: nodes,
          links,
          emphasis: { focus: "adjacency" },
          lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.45 },
          label: { fontSize: 11, color: "#334155" },
          nodeWidth: 16,
          nodeGap: 18,
        },
      ],
    }),
    [nodes, links]
  );

  if (!balance || links.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950/40">
      <ReactECharts option={option} style={{ height: 260, width: "100%" }} notMerge lazyUpdate />
    </div>
  );
}

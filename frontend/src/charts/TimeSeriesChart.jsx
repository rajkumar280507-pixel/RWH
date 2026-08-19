import ReactECharts from "echarts-for-react";

/**
 * Dark-themed time series line chart. `series` is [{name, data:[[ts, value]], color}].
 * Kept deliberately thin — all data shaping happens in the calling page so this
 * stays reusable for groundwater levels, rainfall, and fitted trend lines.
 */
export default function TimeSeriesChart({ series = [], yLabel = "", height = 260, invertY = false }) {
  const option = {
    backgroundColor: "transparent",
    grid: { left: 55, right: 20, top: 30, bottom: 40 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#111a2e",
      borderColor: "#334155",
      textStyle: { color: "#e2e8f0", fontSize: 11 },
    },
    legend: {
      show: series.length > 1,
      top: 0,
      textStyle: { color: "#94a3b8", fontSize: 11 },
    },
    xAxis: {
      type: "time",
      axisLine: { lineStyle: { color: "#334155" } },
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: yLabel,
      nameTextStyle: { color: "#64748b", fontSize: 10 },
      inverse: invertY,
      scale: true,
      axisLine: { lineStyle: { color: "#334155" } },
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      splitLine: { lineStyle: { color: "#1e293b" } },
    },
    series: series.map((s) => ({
      name: s.name,
      type: "line",
      data: s.data,
      showSymbol: false,
      smooth: s.smooth ?? false,
      lineStyle: { width: s.width ?? 2, color: s.color, type: s.dashed ? "dashed" : "solid" },
      itemStyle: { color: s.color },
      areaStyle: s.area ? { color: s.color, opacity: 0.12 } : undefined,
    })),
  };

  return <ReactECharts option={option} style={{ height, width: "100%" }} notMerge lazyUpdate />;
}

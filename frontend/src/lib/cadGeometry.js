/**
 * cadGeometry.js — pure drafting/geometry toolkit shared by every 2D
 * engineering-drawing view in `EngineeringDrawings2D.jsx`.
 *
 * Plain JS, no React/JSX, no DOM access — every function is a deterministic
 * transform from real-world engineering numbers (metres) into SVG-pixel
 * geometry, or a small "shape descriptor" object the component layer turns
 * into actual `<line>`/`<text>`/`<polygon>` elements via a generic
 * `renderShapes()` mapper (kept in EngineeringDrawings2D.jsx, since JSX
 * can't live in a .js file).
 *
 * Shape descriptor shapes used throughout this module:
 *   { type: "line", x1, y1, x2, y2, stroke, strokeWidth, dash, marker }
 *   { type: "polyline"|"polygon", points, fill, stroke, strokeWidth, dash }
 *   { type: "circle", cx, cy, r, fill, stroke, strokeWidth }
 *   { type: "rect", x, y, width, height, fill, stroke, strokeWidth, rx }
 *   { type: "text", x, y, text, fill, anchor, size, weight, rotate }
 */

// ---------------------------------------------------------------------------
// Coordinate transforms
// ---------------------------------------------------------------------------

/**
 * Converts a real-world coordinate (metres) into SVG pixel space.
 *
 * @param {{x:number, y:number}} point - world coordinate in metres. By
 *   convention `x` is horizontal distance from the drawing origin and `y` is
 *   either "height above a baseline" (flipY:true — plan/elevation views
 *   where up-in-the-world should read as up-on-screen) or "depth below
 *   ground" (flipY:false, the default — cross sections, where SVG's
 *   natively-downward y axis already matches "deeper = further down").
 * @param {object} opts
 * @param {number} opts.scale - pixels per metre (from computeScale()).
 * @param {{x:number,y:number}} [opts.origin] - pixel location of world (0,0).
 * @param {number} [opts.svgHeight] - required when flipY is true.
 * @param {boolean} [opts.flipY=false] - flip so real-world "up" is screen "up".
 */
export function worldToSvg(point, { scale, origin = { x: 0, y: 0 }, svgHeight = 0, flipY = false } = {}) {
  const x = origin.x + point.x * scale;
  const y = flipY ? svgHeight - origin.y - point.y * scale : origin.y + point.y * scale;
  return { x, y };
}

/**
 * Returns a pixels-per-metre scale factor that fits the largest real-world
 * dimension into the available SVG viewport, leaving `marginPx` of clearance
 * on each side for dimension lines/labels/title block.
 *
 * Accepts either a single extent (m) + a single pixel extent, or a
 * `{width,height}` real extent + `{width,height}` pixel extent, in which
 * case it returns the smaller (more conservative) of the two axis scales so
 * the whole drawing fits both ways.
 */
export function computeScale(realExtentMeters, svgPixelExtent, marginPx = 40) {
  if (realExtentMeters && typeof realExtentMeters === "object") {
    const sx = computeScale(realExtentMeters.width, svgPixelExtent.width, marginPx);
    const sy = computeScale(realExtentMeters.height, svgPixelExtent.height, marginPx);
    return Math.min(sx, sy);
  }
  const usablePx = Math.max(svgPixelExtent - marginPx * 2, 10);
  const extent = Math.max(realExtentMeters, 0.05);
  return usablePx / extent;
}

// ---------------------------------------------------------------------------
// Annotation primitives
// ---------------------------------------------------------------------------

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Engineering-style dimension line between two SVG points: extension lines
 * perpendicular to the measured edge, a dimension line offset from it with
 * arrowheads at both ends, and a label centred on it.
 *
 * @param {{x:number,y:number}} p1
 * @param {{x:number,y:number}} p2
 * @param {number} offsetPx - perpendicular offset of the dimension line from
 *   the measured edge (positive = to the right of the p1->p2 direction).
 * @param {string} label
 * @param {string} [color] - CSS color for the dimension ink. Markers can't
 *   reliably inherit `currentColor` from the referencing element (SVG
 *   `<marker>` content resolves `currentColor` against its own subtree, not
 *   the caller's), so dimension/leader lines take an explicit color rather
 *   than relying on CSS inheritance.
 */
export function dimensionLine(p1, p2, offsetPx, label, color = "rgb(var(--color-recharge-water))") {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const ox = nx * offsetPx;
  const oy = ny * offsetPx;

  const d1 = { x: p1.x + ox, y: p1.y + oy };
  const d2 = { x: p2.x + ox, y: p2.y + oy };
  const midX = (d1.x + d2.x) / 2;
  const midY = (d1.y + d2.y) / 2;
  // Small perpendicular nudge so the label doesn't sit on the line itself.
  const labelX = midX + nx * (offsetPx >= 0 ? 10 : -10);
  const labelY = midY + ny * (offsetPx >= 0 ? 10 : -10);

  const shapes = [
    // Extension lines: measured point out to the dimension line.
    { type: "line", x1: p1.x, y1: p1.y, x2: d1.x, y2: d1.y, stroke: color, strokeWidth: 0.75, dash: "2 2", opacity: 0.55 },
    { type: "line", x1: p2.x, y1: p2.y, x2: d2.x, y2: d2.y, stroke: color, strokeWidth: 0.75, dash: "2 2", opacity: 0.55 },
    // Dimension line itself with arrowheads at both ends.
    {
      type: "line",
      x1: d1.x,
      y1: d1.y,
      x2: d2.x,
      y2: d2.y,
      stroke: color,
      strokeWidth: 1.25,
      markerStart: "url(#cad-arrow-start)",
      markerEnd: "url(#cad-arrow-end)",
    },
    {
      type: "text",
      x: labelX,
      y: labelY,
      text: label,
      anchor: "middle",
      size: 10,
      weight: 700,
      fill: color,
    },
  ];

  return { shapes, d1, d2, labelX, labelY };
}

/**
 * A leader line: a line from a label anchor to a feature point, with an
 * arrowhead at the feature and the label text at the far end (e.g.
 * "PVC slotted pipe" pointing at a pipe in the drawing).
 *
 * @param {{x:number,y:number}} fromPoint - where the label sits.
 * @param {{x:number,y:number}} toPoint - the feature being annotated (arrow tip).
 * @param {string} label
 * @param {string} [color]
 */
export function leaderLine(fromPoint, toPoint, label, color = "rgb(var(--color-sand))") {
  const anchor = fromPoint.x >= toPoint.x ? "start" : "end";
  const labelOffsetX = anchor === "start" ? 4 : -4;
  const shapes = [
    {
      type: "line",
      x1: fromPoint.x,
      y1: fromPoint.y,
      x2: toPoint.x,
      y2: toPoint.y,
      stroke: color,
      strokeWidth: 1,
      markerEnd: "url(#cad-arrow-leader)",
    },
    {
      type: "text",
      x: fromPoint.x + labelOffsetX,
      y: fromPoint.y,
      text: label,
      anchor,
      size: 10,
      weight: 600,
      fill: color,
    },
  ];
  return { shapes, labelX: fromPoint.x + labelOffsetX, labelY: fromPoint.y };
}

/**
 * A simple north-arrow symbol: a filled triangle over an "N" label, centred
 * on `centerPoint`, `size` px tall.
 */
export function northArrow(centerPoint, size = 28) {
  const { x, y } = centerPoint;
  const halfW = size * 0.3;
  const top = y - size / 2;
  const bottom = y + size / 2;
  const mid = y + size * 0.05;
  const shapes = [
    // Left (shaded) half of the arrow.
    { type: "polygon", points: `${x},${top} ${x - halfW},${bottom} ${x},${mid}`, fill: "currentColor", opacity: 1 },
    // Right (outline) half of the arrow.
    { type: "polygon", points: `${x},${top} ${x + halfW},${bottom} ${x},${mid}`, fill: "none", stroke: "currentColor", strokeWidth: 1 },
    { type: "text", x, y: bottom + 12, text: "N", anchor: "middle", size: 11, weight: 700, fill: "currentColor" },
  ];
  return { shapes };
}

/**
 * A small rectangular CAD title block laid out in a grid — drawing title
 * spanning the top row, then project / scale / date / drawn-by cells below.
 *
 * @param {object} opts
 * @param {number} [opts.x=0] @param {number} [opts.y=0] top-left corner (px)
 * @param {number} [opts.width=260] @param {number} [opts.height=64]
 * @param {string} opts.projectName
 * @param {string} opts.drawingTitle
 * @param {string} opts.scale - e.g. "1:50 (auto-fit)"
 * @param {string} opts.date
 * @param {string} opts.drawnBy
 */
export function titleBlock({
  x = 0,
  y = 0,
  width = 260,
  height = 64,
  projectName = "RTRWH RECHARGE SYSTEM",
  drawingTitle = "",
  scale = "",
  date = "",
  drawnBy = "",
} = {}) {
  const titleRowH = 22;
  const colW = width / 2;
  const rowY = y + titleRowH;
  const rowH = height - titleRowH;

  const shapes = [
    { type: "rect", x, y, width, height, fill: "rgba(15,23,42,0.55)", stroke: "currentColor", strokeWidth: 1 },
    { type: "line", x1: x, y1: rowY, x2: x + width, y2: rowY, stroke: "currentColor", strokeWidth: 0.75, opacity: 0.6 },
    { type: "line", x1: x + colW, y1: rowY, x2: x + colW, y2: y + height, stroke: "currentColor", strokeWidth: 0.75, opacity: 0.6 },
    { type: "line", x1: x, y1: rowY + rowH / 2, x2: x + width, y2: rowY + rowH / 2, stroke: "currentColor", strokeWidth: 0.75, opacity: 0.6 },
    {
      type: "text",
      x: x + width / 2,
      y: y + titleRowH / 2 + 4,
      text: drawingTitle.toUpperCase(),
      anchor: "middle",
      size: 10.5,
      weight: 700,
      fill: "currentColor",
    },
    { type: "text", x: x + 8, y: rowY + rowH / 4 + 3, text: `PROJECT: ${projectName}`, anchor: "start", size: 8.5, fill: "currentColor" },
    { type: "text", x: x + colW + 8, y: rowY + rowH / 4 + 3, text: `SCALE: ${scale}`, anchor: "start", size: 8.5, fill: "currentColor" },
    { type: "text", x: x + 8, y: rowY + (rowH * 3) / 4 + 3, text: `DATE: ${date}`, anchor: "start", size: 8.5, fill: "currentColor" },
    { type: "text", x: x + colW + 8, y: rowY + (rowH * 3) / 4 + 3, text: `DRAWN: ${drawnBy}`, anchor: "start", size: 8.5, fill: "currentColor" },
  ];

  return { shapes, width, height };
}

/**
 * A graphic scale bar: alternating filled/unfilled segments with metre
 * labels, anchored at `originPoint`.
 *
 * @param {{x:number,y:number}} originPoint - left edge of the bar (px)
 * @param {number} scale - pixels per metre of the drawing this bar describes
 * @param {number} [unitsToShow=4] - number of segments
 * @param {number} [segmentMeters=1] - metres represented by each segment
 */
export function scaleBar(originPoint, scale, unitsToShow = 4, segmentMeters = 1) {
  const segW = scale * segmentMeters;
  const barH = 6;
  const shapes = [];
  for (let i = 0; i < unitsToShow; i++) {
    const sx = originPoint.x + i * segW;
    shapes.push({
      type: "rect",
      x: sx,
      y: originPoint.y,
      width: segW,
      height: barH,
      fill: i % 2 === 0 ? "currentColor" : "none",
      stroke: "currentColor",
      strokeWidth: 0.75,
    });
  }
  shapes.push({ type: "text", x: originPoint.x, y: originPoint.y + barH + 12, text: "0", anchor: "middle", size: 8, fill: "currentColor" });
  shapes.push({
    type: "text",
    x: originPoint.x + unitsToShow * segW,
    y: originPoint.y + barH + 12,
    text: `${round1(unitsToShow * segmentMeters)} m`,
    anchor: "middle",
    size: 8,
    fill: "currentColor",
  });
  return { shapes, width: unitsToShow * segW, height: barH + 14 };
}

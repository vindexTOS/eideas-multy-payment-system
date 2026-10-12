/**
 * Chart color roles.
 *
 * Three single-series charts, so color follows the entity (gross /
 * commission / net), never the rank of a bar. These are categorical slots
 * 1-3 of the validated palette; the triple passes the lightness band,
 * chroma floor, CVD separation (worst all-pairs dE 9.2) and the
 * normal-vision floor (worst 24.0) on a light surface.
 *
 * `net` sits below 3:1 contrast against the surface, which obliges the
 * relief rule - the earnings page therefore ships a monthly table view
 * alongside the columns.
 */
export const chartColors = {
  gross: "#2a78d6",
  commission: "#eb6834",
  net: "#1baf7a",
} as const;

export const chartInk = {
  primary: "#0b0b0b",
  secondary: "#52514e",
  grid: "#e8e8e4",
  surface: "#ffffff",
} as const;

export type ChartSeries = keyof typeof chartColors;

import { Empty } from "antd";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money, monthLabel } from "@/lib/format";
import type { EarningsMonth } from "@/types/api";
import { chartColors, chartInk, type ChartSeries } from "./chartTokens";

interface Props {
  data: EarningsMonth[];
  series: ChartSeries;
  /** Which numeric field of the month row to plot. */
  field: keyof Pick<EarningsMonth, "total" | "commission" | "net">;
  currency?: string;
  height?: number;
}

/**
 * One measure, one axis, one series - the chart title names it, so no
 * legend box. Columns carry rounded data-ends anchored to the baseline and
 * a per-bar hover tooltip; the grid and axes stay recessive.
 */
export const MonthlyColumnChart = ({
  data,
  series,
  field,
  currency = "GEL",
  height = 260,
}: Props) => {
  const { t } = useTranslation();

  if (!data.length) return <Empty description={t("common.noData")} />;

  const hasValues = data.some((row) => row[field] > 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
        barCategoryGap="28%"
      >
        <CartesianGrid stroke={chartInk.grid} vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={monthLabel}
          tick={{ fill: chartInk.secondary, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: chartInk.grid }}
          interval="preserveStartEnd"
          minTickGap={8}
        />
        <YAxis
          tick={{ fill: chartInk.secondary, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={72}
          // A zero-only series would otherwise render a meaningless 0..0 axis.
          domain={hasValues ? undefined : [0, 1]}
          tickFormatter={(value: number) => value.toLocaleString("ka-GE")}
        />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          contentStyle={{
            borderRadius: 8,
            border: `1px solid ${chartInk.grid}`,
            background: chartInk.surface,
            color: chartInk.primary,
          }}
          labelFormatter={(label: string) => monthLabel(label)}
          formatter={(value: number) =>
            [money(value, currency), ""] as [string, string]
          }
        />
        <Bar
          dataKey={field}
          fill={chartColors[series]}
          radius={[4, 4, 0, 0]}
          maxBarSize={44}
          // 2px of surface between neighbouring fills.
          stroke={chartInk.surface}
          strokeWidth={2}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

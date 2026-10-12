import {
  Card,
  Col,
  Row,
  Segmented,
  Space,
  Statistic,
  Table,
  Typography,
} from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { chartColors } from "@/components/charts/chartTokens";
import { MonthlyColumnChart } from "@/components/charts/MonthlyColumnChart";
import { money, monthLabel } from "@/lib/format";
import type { EarningsMonth, EarningsSeries } from "@/types/api";

/**
 * The three series the client asked for, as three separate charts rather
 * than one stacked/dual-axis chart: they answer three different questions
 * and gross/commission differ by an order of magnitude, which a shared
 * second axis would misrepresent.
 *
 * The table view is also the relief for the net series colour, which sits
 * below 3:1 contrast on a light surface.
 */
export const EarningsCharts = ({
  data,
  title,
}: {
  data: EarningsSeries;
  title?: string;
}) => {
  const { t } = useTranslation();
  const [view, setView] = useState<"charts" | "table">("charts");
  const { months, totals, currency } = data;

  const columns = [
    {
      title: t("earnings.month"),
      dataIndex: "month",
      render: (value: string) => monthLabel(value),
    },
    {
      title: t("earnings.gross"),
      dataIndex: "total",
      align: "right" as const,
      render: (value: number) => money(value, currency),
    },
    {
      title: t("earnings.commission"),
      dataIndex: "commission",
      align: "right" as const,
      render: (value: number) => money(value, currency),
    },
    {
      title: t("earnings.companyNet"),
      dataIndex: "net",
      align: "right" as const,
      render: (value: number) => money(value, currency),
    },
    {
      title: t("earnings.payments"),
      dataIndex: "count",
      align: "right" as const,
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title={t("earnings.gross")}
              value={money(totals.total, currency)}
              valueStyle={{ fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title={t("earnings.commission")}
              value={money(totals.commission, currency)}
              valueStyle={{ fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title={t("earnings.companyNet")}
              value={money(totals.net, currency)}
              valueStyle={{ fontSize: 22 }}
            />
          </Card>
        </Col>
      </Row>

      <Space
        align="center"
        style={{ justifyContent: "space-between", width: "100%" }}
        wrap
      >
        <Typography.Text type="secondary">
          {title ? `${title} · ` : ""}
          {t("earnings.period", {
            from: monthLabel(data.from),
            to: monthLabel(data.to),
            count: totals.count,
          })}
        </Typography.Text>
        <Segmented
          value={view}
          onChange={(value) => setView(value as "charts" | "table")}
          options={[
            { label: t("earnings.charts"), value: "charts" },
            { label: t("earnings.table"), value: "table" },
          ]}
        />
      </Space>

      {view === "table" ? (
        <Card>
          <Table<EarningsMonth>
            rowKey="month"
            size="small"
            dataSource={months}
            columns={columns}
            pagination={false}
            scroll={{ x: true }}
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={8}>
            <Card
              title={
                <ChartTitle
                  color={chartColors.gross}
                  label={t("earnings.grossByMonth")}
                />
              }
            >
              <MonthlyColumnChart
                data={months}
                series="gross"
                field="total"
                currency={currency}
              />
            </Card>
          </Col>
          <Col xs={24} xl={8}>
            <Card
              title={
                <ChartTitle
                  color={chartColors.commission}
                  label={t("earnings.commissionByMonth")}
                />
              }
            >
              <MonthlyColumnChart
                data={months}
                series="commission"
                field="commission"
                currency={currency}
              />
            </Card>
          </Col>
          <Col xs={24} xl={8}>
            <Card
              title={
                <ChartTitle
                  color={chartColors.net}
                  label={t("earnings.netByMonth")}
                />
              }
            >
              <MonthlyColumnChart
                data={months}
                series="net"
                field="net"
                currency={currency}
              />
            </Card>
          </Col>
        </Row>
      )}
    </Space>
  );
};

/** A colour chip beside the title carries identity; the text stays ink. */
const ChartTitle = ({ color, label }: { color: string; label: string }) => (
  <Space size={8}>
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 3,
        background: color,
        display: "inline-block",
      }}
    />
    <span>{label}</span>
  </Space>
);

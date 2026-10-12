import { useQuery } from "@tanstack/react-query";
import { Card, Descriptions, Select, Space, Table, Tag } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { earningsApi } from "@/features/earnings/api";
import { EarningsCharts } from "@/features/earnings/EarningsCharts";
import { paymentsApi } from "@/features/payments/api";
import { dateTime, money, relative } from "@/lib/format";
import { queryKeys } from "@/lib/queryKeys";
import type { Payment, PaymentStatus } from "@/types/api";
import { devicesApi } from "./api";

const STATUS_COLOR: Partial<Record<PaymentStatus, string>> = {
  success: "green",
  reversed: "orange",
};

/** Terminal detail: its data, its earnings columns and its latest payments. */
export const DeviceDetailPage = () => {
  const { deviceId = "" } = useParams();
  const { t } = useTranslation();
  const [months, setMonths] = useState(12);

  const device = useQuery({
    queryKey: queryKeys.device(deviceId),
    queryFn: () => devicesApi.get(deviceId),
    enabled: !!deviceId,
  });

  const earnings = useQuery({
    queryKey: queryKeys.deviceEarnings(deviceId, { months }),
    queryFn: () => earningsApi.deviceSeries(deviceId, { months }),
    enabled: !!deviceId,
  });

  const payments = useQuery({
    queryKey: queryKeys.payments({ deviceId, limit: 20 }),
    queryFn: () => paymentsApi.list({ deviceId, limit: 20 }),
    enabled: !!deviceId,
  });

  const paymentColumns = [
    {
      title: t("payments.paidAt"),
      dataIndex: "paidAt",
      render: (v: string) => dateTime(v),
    },
    {
      title: t("payments.amount"),
      dataIndex: "amount",
      align: "right" as const,
      render: (value: string) => money(value),
    },
    {
      title: t("payments.commission"),
      dataIndex: "commission",
      align: "right" as const,
      render: (value: string, row: Payment) => (
        <Space size={4}>
          {money(value)}
          <Tag>
            {row.appliedRule === "percent"
              ? t("payments.rulePercent")
              : t("payments.ruleMin")}
          </Tag>
        </Space>
      ),
    },
    {
      title: t("payments.net"),
      dataIndex: "netAmount",
      align: "right" as const,
      render: (value: string) => money(value),
    },
    {
      title: t("payments.source"),
      dataIndex: "source",
      render: (value: string) => t(`payments.sources.${value}`),
    },
    {
      title: t("common.status"),
      dataIndex: "status",
      render: (status: PaymentStatus) => (
        <Tag color={STATUS_COLOR[status]}>
          {t(`payments.statuses.${status}`)}
        </Tag>
      ),
    },
    {
      title: t("payments.reference"),
      dataIndex: "externalRef",
      render: (value: string | null) => value ?? t("common.dash"),
    },
  ];

  const typeName =
    device.data?.type === "other"
      ? (device.data.typeLabel ?? t("devices.types.other"))
      : device.data
        ? t(`devices.types.${device.data.type}`)
        : "";

  return (
    <>
      <PageHeader
        title={device.data?.name ?? t("devices.one")}
        subtitle={device.data?.deviceUid}
        crumbs={[
          { title: t("devices.title"), to: "/devices" },
          { title: device.data?.name ?? "..." },
        ]}
        actions={
          <Select
            style={{ width: 190 }}
            value={months}
            onChange={setMonths}
            options={[6, 12, 24].map((count) => ({
              label: t("earnings.lastMonths", { count }),
              value: count,
            }))}
          />
        }
      />

      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Card title={t("devices.detailsTitle")}>
          <QueryBoundary
            isLoading={device.isPending}
            error={device.error}
            rows={3}
          >
            {device.data && (
              <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
                <Descriptions.Item label={t("devices.deviceId")}>
                  {device.data.deviceUid}
                </Descriptions.Item>
                <Descriptions.Item label={t("devices.type")}>
                  {typeName}
                </Descriptions.Item>
                <Descriptions.Item label={t("devices.number")}>
                  {device.data.number ?? t("common.dash")}
                </Descriptions.Item>
                <Descriptions.Item label={t("devices.minTariff")}>
                  {money(device.data.minTariff)}
                </Descriptions.Item>
                <Descriptions.Item label={t("devices.percentTariff")}>
                  {device.data.percentTariff}%
                </Descriptions.Item>
                <Descriptions.Item label={t("common.status")}>
                  <Tag
                    color={
                      device.data.status === "active" ? "green" : "default"
                    }
                  >
                    {t(`devices.statuses.${device.data.status}`)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t("devices.address")}>
                  {device.data.address ?? t("common.dash")}
                </Descriptions.Item>
                <Descriptions.Item label={t("devices.lastSeen")}>
                  {relative(device.data.lastSeenAt, t("common.never"))}
                </Descriptions.Item>
                <Descriptions.Item label={t("common.comment")}>
                  {device.data.comment ?? t("common.dash")}
                </Descriptions.Item>
              </Descriptions>
            )}
          </QueryBoundary>
        </Card>

        <Card title={t("earnings.cardTitle")}>
          <QueryBoundary isLoading={earnings.isPending} error={earnings.error}>
            {earnings.data && (
              <EarningsCharts data={earnings.data} title={device.data?.name} />
            )}
          </QueryBoundary>
        </Card>

        <Card title={t("devices.latestPayments")}>
          <Table<Payment>
            rowKey="id"
            size="small"
            loading={payments.isPending}
            dataSource={payments.data?.items ?? []}
            columns={paymentColumns}
            pagination={false}
            scroll={{ x: true }}
          />
        </Card>
      </Space>
    </>
  );
};

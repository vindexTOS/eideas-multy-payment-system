import { useQuery } from "@tanstack/react-query";
import { Card, Select, Space, Table, Tag } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/common/PageHeader";
import { dateTime, money } from "@/lib/format";
import { queryKeys } from "@/lib/queryKeys";
import type { Payment, PaymentSource, PaymentStatus } from "@/types/api";
import { paymentsApi } from "./api";

const STATUSES: PaymentStatus[] = ["success", "pending", "failed", "reversed"];
const SOURCES: PaymentSource[] = ["terminal", "app_balance", "manual"];
const STATUS_COLOR: Partial<Record<PaymentStatus, string>> = {
  success: "green",
  reversed: "orange",
};

/** The ledger: every money-in event the caller is allowed to see. */
export const PaymentsPage = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PaymentStatus | undefined>();
  const [source, setSource] = useState<PaymentSource | undefined>();

  const params = { page, limit: 25, status, source };
  const { data, isPending } = useQuery({
    queryKey: queryKeys.payments(params),
    queryFn: () => paymentsApi.list(params),
  });

  const columns = [
    {
      title: t("payments.paidAt"),
      dataIndex: "paidAt",
      render: (v: string) => dateTime(v),
    },
    {
      title: t("devices.terminal"),
      key: "device",
      render: (_: unknown, row: Payment) =>
        row.device
          ? `${row.device.name} (${row.device.deviceUid})`
          : row.deviceId,
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
      render: (value: PaymentSource) => t(`payments.sources.${value}`),
    },
    {
      title: t("common.status"),
      dataIndex: "status",
      render: (value: PaymentStatus) => (
        <Tag color={STATUS_COLOR[value]}>{t(`payments.statuses.${value}`)}</Tag>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("payments.title")}
        subtitle={t("payments.subtitle")}
        actions={
          <Space wrap>
            <Select
              allowClear
              placeholder={t("common.status")}
              style={{ width: 160 }}
              value={status}
              onChange={setStatus}
              options={STATUSES.map((value) => ({
                label: t(`payments.statuses.${value}`),
                value,
              }))}
            />
            <Select
              allowClear
              placeholder={t("payments.source")}
              style={{ width: 190 }}
              value={source}
              onChange={setSource}
              options={SOURCES.map((value) => ({
                label: t(`payments.sources.${value}`),
                value,
              }))}
            />
          </Space>
        }
      />
      <Card>
        <Table<Payment>
          rowKey="id"
          loading={isPending}
          dataSource={data?.items ?? []}
          columns={columns}
          scroll={{ x: true }}
          pagination={{
            current: data?.meta.page ?? page,
            pageSize: data?.meta.limit ?? 25,
            total: data?.meta.total ?? 0,
            onChange: setPage,
            showSizeChanger: false,
          }}
        />
      </Card>
    </>
  );
};

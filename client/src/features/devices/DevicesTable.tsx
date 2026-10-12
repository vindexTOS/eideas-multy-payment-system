import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Popconfirm, Space, Table, Tag, Tooltip } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { money, relative } from "@/lib/format";
import { errorMessage } from "@/lib/http";
import { queryKeys } from "@/lib/queryKeys";
import type { DeviceStatus, DeviceSummary, DeviceType } from "@/types/api";
import { devicesApi, type DeviceListParams } from "./api";
import { DeviceFormModal } from "./DeviceFormModal";

const STATUS_COLOR: Record<DeviceStatus, string> = {
  active: "green",
  inactive: "default",
  blocked: "red",
};

/** Shared terminal table: used on the site page, the company page and /devices. */
export const DevicesTable = ({ params }: { params: DeviceListParams }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: queryKeys.devices(params),
    queryFn: () => devicesApi.list({ limit: 100, ...params }),
  });

  const editing = useQuery({
    queryKey: queryKeys.device(editingId ?? "none"),
    queryFn: () => devicesApi.get(editingId as string),
    enabled: !!editingId,
  });

  const remove = useMutation({
    mutationFn: devicesApi.remove,
    onSuccess: async () => {
      message.success(t("devices.deleted"));
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  /** `other` falls back to the free-text label the admin typed in. */
  const typeName = (type: DeviceType, label: string | null) =>
    type === "other" && label ? label : t(`devices.types.${type}`);

  const actionColumn = {
    title: "",
    key: "actions",
    width: 90,
    render: (_: unknown, row: DeviceSummary) => (
      <Space>
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => setEditingId(row.id)}
        />
        <Popconfirm
          title={t("devices.deleteConfirm")}
          description={t("devices.deleteHint")}
          onConfirm={() => remove.mutate(row.id)}
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  };

  const columns = [
    {
      title: t("devices.terminal"),
      dataIndex: "name",
      render: (name: string, row: DeviceSummary) => (
        <Space direction="vertical" size={0}>
          <a onClick={() => navigate(`/devices/${row.id}`)}>{name}</a>
          <span style={{ color: "#8c8c8c", fontSize: 12 }}>
            {row.deviceUid}
          </span>
        </Space>
      ),
    },
    {
      title: t("devices.type"),
      dataIndex: "type",
      render: (type: DeviceType, row: DeviceSummary) =>
        typeName(type, row.typeLabel),
    },
    {
      title: t("devices.object"),
      dataIndex: "siteName",
      render: (value?: string | null) => value ?? t("common.dash"),
    },
    {
      title: t("devices.number"),
      dataIndex: "number",
      render: (value?: string | null) => value ?? t("common.dash"),
    },
    {
      title: t("devices.tariff"),
      key: "tariff",
      render: (_: unknown, row: DeviceSummary) => (
        <Tooltip title={t("devices.tariffTooltip")}>
          {`${money(row.minTariff)} / ${row.percentTariff}%`}
        </Tooltip>
      ),
    },
    {
      title: t("companies.thisMonth"),
      dataIndex: "monthEarnings",
      align: "right" as const,
      render: (value: number) => money(value),
    },
    {
      title: t("payments.commission"),
      dataIndex: "monthCommission",
      align: "right" as const,
      render: (value: number) => money(value),
    },
    {
      title: t("devices.lastSeen"),
      dataIndex: "lastSeenAt",
      render: (value: string | null) => relative(value, t("common.never")),
    },
    {
      title: t("common.status"),
      dataIndex: "status",
      width: 110,
      render: (status: DeviceStatus) => (
        <Tag color={STATUS_COLOR[status]}>
          {t(`devices.statuses.${status}`)}
        </Tag>
      ),
    },
    ...(isAdmin ? [actionColumn] : []),
  ];

  return (
    <>
      <Table<DeviceSummary>
        rowKey="id"
        loading={isPending}
        dataSource={data?.items ?? []}
        columns={columns}
        pagination={false}
        scroll={{ x: true }}
      />
      <DeviceFormModal
        open={!!editingId && !!editing.data}
        device={editing.data}
        onClose={() => setEditingId(null)}
      />
    </>
  );
};

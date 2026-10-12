import {
  EyeInvisibleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Card, Space, Table, Tag, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/common/PageHeader";
import { DeviceFormModal } from "@/features/devices/DeviceFormModal";
import { dateTime, relative } from "@/lib/format";
import { errorMessage } from "@/lib/http";
import { queryKeys } from "@/lib/queryKeys";
import type { UnregisteredDevice } from "@/types/api";
import { registryApi } from "./api";

/**
 * Terminals that have reported to the broker but are not registered yet.
 * This is the admin inbox for new hardware.
 */
export const UnregisteredDevicesPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [registering, setRegistering] = useState(false);

  const { data, isPending, refetch, isFetching } = useQuery({
    queryKey: queryKeys.unregistered({ limit: 50 }),
    queryFn: () => registryApi.list({ limit: 50 }),
    // New hardware appears without a page reload.
    refetchInterval: 15_000,
  });

  const mqtt = useQuery({
    queryKey: queryKeys.mqttStatus,
    queryFn: registryApi.mqttStatus,
    refetchInterval: 20_000,
  });

  const ignore = useMutation({
    mutationFn: registryApi.ignore,
    onSuccess: async () => {
      message.success(t("registry.hidden"));
      await queryClient.invalidateQueries({
        queryKey: ["unregistered-devices"],
      });
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  const columns = [
    { title: t("registry.deviceId"), dataIndex: "deviceUid" },
    {
      title: t("registry.firstSeen"),
      dataIndex: "firstSeenAt",
      render: (v: string) => dateTime(v),
    },
    {
      title: t("registry.lastSeen"),
      dataIndex: "lastSeenAt",
      render: (value: string) => relative(value, t("common.never")),
    },
    {
      title: t("registry.messages"),
      dataIndex: "messageCount",
      align: "right" as const,
    },
    {
      title: t("registry.lastTopic"),
      dataIndex: "lastTopic",
      render: (value: string | null) => (
        <Typography.Text code copyable={!!value}>
          {value ?? t("common.dash")}
        </Typography.Text>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 60,
      render: (_: unknown, row: UnregisteredDevice) => (
        <Button
          size="small"
          icon={<EyeInvisibleOutlined />}
          title={t("registry.hide")}
          onClick={() => ignore.mutate(row.id)}
        />
      ),
    },
  ];

  const status = mqtt.data;
  const alertMessage = !status
    ? ""
    : status.connected
      ? t("registry.mqtt.connected", {
          url: status.url,
          topic: status.subscribedTo,
        })
      : status.enabled
        ? `${t("registry.mqtt.notConnected", { url: status.url })}${
            status.lastError ? ` — ${status.lastError}` : ""
          }`
        : t("registry.mqtt.disabled");

  return (
    <>
      <PageHeader
        title={t("registry.title")}
        subtitle={t("registry.subtitle")}
        actions={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              loading={isFetching}
              onClick={() => refetch()}
            >
              {t("common.refresh")}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setRegistering(true)}
            >
              {t("devices.register")}
            </Button>
          </Space>
        }
      />

      {status && (
        <Alert
          style={{ marginBottom: 16 }}
          type={
            status.connected ? "success" : status.enabled ? "error" : "warning"
          }
          showIcon
          message={alertMessage}
          description={
            <Space wrap size="large">
              <span>
                {t("registry.mqtt.received")}{" "}
                <Tag>{status.router.received}</Tag>
              </span>
              <span>
                {t("registry.mqtt.handled")}{" "}
                <Tag color="green">{status.router.handled}</Tag>
              </span>
              <span>
                {t("registry.mqtt.failed")}{" "}
                <Tag color={status.router.failed ? "red" : "default"}>
                  {status.router.failed}
                </Tag>
              </span>
              <span>
                {t("registry.mqtt.unknownIds")}{" "}
                <Tag>{status.router.unknownDevices}</Tag>
              </span>
              <span>
                {t("registry.mqtt.lastFrame", {
                  when: relative(
                    status.router.lastMessageAt,
                    t("common.never"),
                  ),
                })}
              </span>
            </Space>
          }
        />
      )}

      <Card>
        <Table<UnregisteredDevice>
          rowKey="id"
          loading={isPending}
          dataSource={data?.items ?? []}
          columns={columns}
          pagination={false}
          scroll={{ x: true }}
        />
      </Card>

      <DeviceFormModal
        open={registering}
        onClose={() => setRegistering(false)}
      />
    </>
  );
};

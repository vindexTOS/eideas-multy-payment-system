import { PlusOutlined } from "@ant-design/icons";
import { Button, Card, Input, Select, Space } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/features/auth/useAuth";
import type { DeviceStatus, DeviceType } from "@/types/api";
import { DeviceFormModal } from "./DeviceFormModal";
import { DevicesTable } from "./DevicesTable";

const TYPES: DeviceType[] = [
  "car_wash",
  "barrier",
  "parking",
  "vacuum",
  "other",
];
const STATUSES: DeviceStatus[] = ["active", "inactive", "blocked"];

/** Flat list of every terminal the caller may see. */
export const DevicesPage = () => {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<DeviceType | undefined>();
  const [status, setStatus] = useState<DeviceStatus | undefined>();

  const companyId = searchParams.get("companyId") ?? undefined;

  return (
    <>
      <PageHeader
        title={t("devices.title")}
        subtitle={t("devices.subtitle")}
        actions={
          <Space wrap>
            <Input.Search
              allowClear
              placeholder={t("devices.searchPlaceholder")}
              style={{ width: 260 }}
              onSearch={setSearch}
            />
            <Select
              allowClear
              placeholder={t("devices.type")}
              style={{ width: 160 }}
              value={type}
              onChange={setType}
              options={TYPES.map((value) => ({
                label: t(`devices.types.${value}`),
                value,
              }))}
            />
            <Select
              allowClear
              placeholder={t("common.status")}
              style={{ width: 150 }}
              value={status}
              onChange={setStatus}
              options={STATUSES.map((value) => ({
                label: t(`devices.statuses.${value}`),
                value,
              }))}
            />
            {isAdmin && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreating(true)}
              >
                {t("devices.register")}
              </Button>
            )}
          </Space>
        }
      />
      <Card>
        <DevicesTable
          params={{ companyId, search: search || undefined, type, status }}
        />
      </Card>

      <DeviceFormModal
        open={creating}
        companyId={companyId}
        onClose={() => setCreating(false)}
      />
    </>
  );
};

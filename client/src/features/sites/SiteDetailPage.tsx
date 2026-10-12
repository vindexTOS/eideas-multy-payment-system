import { PlusOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Descriptions, Space } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { useAuth } from "@/features/auth/useAuth";
import { DeviceFormModal } from "@/features/devices/DeviceFormModal";
import { DevicesTable } from "@/features/devices/DevicesTable";
import { earningsApi } from "@/features/earnings/api";
import { EarningsCharts } from "@/features/earnings/EarningsCharts";
import { queryKeys } from "@/lib/queryKeys";
import { sitesApi } from "./api";

/** Object (address) -> the terminals installed on it. */
export const SiteDetailPage = () => {
  const { companyId, siteId = "" } = useParams();
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [creating, setCreating] = useState(false);

  const site = useQuery({
    queryKey: queryKeys.site(siteId),
    queryFn: () => sitesApi.get(siteId),
    enabled: !!siteId,
  });

  const earnings = useQuery({
    queryKey: queryKeys.earnings({ siteId, months: 12 }),
    queryFn: () => earningsApi.siteSeries(siteId, { months: 12 }),
    enabled: !!siteId,
  });

  const crumbs = [
    { title: t("companies.title"), to: "/companies" },
    ...(companyId
      ? [{ title: t("companies.one"), to: `/companies/${companyId}` }]
      : []),
    { title: site.data?.name ?? "..." },
  ];

  return (
    <>
      <PageHeader
        title={site.data?.name ?? t("sites.one")}
        subtitle={site.data?.address}
        crumbs={crumbs}
        actions={
          isAdmin && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreating(true)}
            >
              {t("devices.register")}
            </Button>
          )
        }
      />

      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Card title={t("sites.detailsTitle")}>
          <QueryBoundary isLoading={site.isPending} error={site.error} rows={2}>
            {site.data && (
              <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
                <Descriptions.Item label={t("sites.address")}>
                  {site.data.address}
                </Descriptions.Item>
                <Descriptions.Item label={t("sites.city")}>
                  {site.data.city ?? t("common.dash")}
                </Descriptions.Item>
                <Descriptions.Item label={t("common.status")}>
                  {site.data.isActive
                    ? t("common.active")
                    : t("common.inactive")}
                </Descriptions.Item>
                <Descriptions.Item label={t("common.comment")}>
                  {site.data.comment ?? t("common.dash")}
                </Descriptions.Item>
              </Descriptions>
            )}
          </QueryBoundary>
        </Card>

        <Card title={t("sites.devicesOnObject")}>
          <DevicesTable params={{ siteId }} />
        </Card>

        <Card title={t("earnings.cardTitle")}>
          <QueryBoundary isLoading={earnings.isPending} error={earnings.error}>
            {earnings.data && (
              <EarningsCharts data={earnings.data} title={site.data?.name} />
            )}
          </QueryBoundary>
        </Card>
      </Space>

      <DeviceFormModal
        open={creating}
        companyId={site.data?.companyId}
        siteId={siteId}
        onClose={() => setCreating(false)}
      />
    </>
  );
};

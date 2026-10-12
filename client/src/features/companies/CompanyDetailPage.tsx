import { PlusOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Descriptions, Space, Table, Tag } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { useAuth } from "@/features/auth/useAuth";
import { sitesApi } from "@/features/sites/api";
import { SiteFormModal } from "@/features/sites/SiteFormModal";
import { money } from "@/lib/format";
import { queryKeys } from "@/lib/queryKeys";
import type { SiteSummary } from "@/types/api";
import { companiesApi } from "./api";

/** Company -> its objects (addresses). Drill down continues on each object. */
export const CompanyDetailPage = () => {
  const { companyId = "" } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin, can } = useAuth();
  const [creating, setCreating] = useState(false);

  const company = useQuery({
    queryKey: queryKeys.company(companyId),
    queryFn: () => companiesApi.get(companyId),
    enabled: !!companyId,
  });

  const sites = useQuery({
    queryKey: queryKeys.sites({ companyId }),
    queryFn: () => sitesApi.list({ companyId, limit: 100 }),
    enabled: !!companyId,
  });

  const columns = [
    {
      title: t("sites.one"),
      dataIndex: "name",
      render: (name: string, row: SiteSummary) => (
        <a onClick={() => navigate(`/companies/${companyId}/sites/${row.id}`)}>
          {name}
        </a>
      ),
    },
    { title: t("sites.address"), dataIndex: "address" },
    {
      title: t("companies.devices"),
      dataIndex: "deviceCount",
      align: "right" as const,
      width: 100,
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
      title: t("common.status"),
      dataIndex: "isActive",
      width: 100,
      render: (active: boolean) =>
        active ? (
          <Tag color="green">{t("common.active")}</Tag>
        ) : (
          <Tag>{t("common.inactive")}</Tag>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title={company.data?.name ?? t("companies.one")}
        subtitle={company.data?.identificationCode}
        crumbs={[
          { title: t("companies.title"), to: "/companies" },
          { title: company.data?.name ?? "..." },
        ]}
        actions={
          can("admin", "company") && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreating(true)}
            >
              {t("sites.create")}
            </Button>
          )
        }
      />

      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Card title={t("companies.detailsTitle")}>
          <QueryBoundary
            isLoading={company.isPending}
            error={company.error}
            rows={3}
          >
            {company.data && (
              <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
                <Descriptions.Item label={t("companies.identificationCode")}>
                  {company.data.identificationCode}
                </Descriptions.Item>
                <Descriptions.Item label={t("companies.email")}>
                  {company.data.email}
                </Descriptions.Item>
                <Descriptions.Item label={t("companies.phone")}>
                  {company.data.phone}
                </Descriptions.Item>
                <Descriptions.Item label={t("companies.legalAddress")}>
                  {company.data.legalAddress}
                </Descriptions.Item>
                <Descriptions.Item label={t("companies.bankAccount")}>
                  {company.data.bankAccount}
                </Descriptions.Item>
                <Descriptions.Item label={t("common.status")}>
                  {company.data.isActive
                    ? t("common.active")
                    : t("common.inactive")}
                </Descriptions.Item>
              </Descriptions>
            )}
          </QueryBoundary>
        </Card>

        <Card
          title={t("companies.objects")}
          extra={
            isAdmin && (
              <Button
                size="small"
                onClick={() => navigate(`/devices?companyId=${companyId}`)}
              >
                {t("companies.allDevices")}
              </Button>
            )
          }
        >
          <Table<SiteSummary>
            rowKey="id"
            loading={sites.isPending}
            dataSource={sites.data?.items ?? []}
            columns={columns}
            pagination={false}
            scroll={{ x: true }}
          />
        </Card>
      </Space>

      <SiteFormModal
        open={creating}
        companyId={companyId}
        onClose={() => setCreating(false)}
      />
    </>
  );
};

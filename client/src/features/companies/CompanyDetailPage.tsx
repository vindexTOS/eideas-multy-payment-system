import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Descriptions,
  Popconfirm,
  Space,
  Table,
  Tag,
} from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { useAuth } from "@/features/auth/useAuth";
import { sitesApi } from "@/features/sites/api";
import { SiteFormModal } from "@/features/sites/SiteFormModal";
import { money } from "@/lib/format";
import { errorMessage } from "@/lib/http";
import { queryKeys } from "@/lib/queryKeys";
import type { Site, SiteSummary } from "@/types/api";
import { companiesApi } from "./api";

/** Company -> its objects (addresses). Drill down continues on each object. */
export const CompanyDetailPage = () => {
  const { companyId = "" } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin, isCompany } = useAuth();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  // undefined = form closed, null = new object, Site = editing that object.
  const [editing, setEditing] = useState<Site | null | undefined>(undefined);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);

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

  // A list row has no comment, so Edit loads the full object first.
  const startEdit = async (id: string) => {
    setLoadingEdit(id);
    try {
      setEditing(
        await queryClient.fetchQuery({
          queryKey: queryKeys.site(id),
          queryFn: () => sitesApi.get(id),
          staleTime: 0,
        }),
      );
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoadingEdit(null);
    }
  };

  const remove = useMutation({
    mutationFn: sitesApi.remove,
    onSuccess: async () => {
      message.success(t("sites.deleted"));
      // Its devices were detached, so device lists change too.
      await Promise.all(
        ["sites", "site", "devices", "device", "companies"].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  const actionColumn = {
    title: "",
    key: "actions",
    width: 90,
    render: (_: unknown, row: SiteSummary) => (
      <Space>
        <Button
          size="small"
          icon={<EditOutlined />}
          aria-label={t("common.edit")}
          loading={loadingEdit === row.id}
          onClick={() => startEdit(row.id)}
        />
        <Popconfirm
          title={t("sites.deleteConfirm")}
          description={t("sites.deleteHint")}
          onConfirm={() => remove.mutate(row.id)}
        >
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            aria-label={t("common.delete")}
          />
        </Popconfirm>
      </Space>
    ),
  };

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
    // Companies are view-only: objects are edited and deleted by an admin.
    ...(isAdmin ? [actionColumn] : []),
  ];

  return (
    <>
      <PageHeader
        title={company.data?.name ?? t("companies.one")}
        subtitle={company.data?.identificationCode}
        crumbs={
          // A company's panel is its top level: there is no list above it.
          isCompany
            ? undefined
            : [
                { title: t("companies.title"), to: "/companies" },
                { title: company.data?.name ?? "..." },
              ]
        }
        actions={
          // Companies are view-only for now (brief): objects are added by an admin.
          isAdmin && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setEditing(null)}
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
        open={editing !== undefined}
        site={editing}
        companyId={companyId}
        onClose={() => setEditing(undefined)}
      />
    </>
  );
};

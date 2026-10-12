import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Input,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/features/auth/useAuth";
import { money } from "@/lib/format";
import { errorMessage } from "@/lib/http";
import { queryKeys } from "@/lib/queryKeys";
import type { Company, CompanySummary } from "@/types/api";
import { companiesApi } from "./api";
import { CompanyFormModal } from "./CompanyFormModal";

/** Admin landing page: every company with its objects, devices and money. */
export const CompaniesPage = () => {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Company | null | undefined>(undefined);

  const params = { page, limit: 20, search: search || undefined };
  const { data, isPending } = useQuery({
    queryKey: queryKeys.companies(params),
    queryFn: () => companiesApi.list(params),
  });

  const remove = useMutation({
    mutationFn: companiesApi.remove,
    onSuccess: async () => {
      message.success(t("companies.deleted"));
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  const actionColumn = {
    title: "",
    key: "actions",
    width: 90,
    render: (_: unknown, row: CompanySummary) => (
      <Space>
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => setEditing(row as unknown as Company)}
        />
        <Popconfirm
          title={t("companies.deleteConfirm")}
          description={t("companies.deleteHint")}
          onConfirm={() => remove.mutate(row.id)}
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  };

  const columns = [
    {
      title: t("companies.one"),
      dataIndex: "name",
      render: (name: string, row: CompanySummary) => (
        <Space direction="vertical" size={0}>
          <a onClick={() => navigate(`/companies/${row.id}`)}>{name}</a>
          <span style={{ color: "#8c8c8c", fontSize: 12 }}>
            {row.identificationCode}
          </span>
        </Space>
      ),
    },
    { title: t("companies.phone"), dataIndex: "phone" },
    { title: t("companies.email"), dataIndex: "email" },
    {
      title: t("companies.objects"),
      dataIndex: "siteCount",
      align: "right" as const,
      width: 90,
    },
    {
      title: t("companies.devices"),
      dataIndex: "deviceCount",
      align: "right" as const,
      width: 90,
    },
    {
      title: t("companies.thisMonth"),
      dataIndex: "monthEarnings",
      align: "right" as const,
      render: (value: number, row: CompanySummary) => (
        <Tooltip
          title={t("companies.commissionTooltip", {
            value: money(row.monthCommission),
          })}
        >
          {money(value)}
        </Tooltip>
      ),
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
    ...(isAdmin ? [actionColumn] : []),
  ];

  return (
    <>
      <PageHeader
        title={t("companies.title")}
        subtitle={t("companies.subtitle")}
        actions={
          <Space>
            <Input.Search
              allowClear
              placeholder={t("companies.searchPlaceholder")}
              style={{ width: 240 }}
              onSearch={(value) => {
                setSearch(value);
                setPage(1);
              }}
            />
            {isAdmin && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setEditing(null)}
              >
                {t("companies.create")}
              </Button>
            )}
          </Space>
        }
      />
      <Card>
        <Table<CompanySummary>
          rowKey="id"
          loading={isPending}
          dataSource={data?.items ?? []}
          columns={columns}
          scroll={{ x: true }}
          pagination={{
            current: data?.meta.page ?? page,
            pageSize: data?.meta.limit ?? 20,
            total: data?.meta.total ?? 0,
            onChange: setPage,
            showSizeChanger: false,
          }}
        />
      </Card>

      <CompanyFormModal
        open={editing !== undefined}
        company={editing}
        onClose={() => setEditing(undefined)}
      />
    </>
  );
};

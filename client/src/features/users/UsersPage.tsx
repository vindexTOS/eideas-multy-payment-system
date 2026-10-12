import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Popconfirm, Space, Table, Tag } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/common/PageHeader";
import { dateTime } from "@/lib/format";
import { errorMessage } from "@/lib/http";
import { queryKeys } from "@/lib/queryKeys";
import type { AppUser, UserRole } from "@/types/api";
import { usersApi } from "./api";
import { UserFormModal } from "./UserFormModal";

const ROLE_COLOR: Record<UserRole, string> = {
  admin: "purple",
  company: "blue",
  manager: "cyan",
};

export const UsersPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AppUser | null | undefined>(undefined);

  const params = { page, limit: 25 };
  const { data, isPending } = useQuery({
    queryKey: queryKeys.users(params),
    queryFn: () => usersApi.list(params),
  });

  const remove = useMutation({
    mutationFn: usersApi.remove,
    onSuccess: async () => {
      message.success(t("users.deleted"));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  const columns = [
    { title: t("users.fullName"), dataIndex: "fullName" },
    { title: t("users.email"), dataIndex: "email" },
    {
      title: t("users.role"),
      dataIndex: "role",
      render: (role: UserRole) => (
        <Tag color={ROLE_COLOR[role]}>{t(`users.roles.${role}`)}</Tag>
      ),
    },
    {
      title: t("users.company"),
      dataIndex: "companyName",
      render: (value: string | null) => value ?? t("common.dash"),
    },
    {
      title: t("users.devices"),
      dataIndex: "deviceIds",
      align: "right" as const,
      render: (ids: string[], row: AppUser) =>
        row.role === "manager" ? ids.length : t("common.dash"),
    },
    {
      title: t("users.lastLogin"),
      dataIndex: "lastLoginAt",
      render: (value: string | null) =>
        value ? dateTime(value) : t("common.never"),
    },
    {
      title: t("common.status"),
      dataIndex: "isActive",
      render: (active: boolean) =>
        active ? (
          <Tag color="green">{t("common.active")}</Tag>
        ) : (
          <Tag>{t("common.inactive")}</Tag>
        ),
    },
    {
      title: "",
      key: "actions",
      width: 90,
      render: (_: unknown, row: AppUser) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => setEditing(row)}
          />
          <Popconfirm
            title={t("users.deleteConfirm")}
            onConfirm={() => remove.mutate(row.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("users.title")}
        subtitle={t("users.subtitle")}
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setEditing(null)}
          >
            {t("users.create")}
          </Button>
        }
      />
      <Card>
        <Table<AppUser>
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

      <UserFormModal
        open={editing !== undefined}
        user={editing}
        onClose={() => setEditing(undefined)}
      />
    </>
  );
};

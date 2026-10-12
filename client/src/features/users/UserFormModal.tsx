import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Form, Input, Modal, Select, Switch } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/features/auth/useAuth";
import { companiesApi } from "@/features/companies/api";
import { devicesApi } from "@/features/devices/api";
import { errorMessage } from "@/lib/http";
import { queryKeys } from "@/lib/queryKeys";
import type { AppUser, UserRole } from "@/types/api";
import { usersApi, type UserPayload } from "./api";

/**
 * Roles: admin / company / manager. A manager is given an explicit device
 * list - that is how a company lets an employee watch specific addresses.
 */
export const UserFormModal = ({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user?: AppUser | null;
  onClose: () => void;
}) => {
  const [form] = Form.useForm<UserPayload>();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { isAdmin, user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const role = Form.useWatch("role", form);
  const companyId =
    Form.useWatch("companyId", form) ?? currentUser?.companyId ?? undefined;

  const companies = useQuery({
    queryKey: queryKeys.companies({ limit: 200 }),
    queryFn: () => companiesApi.list({ limit: 200 }),
    enabled: open && isAdmin,
  });

  const devices = useQuery({
    queryKey: queryKeys.devices({ companyId, limit: 200 }),
    queryFn: () => devicesApi.list({ companyId, limit: 200 }),
    enabled: open && role === "manager" && !!companyId,
  });

  useEffect(() => {
    if (!open) return;
    if (user) {
      form.setFieldsValue({
        email: user.email,
        fullName: user.fullName,
        phone: user.phone ?? undefined,
        role: user.role,
        companyId: user.companyId ?? undefined,
        deviceIds: user.deviceIds,
        isActive: user.isActive,
        password: undefined,
      });
    } else {
      form.resetFields();
    }
  }, [open, user, form]);

  const mutation = useMutation({
    mutationFn: (values: UserPayload) => {
      if (user) {
        const { email, fullName, phone, isActive, deviceIds, password } =
          values;
        return usersApi.update(user.id, {
          email,
          fullName,
          phone,
          isActive,
          deviceIds,
          ...(password ? { password } : {}),
        });
      }
      return usersApi.create(values);
    },
    onSuccess: async () => {
      message.success(user ? t("users.updated") : t("users.created"));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  return (
    <Modal
      open={open}
      title={
        user ? t("users.editTitle", { name: user.fullName }) : t("users.create")
      }
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={mutation.isPending}
      okText={t("common.save")}
      cancelText={t("common.cancel")}
      destroyOnHidden
    >
      <Form<UserPayload>
        form={form}
        layout="vertical"
        onFinish={(values) => mutation.mutate(values)}
        initialValues={{ role: "manager", isActive: true }}
      >
        <Form.Item
          name="fullName"
          label={t("users.fullName")}
          rules={[{ required: true, message: t("validation.required") }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="email"
          label={t("users.email")}
          rules={[
            {
              required: true,
              type: "email",
              message: t("validation.emailRequired"),
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="password"
          label={user ? t("users.newPassword") : t("users.password")}
          rules={[
            { required: !user, min: 8, message: t("users.passwordHint") },
          ]}
        >
          <Input.Password placeholder={t("users.passwordHint")} />
        </Form.Item>
        <Form.Item name="phone" label={t("users.phone")}>
          <Input />
        </Form.Item>
        <Form.Item
          name="role"
          label={t("users.role")}
          rules={[{ required: true, message: t("validation.required") }]}
        >
          <Select
            disabled={!!user}
            options={[
              ...(isAdmin
                ? [
                    {
                      label: t("users.roles.admin"),
                      value: "admin" as UserRole,
                    },
                    {
                      label: t("users.roles.company"),
                      value: "company" as UserRole,
                    },
                  ]
                : []),
              { label: t("users.roles.manager"), value: "manager" as UserRole },
            ]}
          />
        </Form.Item>
        {isAdmin && role !== "admin" && (
          <Form.Item
            name="companyId"
            label={t("users.company")}
            rules={[{ required: true, message: t("validation.required") }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              disabled={!!user}
              loading={companies.isLoading}
              options={(companies.data?.items ?? []).map((company) => ({
                label: company.name,
                value: company.id,
              }))}
            />
          </Form.Item>
        )}
        {role === "manager" && (
          <Form.Item
            name="deviceIds"
            label={t("users.managerDevices")}
            tooltip={t("users.managerDevicesTooltip")}
          >
            <Select
              mode="multiple"
              allowClear
              loading={devices.isLoading}
              optionFilterProp="label"
              placeholder={t("users.pickDevices")}
              options={(devices.data?.items ?? []).map((device) => ({
                label: `${device.name} (${device.deviceUid})`,
                value: device.id,
              }))}
            />
          </Form.Item>
        )}
        <Form.Item
          name="isActive"
          label={t("common.status")}
          valuePropName="checked"
        >
          <Switch
            checkedChildren={t("common.active")}
            unCheckedChildren={t("common.inactive")}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

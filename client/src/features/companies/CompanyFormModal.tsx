import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Form, Input, Modal, Switch } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/lib/http";
import type { Company } from "@/types/api";
import { companiesApi, type CompanyPayload } from "./api";

export const CompanyFormModal = ({
  open,
  company,
  onClose,
}: {
  open: boolean;
  company?: Company | null;
  onClose: () => void;
}) => {
  const [form] = Form.useForm<CompanyPayload>();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    // Always start clean: the form instance outlives the modal, so without
    // this a password typed earlier (even for another company) stays in the
    // field on Edit - visible, and saved again as that company's password.
    form.resetFields();
    if (company)
      form.setFieldsValue({
        ...company,
        comment: company.comment ?? undefined,
        password: undefined,
      });
  }, [open, company, form]);

  const mutation = useMutation({
    mutationFn: ({ password, ...values }: CompanyPayload) => {
      // An emptied field comes back as "": on edit that means "keep it".
      const withPassword = password ? { ...values, password } : values;
      return company
        ? companiesApi.update(company.id, withPassword)
        : companiesApi.create(withPassword);
    },
    onSuccess: async () => {
      message.success(
        company ? t("companies.updated") : t("companies.created"),
      );
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      if (company)
        await queryClient.invalidateQueries({
          queryKey: ["company", company.id],
        });
      onClose();
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  return (
    <Modal
      open={open}
      title={
        company
          ? t("companies.editTitle", { name: company.name })
          : t("companies.create")
      }
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={mutation.isPending}
      okText={t("common.save")}
      cancelText={t("common.cancel")}
      destroyOnHidden
    >
      <Form<CompanyPayload>
        form={form}
        layout="vertical"
        onFinish={(values) => mutation.mutate(values)}
        initialValues={{ isActive: true }}
      >
        <Form.Item
          name="name"
          label={t("companies.name")}
          rules={[{ required: true, message: t("validation.required") }]}
        >
          <Input placeholder="Clean Car LLC" />
        </Form.Item>
        <Form.Item
          name="identificationCode"
          label={t("companies.identificationCode")}
          rules={[
            { required: true, min: 5, message: t("validation.required") },
          ]}
        >
          <Input placeholder="405123456" />
        </Form.Item>
        <Form.Item
          name="email"
          label={t("companies.email")}
          extra={t("companies.emailIsLogin")}
          rules={[
            {
              required: true,
              type: "email",
              message: t("validation.emailRequired"),
            },
          ]}
        >
          <Input placeholder="office@cleancar.ge" autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="password"
          label={
            company ? t("companies.newPassword") : t("companies.password")
          }
          rules={[
            {
              required: !company,
              min: 8,
              max: 72,
              message: t("users.passwordHint"),
            },
          ]}
        >
          {/* new-password: the browser must not autofill the admin's own one. */}
          <Input.Password
            placeholder={t("users.passwordHint")}
            autoComplete="new-password"
          />
        </Form.Item>
        <Form.Item
          name="phone"
          label={t("companies.phone")}
          rules={[{ required: true, message: t("validation.required") }]}
        >
          <Input placeholder="+995555123456" />
        </Form.Item>
        <Form.Item
          name="legalAddress"
          label={t("companies.legalAddress")}
          rules={[{ required: true, message: t("validation.required") }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="bankAccount"
          label={t("companies.bankAccount")}
          rules={[{ required: true, message: t("validation.required") }]}
        >
          <Input placeholder="GE29TB0000000123456789" />
        </Form.Item>
        <Form.Item name="comment" label={t("common.comment")}>
          <Input.TextArea rows={2} />
        </Form.Item>
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

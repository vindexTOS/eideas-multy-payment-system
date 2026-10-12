import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Form, Input, Modal, Switch } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/lib/http";
import type { Site } from "@/types/api";
import { sitesApi, type SitePayload } from "./api";

export const SiteFormModal = ({
  open,
  site,
  companyId,
  onClose,
}: {
  open: boolean;
  site?: Site | null;
  companyId?: string;
  onClose: () => void;
}) => {
  const [form] = Form.useForm<SitePayload>();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    if (site) {
      form.setFieldsValue({
        name: site.name,
        address: site.address,
        city: site.city ?? undefined,
        comment: site.comment ?? undefined,
        isActive: site.isActive,
      });
    } else {
      form.resetFields();
    }
  }, [open, site, form]);

  const mutation = useMutation({
    mutationFn: (values: SitePayload) =>
      site
        ? sitesApi.update(site.id, values)
        : sitesApi.create({ ...values, companyId }),
    onSuccess: async () => {
      message.success(site ? t("sites.updated") : t("sites.created"));
      await queryClient.invalidateQueries({ queryKey: ["sites"] });
      onClose();
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  return (
    <Modal
      open={open}
      title={
        site ? t("sites.editTitle", { name: site.name }) : t("sites.create")
      }
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={mutation.isPending}
      okText={t("common.save")}
      cancelText={t("common.cancel")}
      destroyOnHidden
    >
      <Form<SitePayload>
        form={form}
        layout="vertical"
        onFinish={(values) => mutation.mutate(values)}
        initialValues={{ isActive: true }}
      >
        <Form.Item
          name="name"
          label={t("sites.name")}
          rules={[{ required: true, message: t("validation.required") }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="address"
          label={t("sites.address")}
          rules={[{ required: true, message: t("validation.required") }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="city" label={t("sites.city")}>
          <Input />
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Col, Form, Input, InputNumber, Modal, Row, Select } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/features/auth/useAuth";
import { companiesApi } from "@/features/companies/api";
import { registryApi } from "@/features/registry/api";
import { sitesApi } from "@/features/sites/api";
import { relative } from "@/lib/format";
import { errorMessage } from "@/lib/http";
import { queryKeys } from "@/lib/queryKeys";
import type { Device, DeviceType } from "@/types/api";
import { devicesApi, type DevicePayload } from "./api";

const TYPES: DeviceType[] = ["car_wash", "barrier", "parking", "vacuum"];

/**
 * The device uid is picked from the unregistered pool rather than typed:
 * that is the whole point of the registry - you cannot register a terminal
 * that has never spoken to us.
 */
export const DeviceFormModal = ({
  open,
  device,
  companyId,
  siteId,
  onClose,
}: {
  open: boolean;
  device?: Device | null;
  companyId?: string;
  siteId?: string;
  onClose: () => void;
}) => {
  const [form] = Form.useForm<DevicePayload>();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const selectedCompanyId =
    Form.useWatch("companyId", form) ?? companyId ?? user?.companyId;

  const uids = useQuery({
    queryKey: queryKeys.unregisteredOptions,
    queryFn: registryApi.options,
    enabled: open && !device && isAdmin,
  });

  const companies = useQuery({
    queryKey: queryKeys.companies({ limit: 200 }),
    queryFn: () => companiesApi.list({ limit: 200 }),
    enabled: open && isAdmin && !companyId,
  });

  const sites = useQuery({
    queryKey: queryKeys.sites({ companyId: selectedCompanyId }),
    queryFn: () =>
      sitesApi.list({ companyId: selectedCompanyId ?? undefined, limit: 200 }),
    enabled: open && !!selectedCompanyId,
  });

  useEffect(() => {
    if (!open) return;
    if (device) {
      form.setFieldsValue({
        deviceUid: device.deviceUid,
        name: device.name,
        type: device.type,
        typeLabel: device.typeLabel ?? undefined,
        siteId: device.siteId ?? undefined,
        number: device.number ?? undefined,
        address: device.address ?? undefined,
        comment: device.comment ?? undefined,
        status: device.status,
        minTariff: Number.parseFloat(device.minTariff),
        percentTariff: Number.parseFloat(device.percentTariff),
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ companyId, siteId } as DevicePayload);
    }
  }, [open, device, companyId, siteId, form]);

  const mutation = useMutation({
    mutationFn: (values: DevicePayload) =>
      device ? devicesApi.update(device.id, values) : devicesApi.create(values),
    onSuccess: async () => {
      message.success(device ? t("devices.updated") : t("devices.registered"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["devices"] }),
        queryClient.invalidateQueries({ queryKey: ["unregistered-devices"] }),
        queryClient.invalidateQueries({ queryKey: ["sites"] }),
      ]);
      onClose();
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  return (
    <Modal
      open={open}
      width={720}
      title={
        device
          ? t("devices.editTitle", { name: device.name })
          : t("devices.register")
      }
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={mutation.isPending}
      okText={t("common.save")}
      cancelText={t("common.cancel")}
      destroyOnHidden
    >
      <Form<DevicePayload>
        form={form}
        layout="vertical"
        onFinish={(values) => mutation.mutate(values)}
        initialValues={{ type: "other", minTariff: 0, percentTariff: 0 }}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="deviceUid"
              label={t("devices.deviceId")}
              tooltip={t("devices.deviceIdTooltip")}
              rules={[
                { required: true, message: t("validation.pickDeviceId") },
              ]}
            >
              {device ? (
                <Input disabled />
              ) : (
                <Select
                  showSearch
                  loading={uids.isLoading}
                  placeholder={t("devices.pickFromPool")}
                  options={(uids.data ?? []).map((item) => ({
                    label: t("devices.seenRelative", {
                      uid: item.deviceUid,
                      when: relative(item.lastSeenAt, t("common.never")),
                    }),
                    value: item.deviceUid,
                  }))}
                  notFoundContent={t("devices.poolEmpty")}
                />
              )}
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="name"
              label={t("devices.name")}
              rules={[{ required: true, message: t("validation.required") }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="type" label={t("devices.type")}>
              <Select
                options={[
                  ...TYPES.map((value) => ({
                    label: t(`devices.types.${value}`),
                    value,
                  })),
                  { label: t("devices.types.otherPick"), value: "other" },
                ]}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="typeLabel"
              label={t("devices.customType")}
              tooltip={t("devices.customTypeTooltip")}
            >
              <Input placeholder={t("devices.customTypePlaceholder")} />
            </Form.Item>
          </Col>
          {isAdmin && !companyId && (
            <Col xs={24} md={12}>
              <Form.Item
                name="companyId"
                label={t("devices.company")}
                rules={[
                  { required: !device, message: t("validation.required") },
                ]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  disabled={!!device}
                  loading={companies.isLoading}
                  options={(companies.data?.items ?? []).map((company) => ({
                    label: company.name,
                    value: company.id,
                  }))}
                />
              </Form.Item>
            </Col>
          )}
          <Col xs={24} md={12}>
            <Form.Item name="siteId" label={t("devices.object")}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                loading={sites.isLoading}
                placeholder={t("devices.attachToObject")}
                options={(sites.data?.items ?? []).map((site) => ({
                  label: `${site.name} — ${site.address}`,
                  value: site.id,
                }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="minTariff"
              label={t("devices.minTariff")}
              tooltip={t("devices.minTariffTooltip")}
              rules={[{ required: true, message: t("validation.required") }]}
            >
              <InputNumber
                min={0}
                step={0.1}
                precision={2}
                style={{ width: "100%" }}
                addonAfter="GEL"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="percentTariff"
              label={t("devices.percentTariff")}
              tooltip={t("devices.percentTariffTooltip")}
              rules={[{ required: true, message: t("validation.required") }]}
            >
              <InputNumber
                min={0}
                max={100}
                step={0.5}
                precision={2}
                style={{ width: "100%" }}
                addonAfter="%"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="number"
              label={t("devices.number")}
              tooltip={t("devices.numberTooltip")}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="address"
              label={t("devices.address")}
              tooltip={t("devices.addressTooltip")}
            >
              <Input placeholder={t("devices.addressPlaceholder")} />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="comment" label={t("common.comment")}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

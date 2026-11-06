import {
  DeleteOutlined,
  PlusOutlined,
  PoweroffOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Steps,
  Switch,
  Table,
  Typography,
} from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errorMessage, keys, useInfo, type Device } from "./api";
import { ConnectionBadge, PaymentStatusTag } from "./badges";

dayjs.extend(relativeTime);

export const DevicesPage = () => {
  const { data: devices, isLoading } = useQuery({
    queryKey: keys.devices,
    queryFn: api.devices,
  });
  const { data: info } = useInfo();
  const [creating, setCreating] = useState(false);
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const power = useMutation({
    mutationFn: (device: Device) =>
      device.runtime.online
        ? api.disconnect(device.id)
        : api.connect(device.id),
    onError: (e) => {
      message.error(errorMessage(e));
    },
  });
  const remove = useMutation({
    mutationFn: (device: Device) => api.remove(device.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.devices }),
    onError: (e) => {
      message.error(errorMessage(e));
    },
  });

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card size="small">
        <Steps
          size="small"
          current={-1}
          items={[
            {
              title: "Create a device",
              description: "It connects and announces itself on the broker",
            },
            {
              title: "Register it in the panel",
              description: `Unregistered devices → pick ${info?.uidPrefix ?? "EMU-"}…`,
            },
            {
              title: "Command it from the panel",
              description:
                "Config, set amount, reconcile: watch them arrive here",
            },
            {
              title: "Pay from here",
              description: "The payment shows up in the panel's earnings",
            },
          ]}
        />
      </Card>

      <Card
        title="Virtual terminals"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreating(true)}
          >
            Create device
          </Button>
        }
      >
        <Table<Device>
          rowKey="id"
          loading={isLoading}
          dataSource={devices}
          pagination={false}
          locale={{ emptyText: "No virtual terminals yet" }}
          columns={[
            {
              title: "Device",
              render: (_, d) => (
                <Space direction="vertical" size={0}>
                  <Link to={`/devices/${d.id}`}>{d.name}</Link>
                  <Typography.Text code copyable>
                    {d.uid}
                  </Typography.Text>
                </Space>
              ),
            },
            { title: "MQTT", render: (_, d) => <ConnectionBadge device={d} /> },
            {
              title: "Terminal",
              render: (_, d) => <PaymentStatusTag device={d} />,
            },
            {
              title: "Config from server",
              render: (_, d) =>
                d.configReceivedAt ? (
                  <Typography.Text title={d.configReceivedAt}>
                    received {dayjs(d.configReceivedAt).fromNow()}
                  </Typography.Text>
                ) : (
                  <Typography.Text type="secondary">not yet</Typography.Text>
                ),
            },
            {
              title: "",
              align: "right",
              render: (_, d) => (
                <Space>
                  <Button
                    size="small"
                    icon={
                      d.runtime.online ? (
                        <PoweroffOutlined />
                      ) : (
                        <ThunderboltOutlined />
                      )
                    }
                    loading={power.isPending && power.variables?.id === d.id}
                    onClick={() => power.mutate(d)}
                  >
                    {d.runtime.online ? "Disconnect" : "Connect"}
                  </Button>
                  <Popconfirm
                    title={`Remove ${d.uid}?`}
                    description="It disconnects and its log is deleted. The platform keeps whatever it already recorded."
                    okText="Remove"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => remove.mutateAsync(d)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <CreateDeviceModal
        open={creating}
        onClose={() => setCreating(false)}
        prefix={info?.uidPrefix}
      />
    </Space>
  );
};

const CreateDeviceModal = ({
  open,
  onClose,
  prefix,
}: {
  open: boolean;
  onClose: () => void;
  prefix?: string;
}) => {
  const [form] = Form.useForm<{
    name: string;
    uidSuffix?: string;
    autoConnect: boolean;
  }>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const create = useMutation({
    mutationFn: api.create,
    onSuccess: (device) => {
      message.success(`${device.uid} created`);
      form.resetFields();
      onClose();
      navigate(`/devices/${device.id}`);
    },
    onError: (e) => {
      message.error(errorMessage(e));
    },
  });

  return (
    <Modal
      title="Create virtual terminal"
      open={open}
      onCancel={onClose}
      okText="Create"
      confirmLoading={create.isPending}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ autoConnect: true }}
        onFinish={(values) =>
          create.mutate({
            ...values,
            uidSuffix: values.uidSuffix?.trim() || undefined,
          })
        }
      >
        <Form.Item
          name="name"
          label="Name"
          rules={[{ required: true, max: 80 }]}
        >
          <Input placeholder="Car wash bay 1 (emulated)" autoFocus />
        </Form.Item>
        <Form.Item
          name="uidSuffix"
          label="Device uid"
          extra="Leave empty for a random one. The prefix is fixed so an emulated uid can never be a real terminal's."
          rules={[
            {
              pattern: /^[A-Za-z0-9_-]{1,40}$/,
              message: "A-Z a-z 0-9 _ - only",
            },
          ]}
        >
          <Input addonBefore={prefix ?? "EMU-"} placeholder="random" />
        </Form.Item>
        <Form.Item
          name="autoConnect"
          label="Connect to the broker now"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

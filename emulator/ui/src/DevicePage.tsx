import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PoweroffOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Radio,
  Result,
  Row,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  api,
  errorMessage,
  keys,
  lari,
  resultOptions,
  useProtocol,
  type Behaviour,
  type Device,
  type Protocol,
} from "./api";
import { ConnectionBadge, PaymentStatusTag } from "./badges";
import { FrameLog } from "./FrameLog";

const SUCCESS = 0x01;
const PAYMENT_VID = 0x81;

export const DevicePage = () => {
  const { id = "" } = useParams();
  const {
    data: device,
    isLoading,
    error,
  } = useQuery({
    queryKey: keys.device(id),
    queryFn: () => api.device(id),
  });
  const { data: protocol } = useProtocol();

  if (error) {
    return (
      <Result
        status="404"
        title="No such virtual terminal"
        subTitle={errorMessage(error)}
        extra={<Link to="/">Back to the list</Link>}
      />
    );
  }
  if (isLoading || !device) return <Card loading />;

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Link to="/">
        <ArrowLeftOutlined /> All virtual terminals
      </Link>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <TerminalCard device={device} />
            {device.runtime.pending && (
              <PendingCard device={device} protocol={protocol} />
            )}
            <SendCard device={device} protocol={protocol} />
            <BehaviourCard device={device} protocol={protocol} />
            <ConfigCard device={device} protocol={protocol} />
          </Space>
        </Col>
        <Col xs={24} xl={14}>
          <FrameLog deviceId={device.id} />
        </Col>
      </Row>
    </Space>
  );
};

/**
 * Run one terminal action, with the toast either way. The callbacks must not
 * return the toast: it is a thenable, and the mutation would stay pending
 * (button spinning) until the toast closes.
 */
const useAction = (success = "Sent") => {
  const { message } = App.useApp();
  return useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: () => {
      message.success(success);
    },
    onError: (e) => {
      message.error(errorMessage(e));
    },
  });
};

const TerminalCard = ({ device }: { device: Device }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const power = useAction(
    device.runtime.online ? "Disconnected" : "Connecting",
  );
  const rename = useAction("Renamed");
  const remove = useMutation({
    mutationFn: () => api.remove(device.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: keys.device(device.id) });
      message.success(`${device.uid} removed`);
      navigate("/");
    },
    onError: (e) => {
      message.error(errorMessage(e));
    },
  });
  const { runtime } = device;

  return (
    <Card>
      <Space direction="vertical" size={4} style={{ width: "100%" }}>
        <Typography.Title
          level={4}
          style={{ margin: 0 }}
          editable={{
            onChange: (name) =>
              name.trim() &&
              name !== device.name &&
              rename.mutate(() => api.update(device.id, { name })),
          }}
        >
          {device.name}
        </Typography.Title>
        <Typography.Text code copyable>
          {device.uid}
        </Typography.Text>
        <Space wrap style={{ marginTop: 8 }}>
          <ConnectionBadge device={device} />
          <PaymentStatusTag device={device} />
        </Space>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {runtime.connectedAt &&
            runtime.connected &&
            `Connected since ${dayjs(runtime.connectedAt).format("HH:mm:ss")}. `}
          {runtime.lastHeartbeatAt &&
            `Last heartbeat ${dayjs(runtime.lastHeartbeatAt).format("HH:mm:ss")}. `}
          {device.behaviour.heartbeatSeconds === 0 && "Heartbeat off."}
        </Typography.Text>
        {runtime.online && !runtime.connected && runtime.lastError && (
          <Alert
            type="warning"
            showIcon
            message={`Broker: ${runtime.lastError}`}
          />
        )}
        <Space style={{ marginTop: 8 }}>
          <Button
            type={runtime.online ? "default" : "primary"}
            icon={
              runtime.online ? <PoweroffOutlined /> : <ThunderboltOutlined />
            }
            loading={power.isPending}
            onClick={() =>
              power.mutate(() =>
                runtime.online
                  ? api.disconnect(device.id)
                  : api.connect(device.id),
              )
            }
          >
            {runtime.online ? "Disconnect" : "Connect"}
          </Button>
          <Popconfirm
            title={`Remove ${device.uid}?`}
            description="It disconnects and its log is deleted. The platform keeps whatever it already recorded."
            okText="Remove"
            okButtonProps={{ danger: true }}
            onConfirm={() => remove.mutateAsync()}
          >
            <Button danger icon={<DeleteOutlined />}>
              Remove
            </Button>
          </Popconfirm>
        </Space>
      </Space>
    </Card>
  );
};

/** The server sent 0x50 / 0x51 and the terminal is waiting to answer. */
const PendingCard = ({
  device,
  protocol,
}: {
  device: Device;
  protocol?: Protocol;
}) => {
  const pending = device.runtime.pending!;
  const auto = device.behaviour.mode === "auto";
  const autoResult =
    pending.kind === "payment"
      ? device.behaviour.paymentResult
      : device.behaviour.reconciliationResult;
  const [result, setResult] = useState<number>(SUCCESS);
  const answer = useAction("Answered");

  return (
    <Card style={{ borderColor: "#c026d3" }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Typography.Text strong>
          {pending.kind === "payment"
            ? `The server asked this terminal to charge ${lari(pending.amountTetri)}`
            : "The server asked this terminal to reconcile"}
        </Typography.Text>
        <Typography.Text type="secondary">
          {auto
            ? `Auto mode: answers "${protocol?.results[autoResult] ?? autoResult}" after ${device.behaviour.responseDelayMs} ms, or answer now:`
            : "Manual mode: waiting for your answer, like a customer at the card reader."}
        </Typography.Text>
        <Space.Compact style={{ width: "100%" }}>
          <Select
            style={{ flex: 1 }}
            value={result}
            onChange={setResult}
            options={resultOptions(protocol)}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={answer.isPending}
            onClick={() => answer.mutate(() => api.complete(device.id, result))}
          >
            Send answer
          </Button>
        </Space.Compact>
      </Space>
    </Card>
  );
};

const SendCard = ({
  device,
  protocol,
}: {
  device: Device;
  protocol?: Protocol;
}) => {
  const send = useAction();
  const results = resultOptions(protocol);
  const operations = (protocol?.vids ?? [])
    .filter(
      (d) => protocol?.operationVids.includes(d.vid) && d.vid !== PAYMENT_VID,
    )
    .map((d) => ({
      value: d.vid,
      label: `${d.label} (0x${d.vid.toString(16).toUpperCase()})`,
    }));
  const offline = !device.runtime.connected;
  const tetri = (gel: number) => Math.round(gel * 100);

  return (
    <Card title="Send an event to the server">
      {offline && (
        <Alert
          type="info"
          showIcon
          message="Connect the terminal to send events."
          style={{ marginBottom: 12 }}
        />
      )}
      <Tabs
        items={[
          {
            key: "payment",
            label: "Payment",
            children: (
              <Form
                layout="vertical"
                disabled={offline}
                initialValues={{ amount: 5, result: SUCCESS }}
                onFinish={(v: { amount: number; result: number }) =>
                  send.mutate(() =>
                    api.payment(device.id, tetri(v.amount), v.result),
                  )
                }
              >
                <Typography.Paragraph type="secondary">
                  A customer paying at the terminal: 0x80 amount + 0x81 result
                  in one frame.
                </Typography.Paragraph>
                <Space align="end" wrap>
                  <Form.Item
                    name="amount"
                    label="Amount (GEL)"
                    rules={[{ required: true }]}
                  >
                    <InputNumber
                      min={0.01}
                      max={100}
                      step={0.5}
                      precision={2}
                    />
                  </Form.Item>
                  <Form.Item
                    name="result"
                    label="Result"
                    style={{ minWidth: 220 }}
                  >
                    <Select options={results} />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<SendOutlined />}
                      loading={send.isPending}
                    >
                      Send payment
                    </Button>
                  </Form.Item>
                </Space>
              </Form>
            ),
          },
          {
            key: "status",
            label: "Status",
            children: (
              <Space direction="vertical">
                <Typography.Text type="secondary">
                  0x82 payment status.
                </Typography.Text>
                <Space>
                  <Button
                    disabled={offline}
                    onClick={() =>
                      send.mutate(() => api.status(device.id, "idle"))
                    }
                  >
                    Idle
                  </Button>
                  <Button
                    disabled={offline}
                    onClick={() =>
                      send.mutate(() => api.status(device.id, "busy"))
                    }
                  >
                    Busy
                  </Button>
                </Space>
              </Space>
            ),
          },
          {
            key: "operation",
            label: "Operation",
            children: (
              <Form
                layout="vertical"
                disabled={offline}
                initialValues={{ vid: 0xbb, result: SUCCESS }}
                onFinish={(v: {
                  vid: number;
                  result: number;
                  amount?: number;
                }) =>
                  send.mutate(() =>
                    api.operation(device.id, {
                      vid: v.vid,
                      result: v.result,
                      amountTetri: v.amount ? tetri(v.amount) : undefined,
                    }),
                  )
                }
              >
                <Form.Item name="vid" label="Operation">
                  <Select options={operations} />
                </Form.Item>
                <Space align="end" wrap>
                  <Form.Item
                    name="result"
                    label="Result"
                    style={{ minWidth: 220 }}
                  >
                    <Select options={results} />
                  </Form.Item>
                  <Form.Item name="amount" label="Amount (GEL, optional)">
                    <InputNumber
                      min={0.01}
                      max={100}
                      step={0.5}
                      precision={2}
                    />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<SendOutlined />}
                      loading={send.isPending}
                    >
                      Send
                    </Button>
                  </Form.Item>
                </Space>
              </Form>
            ),
          },
          {
            key: "raw",
            label: "Raw hex",
            children: (
              <Form
                layout="vertical"
                disabled={offline}
                onFinish={(v: { hex: string }) =>
                  send.mutate(() => api.raw(device.id, v.hex))
                }
              >
                <Typography.Paragraph type="secondary">
                  Exact bytes, spec or not, including the 4-byte clock. Try{" "}
                  <Typography.Text code copyable>
                    6a e8 77 ce 80 02 01 f4 81 01 01
                  </Typography.Text>{" "}
                  (amount written big-endian): the listener should refuse to
                  book it.
                </Typography.Paragraph>
                <Form.Item
                  name="hex"
                  rules={[
                    { required: true },
                    {
                      pattern: /^(\s*[0-9a-fA-F]{2})+\s*$/,
                      message: "Whole bytes in hex",
                    },
                  ]}
                >
                  <Input.TextArea
                    rows={2}
                    style={{ fontFamily: "monospace" }}
                  />
                </Form.Item>
                <Button
                  htmlType="submit"
                  icon={<SendOutlined />}
                  loading={send.isPending}
                >
                  Send raw frame
                </Button>
              </Form>
            ),
          },
        ]}
      />
    </Card>
  );
};

const BehaviourCard = ({
  device,
  protocol,
}: {
  device: Device;
  protocol?: Protocol;
}) => {
  const save = useAction("Behaviour saved");
  const [form] = Form.useForm<Behaviour>();
  const mode = Form.useWatch("mode", form) ?? device.behaviour.mode;

  return (
    <Card title="How it answers the server">
      <Form
        form={form}
        layout="vertical"
        initialValues={device.behaviour}
        onFinish={(behaviour) =>
          save.mutate(() => api.update(device.id, { behaviour }))
        }
      >
        <Form.Item
          name="mode"
          extra={
            mode === "auto"
              ? "Set-amount (0x50) and reconcile (0x51) are answered by themselves."
              : "Set-amount and reconcile wait for you to answer from this page."
          }
        >
          <Radio.Group
            optionType="button"
            options={[
              { value: "auto", label: "Auto" },
              { value: "manual", label: "Manual" },
            ]}
          />
        </Form.Item>
        <Space wrap>
          <Form.Item
            name="paymentResult"
            label="Answer to set-amount"
            style={{ minWidth: 220 }}
          >
            <Select
              options={resultOptions(protocol)}
              disabled={mode !== "auto"}
            />
          </Form.Item>
          <Form.Item
            name="reconciliationResult"
            label="Answer to reconcile"
            style={{ minWidth: 220 }}
          >
            <Select
              options={resultOptions(protocol)}
              disabled={mode !== "auto"}
            />
          </Form.Item>
          <Form.Item name="responseDelayMs" label="Answer after (ms)">
            <InputNumber
              min={0}
              max={60000}
              step={500}
              disabled={mode !== "auto"}
            />
          </Form.Item>
          <Form.Item
            name="heartbeatSeconds"
            label="Heartbeat every (s)"
            tooltip="0 = off. Sends the current 0x82 status on events/heartbeat, keeping it online in the panel."
            rules={[
              {
                validator: (_, v: number) =>
                  v === 0 || (v >= 5 && v <= 3600)
                    ? Promise.resolve()
                    : Promise.reject(new Error("0, or 5-3600")),
              },
            ]}
          >
            <InputNumber min={0} max={3600} />
          </Form.Item>
        </Space>
        <Button htmlType="submit" loading={save.isPending}>
          Save behaviour
        </Button>
      </Form>
    </Card>
  );
};

/** Config VIDs 0x01-0x08 as the server last pushed them. */
const ConfigCard = ({
  device,
  protocol,
}: {
  device: Device;
  protocol?: Protocol;
}) => {
  const definitions = (protocol?.vids ?? []).filter((d) => d.kind === "config");
  const received = device.config;

  return (
    <Card
      title="Config from the server"
      extra={
        device.configReceivedAt ? (
          <Typography.Text type="secondary" title={device.configReceivedAt}>
            received {dayjs(device.configReceivedAt).format("DD MMM HH:mm:ss")}
          </Typography.Text>
        ) : (
          <Tag>never received</Tag>
        )
      }
    >
      {!received && (
        <Typography.Paragraph type="secondary">
          Running on spec defaults. Register this uid in the panel and save its
          terminal config there; it lands here.
        </Typography.Paragraph>
      )}
      <Descriptions size="small" column={1} bordered>
        {definitions.map((d) => {
          const value = received?.[d.key] ?? d.default;
          const mode =
            d.key === "operationMode"
              ? protocol?.operationModes[String(value)]
              : null;
          return (
            <Descriptions.Item
              key={d.key}
              label={`${d.label} · 0x${d.vid.toString(16).padStart(2, "0")}`}
            >
              <Typography.Text type={received ? undefined : "secondary"}>
                {value}
                {mode ? ` (${mode})` : ""}
                {d.key === "countryCode" && value !== undefined
                  ? ` · 0x${value.toString(16).toUpperCase()}`
                  : ""}
              </Typography.Text>
            </Descriptions.Item>
          );
        })}
      </Descriptions>
    </Card>
  );
};

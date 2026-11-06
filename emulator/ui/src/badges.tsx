import { Badge, Tag, Tooltip } from "antd";
import { lari, type Device } from "./api";

/** Connected / connecting / off, with the broker error on hover. */
export const ConnectionBadge = ({ device }: { device: Device }) => {
  const { connected, online, lastError } = device.runtime;
  if (connected) return <Badge status="success" text="Connected" />;
  if (online) {
    return (
      <Tooltip title={lastError ?? "Waiting for the broker"}>
        <Badge status="processing" color="orange" text="Connecting…" />
      </Tooltip>
    );
  }
  return <Badge status="default" text="Off" />;
};

export const PaymentStatusTag = ({ device }: { device: Device }) => {
  const { paymentStatus, pending } = device.runtime;
  return (
    <>
      <Tag color={paymentStatus === "busy" ? "orange" : "green"}>
        {paymentStatus === "busy" ? "Busy" : "Idle"}
      </Tag>
      {pending && (
        <Tag color="magenta">
          {pending.kind === "payment"
            ? `Charging ${lari(pending.amountTetri)}`
            : "Reconciling"}
        </Tag>
      )}
    </>
  );
};

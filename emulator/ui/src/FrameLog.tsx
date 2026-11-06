import { ClearOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Empty,
  Popconfirm,
  Segmented,
  Space,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { api, keys, type Frame } from "./api";

const DIRECTION = {
  in: { color: "blue", label: "← from server" },
  out: { color: "green", label: "→ to server" },
  note: { color: "default", label: "• terminal" },
} as const;

/** Newest first; fed live by the stream (see stream.ts). */
export const FrameLog = ({ deviceId }: { deviceId: string }) => {
  const [filter, setFilter] = useState<"all" | "frames">("all");
  const queryClient = useQueryClient();
  const { data: frames, isLoading } = useQuery({
    queryKey: keys.frames(deviceId),
    queryFn: () => api.frames(deviceId),
    staleTime: Infinity,
  });
  const clear = useMutation({
    mutationFn: () => api.clearFrames(deviceId),
    onSuccess: () =>
      queryClient.setQueryData<Frame[]>(keys.frames(deviceId), []),
  });

  const shown = (frames ?? []).filter(
    (f) => filter === "all" || f.direction !== "note",
  );

  return (
    <Card
      title="Live log"
      loading={isLoading}
      extra={
        <Space>
          <Segmented
            size="small"
            value={filter}
            onChange={(v) => setFilter(v as "all" | "frames")}
            options={[
              { label: "Everything", value: "all" },
              { label: "Frames only", value: "frames" },
            ]}
          />
          <Popconfirm
            title="Clear this device's log?"
            onConfirm={() => clear.mutate()}
          >
            <Button size="small" icon={<ClearOutlined />}>
              Clear
            </Button>
          </Popconfirm>
        </Space>
      }
      styles={{ body: { maxHeight: 720, overflowY: "auto", padding: 0 } }}
    >
      {!shown.length && (
        <Empty style={{ padding: 32 }} description="Nothing yet" />
      )}
      {shown.map((frame) => (
        <div
          key={frame.id}
          style={{
            padding: "8px 16px",
            borderBottom: "1px solid #f0f0f0",
            background: frame.direction === "note" ? "#fafafa" : undefined,
          }}
        >
          <Space size={8} wrap>
            <Typography.Text
              type="secondary"
              style={{ fontFamily: "monospace", fontSize: 12 }}
            >
              {dayjs(frame.at).format("HH:mm:ss.SSS")}
            </Typography.Text>
            <Tag color={DIRECTION[frame.direction].color}>
              {DIRECTION[frame.direction].label}
            </Tag>
            <Typography.Text strong={frame.direction !== "note"}>
              {frame.summary}
            </Typography.Text>
            {frame.records?.some((r) => r.problem) && (
              <Tag color="red">out of spec</Tag>
            )}
          </Space>
          {frame.hex && (
            <div style={{ marginTop: 2 }}>
              <Typography.Text
                type="secondary"
                copyable={{ text: frame.hex }}
                style={{ fontFamily: "monospace", fontSize: 12 }}
              >
                {frame.topic} · {frame.hex.replace(/(..)/g, "$1 ").trim()}
              </Typography.Text>
            </div>
          )}
        </div>
      ))}
    </Card>
  );
};

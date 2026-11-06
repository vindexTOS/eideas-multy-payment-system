import { ApiOutlined, LogoutOutlined } from "@ant-design/icons";
import {
  Button,
  Layout as AntLayout,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { Link, Outlet } from "react-router-dom";
import { useInfo } from "./api";
import { useAuth } from "./auth";
import { useLiveStream } from "./stream";

export const Layout = () => {
  const { logout, signedIn } = useAuth();
  const { data: info } = useInfo();
  useLiveStream(signedIn);

  return (
    <AntLayout style={{ minHeight: "100vh" }}>
      <AntLayout.Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#1e1b4b",
          paddingInline: 24,
        }}
      >
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ApiOutlined style={{ color: "#c4b5fd", fontSize: 20 }} />
          <Typography.Text strong style={{ color: "#fff", fontSize: 16 }}>
            Eideas Terminal Emulator
          </Typography.Text>
        </Link>
        <Space size="middle">
          {info && (
            // Always visible: this is how nobody fires test payments at the
            // production listener without noticing.
            <Tooltip title="Broker and topic root every virtual terminal uses. Must match the listener's MQTT_URL and MQTT_ROOT_TOPIC.">
              <Tag color="purple" style={{ marginInlineEnd: 0 }}>
                {info.broker} · root <b>{info.rootTopic}</b>
              </Tag>
            </Tooltip>
          )}
          <Tag color="gold" style={{ marginInlineEnd: 0 }}>
            super admin{info ? ` · ${info.superAdmin}` : ""}
          </Tag>
          <Button icon={<LogoutOutlined />} onClick={logout} size="small">
            Sign out
          </Button>
        </Space>
      </AntLayout.Header>
      <AntLayout.Content
        style={{ padding: 24, maxWidth: 1440, width: "100%", margin: "0 auto" }}
      >
        <Outlet />
      </AntLayout.Content>
    </AntLayout>
  );
};

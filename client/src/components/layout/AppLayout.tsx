import {
  ApiOutlined,
  BankOutlined,
  BarChartOutlined,
  CreditCardOutlined,
  DesktopOutlined,
  GlobalOutlined,
  LogoutOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Dropdown, Layout, Menu, Tag, Typography } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { useLanguage } from "@/i18n/useLanguage";
import type { Language } from "@/i18n";
import type { UserRole } from "@/types/api";

interface NavItem {
  key: string;
  icon: React.ReactNode;
  /** Translation key, resolved at render so it follows the language switch. */
  labelKey: string;
  roles: UserRole[];
}

const ALL: UserRole[] = ["admin", "company", "manager"];

const NAV: NavItem[] = [
  {
    key: "/companies",
    icon: <BankOutlined />,
    labelKey: "nav.companies",
    roles: ALL,
  },
  {
    key: "/devices",
    icon: <DesktopOutlined />,
    labelKey: "nav.devices",
    roles: ALL,
  },
  {
    key: "/earnings",
    icon: <BarChartOutlined />,
    labelKey: "nav.earnings",
    roles: ALL,
  },
  {
    key: "/payments",
    icon: <CreditCardOutlined />,
    labelKey: "nav.payments",
    roles: ALL,
  },
  {
    key: "/unregistered-devices",
    icon: <ApiOutlined />,
    labelKey: "nav.unregistered",
    roles: ["admin"],
  },
  {
    key: "/users",
    icon: <TeamOutlined />,
    labelKey: "nav.users",
    roles: ["admin", "company"],
  },
];

export const AppLayout = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const items = useMemo(
    () =>
      NAV.filter((item) => !user || item.roles.includes(user.role)).map(
        ({ key, icon, labelKey }) => ({ key, icon, label: t(labelKey) }),
      ),
    [user, t],
  );

  // Highlight the section, not the exact url: /companies/:id/sites/:id still
  // belongs to Companies.
  const selected = NAV.map((item) => item.key).filter((key) =>
    location.pathname.startsWith(key),
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Sider
        breakpoint="lg"
        collapsedWidth={64}
        theme="dark"
        width={224}
      >
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 16px",
            color: "#fff",
            fontWeight: 600,
            letterSpacing: 0.3,
          }}
        >
          <CreditCardOutlined />
          <span>Eideas Pay</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          items={items}
          selectedKeys={selected}
          onClick={({ key }) => navigate(key)}
        />
      </Layout.Sider>

      <Layout>
        <Layout.Header
          style={{
            background: "#fff",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 12,
            paddingInline: 24,
          }}
        >
          {user?.companyName && <Tag color="blue">{user.companyName}</Tag>}

          <Dropdown
            menu={{
              selectedKeys: [language],
              items: [
                { key: "ka", label: t("language.ka") },
                { key: "en", label: t("language.en") },
              ],
              onClick: ({ key }) => setLanguage(key as Language),
            }}
          >
            <Button type="text" icon={<GlobalOutlined />}>
              {language === "ka" ? t("language.ka") : t("language.en")}
            </Button>
          </Dropdown>

          <Dropdown
            menu={{
              items: [
                {
                  key: "role",
                  label: t("auth.signedInAs", {
                    role: t(`users.roles.${user?.role ?? "manager"}`),
                  }),
                  disabled: true,
                },
                { type: "divider" },
                {
                  key: "logout",
                  icon: <LogoutOutlined />,
                  label: t("auth.signOut"),
                  onClick: logout,
                },
              ],
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <Avatar size="small" style={{ background: "#2a78d6" }}>
                {user?.fullName?.[0]?.toUpperCase() ?? "?"}
              </Avatar>
              <Typography.Text>{user?.fullName}</Typography.Text>
            </div>
          </Dropdown>
        </Layout.Header>

        <Layout.Content style={{ padding: 24, background: "#f5f5f5" }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

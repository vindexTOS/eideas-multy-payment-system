import { GlobalOutlined, LockOutlined, UserOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Dropdown,
  Flex,
  Form,
  Input,
  Typography,
} from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import type { Language } from "@/i18n";
import { useLanguage } from "@/i18n/useLanguage";
import { errorMessage } from "@/lib/http";
import { useAuth } from "./useAuth";

interface LoginForm {
  email: string;
  password: string;
}

export const LoginPage = () => {
  const { user, login, loading } = useAuth();
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user && !loading)
    return <Navigate to={location.state?.from ?? "/"} replace />;

  const onFinish = async (values: LoginForm) => {
    setSubmitting(true);
    setError(null);
    try {
      await login(values.email, values.password);
      navigate(location.state?.from ?? "/", { replace: true });
    } catch (err) {
      setError(errorMessage(err, t("auth.failed")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        padding: 24,
      }}
    >
      <Card style={{ width: 420, maxWidth: "100%" }}>
        <Flex align="flex-start" justify="space-between" gap={8}>
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              {t("auth.appName")}
            </Typography.Title>
            <Typography.Paragraph type="secondary">
              {t("auth.subtitle")}
            </Typography.Paragraph>
          </div>
          {/* Language is switchable before signing in, not only after. */}
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
            <Button type="text" size="small" icon={<GlobalOutlined />}>
              {language === "ka" ? "ქარ" : "EN"}
            </Button>
          </Dropdown>
        </Flex>

        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form<LoginForm>
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
        >
          <Form.Item
            name="email"
            label={t("auth.email")}
            rules={[
              {
                required: true,
                type: "email",
                message: t("validation.emailRequired"),
              },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="admin@eideas.io"
              autoComplete="username"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label={t("auth.password")}
            rules={[
              { required: true, message: t("validation.passwordRequired") },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            {t("auth.signIn")}
          </Button>
        </Form>
      </Card>
    </div>
  );
};

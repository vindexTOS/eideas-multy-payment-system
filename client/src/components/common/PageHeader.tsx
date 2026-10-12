import { Breadcrumb, Flex, Space, Typography } from "antd";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface Crumb {
  title: string;
  to?: string;
}

export const PageHeader = ({
  title,
  subtitle,
  crumbs = [],
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
}) => (
  <div style={{ marginBottom: 20 }}>
    {crumbs.length > 0 && (
      <Breadcrumb
        style={{ marginBottom: 8 }}
        items={crumbs.map((crumb) => ({
          title: crumb.to ? (
            <Link to={crumb.to}>{crumb.title}</Link>
          ) : (
            crumb.title
          ),
        }))}
      />
    )}
    <Flex align="center" justify="space-between" gap={16} wrap>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {subtitle && (
          <Typography.Text type="secondary">{subtitle}</Typography.Text>
        )}
      </div>
      {actions && <Space wrap>{actions}</Space>}
    </Flex>
  </div>
);

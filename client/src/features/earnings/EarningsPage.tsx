import { useQuery } from "@tanstack/react-query";
import { Card, Select, Space } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { useAuth } from "@/features/auth/useAuth";
import { companiesApi } from "@/features/companies/api";
import { queryKeys } from "@/lib/queryKeys";
import { earningsApi } from "./api";
import { EarningsCharts } from "./EarningsCharts";

/** The company "earnings" page; an admin can additionally pick a company. */
export const EarningsPage = () => {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [months, setMonths] = useState(12);
  const [companyId, setCompanyId] = useState<string | undefined>();

  const companies = useQuery({
    queryKey: queryKeys.companies({ limit: 200 }),
    queryFn: () => companiesApi.list({ limit: 200 }),
    enabled: isAdmin,
  });

  const earnings = useQuery({
    queryKey: queryKeys.earnings({ months, companyId }),
    queryFn: () => earningsApi.series({ months, companyId }),
  });

  const monthOptions = [6, 12, 24].map((count) => ({
    label: t("earnings.lastMonths", { count }),
    value: count,
  }));

  return (
    <>
      <PageHeader
        title={t("earnings.title")}
        subtitle={t("earnings.subtitle")}
        actions={
          <Space wrap>
            {isAdmin && (
              <Select
                allowClear
                style={{ minWidth: 220 }}
                placeholder={t("earnings.allCompanies")}
                loading={companies.isLoading}
                value={companyId}
                onChange={setCompanyId}
                options={(companies.data?.items ?? []).map((company) => ({
                  label: company.name,
                  value: company.id,
                }))}
              />
            )}
            <Select
              style={{ width: 190 }}
              value={months}
              onChange={setMonths}
              options={monthOptions}
            />
          </Space>
        }
      />
      <Card>
        <QueryBoundary isLoading={earnings.isPending} error={earnings.error}>
          {earnings.data && <EarningsCharts data={earnings.data} />}
        </QueryBoundary>
      </Card>
    </>
  );
};

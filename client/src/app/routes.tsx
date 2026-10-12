import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { CompaniesPage } from "@/features/companies/CompaniesPage";
import { CompanyDetailPage } from "@/features/companies/CompanyDetailPage";
import { DeviceDetailPage } from "@/features/devices/DeviceDetailPage";
import { DevicesPage } from "@/features/devices/DevicesPage";
import { EarningsPage } from "@/features/earnings/EarningsPage";
import { PaymentsPage } from "@/features/payments/PaymentsPage";
import { UnregisteredDevicesPage } from "@/features/registry/UnregisteredDevicesPage";
import { SiteDetailPage } from "@/features/sites/SiteDetailPage";
import { UsersPage } from "@/features/users/UsersPage";

/**
 * Drill-down mirrors the client's description:
 *   companies -> objects (sites) -> devices -> earnings
 */
export const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />

    <Route element={<RequireAuth />}>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/companies" replace />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="companies/:companyId" element={<CompanyDetailPage />} />
        <Route
          path="companies/:companyId/sites/:siteId"
          element={<SiteDetailPage />}
        />
        <Route path="sites/:siteId" element={<SiteDetailPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="devices/:deviceId" element={<DeviceDetailPage />} />
        <Route path="earnings" element={<EarningsPage />} />
        <Route path="payments" element={<PaymentsPage />} />
      </Route>
    </Route>

    <Route element={<RequireAuth roles={["admin", "company"]} />}>
      <Route element={<AppLayout />}>
        <Route path="users" element={<UsersPage />} />
      </Route>
    </Route>

    <Route element={<RequireAuth roles={["admin"]} />}>
      <Route element={<AppLayout />}>
        <Route
          path="unregistered-devices"
          element={<UnregisteredDevicesPage />}
        />
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

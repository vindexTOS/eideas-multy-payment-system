import { Spin } from "antd";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { UserRole } from "@/types/api";
import { useAuth } from "./useAuth";

/** Route guard. `roles` empty = any signed-in user. */
export const RequireAuth = ({ roles = [] }: { roles?: UserRole[] }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles.length && !roles.includes(user.role))
    return <Navigate to="/" replace />;

  return <Outlet />;
};

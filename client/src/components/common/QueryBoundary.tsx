import { Alert, Skeleton } from "antd";
import type { ReactNode } from "react";
import { errorMessage } from "@/lib/http";

/**
 * Consistent loading/error handling so no screen half-renders against
 * undefined data.
 */
export const QueryBoundary = ({
  isLoading,
  error,
  children,
  rows = 6,
}: {
  isLoading: boolean;
  error: unknown;
  children: ReactNode;
  rows?: number;
}) => {
  if (isLoading) return <Skeleton active paragraph={{ rows }} />;
  if (error)
    return <Alert type="error" showIcon message={errorMessage(error)} />;
  return <>{children}</>;
};

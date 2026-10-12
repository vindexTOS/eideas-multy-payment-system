import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp, ConfigProvider, theme } from "antd";
import { useState, type ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import "@/i18n";
import { useLanguage } from "@/i18n/useLanguage";

/**
 * One place for every cross-cutting provider. Query defaults are set here
 * so no screen has to repeat them.
 */
export const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Money data: short staleness, no refetch storm on tab focus.
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LocalisedConfig>
        <AntApp>
          <BrowserRouter>
            <AuthProvider>{children}</AuthProvider>
          </BrowserRouter>
        </AntApp>
      </LocalisedConfig>
    </QueryClientProvider>
  );
};

/**
 * Separate component so it can use the language hook: Ant Design's own
 * component text (pagination, empty states, popconfirms) has to follow the
 * same switch as our strings.
 */
const LocalisedConfig = ({ children }: { children: ReactNode }) => {
  const { antdLocale } = useLanguage();

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#2a78d6",
          borderRadius: 8,
          fontFamily:
            "'Inter', 'Segoe UI', 'BPG Nino Mtavruli', -apple-system, BlinkMacSystemFont, sans-serif",
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
};

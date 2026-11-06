import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp, ConfigProvider } from "antd";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, RequireAuth } from "./auth";
import { DevicePage } from "./DevicePage";
import { DevicesPage } from "./DevicesPage";
import { Layout } from "./Layout";
import { LoginPage } from "./LoginPage";

const queryClient = new QueryClient({
  defaultOptions: {
    // Live data arrives over the stream; no refetch storms on focus.
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 10_000 },
  },
});

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root is missing from index.html");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={{ token: { colorPrimary: "#7c3aed" } }}>
        <AntApp>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  element={
                    <RequireAuth>
                      <Layout />
                    </RequireAuth>
                  }
                >
                  <Route path="/" element={<DevicesPage />} />
                  <Route path="/devices/:id" element={<DevicePage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  </StrictMode>,
);

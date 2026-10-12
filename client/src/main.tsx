import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Providers } from "./app/Providers";
import { AppRoutes } from "./app/routes";
import "./index.css";

const container = document.getElementById("root");
if (!container)
  throw new Error("Root element #root is missing from index.html");

createRoot(container).render(
  <StrictMode>
    <Providers>
      <AppRoutes />
    </Providers>
  </StrictMode>,
);

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

// ── shapes, as the emulator server returns them ─────────────────────────────

export type Mode = "auto" | "manual";

export interface Behaviour {
  mode: Mode;
  paymentResult: number;
  reconciliationResult: number;
  responseDelayMs: number;
  heartbeatSeconds: number;
}

export type Pending =
  | { kind: "payment"; amountTetri: number; since: string }
  | { kind: "reconciliation"; since: string };

export interface Runtime {
  connected: boolean;
  online: boolean;
  paymentStatus: "idle" | "busy";
  pending: Pending | null;
  lastError: string | null;
  connectedAt: string | null;
  lastHeartbeatAt: string | null;
}

export interface Device {
  id: string;
  uid: string;
  name: string;
  autoConnect: boolean;
  behaviour: Behaviour;
  config: Record<string, number> | null;
  configReceivedAt: string | null;
  createdAt: string;
  runtime: Runtime;
}

export interface FrameRecord {
  vid: string;
  key: string | null;
  label: string;
  value: number | null;
  meaning: string | null;
  hex: string;
  problem: string | null;
}

export interface Frame {
  id: number;
  deviceId: string;
  direction: "in" | "out" | "note";
  topic: string | null;
  hex: string | null;
  summary: string;
  records: FrameRecord[] | null;
  at: string;
}

export interface Info {
  broker: string;
  rootTopic: string;
  uidPrefix: string;
  superAdmin: string;
}

export interface VidDefinition {
  vid: number;
  key: string;
  kind: "config" | "command" | "event";
  label: string;
  min?: number;
  max?: number;
  default?: number;
}

export interface Protocol {
  vids: VidDefinition[];
  results: Record<string, string>;
  operationModes: Record<string, string>;
  operationVids: number[];
}

// ── transport ───────────────────────────────────────────────────────────────

const TOKEN_KEY = "emulator.token";

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const http = axios.create({ baseURL: "/api", timeout: 20_000 });

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !error.config?.url?.includes("/auth/login")
    ) {
      window.dispatchEvent(new Event("emulator:unauthorized"));
    }
    return Promise.reject(error);
  },
);

export const errorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string | string[] })
      ?.message;
    if (Array.isArray(message)) return message.join(", ");
    return message ?? error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong";
};

// ── endpoints ───────────────────────────────────────────────────────────────

const data = <T>(promise: Promise<{ data: T }>): Promise<T> =>
  promise.then((r) => r.data);

export const api = {
  login: (email: string, password: string) =>
    data(
      http.post<{ accessToken: string; email: string }>("/auth/login", {
        email,
        password,
      }),
    ),
  info: () => data(http.get<Info>("/info")),
  protocol: () => data(http.get<Protocol>("/protocol")),
  devices: () => data(http.get<Device[]>("/devices")),
  device: (id: string) => data(http.get<Device>(`/devices/${id}`)),
  create: (body: { name: string; uidSuffix?: string; autoConnect: boolean }) =>
    data(http.post<Device>("/devices", body)),
  update: (
    id: string,
    body: { name?: string; behaviour?: Partial<Behaviour> },
  ) => data(http.patch<Device>(`/devices/${id}`, body)),
  remove: (id: string) => http.delete(`/devices/${id}`),
  connect: (id: string) => data(http.post<Device>(`/devices/${id}/connect`)),
  disconnect: (id: string) =>
    data(http.post<Device>(`/devices/${id}/disconnect`)),
  payment: (id: string, amountTetri: number, result: number) =>
    data(http.post<Device>(`/devices/${id}/payment`, { amountTetri, result })),
  status: (id: string, status: "idle" | "busy") =>
    data(http.post<Device>(`/devices/${id}/status`, { status })),
  operation: (
    id: string,
    body: { vid: number; result: number; amountTetri?: number },
  ) => data(http.post<Device>(`/devices/${id}/operation`, body)),
  raw: (id: string, hex: string) =>
    data(http.post<Device>(`/devices/${id}/raw`, { hex })),
  complete: (id: string, result: number) =>
    data(http.post<Device>(`/devices/${id}/complete`, { result })),
  frames: (id: string) =>
    data(
      http.get<Frame[]>(`/devices/${id}/frames`, { params: { limit: 300 } }),
    ),
  clearFrames: (id: string) => http.delete(`/devices/${id}/frames`),
};

export const keys = {
  info: ["info"] as const,
  protocol: ["protocol"] as const,
  devices: ["devices"] as const,
  device: (id: string) => ["device", id] as const,
  frames: (id: string) => ["frames", id] as const,
};

/** Static for the life of the server, so fetched once. */
export const useProtocol = () =>
  useQuery({
    queryKey: keys.protocol,
    queryFn: api.protocol,
    staleTime: Infinity,
  });

export const useInfo = () =>
  useQuery({ queryKey: keys.info, queryFn: api.info, staleTime: Infinity });

/** Result codes as Select options: "Success (0x01)". */
export const resultOptions = (protocol: Protocol | undefined) =>
  Object.entries(protocol?.results ?? {}).map(([code, label]) => ({
    value: Number(code),
    label: `${label} (0x${Number(code).toString(16).padStart(2, "0").toUpperCase()})`,
  }));

export const lari = (tetri: number): string =>
  `${(tetri / 100).toFixed(2)} GEL`;

/** One place for cache keys, so invalidation never guesses. */
export const queryKeys = {
  profile: ["profile"] as const,
  companies: (params?: unknown) => ["companies", params ?? {}] as const,
  company: (id: string) => ["company", id] as const,
  sites: (params?: unknown) => ["sites", params ?? {}] as const,
  site: (id: string) => ["site", id] as const,
  devices: (params?: unknown) => ["devices", params ?? {}] as const,
  device: (id: string) => ["device", id] as const,
  deviceEarnings: (id: string, params?: unknown) =>
    ["device-earnings", id, params ?? {}] as const,
  earnings: (params?: unknown) => ["earnings", params ?? {}] as const,
  payments: (params?: unknown) => ["payments", params ?? {}] as const,
  users: (params?: unknown) => ["users", params ?? {}] as const,
  unregistered: (params?: unknown) =>
    ["unregistered-devices", params ?? {}] as const,
  unregisteredOptions: ["unregistered-devices", "options"] as const,
  mqttStatus: ["mqtt-status"] as const,
};

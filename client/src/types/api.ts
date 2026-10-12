/** Mirrors the server DTOs. Kept hand-written and small on purpose. */

export type UserRole = "admin" | "company" | "manager";
export type DeviceType =
  "car_wash" | "barrier" | "parking" | "vacuum" | "other";
export type DeviceStatus = "active" | "inactive" | "blocked";
export type PaymentSource = "terminal" | "app_balance" | "manual";
export type PaymentStatus = "pending" | "success" | "failed" | "reversed";

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface AuthProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId: string | null;
  companyName: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthProfile;
}

export interface Company {
  id: string;
  name: string;
  identificationCode: string;
  email: string;
  phone: string;
  legalAddress: string;
  bankAccount: string;
  comment?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CompanySummary extends Company {
  siteCount: number;
  deviceCount: number;
  monthEarnings: number;
  monthCommission: number;
}

export interface Site {
  id: string;
  name: string;
  address: string;
  city: string | null;
  latitude: string | null;
  longitude: string | null;
  comment: string | null;
  isActive: boolean;
  companyId: string;
  createdAt: string;
}

export interface SiteSummary {
  id: string;
  name: string;
  address: string;
  city: string | null;
  companyId: string;
  companyName?: string;
  isActive: boolean;
  deviceCount: number;
  monthEarnings: number;
  monthCommission: number;
  createdAt: string;
}

export interface Device {
  id: string;
  deviceUid: string;
  name: string;
  type: DeviceType;
  typeLabel: string | null;
  minTariff: string;
  percentTariff: string;
  number: string | null;
  address: string | null;
  comment: string | null;
  status: DeviceStatus;
  lastSeenAt: string | null;
  companyId: string;
  siteId: string | null;
  createdAt: string;
}

export interface DeviceSummary {
  id: string;
  deviceUid: string;
  name: string;
  type: DeviceType;
  typeLabel: string | null;
  status: DeviceStatus;
  number: string | null;
  address: string | null;
  minTariff: number;
  percentTariff: number;
  companyId: string;
  companyName?: string;
  siteId: string | null;
  siteName?: string | null;
  lastSeenAt: string | null;
  monthEarnings: number;
  monthCommission: number;
  monthNet: number;
  createdAt: string;
}

export interface UnregisteredDevice {
  id: string;
  deviceUid: string;
  firstSeenAt: string;
  lastSeenAt: string;
  messageCount: number;
  lastTopic: string | null;
  lastPayload: Record<string, unknown> | null;
  ignored: boolean;
}

export interface Payment {
  id: string;
  amount: string;
  commission: string;
  netAmount: string;
  appliedRule: string;
  currency: string;
  source: PaymentSource;
  status: PaymentStatus;
  externalRef: string | null;
  paidAt: string;
  deviceId: string;
  companyId: string;
  siteId: string | null;
  device?: { id: string; name: string; deviceUid: string };
}

export interface EarningsMonth {
  month: string;
  total: number;
  commission: number;
  net: number;
  count: number;
}

export interface EarningsSeries {
  months: EarningsMonth[];
  totals: { total: number; commission: number; net: number; count: number };
  from: string;
  to: string;
  currency: string;
}

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  companyId: string | null;
  companyName?: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  deviceIds: string[];
  createdAt: string;
}

export interface MqttStatus {
  enabled: boolean;
  connected: boolean;
  url: string;
  rootTopic: string;
  subscribedTo: string | null;
  clientId: string | null;
  reconnects: number;
  lastError: string | null;
  router: {
    received: number;
    handled: number;
    failed: number;
    unknownDevices: number;
    lastMessageAt: string | null;
  };
}

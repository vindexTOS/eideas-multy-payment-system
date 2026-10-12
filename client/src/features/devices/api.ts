import { http } from "@/lib/http";
import type {
  Device,
  DeviceStatus,
  DeviceSummary,
  DeviceType,
  Paginated,
} from "@/types/api";

export interface DevicePayload {
  deviceUid: string;
  name: string;
  type?: DeviceType;
  typeLabel?: string;
  companyId?: string;
  siteId?: string;
  minTariff: number;
  percentTariff: number;
  number?: string;
  address?: string;
  comment?: string;
  status?: DeviceStatus;
}

export interface DeviceListParams {
  companyId?: string;
  siteId?: string;
  type?: DeviceType;
  status?: DeviceStatus;
  page?: number;
  limit?: number;
  search?: string;
}

export const devicesApi = {
  list: async (
    params: DeviceListParams = {},
  ): Promise<Paginated<DeviceSummary>> =>
    (await http.get<Paginated<DeviceSummary>>("/devices", { params })).data,

  get: async (id: string): Promise<Device> =>
    (await http.get<Device>(`/devices/${id}`)).data,

  create: async (payload: DevicePayload): Promise<Device> =>
    (await http.post<Device>("/devices", payload)).data,

  update: async (
    id: string,
    payload: Partial<DevicePayload>,
  ): Promise<Device> =>
    (await http.patch<Device>(`/devices/${id}`, payload)).data,

  remove: async (id: string): Promise<void> => {
    await http.delete(`/devices/${id}`);
  },
};

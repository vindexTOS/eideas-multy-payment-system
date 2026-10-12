import { http } from "@/lib/http";
import type { EarningsSeries } from "@/types/api";

export interface EarningsParams {
  companyId?: string;
  siteId?: string;
  deviceId?: string;
  from?: string;
  to?: string;
  months?: number;
}

export const earningsApi = {
  series: async (params: EarningsParams = {}): Promise<EarningsSeries> =>
    (await http.get<EarningsSeries>("/earnings", { params })).data,

  deviceSeries: async (
    deviceId: string,
    params: EarningsParams = {},
  ): Promise<EarningsSeries> =>
    (
      await http.get<EarningsSeries>(`/earnings/devices/${deviceId}`, {
        params,
      })
    ).data,

  siteSeries: async (
    siteId: string,
    params: EarningsParams = {},
  ): Promise<EarningsSeries> =>
    (await http.get<EarningsSeries>(`/earnings/sites/${siteId}`, { params }))
      .data,
};

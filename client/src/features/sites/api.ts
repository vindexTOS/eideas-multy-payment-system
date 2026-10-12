import { http } from "@/lib/http";
import type { Paginated, Site, SiteSummary } from "@/types/api";

export interface SitePayload {
  name: string;
  address: string;
  city?: string;
  comment?: string;
  isActive?: boolean;
  companyId?: string;
}

export const sitesApi = {
  list: async (
    params: {
      companyId?: string;
      page?: number;
      limit?: number;
      search?: string;
    } = {},
  ): Promise<Paginated<SiteSummary>> =>
    (await http.get<Paginated<SiteSummary>>("/sites", { params })).data,

  get: async (id: string): Promise<Site> =>
    (await http.get<Site>(`/sites/${id}`)).data,

  create: async (payload: SitePayload): Promise<Site> =>
    (await http.post<Site>("/sites", payload)).data,

  update: async (id: string, payload: Partial<SitePayload>): Promise<Site> =>
    (await http.patch<Site>(`/sites/${id}`, payload)).data,

  remove: async (id: string): Promise<void> => {
    await http.delete(`/sites/${id}`);
  },
};

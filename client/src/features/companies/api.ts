import { http } from "@/lib/http";
import type { Company, CompanySummary, Paginated } from "@/types/api";

export interface CompanyPayload {
  name: string;
  identificationCode: string;
  email: string;
  phone: string;
  legalAddress: string;
  bankAccount: string;
  comment?: string;
  isActive?: boolean;
}

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export const companiesApi = {
  list: async (params: ListParams = {}): Promise<Paginated<CompanySummary>> =>
    (await http.get<Paginated<CompanySummary>>("/companies", { params })).data,

  get: async (id: string): Promise<Company> =>
    (await http.get<Company>(`/companies/${id}`)).data,

  create: async (payload: CompanyPayload): Promise<Company> =>
    (await http.post<Company>("/companies", payload)).data,

  update: async (
    id: string,
    payload: Partial<CompanyPayload>,
  ): Promise<Company> =>
    (await http.patch<Company>(`/companies/${id}`, payload)).data,

  remove: async (id: string): Promise<void> => {
    await http.delete(`/companies/${id}`);
  },
};

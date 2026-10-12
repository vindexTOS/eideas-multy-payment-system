import { http } from "@/lib/http";
import type {
  Paginated,
  Payment,
  PaymentSource,
  PaymentStatus,
} from "@/types/api";

export interface PaymentListParams {
  companyId?: string;
  siteId?: string;
  deviceId?: string;
  status?: PaymentStatus;
  source?: PaymentSource;
  paidFrom?: string;
  paidTo?: string;
  page?: number;
  limit?: number;
}

export const paymentsApi = {
  list: async (params: PaymentListParams = {}): Promise<Paginated<Payment>> =>
    (await http.get<Paginated<Payment>>("/payments", { params })).data,

  create: async (payload: {
    deviceId: string;
    amount: number;
    paidAt?: string;
    externalRef?: string;
  }): Promise<Payment> => (await http.post<Payment>("/payments", payload)).data,

  reverse: async (id: string): Promise<Payment> =>
    (await http.patch<Payment>(`/payments/${id}/reverse`)).data,
};

import { http } from "@/lib/http";
import type { MqttStatus, Paginated, UnregisteredDevice } from "@/types/api";

export const registryApi = {
  list: async (
    params: { page?: number; limit?: number; search?: string } = {},
  ): Promise<Paginated<UnregisteredDevice>> =>
    (
      await http.get<Paginated<UnregisteredDevice>>("/unregistered-devices", {
        params,
      })
    ).data,

  /** Options for the create-device form's uid dropdown. */
  options: async (): Promise<UnregisteredDevice[]> =>
    (await http.get<UnregisteredDevice[]>("/unregistered-devices/options"))
      .data,

  ignore: async (id: string): Promise<void> => {
    await http.patch(`/unregistered-devices/${id}/ignore`);
  },

  remove: async (id: string): Promise<void> => {
    await http.delete(`/unregistered-devices/${id}`);
  },

  mqttStatus: async (): Promise<MqttStatus> =>
    (await http.get<MqttStatus>("/mqtt/status")).data,

  /** Dev helper: push a frame through the pipeline with no device present. */
  simulate: async (payload: {
    deviceUid: string;
    event?: string;
    payload?: Record<string, unknown>;
  }): Promise<{ topic: string }> =>
    (await http.post<{ topic: string }>("/mqtt/simulate", payload)).data,
};

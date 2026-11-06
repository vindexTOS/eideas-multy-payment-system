import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { http, keys, tokenStore, type Device, type Frame } from "./api";

type StreamEvent =
  | { type: "frame"; frame: Frame }
  | { type: "device"; device: Device }
  | { type: "removed"; deviceId: string };

const KEEP_FRAMES = 500;

/**
 * One EventSource for the whole app. It writes straight into the query cache,
 * so every screen updates live without polling.
 */
export const useLiveStream = (enabled: boolean) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = tokenStore.get();
    if (!enabled || !token) return;
    const source = new EventSource(
      `/api/stream?access_token=${encodeURIComponent(token)}`,
    );

    const parse = (event: MessageEvent<string>) =>
      JSON.parse(event.data) as StreamEvent;

    source.addEventListener("device", (event) => {
      const { device } = parse(event) as { device: Device };
      queryClient.setQueryData<Device>(keys.device(device.id), device);
      queryClient.setQueryData<Device[]>(keys.devices, (list) => {
        if (!list) return list;
        return list.some((d) => d.id === device.id)
          ? list.map((d) => (d.id === device.id ? device : d))
          : [device, ...list];
      });
    });

    source.addEventListener("removed", (event) => {
      const { deviceId } = parse(event) as { deviceId: string };
      queryClient.setQueryData<Device[]>(keys.devices, (list) =>
        list?.filter((d) => d.id !== deviceId),
      );
      queryClient.removeQueries({ queryKey: keys.device(deviceId) });
    });

    source.addEventListener("frame", (event) => {
      const { frame } = parse(event) as { frame: Frame };
      // Only into a log somebody has opened; others load fresh when opened.
      queryClient.setQueryData<Frame[]>(keys.frames(frame.deviceId), (list) =>
        list ? [frame, ...list].slice(0, KEEP_FRAMES) : list,
      );
    });

    // After a reconnect the cache may have missed events: refetch what is open.
    source.onopen = () => {
      void queryClient.invalidateQueries({ queryKey: keys.devices });
      void queryClient.invalidateQueries({ queryKey: ["device"] });
      void queryClient.invalidateQueries({ queryKey: ["frames"] });
    };

    // EventSource retries by itself; if the session is gone the 401 from
    // this probe sends the user back to the login screen.
    source.onerror = () => {
      void http.get("/auth/me").catch(() => undefined);
    };

    return () => source.close();
  }, [enabled, queryClient]);
};

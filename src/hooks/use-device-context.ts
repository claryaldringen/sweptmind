import { useMediaQuery } from "./use-media-query";

export type DeviceContext = "phone" | "computer";

export function useDeviceContext(): DeviceContext {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  return isDesktop ? "computer" : "phone";
}

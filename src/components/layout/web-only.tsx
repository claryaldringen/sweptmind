"use client";

import type { ReactNode } from "react";
import { useIsNativeApp } from "@/hooks/use-is-native-app";

/** Hides its content in the Android/iOS app — e.g. donations, which store rules don't allow. */
export function WebOnly({ children }: { children: ReactNode }) {
  return useIsNativeApp() ? null : children;
}
